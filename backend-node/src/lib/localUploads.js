/**
 * Local disk uploads when Supabase Storage is not configured (dev-friendly).
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads');
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']);
const ALLOWED_FOLDERS = new Set(['avatars', 'products', 'gyms', 'posts']);

function extFromMime(mime) {
  const map = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
  return map[mime] || 'jpg';
}

function apiPublicBase(req) {
  if (process.env.API_PUBLIC_URL) return process.env.API_PUBLIC_URL.replace(/\/$/, '');
  const host = req.get('host') || `localhost:${process.env.PORT || 4000}`;
  const proto = req.protocol || 'http';
  return `${proto}://${host}`;
}

function saveLocalImage({ folder, userId, buffer, mimetype }) {
  if (!ALLOWED_FOLDERS.has(folder)) {
    throw new Error('Invalid upload folder');
  }
  if (!ALLOWED_MIME.has(mimetype)) {
    throw new Error('Only PNG, JPEG, WebP, and GIF images are allowed');
  }
  const ext = extFromMime(mimetype);
  const filename = `${crypto.randomUUID()}.${ext}`;
  const dir = path.join(UPLOAD_ROOT, folder, userId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return { filename, relativeKey: `${folder}/${userId}/${filename}` };
}

function publicUrlForKey(req, relativeKey) {
  return `${apiPublicBase(req)}/uploads/${relativeKey}`;
}

module.exports = {
  UPLOAD_ROOT,
  ALLOWED_FOLDERS,
  saveLocalImage,
  publicUrlForKey,
  apiPublicBase,
};
