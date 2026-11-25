import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import reportWebVitals from './reportWebVitals';

// One codebase, two sites. The admin site (its own Vercel project) builds with
// REACT_APP_TARGET=admin. webpack drops the branch not taken at build time, so
// the customer app and the native iOS/Android bundles contain no admin code.
let Root;
if (process.env.REACT_APP_TARGET === 'admin') {
  Root = require('./AdminApp').default;
} else {
  if (window.location.hash === '#admin') {
    window.location.replace(process.env.REACT_APP_ADMIN_URL || 'https://fursday-admin.vercel.app');
  }
  Root = require('./App').default;
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);

reportWebVitals();
