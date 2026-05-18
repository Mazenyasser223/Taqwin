/**
 * Taqwin backend — entry point.
 * Loads env, mounts app, starts HTTP server, handles graceful shutdown.
 */
require('dotenv').config();
const app = require('./app');
const { logger } = require('./lib/logger');
const { prisma } = require('./db');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info(`Taqwin API listening on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => logger.info('HTTP server closed'));
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.warn({ err }, 'Prisma disconnect failed');
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'Uncaught exception'));
