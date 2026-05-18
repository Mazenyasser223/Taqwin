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
const { prisma } = require('./db');
const { logger } = require('./lib/logger');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const emergencyMigrate = require('./routes/emergency-migrate');
const gymRoutes = require('./routes/gyms');
const workoutRoutes = require('./routes/workouts');
const nutritionRoutes = require('./routes/nutrition');
const marketplaceRoutes = require('./routes/marketplace');
const bookingRoutes = require('./routes/bookings');
const communityRoutes = require('./routes/community');
const notificationRoutes = require('./routes/notifications');
const dashboardRoutes = require('./routes/dashboard');
const uploadRoutes = require('./routes/uploads');
const aiRoutes = require('./routes/ai');
const settingsRoutes = require('./routes/settings');
const settingsAccountRoutes = require('./routes/settingsAccount');
const supportRoutes = require('./routes/support');

const app = express();
app.set('trust proxy', 1);

const isProd = process.env.NODE_ENV === 'production';
const allowedOrigins = isProd
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : [
      process.env.FRONTEND_URL || 'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:3001',
    ];

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
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (!isProd && devLanRegex.test(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
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
app.use('/uploads', express.static(uploadsDir));

// Trainers + bookings live under the same router (prefix /api). The bookings
// router exposes /trainers, /trainers/:id, and /bookings/* paths.
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', emergencyMigrate);
app.use('/api/gyms', gymRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api', bookingRoutes); // /api/trainers, /api/bookings
app.use('/api/community', communityRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/settings/account', settingsAccountRoutes);
app.use('/api/support', supportRoutes);

app.get('/health', async (req, res) => {
  let db = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'connected';
  } catch {
    db = 'error';
  }
  res.json({ status: 'ok', service: 'taqwin-api', database: db, version: '0.2.0' });
});

app.use(notFound);
app.use(errorHandler);

module.exports = app;
