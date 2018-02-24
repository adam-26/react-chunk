import React from 'react';
import { chunks } from 'react-chunk';
import ChunksRenderer from './ChunksRenderer';
import PreLoadButton from './PreLoadButton';

const NestedChunk = chunks({
  Hello: () => import(/* webpackChunkName: "NestedHello" */ './NestedHello'),
  World: () => import(/* webpackChunkName: "NestedWorld" */ './NestedWorld'),
})(ChunksRenderer);

function HelloWorldRenderer({ chunk: { imported: { Hello, World } }, ...props }) {
  return <div><World {...props} /><Hello {...props} /></div>
}

export default function Example() {
  return (
    <div>
      <h1>react-chunk demo</h1>
      <NestedChunk />
      <NestedChunk>
        <HelloWorldRenderer />
      </NestedChunk>
      <PreLoadButton />
    </div>
  );
}
