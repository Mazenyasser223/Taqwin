import { ATHLETE_ONBOARDING_STEPS } from '../onboarding/athleteSteps';
import { SECTION_LABELS, type OnboardingSection } from '../onboarding/types';
import type { OnboardingStep } from '../onboarding/types';

const META_KEYS = new Set([
  'progressStepIndex',
  'inProgress',
  'completedAt',
  'version',
  'lastStepId',
  'savedAt',
  'roleWizard',
  'skipped',
]);

const EXTRA_LABELS: Record<string, string> = {
  roleWizard: 'Account type (wizard)',
  displayName: 'Name',
  address: 'Address',
  city: 'City',
  phone: 'Phone',
  bio: 'Bio',
  specialties: 'Specialties',
  yearsExperience: 'Years of experience',
  businessName: 'Business name',
  businessAddress: 'Address',
  businessPhone: 'Phone',
  websiteUrl: 'Website',
  dateOfBirth: 'Date of birth',
};

export interface OnboardingDisplayRow {
  key: string;
  label: string;
  value: string;
}

export interface OnboardingDisplayGroup {
  section: string;
  rows: OnboardingDisplayRow[];
}

function humanizeKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase())
    .trim();
}

function optionLabel(step: OnboardingStep, value: string): string {
  if (step.type !== 'single' && step.type !== 'multi') return value;
  const opt = step.options.find((o) => o.value === value);
  return opt?.label ?? value;
}

function formatStepValue(step: OnboardingStep, raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';

  if (step.type === 'multi' && Array.isArray(raw)) {
    return raw.map((v) => optionLabel(step, String(v))).join(', ');
  }

  if (step.type === 'single') {
    return optionLabel(step, String(raw));
  }

  if (step.type === 'slider') {
    const level = step.levels.find((l) => l.value === String(raw));
    return level?.label ?? String(raw);
  }

  if (step.type === 'likert') {
    const n = Number(raw);
    const labels = ['Not at all', 'A little', 'Somewhat', 'Quite a bit', 'Completely'];
    return Number.isFinite(n) ? `${n} — ${labels[n - 1] ?? ''}`.trim() : String(raw);
  }

  if (step.type === 'number') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(num)) return String(raw);
    const unit =
      step.unit ??
      (step.field === 'weight' || step.field === 'targetWeight'
        ? 'kg'
        : step.field === 'height'
          ? 'cm'
          : '');
    return unit ? `${num} ${unit}` : String(num);
  }

  if (step.type === 'weightOptional') {
    const num = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(num)) return String(raw);
    return `${num} kg`;
  }

  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';

  return String(raw);
}

function stepTitle(step: OnboardingStep): string {
  if (step.type === 'likert') return step.statement;
  if (step.type === 'text') return step.title;
  return step.title;
}

/** Build grouped rows from athlete wizard steps (skips info-only steps). */
export function athleteOnboardingGroups(
  data: Record<string, unknown> | null | undefined,
): OnboardingDisplayGroup[] {
  if (!data || typeof data !== 'object') return [];

  const bySection = new Map<string, OnboardingDisplayRow[]>();

  for (const step of ATHLETE_ONBOARDING_STEPS) {
    if (step.type === 'info' || step.type === 'hero' || step.type === 'generating' || step.type === 'summary') {
      continue;
    }

    const raw = data[step.id];
    const value = formatStepValue(step, raw);
    if (!value) continue;

    const section = SECTION_LABELS[step.section as OnboardingSection] ?? step.section;
    const rows = bySection.get(section) ?? [];
    rows.push({ key: step.id, label: stepTitle(step), value });
    bySection.set(section, rows);
  }

  const sectionOrder = Object.values(SECTION_LABELS);
  return sectionOrder
    .filter((s) => bySection.has(s))
    .map((section) => ({ section, rows: bySection.get(section)! }));
}

/** Keys saved in onboarding JSON but not tied to a wizard step id. */
export function extraOnboardingRows(
  data: Record<string, unknown> | null | undefined,
  stepIds: Set<string>,
): OnboardingDisplayRow[] {
  if (!data) return [];
  const rows: OnboardingDisplayRow[] = [];
  for (const [key, raw] of Object.entries(data)) {
    if (META_KEYS.has(key) || stepIds.has(key)) continue;
    if (raw === undefined || raw === null || raw === '') continue;
    const value =
      Array.isArray(raw) ? raw.map(String).join(', ') : typeof raw === 'object' ? JSON.stringify(raw) : String(raw);
    rows.push({ key, label: EXTRA_LABELS[key] ?? humanizeKey(key), value });
  }
  return rows;
}

export function roleWizardGroups(
  data: Record<string, unknown> | null | undefined,
): OnboardingDisplayGroup[] {
  if (!data || data.roleWizard === undefined) return [];

  const stepIds = new Set(ATHLETE_ONBOARDING_STEPS.map((s) => s.id));
  const rows = extraOnboardingRows(data, stepIds);
  if (!rows.length) return [];

  return [{ section: 'Setup answers', rows }];
}

export function onboardingMetaLine(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (data.completedAt) {
    parts.push(`Completed ${new Date(String(data.completedAt)).toLocaleDateString()}`);
  } else if (data.inProgress) {
    parts.push('In progress');
  }
  if (data.skipped) parts.push('Skipped remaining steps');
  if (typeof data.progressStepIndex === 'number') {
    parts.push(`Last step index: ${data.progressStepIndex}`);
  }
  return parts.length ? parts.join(' · ') : null;
}
