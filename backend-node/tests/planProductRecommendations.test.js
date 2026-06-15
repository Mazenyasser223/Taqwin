const test = require('node:test');
const assert = require('node:assert/strict');
const { buildSlots } = require('../src/lib/commerce/planProductRecommendations');

test('buildSlots recommends protein + creatine + shaker for muscle goal', () => {
  const slots = buildSlots({
    goal: 'muscle',
    fitnessLevel: 'intermediate',
    activityLevel: 'moderate',
    supplementsBudget: '',
    isVegan: false,
    weightKg: 80,
    proteinTargetG: 176,
  });
  const ids = slots.map((s) => s.slot);
  assert.ok(ids.includes('protein'));
  assert.ok(ids.includes('creatine'));
  assert.ok(ids.includes('shaker'));
});

test('buildSlots skips whey for vegan athletes', () => {
  const slots = buildSlots({
    goal: 'muscle',
    fitnessLevel: 'intermediate',
    activityLevel: 'moderate',
    supplementsBudget: '',
    isVegan: true,
    weightKg: 70,
    proteinTargetG: 154,
  });
  assert.equal(slots.some((s) => s.slot === 'protein'), false);
});

test('buildSlots variant A excludes shaker', () => {
  const slots = buildSlots(
    {
      goal: 'muscle',
      fitnessLevel: 'intermediate',
      activityLevel: 'moderate',
      supplementsBudget: '',
      isVegan: false,
      weightKg: 80,
      proteinTargetG: 176,
    },
    { includeShaker: false }
  );
  const ids = slots.map((s) => s.slot);
  assert.ok(ids.includes('protein'));
  assert.ok(ids.includes('creatine'));
  assert.equal(ids.includes('shaker'), false);
});

test('buildSlots skips creatine when already listed in supplementsBudget', () => {
  const slots = buildSlots({
    goal: 'muscle',
    fitnessLevel: 'advanced',
    activityLevel: 'high',
    supplementsBudget: 'whey + creatine daily',
    isVegan: false,
    weightKg: 75,
    proteinTargetG: 165,
  });
  assert.equal(slots.some((s) => s.slot === 'creatine'), false);
  assert.equal(slots.some((s) => s.slot === 'protein'), false);
});
