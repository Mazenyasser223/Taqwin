/**
 * Live test: Claude Vision InBody extraction.
 * Usage: node scripts/test-inbody-extract.js [path-to-image-or-pdf]
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { extractInbodyWithClaude } = require('../src/lib/inbody/claudeExtract');

const defaultImage = path.join(
  __dirname,
  '../../../assets/c__Users_magdy_AppData_Roaming_Cursor_User_workspaceStorage_2c67b976f84fadfebc3e38f0288262be_images_image-2eb8fb78-4d83-41a1-84b2-0ee205f1e210.png',
);

const filePath = process.argv[2] || defaultImage;

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('FAIL: ANTHROPIC_API_KEY not set');
    process.exit(1);
  }
  if (!fs.existsSync(filePath)) {
    console.error('FAIL: file not found:', filePath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';

  console.log('Extracting from:', filePath, `(${buffer.length} bytes)`);
  const start = Date.now();
  const extracted = await extractInbodyWithClaude({ buffer, mimeType, filename: path.basename(filePath) });
  console.log('Done in', Date.now() - start, 'ms\n');
  console.log(JSON.stringify(extracted, null, 2));

  const checks = [
    ['weightKg', 77.9, 0.5],
    ['bodyFatPercent', 17.7, 0.5],
    ['skeletalMuscleMassKg', 36.6, 0.5],
    ['bmi', 27.0, 0.5],
    ['basalMetabolicRate', 1753, 30],
    ['visceralFatLevel', 6, 1],
    ['inbodyScore', 87, 2],
  ];

  let passed = 0;
  for (const [key, expected, tol] of checks) {
    const actual = extracted[key];
    const ok = actual != null && Math.abs(actual - expected) <= tol;
    console.log(`${ok ? 'OK' : 'MISS'} ${key}: ${actual} (expected ~${expected})`);
    if (ok) passed += 1;
  }
  console.log(`\n${passed}/${checks.length} core fields within tolerance`);
  process.exit(passed >= 4 ? 0 : 1);
}

main().catch((err) => {
  console.error('FAIL:', err.message);
  process.exit(1);
});
