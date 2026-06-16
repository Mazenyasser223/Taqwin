#!/usr/bin/env node
/**
 * Download curated exercise category cover images → frontend/public/workouts/categories/
 *
 * Usage: node scripts/sync-exercise-category-photos.js
 */
const fs = require('fs');
const path = require('path');

/** Keep in sync with frontend/features/workouts/exerciseCategoryTheme.ts */
const CATEGORY_IMAGES = {
  chest:
    'https://images.unsplash.com/photo-1653773869760-5b0f846231fb?auto=format&fit=crop&w=800&q=80',
  back: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?auto=format&fit=crop&w=800&q=80',
  shoulders:
    'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80',
  biceps:
    'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=80',
  triceps:
    'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80',
  forearms:
    'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=800&q=80',
  abs: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80',
  quads:
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80',
  hamstrings:
    'https://images.unsplash.com/photo-1574680096145-d05b474e2155?auto=format&fit=crop&w=800&q=80',
  calves:
    'https://images.unsplash.com/photo-1486218119243-13883505764c?auto=format&fit=crop&w=800&q=80',
  glutes:
    'https://images.unsplash.com/photo-1540497077202-7c8a3999166f?auto=format&fit=crop&w=800&q=80',
  'free-weights':
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
  'machines-cables':
    'https://images.unsplash.com/photo-1764426445439-681ca4a15c1d?auto=format&fit=crop&w=800&q=80',
  'bodyweight-bands':
    'https://images.unsplash.com/photo-1594737625785-a6cbdabd333c?auto=format&fit=crop&w=800&q=80',
  accessories:
    'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?auto=format&fit=crop&w=800&q=80',
  mobility:
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=800&q=80',
  cardio:
    'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=800&q=80',
  other:
    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80',
};

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'frontend', 'public', 'workouts', 'categories');

function extFromContentType(ct, url) {
  const lower = (ct || '').toLowerCase();
  if (lower.includes('webp')) return '.webp';
  if (lower.includes('png')) return '.png';
  if (lower.includes('jpeg') || lower.includes('jpg')) return '.jpg';
  if (lower.includes('avif')) return '.avif';
  const m = url.match(/\.(jpe?g|png|webp|avif|jfif)(\?|$)/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

async function downloadOne(categoryId, url) {
  const res = await fetch(url, {
    headers: { Accept: 'image/*', 'User-Agent': 'Taqwin/1.0 (category-photo-sync)' },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = extFromContentType(res.headers.get('content-type'), url);
  const dest = path.join(PUBLIC_DIR, `${categoryId}${ext}`);
  fs.writeFileSync(dest, buf);
  return { categoryId, publicUrl: `/workouts/categories/${categoryId}${ext}`, bytes: buf.length };
}

async function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  const copied = [];
  const failed = [];

  for (const [categoryId, url] of Object.entries(CATEGORY_IMAGES)) {
    try {
      const row = await downloadOne(categoryId, url);
      copied.push(row);
      console.log(`[ok] ${categoryId} → ${row.publicUrl} (${row.bytes} bytes)`);
    } catch (err) {
      failed.push({ categoryId, url, error: err.message });
      console.error(`[fail] ${categoryId}: ${err.message}`);
    }
  }

  fs.writeFileSync(
    path.join(PUBLIC_DIR, 'manifest.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), categories: copied, failed }, null, 2)}\n`
  );

  console.log(JSON.stringify({ copied: copied.length, failed: failed.length }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main();
