/**
 * Reusable rate limiters: brute-force protection on auth and AI proxy.
 */
const rateLimit = require('express-rate-limit');

const authMax = Number(process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 60 : 200));
const aiMax = Number(process.env.AI_RATE_LIMIT_MAX || (process.env.NODE_ENV === 'production' ? 30 : 100));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(authMax) && authMax > 0 ? authMax : 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again later.' },
});

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number.isFinite(aiMax) && aiMax > 0 ? aiMax : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached. Try again in a minute.' },
});

module.exports = { authLimiter, aiLimiter };
