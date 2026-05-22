import { ATHLETE_ONBOARDING_STEPS } from '../onboarding/athleteSteps';
import { FLOW_STEP_ORDERS } from '../onboarding/flows/orders';
import { FLOW_META, type QuestionnaireFlowId } from '../onboarding/flows/types';
import { isFlowCompleted, QUESTIONNAIRE_META_KEYS } from '../onboarding/questionnaireCompletion';
import type { OnboardingStep } from '../onboarding/types';
import { formatAnswerText } from '../onboarding/formatAnswer';

const STEPS_BY_ID = new Map<string, OnboardingStep>(
  ATHLETE_ONBOARDING_STEPS.map((s) => [s.id, s]),
);

export interface DossierField {
  id: string;
  label: string;
  value: string;
  /** When value has comma-separated items, show as chips */
  chips?: string[];
}

export interface DossierCategory {
  flow: QuestionnaireFlowId;
  titleKey: string;
  subtitleKey: string;
  icon: string;
  accent: string;
  completed: boolean;
  completedAt?: string;
  fields: DossierField[];
  route: string;
}

export interface ProfileDossier {
  categories: DossierCategory[];
  highlightStats: { labelKey: string; value: string; icon: string }[];
  completionPct: number;
  filledCount: number;
  totalFields: number;
}

function answerRaw(step: OnboardingStep, data: Record<string, unknown>): unknown {
  if (step.type === 'measurements') {
    const parts: string[] = [];
    const labels: Record<string, string> = {
      measureChest: 'Chest',
      measureWaist: 'Waist',
      measureHips: 'Hips',
      measureArm: 'Arm',
    };
    for (const [k, label] of Object.entries(labels)) {
      const v = data[k];
      if (v !== undefined && v !== null && v !== '') parts.push(`${label} ${v} cm`);
    }
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (step.type === 'inbody') {
    const parts: string[] = [];
    if (data.inbodyBodyFat) parts.push(`BF ${data.inbodyBodyFat}%`);
    if (data.inbodyMuscle) parts.push(`Muscle ${data.inbodyMuscle} kg`);
    if (data.inbodyBmr) parts.push(`BMR ${data.inbodyBmr}`);
    if (data.inbodyAcknowledged) parts.push('Acknowledged');
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (step.type === 'photos') {
    const bits: string[] = [];
    if (data.photoFrontDone) bits.push('Front');
    if (data.photoBackDone) bits.push('Back');
    return bits.length ? bits.join(' + ') : undefined;
  }

  if ('field' in step && step.field) {
    return data[step.field] ?? data[step.id];
  }
  return data[step.id];
}

function formatFieldValue(step: OnboardingStep, raw: unknown, data: Record<string, unknown>): string | null {
  if (raw === undefined || raw === null || raw === '') {
    if (step.type === 'measurements' || step.type === 'inbody' || step.type === 'photos') {
      const synthetic = answerRaw(step, data);
      if (typeof synthetic === 'string') return synthetic;
    }
    return null;
  }

  const answers = { [step.id]: raw, ...('field' in step && step.field ? { [step.field]: raw } : {}) };
  const formatted = formatAnswerText(step, answers as Record<string, unknown>);
  if (formatted) return formatted;

  if (Array.isArray(raw)) return raw.map(String).join(', ');
  if (typeof raw === 'boolean') return raw ? 'Yes' : 'No';
  return String(raw);
}

function fieldLabel(step: OnboardingStep): string {
  if (step.type === 'likert') return step.statement;
  return step.title;
}

function chipsFromValue(value: string): string[] | undefined {
  if (!value.includes(',')) return undefined;
  const parts = value.split(',').map((s) => s.trim()).filter(Boolean);
  return parts.length > 1 ? parts : undefined;
}

const FLOW_ROUTES: Record<QuestionnaireFlowId, string> = {
  core: '/onboarding',
  workout: '/onboarding/workout',
  diet: '/onboarding/diet',
  wellness: '/onboarding/wellness',
};

const FLOW_STYLE: Record<QuestionnaireFlowId, { icon: string; accent: string; titleKey: string; subtitleKey: string }> = {
  core: {
    icon: 'person',
    accent: 'from-cyan-500/20 to-teal-600/10 border-cyan-500/30',
    titleKey: 'profile.dossier.flow.core',
    subtitleKey: 'profile.dossier.flow.coreSub',
  },
  workout: {
    icon: 'fitness_center',
    accent: 'from-orange-500/20 to-amber-600/10 border-orange-500/30',
    titleKey: 'profile.dossier.flow.workout',
    subtitleKey: 'profile.dossier.flow.workoutSub',
  },
  diet: {
    icon: 'restaurant',
    accent: 'from-emerald-500/20 to-green-600/10 border-emerald-500/30',
    titleKey: 'profile.dossier.flow.diet',
    subtitleKey: 'profile.dossier.flow.dietSub',
  },
  wellness: {
    icon: 'favorite',
    accent: 'from-violet-500/20 to-purple-600/10 border-violet-500/30',
    titleKey: 'profile.dossier.flow.wellness',
    subtitleKey: 'profile.dossier.flow.wellnessSub',
  },
};

function buildCategory(flow: QuestionnaireFlowId, data: Record<string, unknown>): DossierCategory {
  const style = FLOW_STYLE[flow];
  const order = FLOW_STEP_ORDERS[flow];
  const fields: DossierField[] = [];

  for (const stepId of order) {
    const step = STEPS_BY_ID.get(stepId);
    if (!step || step.type === 'info' || step.type === 'hero' || step.type === 'generating' || step.type === 'summary') {
      continue;
    }
    const raw = answerRaw(step, data);
    const value = formatFieldValue(step, raw, data);
    if (!value) continue;
    fields.push({
      id: stepId,
      label: fieldLabel(step),
      value,
      chips: chipsFromValue(value),
    });
  }

  const completedKey = FLOW_META[flow].completedKey;
  const completedAt = data[completedKey] ? String(data[completedKey]) : undefined;

  return {
    flow,
    titleKey: style.titleKey,
    subtitleKey: style.subtitleKey,
    icon: style.icon,
    accent: style.accent,
    completed: isFlowCompleted(data, flow),
    completedAt,
    fields,
    route: FLOW_ROUTES[flow],
  };
}

function computeBmi(height?: number | null, weight?: number | null): string | null {
  if (!height || !weight || height <= 0) return null;
  const bmi = weight / (height / 100) ** 2;
  return bmi.toFixed(1);
}

export function buildProfileDossier(
  data: Record<string, unknown> | null | undefined,
  profile?: {
    height?: number | null;
    weight?: number | null;
    fitnessGoal?: string | null;
    fitnessLevel?: string | null;
    gender?: string | null;
    dateOfBirth?: string | null;
  } | null,
): ProfileDossier | null {
  if (!data || typeof data !== 'object') return null;

  const categories: QuestionnaireFlowId[] = ['core', 'workout', 'diet', 'wellness'];
  const built = categories.map((f) => buildCategory(f, data));
  const allFields = built.flatMap((c) => c.fields);
  const totalFields = categories.reduce((n, f) => n + FLOW_STEP_ORDERS[f].length, 0);
  const filledCount = allFields.length;
  const completionPct = Math.round((built.filter((c) => c.completed).length / categories.length) * 100);

  const height =
    profile?.height ??
    ((typeof data.height === 'number' ? data.height : Number(data.height)) || null);
  const weight =
    profile?.weight ??
    ((typeof data.weight === 'number' ? data.weight : Number(data.weight)) || null);
  const bmi = computeBmi(height, weight);

  const highlightStats: ProfileDossier['highlightStats'] = [];
  if (height) highlightStats.push({ labelKey: 'profile.dossier.stat.height', value: `${height} cm`, icon: 'height' });
  if (weight) highlightStats.push({ labelKey: 'profile.dossier.stat.weight', value: `${weight} kg`, icon: 'monitor_weight' });
  if (bmi) highlightStats.push({ labelKey: 'profile.dossier.stat.bmi', value: bmi, icon: 'analytics' });
  if (profile?.fitnessGoal) highlightStats.push({ labelKey: 'profile.dossier.stat.goal', value: profile.fitnessGoal, icon: 'flag' });
  else if (data.primaryGoal) highlightStats.push({ labelKey: 'profile.dossier.stat.goal', value: String(data.primaryGoal), icon: 'flag' });

  if (highlightStats.length === 0 && allFields.length === 0) return null;

  return {
    categories: built,
    highlightStats,
    completionPct,
    filledCount,
    totalFields,
  };
}

export function hasAnyOnboardingAnswers(data: Record<string, unknown> | null | undefined): boolean {
  if (!data) return false;
  return Object.keys(data).some((k) => !QUESTIONNAIRE_META_KEYS.has(k) && data[k] != null && data[k] !== '');
}
