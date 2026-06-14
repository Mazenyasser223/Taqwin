/**
 * Optional Sentry initialization — no-op when SENTRY_DSN is unset.
 */
const { logger } = require('../lib/logger');

let sentryReady = false;

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return null;
  try {
    const Sentry = require('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    });
    sentryReady = true;
    logger.info('Sentry initialized');
    return Sentry;
  } catch (err) {
    logger.warn({ err: err.message }, 'Sentry init failed — install @sentry/node to enable');
    return null;
  }
}

function captureException(err, context = {}) {
  if (!sentryReady) return;
  try {
    const Sentry = require('@sentry/node');
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([k, v]) => scope.setExtra(k, v));
      Sentry.captureException(err);
    });
  } catch {
    /* ignore */
  }
}

function isSentryReady() {
  return sentryReady;
}

module.exports = { initSentry, captureException, isSentryReady };
