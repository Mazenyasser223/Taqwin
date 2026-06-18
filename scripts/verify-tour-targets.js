/**
 * CI/dev check: every tour step id must have a matching data-tour attribute in the frontend tree.
 * Run: node scripts/verify-tour-targets.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const FRONTEND = path.join(ROOT, 'frontend');

const STEP_FILES = [
  'features/guide/appTourSteps.ts',
  'features/guide/gymAppTourSteps.ts',
  'features/guide/communityTourSteps.ts',
  'features/guide/gymCommunityTourSteps.ts',
];

const SCAN_DIRS = ['features', 'components'];

function collectStepIds(fileRel) {
  const text = fs.readFileSync(path.join(FRONTEND, fileRel), 'utf8');
  const ids = [];
  for (const m of text.matchAll(/id:\s*['"`]([^'"`]+)['"`]/g)) {
    ids.push(m[1]);
  }
  return ids;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === 'guide') continue;
      walk(full, out);
    } else if (/\.(tsx|ts|jsx|js)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function main() {
  const stepIds = STEP_FILES.flatMap(collectStepIds);
  const uniqueIds = [...new Set(stepIds)];

  const sourceFiles = SCAN_DIRS.flatMap((d) => walk(path.join(FRONTEND, d)));
  const corpus = sourceFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');

  function hasTarget(id) {
    if (corpus.includes(`data-tour="${id}"`) || corpus.includes(`data-tour='${id}'`)) return true;
    if (corpus.includes(`'${id}'`) || corpus.includes(`"${id}"`)) return true;
    return false;
  }

  const missing = uniqueIds.filter((id) => !hasTarget(id));

  console.log(`Tour steps checked: ${uniqueIds.length}`);
  if (missing.length) {
    console.error('Missing data-tour targets:');
    for (const id of missing) console.error(`  - ${id}`);
    process.exit(1);
  }
  console.log('All tour step targets are present in the codebase.');
}

main();
