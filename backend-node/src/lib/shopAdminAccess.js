/**
 * Shop admin — email allowlist only (not platform admin role).
 * Set SHOP_ADMIN_EMAILS in .env (comma-separated).
 */
function getShopAdminEmails() {
  const raw = process.env.SHOP_ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function isShopAdmin(user) {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  const allowlist = getShopAdminEmails();
  if (!allowlist.length) return false;
  return allowlist.includes(email);
}

function enrichAuthUser(user) {
  if (!user || typeof user !== 'object') return user;
  return { ...user, canManageShop: isShopAdmin(user) };
}

function requireShopAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (!isShopAdmin(req.user)) {
    return res.status(403).json({ error: 'Shop management access is restricted' });
  }
  next();
}

module.exports = {
  getShopAdminEmails,
  isShopAdmin,
  enrichAuthUser,
  requireShopAdmin,
};
