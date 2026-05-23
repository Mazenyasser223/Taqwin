/**
 * Download MuscleWiki CDN videos via Playwright (bypasses Cloudflare) into local uploads.
 */
const fs = require('fs');
const path = require('path');

const UPLOAD_ROOT = path.join(__dirname, '../../uploads/exercises');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeFilename(name) {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_');
}

function localRelativePath(muscleWikiId, filename) {
  return `exercises/${muscleWikiId}/${safeFilename(filename)}`;
}

function localAbsolutePath(muscleWikiId, filename) {
  return path.join(UPLOAD_ROOT, String(muscleWikiId), safeFilename(filename));
}

function publicLocalUrl(muscleWikiId, filename) {
  return `/uploads/${localRelativePath(muscleWikiId, filename)}`;
}

function isValidMp4Buffer(buf) {
  if (!buf || buf.length < 12) return false;
  const head = buf.subarray(0, Math.min(buf.length, 64));
  if (head.indexOf(Buffer.from('ftyp')) >= 0) return true;
  return false;
}

function isValidMp4File(absPath) {
  if (!absPath || !fs.existsSync(absPath)) return false;
  try {
    const st = fs.statSync(absPath);
    if (st.size < 10_000) return false;
    const head = Buffer.alloc(64);
    const fd = fs.openSync(absPath, 'r');
    const n = fs.readSync(fd, head, 0, 64, 0);
    fs.closeSync(fd);
    return isValidMp4Buffer(head.subarray(0, n));
  } catch {
    return false;
  }
}

function fileExists(muscleWikiId, filename) {
  const abs = localAbsolutePath(muscleWikiId, filename);
  return isValidMp4File(abs);
}

let browserInstance = null;

async function getBrowser(headless = true) {
  if (!browserInstance) {
    const { chromium } = require('playwright');
    browserInstance = await chromium.launch({ headless });
  }
  return browserInstance;
}

async function downloadVideoUrl(videoUrl, muscleWikiId, filename, slug) {
  const abs = localAbsolutePath(muscleWikiId, filename);
  if (isValidMp4File(abs)) {
    return publicLocalUrl(muscleWikiId, filename);
  }
  if (fs.existsSync(abs)) {
    try {
      fs.unlinkSync(abs);
    } catch {
      /* ignore */
    }
  }

  ensureDir(path.dirname(abs));
  const cleanUrl = videoUrl.split('#')[0];
  const exerciseSlug = slug || filename.replace(/-(front|side)\.mp4$/i, '').replace(/^male-|^female-/, '');

  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    await page.goto('https://musclewiki.com/', { waitUntil: 'domcontentloaded', timeout: 90_000 });
    await page.waitForTimeout(1500);

    let body = null;
    try {
      const respPromise = page.waitForResponse(
        (r) => r.url().includes(filename) && r.status() === 200,
        { timeout: 45_000 },
      );
      await page.goto(`https://musclewiki.com/exercise/${exerciseSlug}`, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      });
      const intercepted = await respPromise;
      body = await intercepted.body();
    } catch {
      const direct = await page.goto(cleanUrl, { waitUntil: 'commit', timeout: 60_000 });
      if (direct?.ok()) body = await direct.body();
    }

    if (!body || body.length < 10_000 || !isValidMp4Buffer(body)) {
      throw new Error(`Could not download ${filename}`);
    }
    fs.writeFileSync(abs, body);
    return publicLocalUrl(muscleWikiId, filename);
  } finally {
    await page.close();
    await context.close();
  }
}

async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

module.exports = {
  UPLOAD_ROOT,
  ensureDir,
  publicLocalUrl,
  fileExists,
  isValidMp4File,
  isValidMp4Buffer,
  localAbsolutePath,
  downloadVideoUrl,
  closeBrowser,
};
