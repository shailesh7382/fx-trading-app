import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/app/App';
import './index.css';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Unable to mount the FX workspace: #root is missing from the document.');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
