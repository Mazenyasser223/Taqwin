/**
 * Downloads male-focused onboarding photos (Pexels/Unsplash).
 * Skips: gender-male.png, gender-female.png, coach-welcome.png
 */
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { pipeline } from 'stream/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../public/assets/onboarding');
const Q = '?auto=compress&cs=tinysrgb&w=520&h=390&fit=crop';

const PHOTOS = {
  'goal-muscle': `https://images.pexels.com/photos/17840/pexels-photo-17840.jpeg${Q}`,
  'goal-weight': `https://images.pexels.com/photos/6550871/pexels-photo-6550871.jpeg${Q}`,
  'goal-endurance': `https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg${Q}`,
  'goal-wellness': `https://images.pexels.com/photos/3253508/pexels-photo-3253508.jpeg${Q}`,
  'physique-lean': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'physique-muscular': `https://images.pexels.com/photos/1318521/pexels-photo-1318521.jpeg${Q}`,
  'physique-ripped': `https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg${Q}`,
  'workout-home': `https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg${Q}`,
  'workout-gym': `https://images.pexels.com/photos/1954521/pexels-photo-1954521.jpeg${Q}`,
  'workout-mixed': `https://images.pexels.com/photos/841286/pexels-photo-841286.jpeg${Q}`,
  'level-beginner': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'level-intermediate': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'level-advanced': `https://images.pexels.com/photos/17840/pexels-photo-17840.jpeg${Q}`,
  'body-ectomorph': `https://images.pexels.com/photos/4348401/pexels-photo-4348401.jpeg${Q}`,
  'body-mesomorph': `https://images.pexels.com/photos/1318521/pexels-photo-1318521.jpeg${Q}`,
  'body-endomorph': `https://images.pexels.com/photos/3796106/pexels-photo-3796106.jpeg${Q}`,
  'age-18-29': `https://images.pexels.com/photos/4348401/pexels-photo-4348401.jpeg${Q}`,
  'age-30-39': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'age-40-49': `https://images.pexels.com/photos/3796106/pexels-photo-3796106.jpeg${Q}`,
  'age-50-plus': `https://images.pexels.com/photos/2603523/pexels-photo-2603523.jpeg${Q}`,
  'body-fat-1': `https://images.pexels.com/photos/1431282/pexels-photo-1431282.jpeg${Q}`,
  'body-fat-2': `https://images.pexels.com/photos/1318521/pexels-photo-1318521.jpeg${Q}`,
  'body-fat-3': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'body-fat-4': `https://images.pexels.com/photos/841286/pexels-photo-841286.jpeg${Q}`,
  'body-fat-5': `https://images.pexels.com/photos/3796106/pexels-photo-3796106.jpeg${Q}`,
  'body-fat-6': `https://images.pexels.com/photos/3796106/pexels-photo-3796106.jpeg${Q}`,
  'body-fat-7': `https://images.pexels.com/photos/2603523/pexels-photo-2603523.jpeg${Q}`,
  'injury-none': `https://images.pexels.com/photos/3253508/pexels-photo-3253508.jpeg${Q}`,
  'injury-back': `https://images.pexels.com/photos/4506162/pexels-photo-4506162.jpeg${Q}`,
  'injury-knees': `https://images.pexels.com/photos/4506082/pexels-photo-4506082.jpeg${Q}`,
  'injury-shoulders': `https://images.pexels.com/photos/3757942/pexels-photo-3757942.jpeg${Q}`,
  'injury-neck': `https://images.pexels.com/photos/4506105/pexels-photo-4506105.jpeg${Q}`,
  'injury-arms': `https://images.pexels.com/photos/4506082/pexels-photo-4506082.jpeg${Q}`,
  'injury-elbows': `https://images.pexels.com/photos/4506168/pexels-photo-4506168.jpeg${Q}`,
  'injury-legs': `https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=520&h=390&fit=crop&q=80`,
  'past-trainer': `https://images.pexels.com/photos/841286/pexels-photo-841286.jpeg${Q}`,
  'past-apps': `https://images.pexels.com/photos/4498576/pexels-photo-4498576.jpeg${Q}`,
  'past-videos': `https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg${Q}`,
  'past-self': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'past-none': `https://images.pexels.com/photos/3253508/pexels-photo-3253508.jpeg${Q}`,
  'push-few': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'push-mid': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'push-many': `https://images.pexels.com/photos/17840/pexels-photo-17840.jpeg${Q}`,
  'gym-large': `https://images.pexels.com/photos/1954521/pexels-photo-1954521.jpeg${Q}`,
  'gym-small': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'gym-garage': `https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg${Q}`,
  'gym-home': `https://images.pexels.com/photos/1954524/pexels-photo-1954524.jpeg${Q}`,
  'cardio-yes': `https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg${Q}`,
  'cardio-no': `https://images.pexels.com/photos/17840/pexels-photo-17840.jpeg${Q}`,
  'time-morning': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'time-afternoon': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'time-evening': `https://images.pexels.com/photos/1954521/pexels-photo-1954521.jpeg${Q}`,
  'time-varies': `https://images.pexels.com/photos/841286/pexels-photo-841286.jpeg${Q}`,
  'sleep-lt5': `https://images.pexels.com/photos/3796106/pexels-photo-3796106.jpeg${Q}`,
  'sleep-56': `https://images.pexels.com/photos/4348401/pexels-photo-4348401.jpeg${Q}`,
  'sleep-78': `https://images.pexels.com/photos/3253508/pexels-photo-3253508.jpeg${Q}`,
  'sleep-gt8': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'water-coffee': `https://images.pexels.com/photos/3796106/pexels-photo-3796106.jpeg${Q}`,
  'water-lt2': `https://images.pexels.com/photos/4348401/pexels-photo-4348401.jpeg${Q}`,
  'water-mid': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'water-high': `https://images.pexels.com/photos/1229356/pexels-photo-1229356.jpeg${Q}`,
  'diet-none': `https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg${Q}`,
  'diet-veg': `https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg${Q}`,
  'motivation-visual': `https://images.pexels.com/photos/1318521/pexels-photo-1318521.jpeg${Q}`,
  'motivation-fitness': `https://images.pexels.com/photos/3764011/pexels-photo-3764011.jpeg${Q}`,
  'confidence-high': `https://images.pexels.com/photos/17840/pexels-photo-17840.jpeg${Q}`,
  'confidence-low': `https://images.pexels.com/photos/4164760/pexels-photo-4164760.jpeg${Q}`,
  'default': `https://images.pexels.com/photos/841286/pexels-photo-841286.jpeg${Q}`,
  'hero-strength': `https://images.pexels.com/photos/17840/pexels-photo-17840.jpeg${Q}`,
};

async function download(name, url) {
  const file = path.join(OUT, `${name}.jpg`);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  await pipeline(res.body, createWriteStream(file));
  return file;
}

await mkdir(OUT, { recursive: true });
let ok = 0;
let fail = 0;
for (const [name, url] of Object.entries(PHOTOS)) {
  try {
    await download(name, url);
    console.log('OK', name);
    ok++;
  } catch (e) {
    console.error('FAIL', name, e.message);
    fail++;
  }
}
console.log(`Done: ${ok} ok, ${fail} failed`);
