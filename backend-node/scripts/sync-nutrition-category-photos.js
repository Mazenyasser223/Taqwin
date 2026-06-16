#!/usr/bin/env node
/**
 * Copy nutrition/ root cover images → frontend/public/nutrition/categories/{taqwinCategoryId}.{ext}
 *
 * Usage: node scripts/sync-nutrition-category-photos.js
 */
const fs = require('fs');
const path = require('path');

/** Root filenames in nutrition/ → Taqwin category id (nutrition.cat.*). */
const ROOT_FILE_TO_CATEGORY = {
  'chicken.jfif': 'poultry',
  'cereal.jfif': 'breakfast-cereals',
  'fast food.jfif': 'fast-food',
  'fats.webp': 'fats-oils',
  'fruit.jfif': 'fruits-juices',
  'اللحوم المصنعة.jfif': 'processed-meats',
  'lamb and veal.jpg': 'lamb-veal',
  'seafood.jpg': 'seafood',
  'seeds.webp': 'nuts-seeds',
  'pasta.jfif': 'grains-pasta',
  'Legumes.jpeg': 'legumes',
  'snacks.jpg': 'snacks',
  'لحم خروف/لحم هبر ني.jfif': 'beef',
};

const NUTRITION_ROOT = path.join(__dirname, '..', '..', 'nutrition');
const PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'nutrition', 'categories');

function main() {
  if (!fs.existsSync(NUTRITION_ROOT)) {
    console.error('Missing nutrition folder:', NUTRITION_ROOT);
    process.exit(1);
  }
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const copied = [];
  const missing = [];

  for (const [fileName, categoryId] of Object.entries(ROOT_FILE_TO_CATEGORY)) {
    const src = path.join(NUTRITION_ROOT, fileName);
    if (!fs.existsSync(src)) {
      missing.push(fileName);
      continue;
    }
    const ext = path.extname(fileName);
    const dest = path.join(PUBLIC_DIR, `${categoryId}${ext}`);
    fs.copyFileSync(src, dest);
    copied.push({ categoryId, publicUrl: `/nutrition/categories/${categoryId}${ext}` });
  }

  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'manifest.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), categories: copied }, null, 2)}\n`
  );

  console.log(JSON.stringify({ copied: copied.length, missing, categories: copied }, null, 2));
}

main();
