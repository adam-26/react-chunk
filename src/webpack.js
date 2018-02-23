'use strict';
const fs = require('fs');
const path = require('path');
const url = require('url');

function buildManifest(compiler, compilation, ignoreChunkNames) {
  const context = compiler.options.context;
  const manifest = {};

  compilation.chunks.forEach(chunk => {
    // Determine if the chunk should be ignored
    const chunkName = typeof chunk.name === 'undefined' ? 'undefined' : chunk.name === null ? 'null' : chunk.name;
    const ignoreChunk = ignoreChunkNames.length === 0 ? false : ignoreChunkNames.some(chunkNameCondition => {
      if (chunkNameCondition instanceof RegExp) {
        chunkNameCondition.lastIndex = 0; // reset in-case its a global regexp
        return chunkNameCondition.test(chunkName);
      }

      return chunkNameCondition === chunkName;
    });

    if (!ignoreChunk) {
      chunk.files.forEach(file => {
        chunk.forEachModule(module => {
          const id = module.id;
          const name = typeof module.libIdent === 'function' ? module.libIdent({ context }) : null;
          const publicPath = url.resolve(compilation.outputOptions.publicPath || '', file);

          let currentModule = module;
          if (module.constructor.name === 'ConcatenatedModule') {
            currentModule = module.rootModule;
          }
          if (!manifest[currentModule.rawRequest]) {
            manifest[currentModule.rawRequest] = [];
          }

          manifest[currentModule.rawRequest].push({ id, name, file, publicPath });
        });
      });
    }
  });

  return manifest;
}

class ReactChunkPlugin {
  constructor(opts = {}) {
    this.filename = opts.filename;
    const ignoreChunkNames = opts.ignoreChunkNames || [];
    this.ignoreChunkNames = Array.isArray(ignoreChunkNames) ? ignoreChunkNames : [ignoreChunkNames];
  }

  apply(compiler) {
    compiler.plugin('emit', (compilation, callback) => {
      const manifest = buildManifest(compiler, compilation, this.ignoreChunkNames);
      const json = JSON.stringify(manifest, null, 2);
      const outputDirectory = path.dirname(this.filename);
      try {
        fs.mkdirSync(outputDirectory);
      } catch (err) {
        if (err.code !== 'EEXIST') {
          throw err;
        }
      }
      fs.writeFileSync(this.filename, json);
      callback();
    });
  }
}

function resolveChunks(manifest, chunkIds) {
  const uniqueIds = chunkIds
    .reduce((uniqueIds, chunkId) => {
      if (uniqueIds.indexOf(chunkId) === -1) {
        uniqueIds.push(chunkId);
      }

      return uniqueIds;
    }, []);

  return uniqueIds.reduce((bundles, chunkId) => {
    return bundles.concat(manifest[chunkId]);
  }, []);
}

exports.ReactChunkPlugin = ReactChunkPlugin;
exports.resolveChunks = resolveChunks;
