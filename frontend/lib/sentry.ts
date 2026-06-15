/**
 * Frontend Sentry — no-op when VITE_SENTRY_DSN is unset.
 */
import * as Sentry from '@sentry/react';

let ready = false;

export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN?.trim();
  if (!dsn || ready) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_APP_VERSION || undefined,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    ignoreErrors: ['ResizeObserver loop'],
  });
  ready = true;
}

export { Sentry };
