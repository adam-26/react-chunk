import React from 'react';
import { chunk, preloadChunks } from 'react-chunk';
import ChunkRenderer from "./ChunkRenderer";

const ContentChunk = chunk(() => import(/* webpackChunkName: "PreLoadedContent" */ './PreLoadedContent'))(ChunkRenderer);

// NOTE: This is for demo purposes only.
//       Pre-loading a single module is no different than using a standard loadable
export default class PreLoadButton extends React.Component {
  state = {
    isLoaded: false
  };

  downloadChunks() {
    if (this.state.isLoaded) {
      return;
    }

    // Verify webpack only submits a single request
    preloadChunks([
      ContentChunk.getLoader(),
      ContentChunk.getLoader(),
      ContentChunk.getLoader()
    ]).then(() => {
      console.log('pre-loading modules');
      this.setState({ isLoaded: true });
    }).catch(err => {
      // on error, can allow user to retry
      console.error(err);
    });
  }

  render() {
    const { isLoaded } = this.state;
    console.log('is content pre-loaded? ' + isLoaded);
    return (
      <div>
        <button onClick={() => this.downloadChunks()}>Preload Modules</button>
        {isLoaded && <ContentChunk />}
      </div>
    );
  }
}
