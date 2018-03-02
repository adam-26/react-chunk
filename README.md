# react-chunk

_Code splitting with minimal boiler plate_

> A higher order component for loading components with dynamic imports.


[![npm](https://img.shields.io/npm/v/react-chunk.svg)](https://www.npmjs.com/package/react-chunk)
[![npm](https://img.shields.io/npm/dm/react-chunk.svg)](https://www.npmjs.com/package/react-chunk)
[![CircleCI branch](https://img.shields.io/circleci/project/github/adam-26/react-chunk/master.svg)](https://circleci.com/gh/adam-26/react-chunk/tree/master)
[![Test Coverage](https://api.codeclimate.com/v1/badges/d805355d2fe47d351663/test_coverage)](https://codeclimate.com/github/adam-26/react-chunk/test_coverage)
[![Maintainability](https://api.codeclimate.com/v1/badges/d805355d2fe47d351663/maintainability)](https://codeclimate.com/github/adam-26/react-chunk/maintainability)
[![Conventional Commits](https://img.shields.io/badge/Conventional%20Commits-1.0.0-yellow.svg)](https://conventionalcommits.org)


_This is a fork of [react-loadable](https://github.com/jamiebuilds/react-loadable), differences and new features include:_
 * _A modified API to support new features_
 * _Full render control using a HOC wrapped component_
 * _Improved re-use of import components_
 * _Improved support for route code splitting_
 * _Pre-loading all chunks required to render an entire route_
 * _Option to _hoist_ static methods of imported components_
 * _Option to enable retry support with backoff_
 * _Manually invoking a retry after timeout or error_
 * _Support for [react-router-config](https://github.com/ReactTraining/react-router/tree/master/packages/react-router-config) code splitting_

> This enables **both** _component_ and _route_ code splitting

## Install

```sh
npm install --save react-chunk
```

```sh
yarn add react-chunk
```

## Example

For more detailed examples, [take a look at the examples](https://github.com/adam-26/react-chunk/tree/master/example)

### Single Import

```js
import { chunk } from 'react-chunk';

// It can be this easy!
const MyComponentChunk = chunk(() => import('./my-component'))();

export default class App extends React.Component {
  render() {
    return <MyComponentChunk />;
  }
}
```

### Multiple Imports
```js
import { chunks } from 'react-chunk';

// A component for rendering mutilple imports
function MutilImportRenderer(props) {
  const {
    chunk: {
      isLoaded,
      imported: {
        MyComponent,
        MyOtherComponent
      }
    },
    ...restProps
  }) = props;

  if (isLoaded) {
    return (
      <div>
        <MyComponent {...restProps} />
        <MyOtherComponent {...restProps} />
      </div>
    );
  }

  return <div>Loading...</div>;
}

const MyComponentsChunk = chunks({
  MyComponent: () => import('./my-component'),
  MyOtherComponent: () => import('./my-other-component'),
})(MutilImportRenderer);

export default class App extends React.Component {
  render() {
    return <MyComponentsChunk />;
  }
}
```

## Environment Configuration

It's _recommended_ you configure your development environment with the following plugins.

### Client

Configure your client build.

#### Babel

Add these plugins to your babel configuration.

```sh
npm install --save-dev babel-plugin-syntax-dynamic-import
```

The **order** of plugins is important.

`.babelrc`
```json
{
  "presets": {...},
  "plugins": [
    "react-chunk/babel",
    "syntax-dynamic-import"
  ]
}

```

#### Webpack

The react-chunk webpack plugin will write the chunk module data to a file required for server-side rendering.

The webpack `CommonsChunkPlugin` is required to allow non entry point chunks to be pre-loaded on the client.

Add the plugins to your _client_ webpack plugins

```js
import webpack from 'webpack';
import { ReactChunkPlugin } from 'react-chunk/webpack';

plugins: [

  new ReactChunkPlugin({
    filename: path.join(__dirname, 'dist', 'react-chunk.json')
  }),

  new webpack.optimize.CommonsChunkPlugin({
    name: 'manifest',
    minChunks: Infinity
  })
]

```

### Server

If your application performs SSR, configure your server build.

#### Babel

Add these plugins to your babel configuration.

```sh
npm install --save-dev babel-plugin-dynamic-import-node
```

The **order** of plugins is important.

`.babelrc`
```json
{
  "presets": {...},
  "plugins": [
    "react-chunk/babel",
    "dynamic-import-node"
  ]
}

```

## Introduction


### Automatic code-splitting on `import()`

When you use `import()` with Webpack 2+, it will
[automatically code-split](https://webpack.js.org/guides/code-splitting/) for
you with no additional configuration.

This means that you can easily experiment with new code splitting points just
by switching to `import()` and using React Chunk. Figure out what performs
best for your app.


### Naming webpack chunks

Its often useful to assign _names_ to webpack chunks. This can be achieved easily using inline code comments.

Be aware that naming chunks **impacts how webpack bundles your code**. You should [read about webpack code splitting](https://webpack.js.org/guides/code-splitting/#dynamic-imports).

```js
import { chunk, chunks } from 'react-chunk';

const AppChunk =
  chunk(() => import(/* webpackChunkName: "App" */ './app'))();

const TimeChunk =
  chunks({
    Calendar: () => import(/* webpackChunkName: "calendar" */ './calendar'),
    Clock: () => import(/* webpackChunkName: "clock" */ './clock'),
  })(TimeRenderer);

```

### Rendering using chunk props

Rendering a static "Loading..." doesn't communicate enough to the user. You
also need to think about error states, timeouts, retries, and making it a nice user experience.

As a developer, you can easiliy re-use import rendering logic when importing a single component. Renderering components for multiple components don't require much more effort.

```js
function ChunkRenderer(props) {
  const {
    chunk: {
      isLoading,
      hasLoaded,
      pastDelay,
      timedOut,
      error,
      retry,
      loaded,
      Imported
    },
    ...restProps
  } = prop;

  if (hasLoaded) {
    return <Imported {...restProps } />;
  }

  if (error) {
    return <div>An error occured</div>;
  }

  if (timedOut) {
    return (
      <div>
        This is taking a while..
        <a onClick={() => retry()}>retry?</a>
      </div>
    );
  }

  if (isLoading && pastDelay) {
    return <div>Loading...</div>;
  }

  return null;
}

chunk(() => import('./someComponent'))(ChunkRenderer);
```

To make this all nice, your [chunk component](#loadingcomponent) receives a
couple different props.


#### Avoiding _Flash Of Loading Component_

Sometimes components load really quickly (< 200ms) and the loading screen only
quickly flashes on the screen.

A number of user studies have proven that this causes users to perceive things
taking longer than they really have. If you don't show anything, users perceive
it as being faster.

So your rendering component will also get a [`pastDelay` prop](#propspastdelay)
which will only be true once the component has taken longer to load than a set
[delay](#optsdelay).

This delay defaults to `200ms` but you can also customize the
[delay](#optsdelay) in `chunk` and `chunks`.

```js
chunk(() => import('./components/Bar'), {
  delay: 300, // 0.3 seconds
});
```

#### Timing out when the `loader` is taking too long

Sometimes network connections suck and never resolve or fail, they just hang
there forever. This sucks for the user because they won't know if it should
always take this long, or if they should try refreshing.

The rendering component will receive a
[`timedOut` prop](#propstimedout) which will be set to `true` when the
[`loader`](#optsloader) has timed out.

However, this feature is disabled by default. To turn it on, you can pass a
[`timeout` option](#optstimeout) to `chunk` and `chunks`.

```js
chunk(() => import('./components/Bar'), {
  timeout: 10000, // 10 seconds
});
```

### Customize rendering

By default `chunk` and `chunks` will render the `default` export of each returned import.
If you want to customize this behavior you can use the
[`resolveDefaultImport` option](#optsresolveDefaultImport).

#### Chunk rendering without a rendering component

```js

// Notice the HOC is invoked with no component
const MyComponentChunk = chunk(() => import('./myComponent'))();

```

When no rendering component is provided, `null` is rendered until the component **hasLoaded**.


#### Rendering multiple chunks

`chunks` **requires** a rendering component be provided when invoking the HOC, an error will be thrown if this requirement is not met.


### Loading multiple resources

To make it easier to load multiple resources in parallel, you can use
[`chunks`](#chunks).

When using `chunks` a rendering component **must** be provided when invoking the HOC.

#### Using `chunks` for multiple imports

```js
const MultiComponentChunk = chunks({
  Bar: () => import('./Bar'),
  i18n: () => fetch('./i18n/bar.json').then(res => res.json())
}, {
  delay: 300,
  // other options here...
})(RequiredRendererComponent);
```


### Preloading

As an optimization, you can also decide to preload one or more components before being
rendered.

#### Preload a single chunk

For example, if you need to load a new component when a button gets pressed,
you could start preloading the component when the user hovers over the button.

The components created by `chunk` and `chunks` expose a
[static `preload` method](#chunkcomponentpreload) which does exactly this.

```js
const BarChunk = chunk(() => import('./Bar'))();

class MyComponent extends React.Component {
  state = { showBar: false };

  onClick = () => {
    this.setState({ showBar: true });
  };

  onMouseOver = () => {
    BarChunk.preloadChunk();
  };

  render() {
    return (
      <div>
        <button
          onClick={this.onClick}
          onMouseOver={this.onMouseOver}>
          Show Bar
        </button>
        {this.state.showBar && <BarChunk />}
      </div>
    )
  }
}
```

#### Preload multiple chunks

This approach can be used to load all the chunks required for rendering a route on the client, and ensure that all chunks are loaded before rendering the route.

This makes it easier to handle errors, instead of having to render an error for each failed component on the page (which may result in the user seeing many error messages) you can simply render an error page for the user - and allow the user to retry the previous action if desired.

```js
import { preloadChunks } from 'react-chunk';

const FooChunk = chunk(() => import('./Foo'))();
const BarChunk = chunk(() => import('./Bar'))();

preloadChunks([
  FooChunk.getChunkLoader(),
  BarChunk.getChunkLoader(),
]).then(() => {
  // use 'setState()' to render using the loaded components
}).catch(err => {
  // handle timeouts, or other errors
})

```

## Server-Side Rendering

When you go to render all these dynamically loaded components, what you'll get
is a whole bunch of loading screens.

This really sucks, but the good news is that React Chunk is designed to
make server-side rendering work as if nothing is being imported dynamically.

### Preloading all your chunk components on the server

The first step to rendering the correct content from the server is to make sure
that all of your chunk components are already loaded when you go to render
them.

To do this, you can use the [`preloadAll`](#loadablepreloadall)
method. It returns a promise that will resolve when all your chunk
components are ready.

```js
import { preloadAll } from 'react-chunk';

preloadAll().then(() => {
  app.listen(3000, () => {
    console.log('Running on http://localhost:3000/');
  });
});
```

#### Configure babel and webpack

Ensure you have [configured babel and webpack](#environmentconfiguration) for **both** _client_ and _server_ builds.

The babel plugin adds additional information to all of your `chunk` and `chunks`.

#### Tracking which dynamic modules were rendered

Next we need to find out which chunks were used to perform the server render.

For this, there is the [`Recorder`](#chunkrecorder) component which can
be used to record all the chunks used for rendering.

```js
import ChunkRecorder from 'react-chunk/Recorder';

app.get('/', (req, res) => {
  let renderedChunks = [];

  let html = ReactDOMServer.renderToString(
    <ChunkRecorder addChunk={chunkName => renderedChunks.push(chunkName)}>
      <App/>
    </ChunkRecorder>
  );

  console.log(renderedChunks);

  res.send(`...${html}...`);
});
```

#### Resolving rendered chunks

In order to make sure that the client loads all the resources required by the
server-side render, we need to resolve the chunks that Webpack created.

First we need to configure Webpack to write the chunk data to a file. Use the [React Chunk Webpack plugin](#webpack-plugin).

Then we can use the plugin output to determine the chunks required for the client render. To determine the files required for each chunk, import the [`resolveChunks`](#resolveChunks)
method from `react-chunk/webpack` and the data from Webpack.

```js
import ChunkRecorder from 'react-chunk/Recorder';
import { resolveChunks } from 'react-chunk/webpack'
import chunkData from './dist/react-chunk.json';

app.get('/', (req, res) => {
  let renderedChunks = [];

  let html = ReactDOMServer.renderToString(
    <ChunkRecorder addChunk={chunkName => renderedChunks.push(chunkName)}>
      <App/>
    </ChunkRecorder>
  );

  let resources = resolveChunks(chunkData, renderedChunks);

  // ...
});
```

We can then render these resources using `<script>` and `<link>` tags in our HTML.

It is important that the script files are included _before_ the main entry point, so that
they can be loaded by the browser prior to the app rendering.

However, as the Webpack manifest (including the logic for parsing chunks) lives in
the main chunk, it will need to be extracted into its own chunk.

This is easy to do with the [CommonsChunkPlugin](https://webpack.js.org/plugins/commons-chunk-plugin/), add it to your webpack plugins configuration.

```js
// webpack.config.js
export default {
  plugins: [
    //...other webpack plugins
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      minChunks: Infinity
    })
  ]
}
```

* Ensure the `manifest.js` is loaded **before** all other webpack scripts.
* Ensure the main entry point (in this example, `main.js`) is loaded **after** all other webpack scripts.

```js
let resources = getBundles(chunkData, renderedChunks);

let styles = resources.filter(bundle => bundle.file.endsWith('.css'));
let scripts = resources.filter(bundle => bundle.file.endsWith('.js'));

res.send(`
  <!doctype html>
  <html lang="en">
    <head>
    ${styles.map(bundle => {
      return `<link rel="stylesheet" href ="/dist/${bundle.file}"></script>`
    }).join('\n')}
    </head>
    <body>
      <div id="app">${html}</div>

      <!-- Load the manifest FIRST -->
      <script src="/dist/manifest.js"></script>

      <!-- Then, load all resolved scripts -->
      ${scripts.map(bundle => {
        return `<script src="/dist/${bundle.file}"></script>`
      }).join('\n')}

      <!-- Load the main entry point LAST -->
      <script src="/dist/main.js"></script>
    </body>
  </html>
`);
```

#### Preloading resolved chunks on the client

We can use the [`preloadReady()`](#loadablepreloadready) method on the
client to preload the chunk components that were included on the page.

Like [`preloadAll()`](#loadablepreloadall), it returns a promise,
which on resolution means that we can hydrate our app.

```js
// src/entry.js
import React from 'react';
import ReactDOM from 'react-dom';
import { preloadReady } from 'react-chunk';
import App from './components/App';

preloadReady().then(() => {
  ReactDOM.hydrate(<App/>, document.getElementById('app'));
}).catch(err => {
  // errors can occur if imports timeout or fail
  // render an error page
});

```

<h4 align="center">
  Now server-side rendering should work perfectly!
</h4>

## API

### `chunk`

A higher-order component for dynamically importing a single resource.

`chunk(import: function[, options: Object]): ChunkComponent`

```js
import { chunk } from 'react-chunk';

const ChunkComponent = chunk(() => import('./Bar'), {
  delay: 200,
  timeout: 10000,
})([WrappedComponent]);
```

This returns a [ChunkComponent](#chunkcomponent). The `WrappedComponent` for a `chunk` is optional, but recommended for complete control of the rendering. The `WrappedComponent` will be passed an additional single prop `chunk`, that provides all state required to render the imported resource.

### `chunks`

A higher-order component that allows you to load multiple resources in parallel.

`chunks(importMap: {[string]: function}[, options: Object]): ChunksComponent`


```js
import { chunks } from 'react-chunk';

const ChunksComponent = chunks({
  Foo: () => import('./Foo'),
  Bar: () => import('./Bar')
}, {
  // define options here...
  delay: 200,
  timeout: 10000,
})(WrappedComponent);
```

This returns a [ChunksComponent](#chunkscomponent). The `WrappedComponent` for a `chunks` is required to control rendering of all imported resources. The `WrappedComponent` will be passed an additional single prop `chunk`, that provides all state required to render the imported resource.


### `chunk` and `chunks` Options

#### `opts.displayName: string`

The react display name to assign when creating the HOC.

#### `opts.hoistStatics: boolean`

`true` to _hoist_ non-react static methods of the imported component to the HOC. Defaults to `false`.

Note that the static methods are only hoisted after the component is loaded (obviously) - if you're using `hoistStatics: true` on a component its _recommended_ that you `preload` (or `preloadChunks`) the component to avoid invoking static methods that have not yet been assigned to the HOC.

Using this option with `chunks` is not supported and will result in an error.

#### `opts.resolveDefaultImport: (imported, importKey) => mixed`

By default, the `.default` export of the imported resource is returned to the `Imported` property (for `chunk`) or the `imported` property (for `chunks`).

The `importKey` is only passed for `chunks`.

#### `opts.retryBackOff: Array<number>`

Allows automatic retry for failed imports using the assigned backOff.

When used in conjuntion with `timeout`, retry attempts will be invoked after the configured `timeout` value has expired.

For example: `[250, 500]` will result in the first retry attempt starting 250ms **after** the first `timeout` or `error`. The second retry will start 500ms **after** the second _timeout_ or _error_.


#### `opts.delay: number`

Time to wait (in milliseconds) before passing
[`props.pastDelay`](#propspastdelay) to your [`loading`](#optsloading)
component. This defaults to `200`.

[Read more about delays](#avoiding-flash-of-loading-component).

#### `opts.timeout: number`

Time to wait (in milliseconds) before passing
[`props.timedOut`](#propstimedout) to your [`loading`](#optsloading) component.
This is turned off by default.

[Read more about timeouts](#timing-out-when-the-loader-is-taking-too-long).

#### `opts.webpack: function`

An optional function which returns an array of Webpack module ids which you can
get with `require.resolveWeak`.

```js
chunk(() => import('./component'), {
  webpack: () => [require.resolveWeak('./Foo')],
});
```

This option can be automated with the [Babel Plugin](#babel-plugin).

#### `opts.modules: Array<string>`

An optional array with module paths for your imports.

```js
chunk(() => import('./component'), {
  modules: ['./my-component']
});
```

This option can be automated with the [Babel Plugin](#babel-plugin).

### `ChunkComponent`

This is the component returned by `chunk`.

```js
const ChunkComponent = chunk({
  // ...
});
```

Props passed to this component will be passed straight through to the
wrapped component, in additional to a `chunk` prop that includes all data required for rendering the imported resource.

### `ChunksComponent`

This is the component returned by `chunks`.

```js
const ChunksComponent = chunks({
  // ...
});
```

Props passed to this component will be passed straight through to the
wrapped component, in additional to a `chunk` prop that includes all data required for rendering the imported resources.

### Common `chunk` and `chunks` static methods
#### `preloadChunk()`

This is a static method that can be used to load the component ahead of time.

```js
const ChunkComponent = chunk({...});

ChunkComponent.preloadChunk();
```

This returns a promise, but you should avoid waiting for that promise to
resolve to update your UI. In most cases it creates a bad user experience.

[Read more about preloading](#preloading).

#### `getChunkLoader()`

This is a static method that can be used to obtain a reference to the components loader. It should be used in conjuntion with [preloadChunks()](#preloadchunks)

```js
const ChunkComponent = chunk({...});

ChunkComponent.getChunkLoader();
```

#### `onImported(subscriber: (ImportedComponent) => void): () => void`

This is a static method that can be used to subscribe for notifications when component has been imported.

Returns an `unsubscribe` function.

```js
const ChunkComponent = chunk({...});

ChunkComponent.onImported((ImportedComponent) => { /* use ImportedComponent */ });
```

#### `onImportedWithHoist(subscriber: (ImportedComponent) => void): () => void`

This is a static method that can be used to subscribe for notifications when component has been imported where `hoistStatics: true`.

Note: this requires `hoistStatics: true`

Returns an `unsubscribe` function.

```js
const ChunkComponent = chunk({...});

ChunkComponent.onImportedWithHoist((ImportedComponent) => { /* use ImportedComponent */ });
```

### `WrappedComponent`

This is the component you pass to the `chunk()` or `chunks()` HOC.

```js
function WrappedComponent(props) {
  const {
    chunk: {
      isLoading,
      hasLoaded,
      pastDelay,
      timedOut,
      error,
      retry,
      loaded,
      importKeys,
      Imported // - only for 'chunk()'
      // imported - only for 'chunks()'
    },
    ...restProps
  } = prop;

  if (hasLoaded) {
    return <Imported {...restProps } />;
  }

  if (error) {
    return <div>An error occured</div>;
  }

  if (timedOut) {
    return (
      <div>
        This is taking a while..
        <a onClick={() => retry()}>retry?</a>
      </div>
    );
  }

  if (isLoading && pastDelay) {
    return <div>Loading...</div>;
  }

  return null;
}

```

[Read more about loading components](#creating-a-great-loading-component)

#### `chunk.Imported: mixed`
> Note the UPPER CASE 'i'
>
> This prop is **only** passed to `chunk` components.

It provides access to the [default export](#optsresolveDefaultImport) of the `import`ed resource.

It is **only** populated when `chunk.hasLoaded` is `true`.

#### `chunk.imported: Object`
> Note the LOWER CASE 'i'
>
> This prop is **only** passed to `chunks` components.

It provides access to the [default export](#optsresolveDefaultImport) of the all `import`ed resource, by key.

It is **only** populated when `chunk.hasLoaded` is `true`.


#### `chunk.importKeys: Array<string>`

For `chunks()`, an array of the key names used for imports.

For `chunk()`, it will always be an empty array

> This can be used to create a generic rendering component that can be used to render both `chunk()` and `chunks()` components.

#### `chunk.isLoading: boolean`

`true` if the import(s) are currently being loaded, otherwise `false`.

#### `chunk.hasLoaded: boolean`

`true` if the import(s) have been successfully loaded, otherwise `false`.

#### `chunk.error: boolean`

A boolean prop passed to [`WrappedComponent`](#wrappedcomponent) when the loading resource(s) has failed.

```js
function WrappedComponent({chunk}) {
  if (chunk.error) {
    return <div>Error!</div>;
  } else {
    return <div>Loading...</div>;
  }
}
```

[Read more about errors](#loading-error-states).

#### `chunk.timedOut: boolean`

A boolean prop passed to [`WrappedComponent`](#wrappedcomponent) after a set
[`timeout`](#optstimeout).

```js
function WrappedComponent({chunk}) {
  if (chunk.timedOut) {
    return <div>Taking a long time...</div>;
  } else {
    return <div>Loading...</div>;
  }
}
```

[Read more about timeouts](#timing-out-when-the-loader-is-taking-too-long).

#### `chunk.pastDelay: boolean`

A boolean prop passed to [`WrappedComponent`](#wrappedcomponent) after a set
[`delay`](#optsdelay).

```js
function WrappedComponent({chunk}) {
  if (chunk.pastDelay) {
    return <div>Loading...</div>;
  } else {
    return null;
  }
}
```

[Read more about delays](#avoiding-flash-of-loading-component).

#### `chunk.loaded: mixed`

This is considered a "low-level" API property, the `loaded` prop provides _raw_ access to all imported resources. This can be used in scenarios where an imported resource includes multiple exports that you need to access.

### `preloadAll()`

This will call all of the
[`WrappedComponent.preload`](#wrappedcomponentpreload) methods recursively
until they are all resolved. Allowing you to preload all of your dynamic
modules in environments like the server.

```js
import { preloadAll } from 'react-chunk';
preloadAll().then(() => {
  app.listen(3000, () => {
    console.log('Running on http://localhost:3000/');
  });
});
```

It's important to note that this requires that you declare all of your chunk
components when modules are initialized rather than when your app is being
rendered.

**Good:**

```js
// During module initialization...
const ChunkComponent = chunk(...);

class MyComponent extends React.Component {
  componentDidMount() {
    // ...
  }
}
```

**Bad:**

```js
// ...

class MyComponent extends React.Component {
  componentDidMount() {
    // During app render...
    const ChunkComponent = chunk(...);
  }
}
```

> **Note:** `preloadAll()` will not work if you have more than one
> copy of `react-chunk` in your app.

[Read more about preloading on the server](#preloading-all-your-chunk-components-on-the-server).

### `preloadReady()`

Check for modules that are already loaded in the browser and call the matching
[`WrappedComponent.preload`](#wrappedcomponentpreload) methods.

```js
import { preloadReady } from 'react-chunk';
preloadReady().then(() => {
  ReactDOM.hydrate(<App/>, document.getElementById('app'));
});
```

[Read more about preloading on the client](#waiting-to-render-on-the-client-until-all-the-bundles-are-loaded).

### `Recorder`

A component for reporting which chunks were used for rendering.

Accepts an `addChunk` prop which is called for every `chunkName` that is
rendered via React Chunk.

```js
import ChunkRecorder from 'react-chunk/Recorder';
let renderedChunks = [];

let html = ReactDOMServer.renderToString(
  <ChunkRecorder addChunk={chunkName => renderedChunks.push(chunkName)}>
    <App/>
  </ChunkRecorder>
);

console.log(renderedChunks);
```

[Read more about capturing rendered modules](#finding-out-which-dynamic-modules-were-rendered).

## Babel Plugin

Providing [`opts.webpack`](#optswebpack) and [`opts.modules`](#optsmodules) for
every chunk component is a lot of manual work to remember to do.

Instead you can add the Babel plugin to your config and it will automate it for
you:

```json
{
  "plugins": ["react-chunk/babel"]
}
```

**Input**

```js
import { chunk, chunks } from 'react-chunk';

const ChunkMyComponent = chunk(() => import('./MyComponent'));

const ChunkComponents = chunks({
  One: () => import('./One'),
  Two: () => import('./Two'),
});
```

**Output**

```js
import { chunk, chunks } from 'react-chunk';

const ChunkMyComponent = chunk(
  () => import('./MyComponent'),
  {},
  {
    webpack: () => [require.resolveWeak('./MyComponent')],
    modules: ['./MyComponent']
  }
});

const ChunkComponents = chunks({
    One: () => import('./One'),
    Two: () => import('./Two'),
  },
  {},
  {
    webpack: () => [require.resolveWeak('./One'), require.resolveWeak('./Two')],
    modules: ['./One', './Two']
  }
});
```

[Read more about declaring modules](#declaring-which-modules-are-being-loaded).

## Webpack Plugin

In order to [send the right bundles down](#mapping-loaded-modules-to-bundles)
when rendering server-side, you'll need the React Chunk Webpack plugin 
to provide you with a mapping of modules to bundles.

```js
// webpack.config.js
import { ReactChunkPlugin } from 'react-chunk/webpack';

export default {
  plugins: [
    new ReactChunkPlugin({
      filename: './dist/react-chunk.json',
    }),
  ],
};
```

This will create a file (`opts.filename`) which you can import to map modules
to bundles.

### `opts.filename`
Required, the destination file for writing react-chunk module data

### `opts.ignoreChunkNames`
Optional, an array of webpack chunk names to exclude from the module data

By ignoring the main entry point (ie: `main` or `index`) only required module data is included in the output.

[Read more about mapping modules to bundles](#mapping-loaded-modules-to-bundles).

### `resolveChunks`

A method exported by `react-chunk/webpack` for converting chunks to
resources.

```js
import { resolveChunks } from 'react-chunk/webpack';

let resources = resolveChunks(chunkData, renderedChunks);
```

[Read more about mapping modules to bundles](#mapping-loaded-modules-to-bundles).

## FAW

### How do I avoid repetition?

Specifying the same `loading` component or `delay` every time you use
`chunk()` or `chunks()` gets repetitive fast. Instead you can wrap `chunk` and `chunks` with your
own Higher-Order Component (HOC) to set default options.

```js
// chunkOptions.js
const defaultChunkOpts = {
  delay: 200,
  timeout: 10,
};

export default defaultChunkOpts;
```

```js
import { chunk chunks } from 'react-chunk';
import Loading from './my-loading-component';
import defaultChunkOpts form './chunkOptions';


export default function MyComponentChunk(opts = {}) {
  return chunk(
    () => import('./my-component'),
    Object.assign({}, defaultChunkOpts, opts)
  );
};
```

Then you can specify additional `options` and a `WrappedComponent` when you go to use it.

```js
import MyComponentChunk from './MyComponentChunk';
import ChunkRenderer from './ChunkRenderer';

const MyAutoRetryComponentChunk = MyComponentChunk({
  retryBackOff: [200, 300]
})(ChunkRenderer);

export default class App extends React.Component {
  render() {
    return <MyAutoRetryComponentChunk />;
  }
}
```

### How do I handle other styles `.css` or sourcemaps `.map` with server-side rendering?

When you call [`resolveChunks`](#resolveChunks), it may return file types other than
JavaScript depending on your Webpack configuration.

To handle this, you should manually filter down to the file extensions that
you care about:

```js
let resources = resolveChunks(stats, modules);

let styles = resources.filter(bundle => bundle.file.endsWith('.css'));
let scripts = resources.filter(bundle => bundle.file.endsWith('.js'));

res.send(`
  <!doctype html>
  <html lang="en">
    <head>
      ...
      ${styles.map(style => {
        return `<link href="/dist/${style.file}" rel="stylesheet"/>`
      }).join('\n')}
    </head>
    <body>
      <div id="app">${html}</div>
      <script src="/dist/manifest.js"></script>
      ${scripts.map(script => {
        return `<script src="/dist/${script.file}"></script>`
      }).join('\n')}
      <script src="/dist/main.js"></script>
    </body>
  </html>
`);
```
