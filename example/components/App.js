import React from 'react';
import { chunk } from 'react-chunk';
import ChunkRenderer from './ChunkRenderer';

const AppChunk = chunk(() => import(/* webpackChunkName: "App" */ './Example'), {
  delay: 250
})(ChunkRenderer);

export default function App() {
  return <AppChunk/>;
}
