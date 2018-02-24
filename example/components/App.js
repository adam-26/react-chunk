import React from 'react';
import { chunk } from 'react-chunk';
import ChunkRenderer from './ChunkRenderer';

const ContentChunk = chunk(() => import(/* webpackChunkName: "Content" */ './Content'), {
  delay: 250
})(ChunkRenderer);

export default function App() {
  return <ContentChunk/>;
}
