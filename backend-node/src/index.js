/**
 * Taqwin backend — entry point.
 * Loads env, mounts app, starts HTTP server, and handles graceful shutdown.
 */
require('dotenv').config();
const app = require('./app');
const { logger } = require('./lib/logger');
const { prisma } = require('./db');
const { getFrontendUrl } = require('./lib/frontendUrl');
const { resolveGoogleCallbackUrl } = require('./lib/googleCallbackUrl');
const { getGoogleOAuthDiagnostics } = require('./lib/googleOAuthConfig');
const { getAllowedOrigins, isVercelCorsEnabled } = require('./lib/corsOrigins');
const { closeRedis } = require('./lib/redis');
const { startFdcCacheWarm } = require('./lib/fdcCacheWarm');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  logger.info(`Taqwin API listening on http://localhost:${PORT}`);
  logger.info(
    {
      frontendUrl: getFrontendUrl(),
      googleCallbackUrl: resolveGoogleCallbackUrl(),
      googleOAuth: getGoogleOAuthDiagnostics(),
      corsOrigins: getAllowedOrigins(),
      corsAllowVercel: isVercelCorsEnabled(),
    },
    'CORS / OAuth origins'
  );
  startFdcCacheWarm();
});

async function shutdown(signal) {
  logger.info({ signal }, 'Shutting down');
  server.close(() => logger.info('HTTP server closed'));
  try {
    await prisma.$disconnect();
  } catch (err) {
    logger.warn({ err }, 'Prisma disconnect failed');
  }
  try {
    await closeRedis();
  } catch (err) {
    logger.warn({ err }, 'Redis disconnect failed');
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'Unhandled rejection'));
process.on('uncaughtException', (err) => logger.error({ err }, 'Uncaught exception'));
