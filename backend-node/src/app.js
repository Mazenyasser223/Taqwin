/**
 * Taqwin backend — Express app.
 * CORS, JSON body, health route (includes DB check). Auth and API routes in Sprint 1.
 */
const express = require('express');
const cors = require('cors');
const { prisma } = require('./db');
const passport = require('./config/passport');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const emergencyMigrate = require('./routes/emergency-migrate');

const app = express();

// CORS configuration for OAuth
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Initialize Passport
app.use(passport.initialize());

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', emergencyMigrate);

app.get('/health', async (req, res) => {
  let db = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = 'connected';
  } catch (e) {
    db = 'error';
  }
  res.json({ status: 'ok', service: 'taqwin-api', database: db });
});

module.exports = app;
