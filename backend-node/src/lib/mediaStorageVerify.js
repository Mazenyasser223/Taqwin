const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));

const UPLOAD_FOLDER_PATTERN = /\/(posts|stories|covers|avatars|messages|progress|support|gyms|products)\/([0-9a-f-]{36})\//i;

/**
 * Ensure a media URL points at this user's upload folder (posts/stories/etc.).
 */
function assertMediaOwnedByUser(url, userId) {
  if (!url || !userId) {
    throw new Error('Invalid media reference');
  }
  const normalized = String(url).replace(/\\/g, '/');
  const match = normalized.match(UPLOAD_FOLDER_PATTERN);
  if (!match) {
    throw new Error('Media URL is not from an allowed upload location');
  }
  if (match[2].toLowerCase() !== String(userId).toLowerCase()) {
    throw new Error('Media file does not belong to this user');
  }
}

function resolveLocalUploadPath(url) {
  const normalized = String(url).replace(/\\/g, '/');
  const idx = normalized.indexOf('/uploads/');
  if (idx === -1) return null;
  const relative = normalized.slice(idx + '/uploads/'.length);
  return path.join(UPLOAD_ROOT, relative.split('/').join(path.sep));
}

async function assertRemoteMediaReachable(url) {
  const fetch = require('node-fetch');
  let res;
  try {
    res = await fetch(url, { method: 'HEAD', timeout: 12_000 });
  } catch (err) {
    throw new Error(`Media file is not reachable in storage (${err.message?.slice(0, 80) || 'network error'})`);
  }
  if (res.ok) return;
  if (res.status === 405 || res.status === 403) {
    const probe = await fetch(url, {
      method: 'GET',
      headers: { Range: 'bytes=0-0' },
      timeout: 12_000,
    });
    if (probe.ok || probe.status === 206) return;
  }
  throw new Error(`Media file is not reachable in storage (HTTP ${res.status})`);
}

/**
 * Confirm uploaded media exists in local disk or remote storage before linking to a post.
 */
async function assertMediaUrlStored(url, userId) {
  assertMediaOwnedByUser(url, userId);

  const localPath = resolveLocalUploadPath(url);
  if (localPath) {
    if (fs.existsSync(localPath) && fs.statSync(localPath).size > 0) return;
  }

  if (String(url).startsWith('https://') || String(url).startsWith('http://')) {
    await assertRemoteMediaReachable(url);
    return;
  }

  throw new Error('Media file was not found in storage');
}

async function assertMediaItemsStored(items, userId) {
  if (!items?.length) return;
  for (const item of items) {
    if (!item?.url?.trim()) {
      throw new Error('Media item is missing a storage URL');
    }
    await assertMediaUrlStored(item.url.trim(), userId);
  }
}

module.exports = {
  assertMediaUrlStored,
  assertMediaItemsStored,
  assertMediaOwnedByUser,
};
