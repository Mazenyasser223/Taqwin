
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { bootstrapAppearance } from './lib/appearance';
import { bootstrapUnits } from './lib/units';
import { initSentry, Sentry } from './lib/sentry';
import './index.css';

bootstrapAppearance();
bootstrapUnits();
initSentry();

// Drop stale PWA service workers in dev (they can cache old VITE_API_URL bundles).
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) void reg.unregister();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element to mount to");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<p>Something went wrong.</p>}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>
);
