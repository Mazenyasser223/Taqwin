/**
 * Block A4 — shared secret for FastAPI → Node internal API (no JWT).
 * Header: X-Internal-Key: <AI_INTERNAL_KEY>
 */
const crypto = require('crypto');

function internalAuthMiddleware(req, res, next) {
  const expected = process.env.AI_INTERNAL_KEY;
  if (!expected || expected.length < 16) {
    return res.status(503).json({ error: 'Internal API not configured (AI_INTERNAL_KEY)' });
  }

  const provided = req.headers['x-internal-key'];
  if (typeof provided !== 'string' || !provided) {
    return res.status(401).json({ error: 'Missing X-Internal-Key header' });
  }

  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid internal key' });
  }

  next();
}

module.exports = { internalAuthMiddleware };
