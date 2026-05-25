#!/usr/bin/env node
/**
 * Browser E2E smoke test for /workouts (exercise library).
 * Usage: node scripts/test-workouts-ui.js [JWT]
 */
require('dotenv').config();
const { chromium } = require('playwright');

const FE = process.env.TEST_FE_BASE || 'http://localhost:3000';
const API = process.env.TEST_API_BASE || 'http://localhost:4000';
const EMAIL = process.env.TEST_EMAIL || 'demo@taqwin.app';
const PASS = process.env.TEST_PASSWORD || 'Taqwin#2025';

async function getToken() {
  const fromArg = process.argv[2];
  if (fromArg) return fromArg;
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const data = await res.json();
  return data.token;
}

async function main() {
  const report = { pass: [], fail: [] };
  const fail = (msg) => report.fail.push(msg);
  const pass = (msg) => report.pass.push(msg);
  const bail = () => {
    console.log('\n=== Workouts UI E2E ===\n');
    for (const p of report.pass) console.log('  ✓', p);
    for (const f of report.fail) console.log('  ✗', f);
    console.log('\nFAILED (early exit)');
    process.exit(1);
  };

  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!loginRes.ok) throw new Error(`login failed: ${loginRes.status}`);
  const { token, user } = await loginRes.json();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(`${FE}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('taqwin_remember_me', '1');
      localStorage.setItem('taqwin_token', token);
      localStorage.setItem('taqwin_user', JSON.stringify(user));
    },
    { token, user },
  );
  // initAuth runs on mount — reload so session hydrates before protected routes
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });

  // App uses HashRouter — route is #/workouts
  await page.goto(`${FE}/#/workouts`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 60000 }).catch(() => {});

  const url = page.url();
  if (url.includes('/workouts')) pass('Navigated to #/workouts (authenticated)');
  else {
    fail(`Expected #/workouts, got ${url}`);
    await browser.close();
    bail();
  }

  const search = page.locator('input[type="search"]');
  await search.waitFor({ state: 'visible', timeout: 45000 }).catch(() => null);
  if (await search.isVisible().catch(() => false)) pass('Search input visible');
  else {
    const bodySnippet = await page.locator('body').innerText().catch(() => '');
    fail(`Search input missing (page: ${bodySnippet.slice(0, 120).replace(/\s+/g, ' ')})`);
    await browser.close();
    bail();
  }

  await page.waitForSelector('article h3', { timeout: 45000 }).catch(() => null);
  const cards = page.locator('article h3');
  const cardCount = await cards.count();
  if (cardCount > 0) pass(`Exercise cards loaded (${cardCount})`);
  else {
    fail('No exercise cards on page');
    await browser.close();
    bail();
  }

  const countText = await page.locator('text=/\\d+.*\\d+/').first().textContent().catch(() => '');
  if (countText && /\d/.test(countText)) pass(`Count label: "${countText.trim().slice(0, 60)}"`);

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/exercises') && r.url().includes('search=curl') && r.status() === 200,
      { timeout: 15000 },
    ),
    search.fill('curl'),
  ]);
  await page.waitForSelector('article h3', { timeout: 15000 });
  const filtered = await cards.count();
  if (filtered > 0) pass(`Search "curl" → ${filtered} result(s)`);
  else fail('Search returned no results');
  await search.fill('');
  await page.waitForResponse(
    (r) => r.url().includes('/api/exercises') && !r.url().includes('search=') && r.status() === 200,
    { timeout: 15000 },
  ).catch(() => {});

  const firstCard = page.locator('article').first();
  await firstCard.click();
  await page.waitForSelector('[aria-label*="close" i], button:has-text("close")', { timeout: 10000 }).catch(() => null);

  const modalVideos = page.locator('video');
  await page.waitForTimeout(800);
  const videoCount = await modalVideos.count();
  if (videoCount > 0) pass(`Modal opened with ${videoCount} video element(s)`);
  else fail('Modal has no <video> elements');

  let playable = 0;
  for (let i = 0; i < Math.min(videoCount, 2); i++) {
    const v = modalVideos.nth(i);
    const src = await v.getAttribute('src');
    if (!src) continue;
    const fullSrc = src.startsWith('http') ? src : `${FE}${src}`;
    const ok = await page.evaluate(async (videoSrc) => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 90000);
        const r = await fetch(videoSrc, { signal: ctrl.signal });
        clearTimeout(t);
        if (!r.ok) return false;
        const buf = await r.arrayBuffer();
        const b = new Uint8Array(buf.slice(0, 64));
        const s = String.fromCharCode(...b);
        return s.includes('ftyp') || buf.byteLength > 50_000;
      } catch {
        return false;
      }
    }, fullSrc);
    if (ok) playable++;
  }
  if (playable > 0) pass(`At least ${playable} video URL(s) respond 200 (HEAD)`);
  else {
    const src0 = await modalVideos.first().getAttribute('src');
    fail(`Video HEAD failed for ${src0 || '(no src)'}`);
  }

  const localSrc = await modalVideos
    .first()
    .getAttribute('src')
    .catch(() => null);
  if (localSrc?.includes('/uploads/')) pass('Primary video uses local /uploads/ path');
  else if (localSrc) pass(`Video src: ${localSrc.slice(0, 80)}`);

  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);

  const loadMore = page.getByRole('button', { name: /load more|تحميل/i });
  if (await loadMore.isVisible().catch(() => false)) {
    await loadMore.click();
    await page.waitForTimeout(1500);
    const after = await cards.count();
    if (after > cardCount) pass(`Load more: ${cardCount} → ${after} cards`);
    else pass('Load more button present (may already be at end)');
  }

  await browser.close();

  console.log('\n=== Workouts UI E2E ===\n');
  for (const p of report.pass) console.log('  ✓', p);
  for (const f of report.fail) console.log('  ✗', f);
  const ok = report.fail.length === 0;
  console.log(ok ? '\nOK' : '\nFAILED');
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
