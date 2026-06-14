/**
 * Optional gym subscription plan perks (freeze, invitations, coach sessions, spa, etc.).
 * -1 means unlimited for any perk field.
 */
const { z } = require('zod');

const PLAN_BENEFIT_UNLIMITED = -1;

const PLAN_BENEFIT_KEYS = [
  'freezeWeeks',
  'invitations',
  'privateCoachSessions',
  'spa',
  'jacuzzi',
  'sauna',
];

const PLAN_BENEFIT_MAX = {
  freezeWeeks: 52,
  invitations: 100,
  privateCoachSessions: 100,
  spa: 100,
  jacuzzi: 100,
  sauna: 100,
};

function benefitValueSchema(key) {
  const max = PLAN_BENEFIT_MAX[key];
  return z
    .number()
    .int()
    .refine((v) => v === PLAN_BENEFIT_UNLIMITED || (v >= 1 && v <= max), {
      message: `Must be ${PLAN_BENEFIT_UNLIMITED} (unlimited) or between 1 and ${max}`,
    })
    .optional();
}

const planBenefitsBodySchema = z
  .object({
    freezeWeeks: benefitValueSchema('freezeWeeks'),
    invitations: benefitValueSchema('invitations'),
    privateCoachSessions: benefitValueSchema('privateCoachSessions'),
    spa: benefitValueSchema('spa'),
    jacuzzi: benefitValueSchema('jacuzzi'),
    sauna: benefitValueSchema('sauna'),
  })
  .strict();

function normalizePlanBenefits(raw) {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  for (const key of PLAN_BENEFIT_KEYS) {
    const v = Number(raw[key]);
    if (Number.isFinite(v) && (v === PLAN_BENEFIT_UNLIMITED || v > 0)) out[key] = Math.floor(v);
  }
  return Object.keys(out).length ? out : null;
}

function parsePlanBenefitsInput(input) {
  if (input === undefined) return undefined;
  if (input === null) return null;
  const normalized = normalizePlanBenefits(input);
  if (!normalized) return null;
  planBenefitsBodySchema.parse(normalized);
  return normalized;
}

module.exports = {
  PLAN_BENEFIT_UNLIMITED,
  planBenefitsBodySchema,
  normalizePlanBenefits,
  parsePlanBenefitsInput,
};
