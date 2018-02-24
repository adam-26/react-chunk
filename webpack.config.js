const path = require('path');
const webpack = require('webpack');
const { ReactChunkPlugin } = require('./webpack');

module.exports = {
  entry: {
    main: './example/client',
  },
  output: {
    path: path.join(__dirname, 'example', 'dist'),
    filename: '[name].js',
    chunkFilename: '[name].js',
    publicPath: '/dist/'
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            babelrc: false,
            presets: [
              ['es2015', { modules: false }],
              'react',
            ],
            plugins: [
              'syntax-dynamic-import',
              'transform-class-properties',
              'transform-object-rest-spread',
              'transform-object-assign',
              require.resolve('./babel'),
            ],
          }
        },
      },
    ],
  },
  devtool: 'inline-source-map',
  resolve: {
    alias: {
      'react-chunk': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    new webpack.optimize.CommonsChunkPlugin({
      name: 'manifest',
      minChunks: Infinity
    }),
    new ReactChunkPlugin({
      filename:  path.resolve(__dirname, 'example', 'dist', 'react-chunk.json'),
      ignoreChunkNames: ['main']
    })
  ]
};
