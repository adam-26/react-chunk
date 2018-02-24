'use strict';
const React = require('react');
const PropTypes = require('prop-types');
const hoistNonReactStatics = require('hoist-non-react-statics');
const getDisplayName = require('react-display-name').default;

const ALL_INITIALIZERS = [];
const READY_INITIALIZERS = [];
const TIMEOUT_ERR = '_t';

function isWebpackReady(getModuleIds) {
  // eslint-disable-next-line no-undef
  if (typeof __webpack_modules__ !== 'object') {
    return false;
  }

  return getModuleIds().every(moduleId => {
    return (
      typeof moduleId !== 'undefined' &&
      // eslint-disable-next-line no-undef
      typeof __webpack_modules__[moduleId] !== 'undefined'
    );
  });
}

function retryLoader(resolve, reject, fn, retryOpts) {
  if (retryOpts.hasResolved) {
    return;
  }

  const invokeRetry = (err) => {
    const backOff = retryOpts.backOff;
    if (backOff.length) {
      const wait = backOff.shift();
      setTimeout(() => retryLoader(resolve, reject, fn, retryOpts), wait);
    }
    else if (err && !retryOpts.hasResolved) {
      retryOpts.hasResolved = true;
      reject(err);
    }
  };

  let _timeout;
  if (retryOpts.importTimeoutMs > 0) {
    _timeout = setTimeout(
      () => invokeRetry(retryOpts.throwOnImportError ? new Error(TIMEOUT_ERR) : null),
      retryOpts.importTimeoutMs);
  }

  fn()
    .then(res => {
      clearTimeout(_timeout);

      if (!retryOpts.hasResolved) {
        retryOpts.hasResolved = true;
        resolve(res)
      }
    })
    .catch((err) => {
      clearTimeout(_timeout);
      invokeRetry(err);
    });
}

function hasLoaded(state) {
  return !state.loading && !state.error && !!state.loaded;
}

function load(loader, options) {
  const promise = new Promise((resolve, reject) => {
    retryLoader(resolve, reject, loader, {
      backOff: options.retryBackOff.slice(),
      importTimeoutMs: options.importTimeoutMs,
      throwOnImportError: options.throwOnImportError,
      hasResolved: false
    });
  });

  const state = {
    loading: true,
    loaded: null,
    error: null,
  };

  state.promise = promise.then(loaded => {
    state.loading = false;
    state.loaded = loaded;
    return loaded;
  }).catch(err => {
    state.loading = false;
    state.error = err;
    throw err;
  });

  return state;
}

function loadMap(obj, options) {
  let state = {
    loading: false,
    loaded: {},
    error: null
  };

  let promises = [];

  try {
    Object.keys(obj).forEach(key => {
      let result = load(obj[key], options);

      if (!result.loading) {
        state.loaded[key] = result.loaded;
        state.error = result.error;
      } else {
        state.loading = true;
      }

      promises.push(result.promise);

      result.promise.then(res => {
        state.loaded[key] = res;
      }).catch(err => {
        state.error = err;
      });
    });
  } catch (err) {
    state.error = err;
  }

  state.promise = Promise.all(promises).then(res => {
    state.loading = false;
    return res;
  }).catch(err => {
    state.loading = false;
    throw err;
  });

  return state;
}

function resolve(obj) {
  return obj && obj.__esModule ? obj.default : obj;
}

function createChunkComponent(loadFn, options) {
  let opts = Object.assign({
    displayName: null,
    loader: null,
    hoist: false,
    resolveDefaultImport: (imported /*, importKey */) => resolve(imported),
    retryBackOff: [],
    delay: 200,
    timeout: null,
    webpack: null,
    modules: [],
  }, options);

  let res = null;
  let importTimeoutMs = typeof opts.timeout === 'number' ? opts.timeout : 0;

  // Adjust the UI timeout to include the retry backOff options
  if (opts.retryBackOff.length && typeof opts.timeout === 'number') {
    opts.timeout = opts.retryBackOff.reduce((total, ms) => {
      return total + ms;
    }, opts.timeout * opts.retryBackOff.length);
  }

  return (WrappedComponent) => {
    if (!opts.singleImport && typeof WrappedComponent === 'undefined') {
      throw new Error('`chunks({..})([missing])` requires a component to wrap.');
    }

    class ChunkComponent extends React.Component {
      constructor(props) {
        super(props);
        init(false);

        this.state = {
          error: res.error,
          pastDelay: false,
          timedOut: false,
          loading: res.loading,
          loaded: res.loaded
        };
      }

      static propTypes = {
        chunks: PropTypes.shape({
          addChunk: PropTypes.func.isRequired,
        })
      };

      static preload() {
        return init(true);
      }

      static getChunkLoader() {
        return init;
      }

      _loadChunks() {
        if (!res.loading) {
          return;
        }

        // clear timeouts - in case 'retry' is invoked before loading is complete
        this._clearTimeouts();

        if (typeof opts.delay === 'number') {
          if (opts.delay === 0) {
            this.setState({ pastDelay: true });
          } else {
            this._delay = setTimeout(() => {
              this.setState({ pastDelay: true });
            }, opts.delay);
          }
        }

        // This approach doesn't provide ms specific feedback, but implementation is really easy
        // - an alternative is to subscribe to: res.onTimeout(() => setState(...))
        // - if more accurate feedback is required, this can be implemented (w/'unsubscribe' on _clearTimeouts)
        if (typeof opts.timeout === 'number') {
          this._timeout = setTimeout(() => {
            this.setState({ timedOut: true });
          }, opts.timeout);
        }

        let update = () => {
          hoistStatics();

          if (!this._mounted) {
            return;
          }

          this.setState({
            error: res.error,
            loaded: res.loaded,
            loading: res.loading
          });

          this._clearTimeouts();
        };

        res.promise.then(() => {
          update();
        }).catch((/* err */) => {
          update();
        });
      }

      _clearTimeouts() {
        clearTimeout(this._delay);
        clearTimeout(this._timeout);
      }

      retry() {
        if (hasLoaded(this.state)) {
          return;
        }

        // reset state for retry
        res = null;
        this.setState({
          error: null,
          loading: true,
          loaded: {},
          pastDelay: false,
          timedOut: false,
        });

        // attempt to load the chunk(s) again
        const promise = init(false); // don't throw on err - this component can not support hoist (or logically, it'd never get here)
        this._loadChunks(); // update this components state
        return promise;
      }

      componentWillMount() {
        this._mounted = true;

        if (this.props.chunks && Array.isArray(opts.modules)) {
          opts.modules.forEach(moduleName => {
            this.props.chunks.addChunk(moduleName);
          });
        }

        this._loadChunks();
      }

      componentWillUnmount() {
        this._mounted = false;
        this._clearTimeouts();
      }

      render() {
        // eslint-disable-next-line no-unused-vars
        const { chunks, ...passThroughProps } = this.props;
        const importState = {
          isLoading: this.state.loading,
          hasLoaded: hasLoaded(this.state),
          pastDelay: this.state.pastDelay,
          timedOut: this.state.timedOut,
          error: this.state.error,
          loaded: this.state.loaded,
          retry: () => this.retry() // binds 'this'
        };

        if (opts.singleImport) {
          if (typeof WrappedComponent === 'undefined') {
            // no wrapped component
            if (importState.hasLoaded) {
              return React.createElement(opts.resolveDefaultImport(this.state.loaded), passThroughProps);
            }

            return null;
          }

          const componentProps = Object.assign({}, passThroughProps, {
            chunk: {
              ...importState,
              importKeys: [],
              Imported: importState.hasLoaded ? opts.resolveDefaultImport(importState.loaded) : null
            }
          });

          return React.createElement(WrappedComponent, componentProps);
        }

        let componentProps = Object.assign({}, passThroughProps, {
          chunk: {
            ...importState,
            importKeys: importState.hasLoaded ? Object.keys(this.state.loaded) : [],
            imported: {}
          }
        });

        if (importState.hasLoaded) {
          componentProps.chunk.imported = Object.keys(this.state.loaded).reduce((acc, importKey) => {
            acc[importKey] = opts.resolveDefaultImport(this.state.loaded[importKey], importKey);
            return acc;
          }, componentProps.chunk.imported);
        }

        return React.createElement(WrappedComponent, componentProps);
      }
    }

    // Apply chunks context to the chunk component
    const ChunkHOC = withChunks(ChunkComponent);

    const hasWrappedComponent = !(typeof WrappedComponent === 'undefined' || WrappedComponent === null);
    const wrappedComponentName = opts.displayName || (hasWrappedComponent ? getDisplayName(WrappedComponent) : '');
    ChunkHOC.displayName = opts.singleImport ? `chunk(${wrappedComponentName})` : `chunks(${wrappedComponentName})`;

    let _hoisted = false;
    function hoistStatics() {
      if (_hoisted || !opts.hoist) {
        return;
      }

      // Only hoist the static methods once
      if (!res.error && res.loaded && !_hoisted) {
        // Hoist is only supported by 'chunk'
        hoistNonReactStatics(ChunkHOC, opts.resolveDefaultImport(res.loaded));
        _hoisted = true;
      }
    }

    function init(throwOnImportError) {
      if (!res) {
        res = loadFn(opts.loader, {
          retryBackOff: Array.isArray(opts.retryBackOff) ? opts.retryBackOff : [],
          importTimeoutMs: importTimeoutMs,
          throwOnImportError: throwOnImportError
        });
      }

      if (opts.hoist) {
        res.promise = res.promise
          .then(() => { hoistStatics(); })
          .catch(err => {
            if (throwOnImportError === true) {
              // When pre-loading, any loader errors will be thrown immediately (ie: hoist, timeout options)
              // - hoisting implies use of static methods, which need to be available prior to rendering.
              throw err;
            }
          });
      }

      return res.promise;
    }

    ALL_INITIALIZERS.push(init);

    if (typeof opts.webpack === 'function') {
      READY_INITIALIZERS.push((throwOnImportError) => {
        if (isWebpackReady(opts.webpack)) {
          return init(throwOnImportError);
        }
      });
    }

    // Hoist any statics on the wrapped component
    return hasWrappedComponent ? hoistNonReactStatics(ChunkHOC, WrappedComponent) : ChunkHOC;
  }
}

function chunk(dynamicImport, opts = {}, webpackOpts = {}) {
  if (typeof dynamicImport !== 'function') {
    throw new Error('`chunk()` requires an import function.');
  }

  return createChunkComponent(load, { ...webpackOpts, ...opts, loader: dynamicImport, singleImport: true });
}

function chunks(dynamicImport, opts = {}, webpackOpts = {}) {
  if (typeof dynamicImport !== 'object' || Array.isArray(dynamicImport) || dynamicImport === null) {
    throw new Error('`chunks()` requires a map of import functions.');
  }

  if (typeof opts.hoist !== 'undefined') {
    throw new Error('`chunks()` does not support the "hoist" option.');
  }

  return createChunkComponent(loadMap, {...webpackOpts, ...opts, loader: dynamicImport, singleImport: false });
}

function flushInitializers(initializers) {
  let promises = [];

  while (initializers.length) {
    let init = initializers.pop();
    promises.push(init(true));
  }

  return Promise.all(promises).then(() => {
    if (initializers.length) {
      return flushInitializers(initializers);
    }
  });
}

function preloadChunks(loaders) {
  return new Promise((resolve, reject) => {
    return flushInitializers(loaders).then(resolve, reject);
  });
}

function preloadAll() {
  return preloadChunks(ALL_INITIALIZERS);
}

function preloadReady() {
  return preloadChunks(READY_INITIALIZERS);
}

function noop() {}

// HOC to access the chunks context
function withChunks(Component) {
  class ChunkReporter extends React.Component {

    static contextTypes = {
      chunks: PropTypes.shape({
        addChunk: PropTypes.func.isRequired,
      })
    };

    render() {
      const { chunks } = this.context;
      return React.createElement(Component, {
        ...this.props,
        chunks: {
          addChunk: (chunks && chunks.addChunk) || noop
        }
      });
    }
  }

  return hoistNonReactStatics(ChunkReporter, Component);
}

exports.chunk = chunk;
exports.chunks = chunks;
exports.preloadReady = preloadReady;
exports.preloadAll = preloadAll;
exports.preloadChunks = preloadChunks;
exports.resolve = resolve;
exports.withChunks = withChunks;
exports.TIMEOUT_ERR = TIMEOUT_ERR;
