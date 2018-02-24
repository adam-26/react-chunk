// @flow
import React from 'react';
import PropTypes from 'prop-types';

class ChunkRecorder extends React.Component {
  static propTypes = {
    addChunk: PropTypes.func.isRequired,
    children: PropTypes.oneOfType([
      PropTypes.node,
      PropTypes.func
    ]).isRequired
  };

  static childContextTypes = {
    chunks: PropTypes.shape({
      addChunk: PropTypes.func,
    }),
  };

  getChildContext() {
    return {
      chunks: {
        addChunk: this.props.addChunk,
      },
    };
  }

  render() {
    return React.Children.only(this.props.children);
  }
}

module.exports = ChunkRecorder;
