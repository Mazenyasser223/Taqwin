#!/usr/bin/env node
/**
 * Map nutrition/{category}/*.jpg → Webteb foods → frontend/public/nutrition/foods/
 *
 * Usage:
 *   node scripts/sync-nutrition-food-photos.js
 *   node scripts/sync-nutrition-food-photos.js --dry-run
 *   node scripts/sync-nutrition-food-photos.js --report-unmatched
 */
require('dotenv').config({ override: true });
const fs = require('fs');
const path = require('path');
const { prisma } = require('../src/db');

/** Folder name → primary DB category id (must match webteb_categories.id). */
const FOLDER_TO_CATEGORY = {
  'الجبن و اللبن': 'dairy-eggs',
  الدهون: 'fats-oils',
  بهارات: 'spices-and-herbs',
  حساء: 'soups-broths',
  'حبوب الافطار': 'breakfast-cereals',
  خضار: 'vegetables',
  'لحم خروف': 'lamb-veal',
  'مؤكلات بحرية': 'seafood',
  حلويات: 'sweets',
  'وجبات سريعة': 'fast-food',
  مسليات: 'snacks',
  دواجن: 'poultry',
  عصير: 'fruits-juices',
  الحبوب: 'nuts-seeds',
  مشروبات: 'beverages',
  المخبوزات: 'bakery',
  الباستا: 'grains-pasta',
};

/** Extra DB categories to search when primary pool misses (same folder). */
const FOLDER_EXTRA_CATEGORIES = {
  بهارات: ['vegetables'],
  'الجبن و اللبن': ['beverages'],
  'لحم خروف': ['beef'],
};

const SYNONYMS = [
  [/فراخ/g, 'دجاج'],
  [/فراخه/g, 'دجاج'],
  [/نية/g, 'نيء'],
  [/\bني\b/g, 'نيء'],
  [/مطبوخه/g, 'مطبوخ'],
  [/مشويه/g, 'مشوي'],
  [/مقليه/g, 'مقلي'],
  [/امريكي/g, 'امريك'],
  [/سويسري/g, 'سويس'],
  [/فانيليا/g, 'فانيل'],
  [/فانليا/g, 'فانيل'],
  [/شوكلات/g, 'شوكولات'],
  [/شوكول/g, 'شوكولات'],
  [/بالشوكولات/g, 'شوكولات'],
  [/بالشوكلات/g, 'شوكولات'],
  [/شوكلاته/g, 'شوكولات'],
  [/تونه/g, 'تونة'],
  [/انشوج/g, 'anchov'],
  [/انشوف/g, 'anchov'],
  [/اذن/g, 'اذن'],
  [/رنج/g, 'رنج'],
  [/شابل/g, 'shad'],
  [/فاصوليا بيض/g, 'فاصوليا'],
  [/لبن صويا/g, 'صويا'],
  [/ريكفورد/g, 'leicester'],
  [/kitkat/g, 'kit kat'],
  [/مرجرين/g, 'margarin'],
  [/مونتري/g, 'monterey'],
  [/اوريجان/g, 'oregano'],
  [/أوريجان/g, 'oregano'],
  [/الهيل/g, 'هال'],
  [/هيل/g, 'هال'],
  [/بابريك/g, 'بابريك'],
  [/كبر/g, 'كبير'],
  [/الكبر/g, 'كبير'],
  [/تيلسيت/g, 'tilsit'],
  [/ليمبرجر/g, 'limburger'],
  [/رايب/g, 'laban'],
  [/بياض/g, 'بياض'],
  [/صفار/g, 'صفار'],
  [/جنزبيل/g, 'زنجبيل'],
  [/زعنر/g, 'زعتر'],
  [/ةرق/g, 'ورق'],
  [/افاكاد/g, 'افوكاد'],
  [/الكوسه/g, 'كوسا'],
  [/الكوسة/g, 'كوسا'],
  [/بسله/g, 'بازلا'],
  [/بسلة/g, 'بازلا'],
  [/الهندبائ/g, 'هندباء'],
  [/جكبري/g, 'جمبري'],
  [/kellogs/g, 'kellogg'],
];

/** Normalized file stem → extra search terms (Arabic/English fragments). */
const STEM_SEARCH_ALIASES = {
  'بابريكا': ['بابريك', 'paprika'],
  'الهيل': ['هال', 'cardamom'],
  'هيل': ['هال', 'cardamom'],
  'الأوريجانو': ['oregano', 'اوريجان'],
  'اوريجانو': ['oregano'],
  'بصل': ['بصل', 'onion'],
  'تيلسيت': ['tilsit'],
  'ليمبرجر': ['limburger'],
  'جبنة مونتري': ['monterey', 'jack'],
  'ريكفورد': ['leicester'],
  'رايب': ['laban', 'rayeb'],
  'مرجرين': ['margarin', 'margarine'],
  'زبادي بالشوكولات': ['شوكولات', 'chocolate', 'زبادي'],
  'مشروب الشوكولات': ['شوكولات', 'chocolate'],
  'بيض ني': ['بيض', 'نيء', 'egg'],
  'بيض مسلوق': ['مسلوق', 'boiled', 'egg'],
  'بيض مقلي': ['مقلي', 'fried', 'egg'],
  'بياض بيض': ['بياض', 'egg white'],
  'صفار بيض': ['صفار', 'yolk'],
  'البيض': ['بيض', 'egg'],
  'port salut cheese': ['port salut', 'port-salut'],
  'جنزبيل': ['زنجبيل', 'ginger'],
  'كاري': ['curry', 'كري'],
  'زيت افاكادو': ['avocado', 'افوكاد'],
  'الكوسة': ['كوسا', 'zucchini'],
  'بسلة': ['بازلا', 'peas'],
  'اعشاب بحرية': ['اعشاب', 'seaweed', 'طحالب'],
  'الهندبائ': ['هندباء', 'endive'],
  'سلطة بطاطس': ['بطاطس', 'potato salad'],
  'شوربة سلطعون': ['سلطعون', 'crab'],
  'شوربة بسلة': ['بازلا', 'pea soup'],
  'شوربة كريم جكبري': ['جمبري', 'shrimp', 'كريم'],
  'alpha bites': ['alpha', 'alpha-b'],
  'kellogs': ['kellogg', 'all-bran'],
  'زعنر': ['زعتر', 'zaatar'],
  'تونة نية': ['tuna', 'تونة', 'نيء'],
  'انشوجة نية': ['anchov', 'anchovy', 'نيء'],
  'رنجة': ['herring', 'رنج'],
  'اذن البحر': ['abalone', 'اذن', 'بحر'],
  'بطارخ نية': ['caviar', 'بطarخ', 'roe', 'نيء'],
  'ةرق الغار': ['ورق', 'غار', 'bay'],
  'زبادي بالشوكلاتة': ['شوكولات', 'chocolate', 'زبادي'],
  'مشروب الشوكلاتة': ['شوكولات', 'chocolate'],
  'فاصوليا بيضا': ['فاصوليا', 'bean'],
  'لبن صويا': ['soy', 'soymilk', 'صويا'],
  'kitkat': ['kit kat'],
  'اضلاع نية': ['ribs', 'ضلع', 'نيء'],
  'خاصرة نية': ['خاصره', 'loin', 'نيء'],
  'رئة خروف': ['رئه', 'lung'],
  'قلوب مطبوخ': ['قلب', 'heart', 'مطبوخ'],
  'كبدة نية': ['كبده', 'liver', 'نيء'],
  'سمك شابل': ['shad'],
};

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.avif']);
const PUBLIC_FOODS_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'nutrition', 'foods');
const MANIFEST_PATH = path.join(PUBLIC_FOODS_DIR, 'manifest.json');
const OVERRIDES_PATH = path.join(__dirname, '..', '..', 'nutrition', 'photo-overrides.json');
const MIN_SCORE = Number(process.env.NUTRITION_PHOTO_MIN_SCORE || 52);

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\u0640/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function expandStem(stem) {
  let s = normalizeText(stem.replace(/_/g, ' '));
  for (const [re, rep] of SYNONYMS) s = s.replace(re, rep);
  return s;
}

function cleanStem(stem) {
  let s = expandStem(stem);
  s = s.replace(/^ال(?=\p{L})/u, '');
  s = s.replace(/^(جبنه|جبن|جبنة|زبادي|حليب|سمك|لحم|توابل)\s+/u, '');
  return s.trim();
}

function stemBeforeComma(name) {
  return normalizeText(String(name || '').split(/[,،]/)[0]);
}

function searchTermsForStem(stem) {
  const cleaned = cleanStem(stem);
  const raw = normalizeText(stem.replace(/_/g, ' '));
  const terms = new Set([cleaned, raw, expandStem(stem)]);
  for (const [key, aliases] of Object.entries(STEM_SEARCH_ALIASES)) {
    const nk = normalizeText(key);
    if (nk === cleaned || nk === raw) {
      for (const a of aliases) terms.add(normalizeText(a));
    } else if (cleaned.includes(nk) || nk.includes(cleaned)) {
      for (const a of aliases) terms.add(normalizeText(a));
    }
  }
  if (/شوكول|شوكلات|chocolate/.test(raw)) {
    terms.add('chocolate');
    terms.add('شوكول');
  }
  return [...terms].filter(Boolean);
}

function tokens(stem) {
  return searchTermsForStem(stem).flatMap((t) => t.split(' ').filter((w) => w.length >= 2));
}

function stateHints(stem) {
  const s = cleanStem(stem);
  const hints = [];
  if (/\bنيء\b/.test(s) || /\braw\b/.test(s)) hints.push('raw');
  if (/\bمطبوخ\b/.test(s) || /\bمشوي\b/.test(s) || /\bمقلي\b/.test(s) || /\bcooked\b/.test(s) || /\bfried\b/.test(s)) {
    hints.push('cooked');
  }
  if (/\bمجمد\b/.test(s) || /\bfrozen\b/.test(s)) hints.push('frozen');
  return hints;
}

function foodState(nameAr) {
  const n = normalizeText(nameAr);
  if (/\bنيء\b/.test(n)) return 'raw';
  if (/\bمجمد\b/.test(n)) return 'frozen';
  if (/\bمطبوخ\b/.test(n) || /\bمشوي\b/.test(n) || /\bمقلي\b/.test(n) || /\bمغلي\b/.test(n)) return 'cooked';
  return 'other';
}

function tokenOverlapScore(stem, food) {
  const toks = [...new Set(tokens(stem))];
  if (!toks.length) return 0;
  const hayAr = normalizeText(food.nameAr);
  const hayEn = normalizeText(food.nameEn);
  let hit = 0;
  for (const t of toks) {
    if (t.length >= 2 && (hayAr.includes(t) || hayEn.includes(t))) hit += 1;
  }
  const required = Math.max(1, Math.ceil(toks.length * 0.6));
  if (hit >= toks.length) return 72 + hit * 6;
  if (hit >= required) return 58 + hit * 5;
  if (toks.length === 1 && hit === 1) return 56;
  return 0;
}

function headMatchScore(stem, food) {
  const terms = searchTermsForStem(stem);
  let best = 0;
  for (const s of terms) {
    if (!s) continue;
    const arHead = stemBeforeComma(food.nameAr);
    const enHead = stemBeforeComma(food.nameEn);
    const ar = normalizeText(food.nameAr);
    const en = normalizeText(food.nameEn);

    if (arHead === s) best = Math.max(best, 100);
    else if (enHead === s || en === s) best = Math.max(best, 96);
    else if (arHead.startsWith(`${s} `)) best = Math.max(best, 90);
    else if (ar.startsWith(s)) best = Math.max(best, 84);
    else if (arHead.includes(s)) best = Math.max(best, 74);
    else if (ar.includes(s)) best = Math.max(best, 66);
    else if (en.includes(s)) best = Math.max(best, 62);
  }
  return best;
}

function scoreMatch(stem, food, opts = {}) {
  let score = Math.max(headMatchScore(stem, food), tokenOverlapScore(stem, food));
  if (!score) return 0;

  if (opts.categoryMatch) score += 6;
  else if (opts.categoryMismatch) score -= 4;

  const hints = stateHints(stem);
  const state = foodState(food.nameAr);
  if (hints.includes('raw') && state === 'raw') score += 10;
  if (hints.includes('cooked') && state === 'cooked') score += 10;
  if (hints.includes('frozen') && state === 'frozen') score += 8;
  if (!hints.length && state === 'raw' && score >= 80) score += 3;

  const arHead = stemBeforeComma(food.nameAr);
  score -= Math.max(0, arHead.length - cleanStem(stem).length) * 0.03;
  return score;
}

function pickBest(stem, foods, opts = {}, minScore = MIN_SCORE) {
  const ranked = foods
    .map((f) => ({
      f,
      score: scoreMatch(stem, f, {
        categoryMatch: opts.preferredCategories?.has(f.categoryId),
        categoryMismatch: opts.preferredCategories && !opts.preferredCategories.has(f.categoryId),
      }),
    }))
    .filter((x) => x.score >= minScore)
    .sort((a, b) => b.score - a.score || a.f.nameAr.length - b.f.nameAr.length || a.f.webtebId - b.f.webtebId);
  return ranked[0] ?? null;
}

function buildTokenIndex(foods) {
  const index = new Map();
  const add = (token, webtebId) => {
    if (!token || token.length < 2) return;
    if (!index.has(token)) index.set(token, new Set());
    index.get(token).add(webtebId);
  };
  for (const food of foods) {
    const parts = `${food.nameAr || ''} ${food.nameEn || ''}`.split(/\s+/);
    for (const part of parts) {
      add(normalizeText(part), food.webtebId);
      add(stemBeforeComma(part), food.webtebId);
    }
    for (const t of normalizeText(food.nameAr).split(' ')) add(t, food.webtebId);
    for (const t of normalizeText(food.nameEn).split(' ')) add(t, food.webtebId);
  }
  return index;
}

function narrowCandidates(stem, foods, byId, tokenIndex) {
  const toks = [...new Set(tokens(stem))];
  const ids = new Set();
  for (const t of toks) {
    for (const id of tokenIndex.get(t) || []) ids.add(id);
  }
  if (!ids.size) return foods;
  return [...ids].map((id) => byId.get(id)).filter(Boolean);
}

function loadOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) return new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
    const map = new Map();
    for (const [relPath, webtebId] of Object.entries(raw)) {
      map.set(relPath.replace(/\\/g, '/'), Number(webtebId));
    }
    return map;
  } catch {
    return new Map();
  }
}

function listPhotoFiles(root) {
  const rows = [];
  for (const [folder, catId] of Object.entries(FOLDER_TO_CATEGORY)) {
    const dir = path.join(root, folder);
    if (!fs.existsSync(dir)) continue;
    for (const file of fs.readdirSync(dir)) {
      const ext = path.extname(file);
      if (!IMAGE_EXT.has(ext.toLowerCase())) continue;
      rows.push({
        folder,
        catId,
        file,
        relPath: `${folder}/${file}`,
        stem: path.basename(file, ext),
        src: path.join(dir, file),
        ext: ext.toLowerCase(),
      });
    }
  }
  return rows;
}

function buildPools(byCat, primaryCatId, folder) {
  const ids = new Set([primaryCatId]);
  for (const extra of FOLDER_EXTRA_CATEGORIES[folder] || []) ids.add(extra);
  const pool = [];
  for (const id of ids) {
    const rows = byCat.get(id) || [];
    pool.push(...rows);
  }
  return { pool, preferredCategories: ids };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const reportUnmatched = process.argv.includes('--report-unmatched');
  const root = path.join(__dirname, '..', '..', 'nutrition');
  if (!fs.existsSync(root)) {
    console.error('Missing nutrition folder at', root);
    process.exit(1);
  }

  const overrides = loadOverrides();
  const foods = await prisma.webtebFood.findMany({
    select: { webtebId: true, nameAr: true, nameEn: true, categoryId: true },
  });
  const byId = new Map(foods.map((f) => [f.webtebId, f]));
  const byCat = new Map();
  const tokenIndex = buildTokenIndex(foods);
  for (const f of foods) {
    if (!byCat.has(f.categoryId)) byCat.set(f.categoryId, []);
    byCat.get(f.categoryId).push(f);
  }

  const candidates = [];
  const unmatched = [];

  for (const row of listPhotoFiles(root)) {
    const overrideId = overrides.get(row.relPath);
    if (overrideId && byId.has(overrideId)) {
      candidates.push({ ...row, food: byId.get(overrideId), score: 200, source: 'override' });
      continue;
    }

    const { pool, preferredCategories } = buildPools(byCat, row.catId, row.folder);
    let best = pickBest(row.stem, pool, { preferredCategories });

    if (!best || best.score < 68) {
      const narrowed = narrowCandidates(row.stem, foods, byId, tokenIndex);
      const global = pickBest(row.stem, narrowed, { preferredCategories });
      if (global && (!best || global.score > best.score)) best = global;
    }

    if (!best) {
      const narrowed = narrowCandidates(row.stem, foods, byId, tokenIndex);
      best = pickBest(row.stem, narrowed, { preferredCategories }, 45);
    }

    if (!best) {
      unmatched.push(row);
      continue;
    }
    candidates.push({ ...row, food: best.f, score: best.score, source: 'match' });
  }

  const winners = new Map();
  for (const c of candidates) {
    const prev = winners.get(c.food.webtebId);
    if (!prev || c.score > prev.score) winners.set(c.food.webtebId, c);
  }

  if (reportUnmatched) {
    console.log(
      JSON.stringify(
        unmatched.map((u) => ({
          file: u.relPath,
          folder: u.folder,
          stem: u.stem,
        })),
        null,
        2
      )
    );
    return;
  }

  if (!dryRun) {
    if (fs.existsSync(PUBLIC_FOODS_DIR)) {
      for (const f of fs.readdirSync(PUBLIC_FOODS_DIR)) {
        if (f === '.gitkeep') continue;
        fs.unlinkSync(path.join(PUBLIC_FOODS_DIR, f));
      }
    } else {
      fs.mkdirSync(PUBLIC_FOODS_DIR, { recursive: true });
    }
  }

  const manifest = {};
  for (const c of winners.values()) {
    const publicFile = `${c.food.webtebId}${c.ext}`;
    const dest = path.join(PUBLIC_FOODS_DIR, publicFile);
    if (!dryRun) fs.copyFileSync(c.src, dest);
    manifest[String(c.food.webtebId)] = `/nutrition/foods/${publicFile}`;
  }

  if (!dryRun) {
    fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.writeFileSync(
      path.join(PUBLIC_FOODS_DIR, 'manifest.meta.json'),
      `${JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          matchedFoods: Object.keys(manifest).length,
          matchedPhotos: candidates.length,
          unmatchedPhotos: unmatched.length,
          dedupedPhotos: candidates.length - winners.size,
          unmatchedFiles: unmatched.map((u) => u.relPath),
        },
        null,
        2
      )}\n`
    );
  }

  console.log(
    JSON.stringify(
      {
        matchedFoods: Object.keys(manifest).length,
        matchedPhotos: candidates.length,
        unmatchedPhotos: unmatched.length,
        dedupedPhotos: candidates.length - winners.size,
        sampleUnmatched: unmatched.slice(0, 20).map((u) => u.relPath),
      },
      null,
      2
    )
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
