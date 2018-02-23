import express from 'express';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { preloadAll } from 'react-chunk';
import { resolveChunks } from 'react-chunk/webpack'
import ChunkRecorder from 'react-chunk/Recorder'
import App from './components/App';

const stats = require('./dist/react-chunk.json');
const app = express();

app.get('/', (req, res) => {
  let renderedChunks = [];
  let html = ReactDOMServer.renderToString(
    <ChunkRecorder addChunk={chunkName => renderedChunks.push(chunkName) }>
      <App/>
    </ChunkRecorder>
  );

  let bundles = resolveChunks(stats, renderedChunks);

  let styles = bundles.filter(bundle => bundle.file.endsWith('.css'));
  let scripts = bundles.filter(bundle => bundle.file.endsWith('.js'));

  res.send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <title>My App</title>
        ${styles.map(style => {
          return `<link href="/dist/${style.file}" rel="stylesheet"/>`;
        }).join('\n')}
      </head>
      <body>
        <div id="app">${html}</div>
        <script src="/dist/main.js"></script>
        ${scripts.map(script => {
          return `<script src="/dist/${script.file}"></script>`
        }).join('\n')}
        <script>window.main();</script>
      </body>
    </html>
  `);
});

app.use('/dist', express.static(path.join(__dirname, 'dist')));

preloadAll().then(() => {
  app.listen(3000, () => {
    console.log('Running on http://localhost:3000/');
  });
}).catch(err => {
  console.log(err);
});
