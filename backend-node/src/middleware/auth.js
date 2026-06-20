/**
 * Taqwin — JWT auth middleware.
 * Use on routes that require a logged-in user. Sets req.user = { id, email, role }.
 */
const jwt = require('jsonwebtoken');
const { prisma } = require('../db');

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
  }

  try {
    const payload = jwt.verify(token, secret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const tokenVersion = payload.tv ?? 0;
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return next(err);
  }
}

/**
 * Require JWT (use after authMiddleware) and one of the allowed Prisma Role values.
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

/** JWT from Authorization header or ?token= (for <video src> which cannot send headers). */
async function authFromHeaderOrQuery(req, res, next) {
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null) ||
    (typeof req.query.token === 'string' ? req.query.token : null);

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return res.status(500).json({ error: 'Server misconfiguration: JWT_SECRET not set' });
  }

  try {
    const payload = jwt.verify(token, secret);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, tokenVersion: true },
    });
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    const tokenVersion = payload.tv ?? 0;
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }
    req.user = { id: user.id, email: user.email, role: user.role };
    next();
  } catch (err) {
    if (err?.name === 'JsonWebTokenError' || err?.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    return next(err);
  }
}

/** Platform shop admin — must run after authMiddleware. */
const requireAdmin = requireRole('admin');

const { requireShopAdmin } = require('../lib/shopAdminAccess');

module.exports = { authMiddleware, authFromHeaderOrQuery, requireRole, requireAdmin, requireShopAdmin };
