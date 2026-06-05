/**
 * Generates SVG illustrations for onboarding option cards.
 * Run: node scripts/generate-onboarding-assets.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '../public/assets/onboarding');

const PALETTES = {
  teal: ['#0891b2', '#0e7490', '#164e63'],
  orange: ['#f97316', '#ea580c', '#9a3412'],
  purple: ['#a855f7', '#7c3aed', '#4c1d95'],
  emerald: ['#10b981', '#059669', '#064e3b'],
  rose: ['#f43f5e', '#e11d48', '#881337'],
  slate: ['#64748b', '#475569', '#1e293b'],
};

function svg(name, colors, icon = 'circle') {
  const [c1, c2, c3] = colors;
  const shapes = {
    circle: `<circle cx="120" cy="100" r="52" fill="url(#g)" opacity="0.9"/>`,
    barbell: `<rect x="48" y="94" width="144" height="12" rx="6" fill="url(#g)"/><circle cx="52" cy="100" r="22" fill="${c2}"/><circle cx="188" cy="100" r="22" fill="${c2}"/>`,
    person: `<ellipse cx="120" cy="78" rx="28" ry="30" fill="url(#g)"/><path d="M72 170 Q120 120 168 170" fill="url(#g)" opacity="0.85"/>`,
    heart: `<path d="M120 155 C90 120 55 120 55 90 C55 65 80 55 120 85 C160 55 185 65 185 90 C185 120 150 120 120 155Z" fill="url(#g)"/>`,
    bolt: `<path d="M132 45 L88 115 H112 L96 175 L152 95 H124 Z" fill="url(#g)"/>`,
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-label="${name}">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="55%" stop-color="${c2}"/>
      <stop offset="100%" stop-color="${c3}"/>
    </linearGradient>
    <radialGradient id="bg" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="${c1}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#0f172a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="240" height="200" rx="24" fill="#0f172a"/>
  <rect width="240" height="200" rx="24" fill="url(#bg)"/>
  ${shapes[icon] || shapes.circle}
  <circle cx="200" cy="40" r="6" fill="${c1}" opacity="0.6"/>
  <circle cx="40" cy="160" r="4" fill="${c2}" opacity="0.5"/>
</svg>`;
}

const assets = {
  'hero-strength': [PALETTES.teal, 'barbell'],
  'age-18-29': [PALETTES.teal, 'person'],
  'age-30-39': [PALETTES.emerald, 'person'],
  'age-40-49': [PALETTES.orange, 'person'],
  'age-50-plus': [PALETTES.purple, 'person'],
  'gender-male': [PALETTES.teal, 'person'],
  'gender-female': [PALETTES.rose, 'person'],
  'goal-muscle': [PALETTES.teal, 'barbell'],
  'goal-weight': [PALETTES.orange, 'heart'],
  'goal-endurance': [PALETTES.emerald, 'bolt'],
  'goal-wellness': [PALETTES.purple, 'heart'],
  'physique-lean': [PALETTES.teal, 'person'],
  'physique-muscular': [PALETTES.orange, 'barbell'],
  'physique-ripped': [PALETTES.emerald, 'person'],
  'workout-home': [PALETTES.slate, 'heart'],
  'workout-gym': [PALETTES.teal, 'barbell'],
  'workout-mixed': [PALETTES.purple, 'bolt'],
  'level-beginner': [PALETTES.teal, 'circle'],
  'level-intermediate': [PALETTES.orange, 'barbell'],
  'level-advanced': [PALETTES.rose, 'bolt'],
  'body-ectomorph': [PALETTES.teal, 'person'],
  'body-mesomorph': [PALETTES.orange, 'barbell'],
  'body-endomorph': [PALETTES.purple, 'person'],
  'default': [PALETTES.slate, 'circle'],
};

fs.mkdirSync(outDir, { recursive: true });
for (const [name, [palette, icon]] of Object.entries(assets)) {
  fs.writeFileSync(path.join(outDir, `${name}.svg`), svg(name, palette, icon));
}
console.log(`Wrote ${Object.keys(assets).length} SVGs to ${outDir}`);
