/* eslint-disable no-console */
/**
 * Node ↔ Python CAG sanitize parity on shared fixture.
 *
 *   npm run verify:cag-sanitize:parity
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const repoRoot = path.join(root, '..');
const fixturePath = path.join(repoRoot, 'shared', 'cag-sanitize-fixture.json');
const { sanitizeCagBundle } = require('../src/lib/cag/sanitizeCag');

function stableStringify(value) {
  return JSON.stringify(value, Object.keys(value).sort(), 0);
}

function deepSort(value) {
  if (Array.isArray(value)) return value.map(deepSort);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = deepSort(value[key]);
    }
    return out;
  }
  return value;
}

function main() {
  console.log('CAG sanitize parity (Node vs Python)\n');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const nodeOut = deepSort(sanitizeCagBundle(fixture));

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cag-parity-'));
  const pyOutPath = path.join(tmpDir, 'python-sanitized.json');
  const pyScript = path.join(repoRoot, 'ai-service', 'scripts', 'verify_cag_parity.py');
  const run = spawnSync('python', [pyScript, fixturePath, pyOutPath], {
    cwd: path.join(repoRoot, 'ai-service'),
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout || 'Python parity script failed');
    process.exit(1);
  }

  const pyOut = deepSort(JSON.parse(fs.readFileSync(pyOutPath, 'utf8')));
  const nodeJson = JSON.stringify(nodeOut);
  const pyJson = JSON.stringify(pyOut);

  if (nodeJson !== pyJson) {
    console.error('✗ Node and Python sanitized bundles differ');
    console.error('Node keys:', Object.keys(nodeOut));
    console.error('Python keys:', Object.keys(pyOut));
    process.exit(1);
  }

  const mustNeutralize = [
    String(nodeOut.profile?.medicalNotes || ''),
    String(nodeOut.readinessLatest?.notes || ''),
    String(nodeOut.onboardingSummary?.injuries?.[1] || ''),
  ];
  for (const text of mustNeutralize) {
    if (!text.includes('[removed]')) {
      console.error(`✗ Expected [removed] in sanitized field, got: ${text}`);
      process.exit(1);
    }
  }

  console.log('✓ Node/Python parity on shared/cag-sanitize-fixture.json');
  process.exit(0);
}

main();
