import React from 'react';

export default function ChunksRenderer(props) {
  const {
    chunk,
    children,
    ...passThroughProps
  } = props;

  const {
    isLoading,
    timedOut,
    pastDelay,
    error,
    hasLoaded,
    imported,
    importKeys
  } = chunk;

  if (hasLoaded) {
    if (children) {
      return React.cloneElement(children, { ...passThroughProps, chunk })
    }

    return (
      <React.Fragment>
        {importKeys.map((key, idx) => React.createElement(imported[key], { ...passThroughProps, key: idx }))}
      </React.Fragment>
    );
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
