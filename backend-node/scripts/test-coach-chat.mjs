/**
 * Smoke-test coach prompt + provider without the full API.
 * Usage (from backend-node): node scripts/test-coach-chat.mjs
 * Requires: dotenv, and ANTHROPIC_API_KEY | GEMINI_API_KEY | Ollama running
 */
import 'dotenv/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const { buildCoachSystemPrompt } = require('../src/lib/coachPrompt.js');
const { completeChat, resolveProvider } = require('../src/services/aiChatProvider.js');

const sampleUserContext = `
displayName: أحمد
weightKg: 78
heightCm: 175
fitnessGoal: Lose Weight
Daily targets: calorieTarget 1716 kcal, proteinTarget 156g, carbTarget 145g, fatTarget 48g
Today: caloriesEaten 0, mealsLogged 0
dietRestrictions: none
`.trim();

// Realistic minimum — model must use these exact names, not invent foods
const sampleFoodContext = `
- Chicken, broilers or fryers, breast, meat only, cooked, roasted | fdcId: 171077 | 165 kcal/100g | P31g C0g F4g
- Lentils, mature seeds, cooked, boiled, without salt | fdcId: 174288 | 116 kcal/100g | P9g C20g F0g
- Egg, whole, cooked, scrambled | fdcId: 172185 | 149 kcal/100g | P10g C2g F11g
- Rice, white, long-grain, regular, cooked | fdcId: 168878 | 130 kcal/100g | P3g C28g F0g
`.trim();

const messages = [{ role: 'user', content: 'اعملي خطة أكل ليوم واحد عشان أخس' }];

const system = buildCoachSystemPrompt({
  userContext: sampleUserContext,
  foodContext: sampleFoodContext,
  locale: 'ar',
});

console.log('Provider:', resolveProvider() || '(none)');
console.log('--- System prompt (first 500 chars) ---\n', system.slice(0, 500), '...\n');

try {
  const reply = await completeChat({ system, messages });
  console.log('--- Reply ---\n', reply);
} catch (err) {
  console.error('Failed:', err.message);
  process.exit(1);
}
