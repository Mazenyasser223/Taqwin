export const PLAN_BENEFIT_UNLIMITED = -1;

export type GymPlanBenefits = {
  freezeWeeks?: number;
  invitations?: number;
  privateCoachSessions?: number;
  spa?: number;
  jacuzzi?: number;
  sauna?: number;
};

export type PlanBenefitsForm = {
  freezeWeeks: string;
  invitations: string;
  privateCoachSessions: string;
  spa: string;
  jacuzzi: string;
  sauna: string;
};

export const emptyPlanBenefitsForm = (): PlanBenefitsForm => ({
  freezeWeeks: '',
  invitations: '',
  privateCoachSessions: '',
  spa: '',
  jacuzzi: '',
  sauna: '',
});

function parseBenefitField(raw: string): number | undefined {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === 'unlimited') return PLAN_BENEFIT_UNLIMITED;
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

function formBenefitValue(value?: number): string {
  if (value == null || value === 0) return '';
  if (value === PLAN_BENEFIT_UNLIMITED) return 'unlimited';
  return String(value);
}

function isBenefitActive(value?: number): boolean {
  return value === PLAN_BENEFIT_UNLIMITED || (value != null && value > 0);
}

export function benefitsFromForm(form: PlanBenefitsForm): GymPlanBenefits | undefined {
  const out: GymPlanBenefits = {};
  const freezeWeeks = parseBenefitField(form.freezeWeeks);
  const invitations = parseBenefitField(form.invitations);
  const privateCoachSessions = parseBenefitField(form.privateCoachSessions);
  const spa = parseBenefitField(form.spa);
  const jacuzzi = parseBenefitField(form.jacuzzi);
  const sauna = parseBenefitField(form.sauna);
  if (freezeWeeks != null) out.freezeWeeks = freezeWeeks;
  if (invitations != null) out.invitations = invitations;
  if (privateCoachSessions != null) out.privateCoachSessions = privateCoachSessions;
  if (spa != null) out.spa = spa;
  if (jacuzzi != null) out.jacuzzi = jacuzzi;
  if (sauna != null) out.sauna = sauna;
  return Object.keys(out).length ? out : undefined;
}

export function formFromBenefits(benefits?: GymPlanBenefits | null): PlanBenefitsForm {
  return {
    freezeWeeks: formBenefitValue(benefits?.freezeWeeks),
    invitations: formBenefitValue(benefits?.invitations),
    privateCoachSessions: formBenefitValue(benefits?.privateCoachSessions),
    spa: formBenefitValue(benefits?.spa),
    jacuzzi: formBenefitValue(benefits?.jacuzzi),
    sauna: formBenefitValue(benefits?.sauna),
  };
}

export function hasPlanBenefits(benefits?: GymPlanBenefits | null): boolean {
  if (!benefits) return false;
  return (
    isBenefitActive(benefits.freezeWeeks) ||
    isBenefitActive(benefits.invitations) ||
    isBenefitActive(benefits.privateCoachSessions) ||
    isBenefitActive(benefits.spa) ||
    isBenefitActive(benefits.jacuzzi) ||
    isBenefitActive(benefits.sauna)
  );
}

type BenefitTranslator = (key: string, params?: Record<string, string>) => string;

function benefitLine(
  value: number | undefined,
  countKey: string,
  unlimitedKey: string,
  t: BenefitTranslator,
): string | null {
  if (!isBenefitActive(value)) return null;
  if (value === PLAN_BENEFIT_UNLIMITED) return t(unlimitedKey);
  return t(countKey, { count: String(value) });
}

export function planBenefitLines(benefits: GymPlanBenefits | null | undefined, t: BenefitTranslator): string[] {
  if (!benefits) return [];
  return [
    benefitLine(benefits.freezeWeeks, 'gymDash.benefitFreezeWeeks', 'gymDash.benefitFreezeWeeksUnlimited', t),
    benefitLine(benefits.invitations, 'gymDash.benefitInvitations', 'gymDash.benefitInvitationsUnlimited', t),
    benefitLine(
      benefits.privateCoachSessions,
      'gymDash.benefitCoachSessions',
      'gymDash.benefitCoachSessionsUnlimited',
      t,
    ),
    benefitLine(benefits.spa, 'gymDash.benefitSpa', 'gymDash.benefitSpaUnlimited', t),
    benefitLine(benefits.jacuzzi, 'gymDash.benefitJacuzzi', 'gymDash.benefitJacuzziUnlimited', t),
    benefitLine(benefits.sauna, 'gymDash.benefitSauna', 'gymDash.benefitSaunaUnlimited', t),
  ].filter((line): line is string => line != null);
}
