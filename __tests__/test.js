'use strict';
const React = require('react');
const renderer = require('react-test-renderer');
const { chunk, chunks, preloadChunks, preloadReady, preloadAll } = require('../src');

function waitFor(delay) {
  return new Promise(resolve => {
    setTimeout(resolve, delay);
  });
}

function createLoader(delay, loader, error) {
  return () => {
    return waitFor(delay).then(() => {
      if (loader) {
        return loader();
      } else {
        throw error;
      }
    });
  };
}

function SingleImport({ chunk, ...rest }) {
  const { Imported, ...chunkState } = chunk;
  if (chunkState.hasLoaded) {
    return <Imported {...rest} />;
  }

  return <div>MyLoadingComponent {JSON.stringify(chunkState)}</div>;
}

// Allows '_' prefix to infer a named component
function lookupMapComponent(key, imports) {
  if (key.indexOf('_') === 0) {
    return imports[key][key.substring(1)];
  }

  return imports[key];
}

function MapImport({ chunk, ...rest }) {
  const { imported, ...chunkState } = chunk;
  const { isLoading, hasLoaded, error, importKeys } = chunkState;

  if (isLoading || error) {
    return <div>MyLoadingComponent {JSON.stringify(chunkState)}</div>;
  }

  if (hasLoaded) {
    return (
      <React.Fragment>
        {importKeys.map((key, idx) => {
          return React.createElement(lookupMapComponent(key, imported), { ...rest, key: idx })
        })}
      </React.Fragment>
    );
  }

  return null;
}

function MyComponent(props) {
  return <div>MyComponent {JSON.stringify(props)}</div>;
}

afterEach(async () => {
  try {
    await preloadAll();
  } catch (err) {}
});

describe('chunk', () => {
  test('missing import throws', async () => {
    expect(() => chunk({a: createLoader(400, () => MyComponent)})).toThrow();
  });

  test('render', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => MyComponent))(SingleImport);

    let component = renderer.create(<ChunkMyComponent prop="baz" />);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // success
  });

  test('loading success', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => MyComponent))(SingleImport);

    let component1 = renderer.create(<ChunkMyComponent prop="foo" />);

    expect(component1.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component1.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component1.toJSON()).toMatchSnapshot(); // loaded

    let component2 = renderer.create(<ChunkMyComponent prop="bar" />);

    expect(component2.toJSON()).toMatchSnapshot(); // reload
  });

  test('delay and timeout', async () => {
    let ChunkMyComponent = chunk(createLoader(300, () => MyComponent), {
      delay: 100,
      timeout: 200,
    })(SingleImport);

    let component1 = renderer.create(<ChunkMyComponent prop="foo" />);

    expect(component1.toJSON()).toMatchSnapshot(); // initial
    await waitFor(100);
    expect(component1.toJSON()).toMatchSnapshot(); // loading
    await waitFor(100);
    expect(component1.toJSON()).toMatchSnapshot(); // timed out
    await waitFor(100);
    expect(component1.toJSON()).toMatchSnapshot(); // loaded
  });

  test('loading error', async () => {
    let ChunkMyComponent = chunk(createLoader(400, null, new Error('test error')))(SingleImport);

    let component = renderer.create(<ChunkMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // errored
  });

  test('retryBackOff', async () => {
    const mockImport = jest.fn();
    mockImport
      .mockImplementationOnce(createLoader(300, null, new Error('1')))
      .mockImplementationOnce(createLoader(200, null, new Error('2')))
      .mockImplementationOnce(createLoader(200, () => MyComponent));

    let ChunkMyComponent = chunk(mockImport, {
      retryBackOff: [200, 300]
    })(SingleImport);

    let component1 = renderer.create(<ChunkMyComponent prop="foo" />);

    expect(component1.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component1.toJSON()).toMatchSnapshot(); // loading
    await waitFor(100);
    expect(component1.toJSON()).toMatchSnapshot(); // first retry - loading
    await waitFor(400);
    expect(component1.toJSON()).toMatchSnapshot(); // second retry - loading
    await waitFor(600);
    expect(component1.toJSON()).toMatchSnapshot(); // loaded
  });

  test('timeout and retryBackOff', async () => {
    const mockImport = jest.fn();
    mockImport
      .mockImplementationOnce(createLoader(300, null, new Error('1')))
      .mockImplementationOnce(createLoader(200, null, new Error('2')))
      .mockImplementationOnce(createLoader(800, () => MyComponent));

    let ChunkMyComponent = chunk(mockImport, {
      timeout: 400, // timeout for each import attempt
      retryBackOff: [200, 200]
    })(SingleImport);

    let component1 = renderer.create(<ChunkMyComponent prop="foo" />);

    expect(component1.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component1.toJSON()).toMatchSnapshot(); // loading
    await waitFor(300);
    expect(component1.toJSON()).toMatchSnapshot(); // first retry - loading
    await waitFor(400);
    expect(component1.toJSON()).toMatchSnapshot(); // second retry - loading
    await waitFor(400);
    expect(component1.toJSON()).toMatchSnapshot(); // timedOut (after all retry attempts)
    await waitFor(500);
    expect(component1.toJSON()).toMatchSnapshot(); // loaded
  });

  test('retry after error', async () => {
    const mockImport = jest.fn();
    mockImport
      .mockImplementationOnce(createLoader(300, null, new Error('1')))
      .mockImplementationOnce(createLoader(300, () => MyComponent));

    const RetryChild = ({ chunk, children, ...rest }) => {
      const { Imported, ...chunkState } = chunk;
      if (chunkState.hasLoaded) {
        return <Imported {...rest} />;
      }

      if (chunkState.error) {
        return React.cloneElement(children, chunkState);
      }

      return <div>MyLoadingComponent {JSON.stringify(chunkState)}</div>;
    };

    // Wrap the RetryChild with chunk HOC
    let ChunkMyComponent = chunk(mockImport)(RetryChild);

    // 'Child' component is required to enable '.reset()' to be invoked after error
    const Child = (props) => (<div>{JSON.stringify(props)}</div>);

    // Render
    let component1 = renderer.create(<ChunkMyComponent prop="foo"><Child /></ChunkMyComponent>);

    expect(component1.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component1.toJSON()).toMatchSnapshot(); // loading
    await waitFor(100);
    expect(component1.toJSON()).toMatchSnapshot(); // error

    component1.root.findByType(Child).props.retry();

    expect(component1.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component1.toJSON()).toMatchSnapshot(); // loading
    await waitFor(100);
    expect(component1.toJSON()).toMatchSnapshot(); // loaded
  });


  test('server side rendering', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => require('../__fixtures__/component')))(SingleImport);

    await preloadAll();

    let component = renderer.create(<ChunkMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot(); // serverside
  });

  test('server side rendering es6', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => require('../__fixtures__/component.es6')))(SingleImport);

    await preloadAll();

    let component = renderer.create(<ChunkMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot(); // serverside
  });

  test('preload', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => MyComponent))(SingleImport);

    let promise = ChunkMyComponent.preload();
    await waitFor(200);

    let component1 = renderer.create(<ChunkMyComponent prop="bar" />);

    expect(component1.toJSON()).toMatchSnapshot(); // still loading...
    await promise;
    expect(component1.toJSON()).toMatchSnapshot(); // success

    let component2 = renderer.create(<ChunkMyComponent prop="baz" />);
    expect(component2.toJSON()).toMatchSnapshot(); // success
  });

  test('render without wrapped component', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => MyComponent))();

    let component = renderer.create(<ChunkMyComponent prop="foo" />);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // success
  });

  test('resolveDefaultImport with no wrapped component', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => ({ MyComponent })), {
      resolveDefaultImport: imported => imported.MyComponent
    })();

    let component = renderer.create(<ChunkMyComponent prop="foo" />);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // success
  });

  test('resolveDefaultImport', async () => {
    let ChunkMyComponent = chunk(createLoader(400, () => ({ MyComponent })), {
      resolveDefaultImport: imported => imported.MyComponent
    })(SingleImport);

    let component = renderer.create(<ChunkMyComponent prop="foo" />);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // success
  });

  describe('opts.hoistStatics: true', () => {
    test('applies statics in render lifecycle', async () => {
      const jestFn = jest.fn();
      MyComponent.myStatic = jestFn;
      let ChunkMyComponent = chunk(createLoader(400, () => MyComponent), { hoistStatics: true })();

      renderer.create(<ChunkMyComponent prop="foo" />);
      expect(ChunkMyComponent.myStatic).toBeUndefined(); // initial
      await waitFor(200);
      expect(ChunkMyComponent.myStatic).toBeUndefined(); // loading
      await waitFor(200);
      expect(ChunkMyComponent.myStatic).toBe(jestFn); // success
      delete MyComponent.myStatic;
    });

    test('applies statics when preloaded on server', async () => {
      const jestFn = jest.fn();
      MyComponent.myStatic = jestFn;
      let ChunkMyComponent = chunk(createLoader(400, () => MyComponent), { hoistStatics: true })();

      await preloadAll();

      expect(ChunkMyComponent.myStatic).toBe(jestFn);
      delete MyComponent.myStatic;
    });

    test('does not apply statics on error', async () => {
      let ChunkMyComponent = chunk(createLoader(400, () => { throw new Error(); }), {
        hoistStatics: true
      })();

      renderer.create(<ChunkMyComponent prop="foo" />);
      expect(ChunkMyComponent.myStatic).toBeUndefined(); // initial
      await waitFor(200);
      expect(ChunkMyComponent.myStatic).toBeUndefined(); // loading
      await waitFor(200);
      expect(ChunkMyComponent.myStatic).toBeUndefined(); // error
      delete MyComponent.myStatic;
    });

    test('throws on server `preloadAll()` when import is invalid', async () => {
      // eslint-disable-next-line no-unused-vars
      let ChunkMyComponent = chunk(createLoader(400, () => { throw new Error('import err'); }), {
        hoistStatics: true
      })();

      expect.assertions(1);
      try {
        await preloadAll();
      } catch (e) {
        expect(e.message).toEqual('import err');
      }
    });

    test('throws on `preloadChunks()` when import is invalid', async () => {
      let ChunkMyComponent = chunk(createLoader(400, () => { throw new Error('import err'); }), {
        hoistStatics: true
      })();

      expect.assertions(1);
      try {
        await preloadChunks([ChunkMyComponent.getChunkLoader()]);
      } catch (e) {
        expect(e.message).toEqual('import err');
      }
    });

    test('throws on static `preload()`', async () => {
      let ChunkMyComponent = chunk(createLoader(400, () => { throw new Error('import err'); }), {
        hoistStatics: true
      })();

      expect.assertions(1);
      try {
        await ChunkMyComponent.preload();
      } catch (e) {
        expect(e.message).toEqual('import err');
      }
    });

    test('`preloadChunks()` hoists statics before render', async () => {
      const jestFn = jest.fn();
      MyComponent.myStatic = jestFn;
      let ChunkMyComponent = chunk(createLoader(400, () => MyComponent), { hoistStatics: true })();

      await preloadChunks([ChunkMyComponent.getChunkLoader()]);

      expect(ChunkMyComponent.myStatic).toBe(jestFn);
      delete MyComponent.myStatic;
    });
  });
});

describe('chunks', () => {
  test('missing component throws', async () => {
    expect(() => chunks({a: createLoader(400, () => MyComponent)})()).toThrow();
  });

  test('missing import map throws', async () => {
    expect(() => chunks(createLoader(400, () => MyComponent))).toThrow();
  });

  test('using hoistStatics option throws', async () => {
    expect(() => chunks({ a: createLoader(400, () => MyComponent)}, { hoistStatics: true })).toThrow();
  });

  test('loads multiple imports', async () => {
    let ChunkMyComponent = chunks({
      a: createLoader(200, () => MyComponent),
      _MyComponent: createLoader(400, () => ({MyComponent})),
    })(MapImport);

    let component = renderer.create(<ChunkMyComponent prop="baz"/>);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // success
  });

  test('renders error when import fails', async () => {
    let ChunkMyComponent = chunks({
      a: createLoader(200, () => MyComponent),
      b: createLoader(400, null, new Error('test error'))
    })(MapImport);

    let component = renderer.create(<ChunkMyComponent prop="baz"/>);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // error
  });

  test('resolveDefaultImport', async () => {
    let ChunkMyComponent = chunks({
      a: createLoader(200, () => ({ aComponent: MyComponent })),
      b: createLoader(400, () => ({ bComponent: MyComponent })),
    }, {
      resolveDefaultImport: (imported, key) => imported[key + 'Component']
    })(MapImport);

    let component = renderer.create(<ChunkMyComponent prop="foo" />);
    expect(component.toJSON()).toMatchSnapshot(); // initial
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // loading
    await waitFor(200);
    expect(component.toJSON()).toMatchSnapshot(); // success
  });
});

describe('preloadReady', () => {
  beforeEach(() => {
    global.__webpack_modules__ = { 1: true, 2: true };
  });

  afterEach(() => {
    delete global.__webpack_modules__;
  });

  test('undefined', async () => {
    let ChunkMyComponent = chunk(createLoader(200, () => MyComponent))(SingleImport);

    await preloadReady();

    let component = renderer.create(<ChunkMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot();
  });

  test('one', async () => {
    let ChunkMyComponent = chunk(createLoader(200, () => MyComponent), {
      webpack: () => [1]
    })(SingleImport);

    await preloadReady();

    let component = renderer.create(<ChunkMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot();
  });

  test('many', async () => {
    let LoadableMyComponent = chunk(createLoader(200, () => MyComponent), {
      webpack: () => [1, 2],
    })(SingleImport);

    await preloadReady();

    let component = renderer.create(<LoadableMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot();
  });

  test('missing', async () => {
    let LoadableMyComponent = chunk(createLoader(200, () => MyComponent), {
      webpack: () => [1, 42],
    })(SingleImport);

    await preloadReady();

    let component = renderer.create(<LoadableMyComponent prop="baz" />);

    expect(component.toJSON()).toMatchSnapshot();
  });

  test('delay with 0', () => {
    let LoadableMyComponent = chunk(createLoader(300, () => MyComponent), {
      delay: 0,
      timeout: 200,
    })(SingleImport);

    let loadingComponent = renderer.create(<LoadableMyComponent prop="foo" />);
  
    expect(loadingComponent.toJSON()).toMatchSnapshot(); // loading
  });

  describe('hoistStatics: true', function () {
    test('applies statics when pre-loaded on client', async () => {
      const jestFn = jest.fn();
      MyComponent.myStatic = jestFn;
      let ChunkMyComponent = chunk(createLoader(400, () => MyComponent), {
        hoistStatics: true,
        webpack: () => [1, 2]
      })();

      await preloadReady();

      expect(ChunkMyComponent.myStatic).toBe(jestFn); // success
      delete MyComponent.myStatic;
    });

    test('throws on client `preloadReady()` when import is invalid', async () => {
      // eslint-disable-next-line no-unused-vars
      let ChunkMyComponent = chunk(createLoader(400, () => { throw new Error('import err'); }), {
        hoistStatics: true,
        webpack: () => [1, 2]
      })();

      expect.assertions(1);
      try {
        await preloadReady();
      } catch (e) {
        expect(e.message).toEqual('import err');
      }
    });
  });
});

test('preloadChunks', async () => {
  let LoadableMyComponent = chunk(createLoader(300, () => MyComponent))(SingleImport);
  let LoadableMapComponent = chunks({ MyComponent: createLoader(300, () => MyComponent) })(MapImport);

  const loaders = [LoadableMyComponent.getChunkLoader(), LoadableMapComponent.getChunkLoader()];

  await preloadChunks(loaders);

  let chunkComponent = renderer.create(<LoadableMyComponent prop="baz" />);
  let chunksComponent = renderer.create(<LoadableMapComponent prop="foo" />);

  expect(chunkComponent.toJSON()).toMatchSnapshot();
  expect(chunksComponent.toJSON()).toMatchSnapshot();
});
