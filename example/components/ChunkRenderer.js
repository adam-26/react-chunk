import React from 'react';

export default function ChunkRenderer(props) {
  const {
    chunk: {
      isLoading,
      timedOut,
      pastDelay,
      error,
      hasLoaded,
      Imported
    },
    ...passThroughProps
  } = props;

  if (hasLoaded) {
    return <Imported {...passThroughProps} />
  }
  if (isLoading) {
    if (timedOut) {
      return <div>Loader timed out!</div>;
    }

    if (pastDelay) {
      return <div>Loading...</div>;
    }

    return null;
  }

  if (error) {
    return <div>Error! Component failed to load</div>;
  }

  return null;
}
