import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

// Mount the single-page app into #root.
createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
