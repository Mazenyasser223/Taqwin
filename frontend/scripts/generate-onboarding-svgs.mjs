/**
 * Generates semantic onboarding option SVGs (distinct icon per choice).
 * Run: node frontend/scripts/generate-onboarding-svgs.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '../public/assets/onboarding');

const BG = '#0f172a';
const TEAL = '#14b8a6';
const TEAL_D = '#0d9488';
const ORANGE = '#f97316';
const SLATE = '#64748b';
const RED = '#ef4444';

function wrap(label, body, accent = TEAL) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" role="img" aria-label="${label}">
  <rect width="240" height="200" rx="24" fill="${BG}"/>
  <radialGradient id="glow" cx="50%" cy="40%" r="55%">
    <stop offset="0%" stop-color="${accent}" stop-opacity="0.25"/>
    <stop offset="100%" stop-color="${BG}" stop-opacity="0"/>
  </radialGradient>
  <rect width="240" height="200" rx="24" fill="url(#glow)"/>
  ${body}
</svg>`;
}

function barbell(x, y, w, color = TEAL) {
  return `
  <rect x="${x - w / 2}" y="${y - 4}" width="${w}" height="8" rx="4" fill="${color}"/>
  <rect x="${x - w / 2 - 14}" y="${y - 18}" width="12" height="36" rx="3" fill="${TEAL_D}"/>
  <rect x="${x + w / 2 + 2}" y="${y - 18}" width="12" height="36" rx="3" fill="${TEAL_D}"/>`;
}

function person(x, cy, scale = 1, color = TEAL) {
  const h = 44 * scale;
  return `
  <circle cx="${x}" cy="${cy - h}" r="${14 * scale}" fill="${color}"/>
  <path d="M${x - 22 * scale} ${cy} Q${x} ${cy - h + 8} ${x + 22 * scale} ${cy}" fill="${color}" opacity="0.9"/>`;
}

function textCenter(txt, y, size = 28, color = '#e2e8f0') {
  return `<text x="120" y="${y}" text-anchor="middle" fill="${color}" font-size="${size}" font-weight="700" font-family="system-ui,sans-serif">${txt}</text>`;
}

function highlightZone(cx, cy, rx, ry, label) {
  return `
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SLATE}" opacity="0.5"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${RED}" opacity="0.35"/>
  <circle cx="${cx}" cy="${cy}" r="8" fill="${ORANGE}"/>
  ${label ? `<text x="120" y="178" text-anchor="middle" fill="#fca5a5" font-size="13" font-family="system-ui,sans-serif">${label}</text>` : ''}`;
}

const files = {
  'goal-muscle': wrap('Build muscle', `${barbell(120, 105, 90)}${textCenter('MUSCLE', 168, 22, TEAL)}`),
  'goal-weight': wrap('Lose weight', `
  <rect x="88" y="70" width="64" height="70" rx="8" fill="none" stroke="${TEAL}" stroke-width="4"/>
  <circle cx="120" cy="95" r="22" fill="none" stroke="${TEAL}" stroke-width="4"/>
  <path d="M120 118 L120 145" stroke="${ORANGE}" stroke-width="4" stroke-linecap="round"/>
  <path d="M108 133 L120 145 L132 133" stroke="${ORANGE}" stroke-width="4" stroke-linecap="round" fill="none"/>
  ${textCenter('WEIGHT LOSS', 168, 18)}`),
  'goal-endurance': wrap('Endurance', `
  <path d="M50 130 Q80 90 120 110 T190 90" fill="none" stroke="${TEAL}" stroke-width="4" stroke-linecap="round"/>
  ${person(120, 145, 0.9)}
  <circle cx="175" cy="75" r="16" fill="none" stroke="${ORANGE}" stroke-width="3"/>
  <path d="M168 75 L175 68 L182 75 L175 82 Z" fill="${ORANGE}"/>
  ${textCenter('CARDIO', 168, 22)}`),
  'goal-wellness': wrap('Wellness', `
  <circle cx="120" cy="100" r="36" fill="none" stroke="${TEAL}" stroke-width="3"/>
  <path d="M120 78 C120 78 108 88 108 100 C108 112 120 122 120 122 C120 122 132 112 132 100 C132 88 120 78 120 78Z" fill="${TEAL}" opacity="0.6"/>
  ${textCenter('BALANCE', 168, 22)}`),

  'physique-lean': wrap('Lean physique', `${person(120, 150, 1, TEAL)}${textCenter('LEAN', 178, 24)}`),
  'physique-muscular': wrap('Muscular', `
  ${person(120, 152, 1.1, TEAL)}
  <ellipse cx="85" cy="108" rx="18" ry="12" fill="${TEAL_D}"/>
  <ellipse cx="155" cy="108" rx="18" ry="12" fill="${TEAL_D}"/>
  ${textCenter('MUSCULAR', 178, 20)}`),
  'physique-ripped': wrap('Ripped', `
  ${person(120, 152, 1, TEAL)}
  <path d="M108 118 L120 128 L132 118 M108 128 L120 138 L132 128" stroke="${ORANGE}" stroke-width="2" fill="none"/>
  ${textCenter('RIPPED', 178, 24)}`),

  'body-ectomorph': wrap('Ectomorph', `${person(120, 155, 0.85, '#94a3b8')}${textCenter('ECTOMORPH', 178, 18)}`),
  'body-mesomorph': wrap('Mesomorph', `${person(120, 155, 1.05, TEAL)}<path d="M95 105 L120 95 L145 105" stroke="${TEAL_D}" stroke-width="6" fill="none"/>${textCenter('MESOMORPH', 178, 18)}`),
  'body-endomorph': wrap('Endomorph', `${person(120, 158, 1.15, '#a78bfa')}${textCenter('ENDOMORPH', 178, 18)}`),

  'age-18-29': wrap('Age 18-29', `${person(120, 150, 0.95, TEAL)}${textCenter('18 – 29', 175, 32, TEAL)}`),
  'age-30-39': wrap('Age 30-39', `${person(120, 150, 1, TEAL)}${textCenter('30 – 39', 175, 32, TEAL)}`),
  'age-40-49': wrap('Age 40-49', `${person(120, 150, 1.05, ORANGE)}${textCenter('40 – 49', 175, 32, ORANGE)}`),
  'age-50-plus': wrap('Age 50+', `${person(120, 150, 1.08, '#a78bfa')}${textCenter('50+', 175, 36, '#c4b5fd')}`),

  'workout-home': wrap('Home workout', `
  <path d="M75 130 L120 85 L165 130 Z" fill="none" stroke="${TEAL}" stroke-width="4"/>
  <rect x="108" y="108" width="24" height="22" fill="${TEAL}"/>
  ${barbell(120, 155, 50, ORANGE)}
  ${textCenter('HOME', 178, 24)}`),
  'workout-gym': wrap('Gym', `
  <rect x="70" y="75" width="100" height="8" rx="2" fill="${SLATE}"/>
  <rect x="75" y="83" width="8" height="55" fill="${SLATE}"/>
  <rect x="157" y="83" width="8" height="55" fill="${SLATE}"/>
  ${barbell(120, 100, 70)}
  ${textCenter('GYM', 178, 28)}`),
  'workout-mixed': wrap('Mixed', `
  <path d="M55 130 L85 95 L115 130 Z" fill="none" stroke="${TEAL}" stroke-width="3"/>
  <rect x="130" y="80" width="60" height="50" rx="4" fill="none" stroke="${ORANGE}" stroke-width="3"/>
  ${barbell(155, 105, 40, ORANGE)}
  ${textCenter('MIXED', 178, 24)}`),

  'level-beginner': wrap('Beginner', `${barbell(120, 110, 40)}${textCenter('BEGINNER', 168, 22)}`),
  'level-intermediate': wrap('Intermediate', `${barbell(120, 108, 65)}${textCenter('INTERMEDIATE', 168, 18)}`),
  'level-advanced': wrap('Advanced', `${barbell(120, 105, 95, ORANGE)}${textCenter('ADVANCED', 168, 22, ORANGE)}`),

  'push-few': wrap('Few push-ups', `${person(120, 130, 0.8)}<path d="M85 115 L155 115" stroke="${TEAL}" stroke-width="3"/>${textCenter('&lt; 12', 175, 36, ORANGE)}`),
  'push-mid': wrap('Mid push-ups', `${person(120, 130, 0.85)}<path d="M85 115 L155 115" stroke="${TEAL}" stroke-width="3"/>${textCenter('13 – 20', 175, 32, TEAL)}`),
  'push-many': wrap('Many push-ups', `${person(120, 130, 0.9)}<path d="M85 115 L155 115" stroke="${TEAL}" stroke-width="3"/>${textCenter('20+', 175, 36, TEAL)}`),

  'squat-few': wrap('Few squats', `${person(120, 125, 0.8)}<path d="M95 130 L95 150 M145 130 L145 150" stroke="${TEAL}" stroke-width="4"/>${textCenter('&lt; 12', 175, 36, ORANGE)}`),
  'squat-mid': wrap('Mid squats', `${person(120, 125, 0.85)}<path d="M95 130 L95 150 M145 130 L145 150" stroke="${TEAL}" stroke-width="4"/>${textCenter('13 – 20', 175, 32)}`),
  'squat-many': wrap('Many squats', `${person(120, 125, 0.9)}<path d="M95 130 L95 150 M145 130 L145 150" stroke="${TEAL}" stroke-width="4"/>${textCenter('20+', 175, 36)}`),

  'gym-large': wrap('Large gym', `<rect x="50" y="70" width="140" height="70" rx="6" fill="none" stroke="${TEAL}" stroke-width="3"/>${barbell(120, 105, 80)}${textCenter('LARGE', 168, 24)}`),
  'gym-small': wrap('Small gym', `<rect x="70" y="80" width="100" height="55" rx="6" fill="none" stroke="${TEAL}" stroke-width="3"/>${barbell(120, 108, 50)}${textCenter('SMALL', 168, 24)}`),
  'gym-garage': wrap('Garage gym', `<rect x="60" y="85" width="120" height="60" rx="4" fill="${SLATE}" opacity="0.4"/>${barbell(120, 110, 70, ORANGE)}${textCenter('GARAGE', 168, 22)}`),
  'gym-home': wrap('Home gym', `<path d="M75 130 L120 90 L165 130Z" fill="none" stroke="${TEAL}" stroke-width="3"/>${barbell(120, 145, 45)}${textCenter('HOME GYM', 168, 18)}`),

  'cardio-yes': wrap('Add cardio', `<path d="M60 125 Q100 85 140 125 T200 95" fill="none" stroke="${TEAL}" stroke-width="4"/>${textCenter('YES', 168, 32, TEAL)}`),
  'cardio-no': wrap('No cardio', `${barbell(120, 110, 75)}<path d="M165 75 L185 95 M185 75 L165 95" stroke="${ORANGE}" stroke-width="4"/>${textCenter('NOT NOW', 168, 20)}`),

  'time-morning': wrap('Morning', `<circle cx="120" cy="95" r="28" fill="${ORANGE}" opacity="0.8"/><path d="M120 67 L120 50 M95 75 L82 62 M145 75 L158 62" stroke="#fde68a" stroke-width="3"/>${textCenter('MORNING', 168, 22)}`),
  'time-afternoon': wrap('Afternoon', `<circle cx="120" cy="100" r="32" fill="${ORANGE}"/>${textCenter('AFTERNOON', 168, 20)}`),
  'time-evening': wrap('Evening', `<circle cx="130" cy="85" r="22" fill="#fde68a"/><path d="M70 120 Q120 140 170 120" fill="none" stroke="${SLATE}" stroke-width="2"/>${textCenter('EVENING', 168, 22)}`),
  'time-varies': wrap('Varies', `<circle cx="120" cy="100" r="40" fill="none" stroke="${TEAL}" stroke-width="4"/><path d="M120 100 L120 72 M120 100 L145 115" stroke="${TEAL}" stroke-width="4"/>${textCenter('VARIES', 168, 22)}`),

  'sleep-lt5': wrap('Under 5h sleep', `<rect x="70" y="100" width="100" height="40" rx="6" fill="${SLATE}"/>${textCenter('Zzz', 125, 28)}${textCenter('&lt; 5h', 175, 28, ORANGE)}`),
  'sleep-56': wrap('5-6h sleep', `<rect x="70" y="100" width="100" height="40" rx="6" fill="${SLATE}"/>${textCenter('5 – 6h', 175, 28)}`),
  'sleep-78': wrap('7-8h sleep', `<rect x="70" y="100" width="100" height="40" rx="6" fill="${TEAL}" opacity="0.5"/>${textCenter('7 – 8h', 175, 28, TEAL)}`),
  'sleep-gt8': wrap('8h+ sleep', `<rect x="70" y="100" width="100" height="40" rx="6" fill="${TEAL}"/>${textCenter('8h+', 175, 32, TEAL)}`),

  'water-coffee': wrap('Tea/coffee', `<path d="M95 110 L95 145 L145 145 L145 110 Q145 95 120 95 Q95 95 95 110Z" fill="${SLATE}"/><path d="M145 115 L165 108" stroke="${SLATE}" stroke-width="3"/>${textCenter('CAFFEINE', 168, 18)}`),
  'water-lt2': wrap('Little water', `<rect x="100" y="110" width="40" height="50" rx="4" fill="none" stroke="${ORANGE}" stroke-width="3"/><path d="M110 120 L130 120" stroke="${ORANGE}" stroke-width="2"/>${textCenter('&lt; 2', 175, 28)}`),
  'water-mid': wrap('Some water', `<rect x="100" y="105" width="40" height="55" rx="4" fill="none" stroke="${TEAL}" stroke-width="3"/><rect x="108" y="125" width="24" height="25" fill="${TEAL}" opacity="0.5"/>${textCenter('2 – 6', 175, 28)}`),
  'water-high': wrap('Lots of water', `<rect x="100" y="100" width="40" height="60" rx="4" fill="${TEAL}" opacity="0.4"/><rect x="108" y="115" width="24" height="38" fill="${TEAL}"/>${textCenter('7 – 10', 175, 24)}`),

  'diet-none': wrap('No restrictions', `<circle cx="120" cy="105" r="35" fill="none" stroke="${TEAL}" stroke-width="3"/><path d="M100 105 L115 120 L145 90" stroke="${TEAL}" stroke-width="4" fill="none"/>${textCenter('NONE', 168, 24)}`),
  'diet-veg': wrap('Vegetarian', `<circle cx="120" cy="110" r="30" fill="${TEAL}" opacity="0.3"/><path d="M120 80 Q105 110 120 130 Q135 110 120 80Z" fill="${TEAL}"/>${textCenter('PLANT-BASED', 168, 18)}`),

  'past-trainer': wrap('Personal trainer', `${person(100, 145, 0.9)}${person(150, 145, 0.85, ORANGE)}${textCenter('TRAINER', 168, 22)}`),
  'past-apps': wrap('Fitness apps', `<rect x="85" y="75" width="70" height="90" rx="12" fill="none" stroke="${TEAL}" stroke-width="3"/><circle cx="120" cy="115" r="18" fill="${TEAL}" opacity="0.4"/>${textCenter('APPS', 175, 28)}`),
  'past-videos': wrap('Videos', `<rect x="70" y="85" width="100" height="60" rx="6" fill="${SLATE}"/><path d="M115 105 L115 125 L135 115 Z" fill="${TEAL}"/>${textCenter('VIDEOS', 168, 24)}`),
  'past-self': wrap('Self-taught', `${person(120, 150, 1)}<path d="M155 90 L175 75 M175 95 L195 80" stroke="${ORANGE}" stroke-width="3"/>${textCenter('SELF', 175, 28)}`),
  'past-none': wrap('None', `<circle cx="120" cy="105" r="40" fill="none" stroke="${SLATE}" stroke-width="3"/><path d="M95 80 L145 130 M145 80 L95 130" stroke="${SLATE}" stroke-width="4"/>${textCenter('NONE', 168, 24)}`),

  'motivation-visual': wrap('Visual progress', `<rect x="75" y="75" width="90" height="70" rx="4" fill="none" stroke="${TEAL}" stroke-width="3"/><path d="M90 120 L110 100 L130 108 L150 85" stroke="${ORANGE}" stroke-width="3" fill="none"/>${textCenter('MIRROR / SCALE', 168, 16)}`),
  'motivation-fitness': wrap('Fitness level', `<path d="M70 130 L100 95 L130 115 L170 80" fill="none" stroke="${TEAL}" stroke-width="4"/>${textCenter('PERFORMANCE', 168, 18)}`),

  'confidence-high': wrap('High confidence', `<path d="M85 120 Q120 75 155 120" fill="none" stroke="${TEAL}" stroke-width="4"/><circle cx="100" cy="105" r="6" fill="${TEAL}"/><circle cx="140" cy="105" r="6" fill="${TEAL}"/>${textCenter('HIGH', 175, 32, TEAL)}`),
  'confidence-low': wrap('Low confidence', `<path d="M85 125 Q120 95 155 125" fill="none" stroke="${SLATE}" stroke-width="4"/>${textCenter('DOUBTS', 175, 24, SLATE)}`),

  'injury-none': wrap('No injury', `${person(120, 150, 1, TEAL)}<circle cx="120" cy="105" r="28" fill="none" stroke="${TEAL}" stroke-width="3"/><path d="M105 105 L115 115 L135 95" stroke="${TEAL}" stroke-width="4" fill="none"/>`),
  'injury-back': wrap('Back injury', `${person(120, 150, 1, SLATE)}${highlightZone(120, 108, 28, 18, 'BACK')}`),
  'injury-knees': wrap('Knee injury', `${person(120, 150, 1, SLATE)}${highlightZone(95, 138, 14, 14)}${highlightZone(145, 138, 14, 14)}${textCenter('KNEES', 178, 16)}`),
  'injury-shoulders': wrap('Shoulder injury', `${person(120, 150, 1, SLATE)}${highlightZone(88, 98, 16, 14)}${highlightZone(152, 98, 16, 14)}${textCenter('SHOULDERS', 178, 14)}`),
  'injury-neck': wrap('Neck injury', `${person(120, 150, 1, SLATE)}${highlightZone(120, 72, 12, 10, 'NECK')}`),
  'injury-arms': wrap('Arm injury', `${person(120, 150, 1, SLATE)}${highlightZone(78, 115, 12, 28)}${highlightZone(162, 115, 12, 28)}${textCenter('ARMS', 178, 16)}`),
  'injury-elbows': wrap('Elbow injury', `${person(120, 150, 1, SLATE)}${highlightZone(72, 118, 10, 10)}${highlightZone(168, 118, 10, 10)}${textCenter('ELBOWS', 178, 14)}`),
  'injury-legs': wrap('Leg injury', `${person(120, 150, 1, SLATE)}${highlightZone(105, 140, 12, 35)}${highlightZone(135, 140, 12, 35)}${textCenter('LEGS', 178, 16)}`),

  'equipment-treadmill': wrap('Treadmill', `<rect x="70" y="95" width="100" height="45" rx="4" fill="${SLATE}"/><rect x="80" y="105" width="80" height="20" fill="${TEAL}" opacity="0.3"/>${textCenter('TREADMILL', 168, 18)}`),
  'equipment-bike': wrap('Bike', `<circle cx="95" cy="130" r="22" fill="none" stroke="${TEAL}" stroke-width="4"/><circle cx="145" cy="130" r="22" fill="none" stroke="${TEAL}" stroke-width="4"/><path d="M95 108 L120 95 L145 108" stroke="${TEAL}" stroke-width="4"/>${textCenter('BIKE', 175, 24)}`),
  'equipment-rower': wrap('Rower', `<path d="M65 130 L175 130" stroke="${SLATE}" stroke-width="4"/><path d="M85 130 L105 100 L125 130" stroke="${TEAL}" stroke-width="4" fill="none"/>${textCenter('ROWER', 168, 22)}`),
  'equipment-elliptical': wrap('Elliptical', `<ellipse cx="120" cy="115" rx="50" ry="25" fill="none" stroke="${TEAL}" stroke-width="4"/>${textCenter('ELLIPTICAL', 168, 16)}`),

  'default': wrap('Option', `<circle cx="120" cy="100" r="35" fill="${TEAL}" opacity="0.25"/>${textCenter('TAQWIN', 168, 28, TEAL)}`),
  'hero-strength': wrap('Strength program', `${barbell(120, 100, 100, ORANGE)}${textCenter('STRENGTH', 168, 28, ORANGE)}`),
};

mkdirSync(OUT, { recursive: true });
for (const [name, svg] of Object.entries(files)) {
  writeFileSync(join(OUT, `${name}.svg`), svg, 'utf8');
}
console.log(`Wrote ${Object.keys(files).length} SVG files to ${OUT}`);
