/**
 * Taqwin backend — Express app.
 * Wires CORS, security headers, compression, logging, validation, and all
 * domain routes.
 */
require('express-async-errors');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const pinoHttp = require('pino-http');
const passport = require('./config/passport');
const { logger } = require('./lib/logger');
const { requestIdMiddleware } = require('./middleware/requestId');
const { communityLimiter, marketplaceLimiter } = require('./middleware/rateLimitApi');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const emergencyMigrate = require('./routes/emergency-migrate');
const gymRoutes = require('./routes/gyms');
const workoutRoutes = require('./routes/workouts');
const exerciseRoutes = require('./routes/exercises');
const nutritionRoutes = require('./routes/nutrition');
const marketplaceRoutes = require('./routes/marketplace');
const marketplacePaymentsRoutes = require('./routes/marketplacePayments');
const communityRoutes = require('./routes/community');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const plansRoutes = require('./routes/plans');
const adaptationRoutes = require('./routes/adaptation');
const uploadRoutes = require('./routes/uploads');
const aiRoutes = require('./routes/ai');
const internalAiRoutes = require('./routes/internal/ai');
const internalCronRoutes = require('./routes/internal/cron');
const { getAllowedOrigins, isOriginAllowed } = require('./lib/corsOrigins');
const settingsRoutes = require('./routes/settings');
const settingsAccountRoutes = require('./routes/settingsAccount');
const supportRoutes = require('./routes/support');
const inbodyRoutes = require('./routes/inbody');
const adminShopRoutes = require('./routes/admin/shop');

const app = express();
app.set('trust proxy', 1);

const SERVER_STARTED_AT = new Date().toISOString();

const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = getAllowedOrigins();

app.use(requestIdMiddleware);

// In dev we also accept any LAN IPv4 origin on the same port set so that the
// SPA still works when opened via http://192.168.x.x:3000 etc.
const devLanRegex = /^http:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  })
);
app.use(compression());
app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (isOriginAllowed(origin, allowedOrigins)) return cb(null, true);
      if (!isProd && devLanRegex.test(origin)) return cb(null, true);
      return cb(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

const { handleStripeWebhook } = require('./routes/stripeWebhook');
app.post(
  '/api/marketplace/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

app.use(express.json({ limit: '1mb' }));
app.use(
  pinoHttp({
    logger,
    autoLogging: { ignore: (req) => req.url === '/health' },
    customLogLevel(req, res, err) {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

app.use(passport.initialize());

const uploadsDir = path.join(__dirname, '../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
const { isValidMp4File } = require('./lib/exerciseVideoCache');
app.use('/uploads/exercises', (req, res, next) => {
  if (!/\.mp4$/i.test(req.path)) return next();
  const rel = req.path.replace(/^\/+/, '');
  const abs = path.join(uploadsDir, 'exercises', rel);
  if (!isValidMp4File(abs)) return res.status(404).end();
  next();
});
app.use('/uploads', express.static(uploadsDir));

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
// Shop admin must register before /api/admin emergency router (which 404s unmatched /api/admin/*).
app.use('/api/admin/shop', marketplaceLimiter, adminShopRoutes);
app.use('/api/admin', emergencyMigrate);
app.use('/api/gyms', gymRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/exercises', exerciseRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/marketplace', marketplaceLimiter, marketplaceRoutes);
app.use('/api/marketplace/payments', marketplacePaymentsRoutes);
// Before /api booking catch-all (that router applies authMiddleware to all /api/* paths).
app.use('/api/internal/ai', internalAiRoutes);
app.use('/api/internal/cron', internalCronRoutes);
app.use('/api/community', communityLimiter, communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/adaptation', adaptationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/settings/account', settingsAccountRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/inbody', inbodyRoutes);

app.get('/', (req, res) => {
  res.json({
    service: 'taqwin-api',
    status: 'ok',
    health: '/health',
    healthLive: '/health/live',
    api: '/api',
  });
});

/** Liveness — always 200 if process is up (for uptime monitors / k8s liveness) */
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'taqwin-api',
    uptimeSec: Math.floor(process.uptime()),
    startedAt: SERVER_STARTED_AT,
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', async (req, res) => {
  const { getInfraHealth } = require('./lib/infraHealth');
  const { getGoogleOAuthDiagnostics } = require('./lib/googleOAuthConfig');
  const infra = await getInfraHealth();
  const statusCode = infra.ok ? 200 : 503;

  res.status(statusCode).json({
    status: infra.ok ? 'ok' : 'degraded',
    service: 'taqwin-api',
    database: infra.postgres.status === 'connected' ? 'connected' : 'error',
    stores: {
      postgres: infra.postgres,
      redis: infra.redis,
      mongo: infra.mongo,
      pgvector: infra.pgvector,
      email: infra.email,
    },
    features: infra.features,
    websocket: infra.websocket,
    version: '0.2.0',
    googleOAuth: getGoogleOAuthDiagnostics(),
    uptimeSec: Math.floor(process.uptime()),
    startedAt: SERVER_STARTED_AT,
    timestamp: new Date().toISOString(),
  });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
