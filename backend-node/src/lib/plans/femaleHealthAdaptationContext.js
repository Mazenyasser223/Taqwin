/**
 * Female-health questionnaire → coach / plan adaptation notes.
 * Not diagnosis — context for safer coaching only.
 */

function arr(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function isFemaleAthlete(od) {
  if (od?.needsFemaleWellness === true) return true;
  const g = String(od?.gender ?? '')
    .trim()
    .toLowerCase();
  return g === 'female' || g === 'f';
}

function isActivePostpartum(v) {
  const s = String(v ?? '').trim();
  return s !== '' && s !== 'no' && s !== 'prefer_not_to_say';
}

const CYCLE_SYMPTOM_ADAPT = {
  fatigue: 'fatigue — lighter sessions / mobility / recovery priority on low-energy days',
  bloating: 'bloating — temporary scale changes may be water retention; avoid overreacting to short-term weight',
  cramps: 'cramps — lighter workout / mobility / recovery when symptomatic',
  mood_changes: 'mood changes — flexible intensity; stress-aware coaching tone',
  cravings: 'cravings — structured meals; protein + fiber anchors; no shame-based messaging',
  headaches: 'headaches — lower intensity; hydration; avoid Valsalva-heavy loads if symptomatic',
};

/**
 * @param {object} od onboardingData
 * @returns {string[]}
 */
function buildFemaleHealthAdaptationNotes(od = {}) {
  if (!isFemaleAthlete(od)) return [];

  const notes = [];
  const symptoms = arr(od.cycleSymptoms).filter((s) => s !== 'none');
  if (symptoms.length) {
    const adapt = symptoms
      .map((s) => CYCLE_SYMPTOM_ADAPT[s])
      .filter(Boolean);
    notes.push(`Cycle symptoms (${symptoms.join(', ')}): not diagnosis — ${adapt.join('; ') || 'adjust intensity to recovery'}`);
  }

  if (String(od.pregnancyStatus ?? '') === 'yes') {
    notes.push(
      'SAFETY — pregnant: require doctor clearance; no aggressive calorie deficit; no high-impact plan; no heavy progression without clearance'
    );
  }

  if (isActivePostpartum(od.postpartumStatus)) {
    notes.push(
      'SAFETY — postpartum: require doctor clearance; gradual return; no aggressive calorie deficit; conservative progression'
    );
  }

  if (String(od.breastfeeding ?? '') === 'yes') {
    notes.push(
      'Breastfeeding: no aggressive calorie deficit; higher calorie safety floor; hydration + recovery priority'
    );
  }

  const conditions = arr(od.femaleHealthConditions).filter(
    (c) => c !== 'none' && c !== 'prefer_not_to_say'
  );
  if (conditions.length) {
    notes.push(
      `Female health context (${conditions.join(', ')}): not diagnosis — slower progress expectations; protein focus; strength training priority; careful recovery; medical disclaimer`
    );
  }

  if (String(od.birthControl ?? '') === 'yes') {
    notes.push('Hormonal birth control: energy/appetite may vary — flexible weekly adjustments');
  }

  const menopause = String(od.menopause ?? '');
  if (menopause === 'yes' || menopause === 'perimenopause') {
    notes.push('Menopause/perimenopause: recovery and sleep priority; conservative deficit; strength + protein focus');
  }

  const cycleRegularity = String(od.cycleRegularity ?? '');
  if (cycleRegularity === 'irregular') {
    notes.push('Irregular cycle: avoid rigid daily assumptions; flexible training intensity');
  }

  return notes;
}

module.exports = {
  buildFemaleHealthAdaptationNotes,
  isFemaleAthlete,
  isActivePostpartum,
};
