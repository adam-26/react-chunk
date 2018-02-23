import React from 'react';
import ReactDOM from 'react-dom';
import { preloadReady } from 'react-chunk';
import App from './components/App';

window.main = () => {
  preloadReady().then(() => {
    ReactDOM.hydrate(<App/>, document.getElementById('app'));
  }).catch(err => {
    // In a real app, render an error page here
    // This could occur when webpack fails to download chunks
    console.error(err);
  });
};
