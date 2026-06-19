/* eslint-disable no-console */
/**
 * Extract unique exercises from diets & workouts/Workout 1.pdf … Workout 4.pdf
 *
 *   node scripts/extract-workout-pdf-exercises.js
 *   node scripts/extract-workout-pdf-exercises.js --write
 *
 * Output: backend-node/data/diet-workout-catalog/exercises.manifest.json
 */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PDF_DIR = path.join(REPO_ROOT, 'diets & workouts');
const OUT_FILE = path.join(__dirname, '..', 'data', 'diet-workout-catalog', 'exercises.manifest.json');
const WORKOUT_COUNT = 4;

const EXERCISE_LINE = /^\d+\s*-\s*(.+)$/;
const SKIP_NAME =
  /^(sets|reps|rest|technique|time|rpe|max reps|super sets|drop set|hold|negative|amrap|male|female|exercise note)$/i;

function normalizeKey(name) {
  return String(name || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanExerciseName(raw) {
  let name = String(raw || '')
    .replace(/\b(male|female)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || name.length < 3) return null;
  if (SKIP_NAME.test(name)) return null;
  if (/^sets\b/i.test(name)) return null;
  return name;
}

function parseSetsRepsBlock(lines, startIdx) {
  for (let i = startIdx; i < Math.min(startIdx + 4, lines.length); i += 1) {
    const header = lines[i].trim();
    if (!/^sets\b/i.test(header)) continue;
    const values = (lines[i + 1] || '').trim().split(/\s+/);
    const sets = Number(values[0]);
    const repsRaw = values[1] || '';
    const reps = /^\d+$/.test(repsRaw) ? Number(repsRaw) : repsRaw || null;
    return {
      defaultSets: Number.isFinite(sets) && sets > 0 ? sets : null,
      defaultReps: reps,
    };
  }
  return { defaultSets: null, defaultReps: null };
}

function parseExerciseLines(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];

  for (let i = 0; i < lines.length; i += 1) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    const match = trimmed.match(EXERCISE_LINE);
    if (!match) continue;

    const name = cleanExerciseName(match[1]);
    if (!name) continue;

    const meta = parseSetsRepsBlock(lines, i + 1);
    out.push({
      name,
      nameKey: normalizeKey(name),
      ...meta,
    });
  }

  return out;
}

async function extractPdf(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  await parser.destroy();
  return parseExerciseLines(result.text || '');
}

function dedupeExercises(all) {
  const byKey = new Map();
  for (const row of all) {
    const key = row.nameKey || normalizeKey(row.name);
    if (!key) continue;
    if (!byKey.has(key)) {
      byKey.set(key, { ...row, nameKey: key });
      continue;
    }
    const prev = byKey.get(key);
    if (!prev.defaultSets && row.defaultSets) prev.defaultSets = row.defaultSets;
    if (!prev.defaultReps && row.defaultReps) prev.defaultReps = row.defaultReps;
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}

async function main() {
  const write = process.argv.includes('--write');
  const byWorkout = {};
  const all = [];

  for (let i = 1; i <= WORKOUT_COUNT; i += 1) {
    const pdfPath = path.join(PDF_DIR, `Workout ${i}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      console.warn('Missing', pdfPath);
      continue;
    }
    const exercises = await extractPdf(pdfPath);
    byWorkout[String(i)] = exercises;
    all.push(...exercises.map((e) => ({ ...e, workout: i })));
    console.log(`Workout ${i}: ${exercises.length} exercise lines`);
  }

  const unique = dedupeExercises(all);
  console.log(`Unique exercises across Workout 1–${WORKOUT_COUNT}: ${unique.length}`);

  const manifest = {
    version: 1,
    source: 'diets & workouts/Workout 1.pdf … Workout 4.pdf',
    extractedAt: new Date().toISOString(),
    workouts: byWorkout,
    exercises: unique.map(({ name, nameKey, defaultSets, defaultReps }) => ({
      name,
      nameKey,
      defaultSets,
      defaultReps,
    })),
  };

  if (write) {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log('Wrote', OUT_FILE);
  } else {
    console.log('Sample:', unique.slice(0, 12).map((e) => e.name).join(' | '));
    console.log('Pass --write to save manifest.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
