import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Intercept relative API calls in native APK runtime so all mobile devices connect directly to live Cloudflare backend
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch;
  const isNative = Boolean(
    window.Capacitor?.isNativePlatform?.() ||
    window.location.protocol === 'capacitor:' ||
    (window.location.hostname === 'localhost' && !window.location.port)
  );

  if (isNative && !window.location.origin.includes('pages.dev')) {
    window.fetch = function(input, init) {
      if (typeof input === 'string' && input.startsWith('/api/')) {
        return originalFetch('https://control-doc.pages.dev' + input, init);
      }
      return originalFetch(input, init);
    };
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
