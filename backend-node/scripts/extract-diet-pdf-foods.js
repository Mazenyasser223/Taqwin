/* eslint-disable no-console */
/**
 * Extract unique food names from diets & workouts/Diet 1.pdf … Diet 8.pdf
 *
 *   node scripts/extract-diet-pdf-foods.js
 *   node scripts/extract-diet-pdf-foods.js --write
 *
 * Output: backend-node/data/diet-workout-catalog/foods.manifest.json
 */
const fs = require('fs');
const path = require('path');
const { PDFParse } = require('pdf-parse');

const REPO_ROOT = path.join(__dirname, '..', '..');
const PDF_DIR = path.join(REPO_ROOT, 'diets & workouts');
const OUT_FILE = path.join(__dirname, '..', 'data', 'diet-workout-catalog', 'foods.manifest.json');
const DIET_COUNT = 8;

const MEAL_HEADER =
  /^(breakfast|lunch|snack|dinner|before workout|after workout|supplements|name\b)/i;
const SKIP_LINE =
  /(-- \d+ of \d+ --|www\.|vanation|MO10|ﺦﺒﻃ|مﺎﻈﻨ|تﺎﻈﺣﻼﻤ|ﻞﺋاﺪﺒ|بدائل|supplements|pre workout|iso triple)/i;
const GRAM_RE = /(?:مج|ﻢﺟ)\s*(\d+)|(\d+)\s*(?:مج|ﻢﺟ)/;

function fixPdfArabic(text) {
  return String(text || '')
    .split(/\s+/)
    .map((token) => {
      if (/[\u0600-\u06FF]/.test(token)) return [...token].reverse().join('');
      return token;
    })
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanFoodName(raw) {
  let name = String(raw || '')
    .replace(GRAM_RE, '')
    .replace(/[():،,.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  name = fixPdfArabic(name);
  name = name
    .replace(/^(وا|或|or)\s+/i, '')
    .replace(/\s+(وا|或)\s+/g, ' ')
    .trim();
  if (!name || name.length < 2) return null;
  if (/^\d+$/.test(name)) return null;
  if (MEAL_HEADER.test(name)) return null;
  if (SKIP_LINE.test(name)) return null;
  return name;
}

function parseFoodLines(text) {
  const foods = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length < 4) continue;
    if (MEAL_HEADER.test(trimmed)) continue;
    if (SKIP_LINE.test(trimmed)) continue;
    if (!GRAM_RE.test(trimmed)) continue;

    const gramMatch = trimmed.match(GRAM_RE);
    if (!gramMatch) continue;
    const grams = Number(gramMatch[1] || gramMatch[2] || 0);
    if (!Number.isFinite(grams) || grams <= 0 || grams > 2000) continue;

    const before = trimmed.slice(0, gramMatch.index).trim();
    const after = trimmed.slice(gramMatch.index + gramMatch[0].length).trim();
    const nameRaw = after.length >= before.length ? after : before;
    const name = cleanFoodName(nameRaw);
    if (!name) continue;
    foods.push({ nameAr: name, gramsExample: grams });
  }
  return foods;
}

async function extractPdf(pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const parser = new PDFParse({ data: buf });
  const result = await parser.getText();
  await parser.destroy();
  return parseFoodLines(result.text || '');
}

function dedupeFoods(all) {
  const byKey = new Map();
  for (const row of all) {
    const key = row.nameAr.toLowerCase().replace(/\s+/g, ' ');
    if (!byKey.has(key)) byKey.set(key, row);
  }
  return [...byKey.values()].sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
}

async function main() {
  const write = process.argv.includes('--write');
  const byDiet = {};
  const all = [];

  for (let i = 1; i <= DIET_COUNT; i += 1) {
    const pdfPath = path.join(PDF_DIR, `Diet ${i}.pdf`);
    if (!fs.existsSync(pdfPath)) {
      console.warn('Missing', pdfPath);
      continue;
    }
    const foods = await extractPdf(pdfPath);
    byDiet[String(i)] = foods;
    all.push(...foods.map((f) => ({ ...f, diet: i })));
    console.log(`Diet ${i}: ${foods.length} food lines`);
  }

  const unique = dedupeFoods(all);
  console.log(`Unique foods across Diet 1–${DIET_COUNT}: ${unique.length}`);

  const manifest = {
    version: 1,
    source: 'diets & workouts/Diet 1.pdf … Diet 8.pdf',
    extractedAt: new Date().toISOString(),
    diets: byDiet,
    foods: unique.map(({ nameAr, gramsExample }) => ({ nameAr, gramsExample })),
  };

  if (write) {
    fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
    fs.writeFileSync(OUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log('Wrote', OUT_FILE);
  } else {
    console.log('Sample names:', unique.slice(0, 15).map((f) => f.nameAr).join(' | '));
    console.log('Pass --write to save manifest.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
