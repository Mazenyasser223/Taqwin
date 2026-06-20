/**
 * Express error handler.
 * - Hides stack traces in production.
 * - Maps Prisma known errors to friendly responses.
 */
const { logger } = require('../lib/logger');
const { captureException } = require('../lib/sentry');

const DB_BUSY_CODES = new Set(['P2024', 'P1001', 'P1002', 'P1008']);

function isDbPoolOrConnectivityError(err) {
  if (!err) return false;
  const code = err.code || err.cause?.code;
  if (code && DB_BUSY_CODES.has(code)) return true;
  const msg = String(err.message || err.cause?.message || '');
  return /connection pool|timed out fetching a new connection|can't reach database|max clients reached|emaxconnsession/i.test(
    msg,
  );
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

function errorHandler(err, req, res, _next) {
  // Prisma: record not found
  if (err && err.code === 'P2025') {
    return res.status(404).json({ error: 'Resource not found' });
  }
  // Prisma: unique constraint
  if (err && err.code === 'P2002') {
    return res.status(409).json({ error: 'Duplicate value', target: err.meta?.target });
  }
  // Prisma: null constraint
  if (err && err.code === 'P2011') {
    return res.status(500).json({ error: 'Internal server error' });
  }
  // Prisma: foreign-key constraint
  if (err && err.code === 'P2003') {
    return res.status(400).json({ error: 'Invalid reference' });
  }

  if (isDbPoolOrConnectivityError(err)) {
    return res.status(503).json({
      error: 'Database is busy. Wait a moment and try again.',
    });
  }

  const status = err?.status || err?.statusCode || 500;
  if (status >= 500) {
    logger.error({ err, path: req.originalUrl, method: req.method }, 'Unhandled error');
    captureException(err, {
      path: req.originalUrl,
      method: req.method,
      requestId: req.requestId,
    });
  } else {
    logger.warn({ msg: err?.message, status, path: req.originalUrl }, 'Request error');
  }

  res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err?.message || 'Request failed',
    ...(process.env.NODE_ENV !== 'production' && status >= 500
      ? { stack: err?.stack }
      : {}),
  });
}

module.exports = { errorHandler, notFound };
