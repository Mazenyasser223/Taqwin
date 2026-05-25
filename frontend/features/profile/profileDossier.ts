import { getActiveStepsForFlow, getLocalizedQuestionnaireStep } from '../onboarding/flows';
import { FLOW_META, type QuestionnaireFlowId } from '../onboarding/flows/types';
import { getFlowCompletionStats, isFlowCompleted, isStepSkipped, QUESTIONNAIRE_META_KEYS } from '../onboarding/questionnaireCompletion';
import type { OnboardingStep, OnboardingAnswers, CatalogPickItem } from '../onboarding/types';
import { formatAnswerText } from '../onboarding/formatAnswer';
import { resolveCatalogPickName } from '../onboarding/catalogLocale';
import type { WebtebFoodNameLookup } from '../onboarding/catalogFoodLookup';
import type { AppLanguage } from '../../services/settingsService';
import type { TranslationKey } from '../../lib/i18n/translations';
import { translations } from '../../lib/i18n/translations';

const SKIP_TYPES = new Set(['info', 'hero', 'generating', 'summary']);

const DOSSIER_FIELD_LABEL_KEYS: Partial<Record<string, TranslationKey>> = {
  displayName: 'profile.dossier.field.displayName',
  gender: 'profile.dossier.field.gender',
  age: 'profile.dossier.field.age',
  phone: 'profile.dossier.field.phone',
  height: 'profile.dossier.field.height',
  weight: 'profile.dossier.field.weight',
  bodyType: 'profile.dossier.field.bodyType',
  bodyMeasurements: 'profile.dossier.field.bodyMeasurements',
  primaryGoal: 'profile.dossier.field.primaryGoal',
  activityLevel: 'profile.dossier.field.activityLevel',
  fitnessLevel: 'profile.dossier.field.fitnessLevel',
  lastTraining: 'profile.dossier.field.lastTraining',
  otherSports: 'profile.dossier.field.otherSports',
  upcomingEvent: 'profile.dossier.field.upcomingEvent',
  planFailed: 'profile.dossier.field.planFailed',
  inbodyScan: 'profile.dossier.field.inbodyScan',
  progressPhotos: 'profile.dossier.field.progressPhotos',
};

export type DossierFieldStatus = 'answered' | 'skipped' | 'empty';

export interface DossierField {
  id: string;
  label: string;
  value: string | null;
  status: DossierFieldStatus;
  chips?: string[];
  flow: QuestionnaireFlowId;
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
  restartRoute: string;
  resumeRoute: string;
  answeredCount: number;
  totalCount: number;
}

export interface ProfileDossier {
  categories: DossierCategory[];
  highlightStats: { labelKey: string; value: string; icon: string }[];
  completionPct: number;
  filledCount: number;
  totalFields: number;
}

function formatDossierLabel(title: string): string {
  return title.replace(/^[?\s؟]+|[?\s؟]+$/g, '').trim();
}

function dossierFieldLabel(stepId: string, step: OnboardingStep, language: AppLanguage): string {
  const key = DOSSIER_FIELD_LABEL_KEYS[stepId];
  if (key && translations[language][key]) {
    return translations[language][key] as string;
  }
  if (step.type === 'likert' && 'statement' in step) {
    return formatDossierLabel(step.statement);
  }
  return formatDossierLabel(step.title);
}

function ageFromDateOfBirth(dateOfBirth?: string | null): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age -= 1;
  return age > 0 && age < 120 ? age : null;
}

type ProfileSlice = {
  displayName?: string | null;
  gender?: string | null;
  height?: number | null;
  weight?: number | null;
  fitnessGoal?: string | null;
  fitnessLevel?: string | null;
  dateOfBirth?: string | null;
  businessPhone?: string | null;
};

/** Merge DB profile columns into onboarding answers (core fields often live on profile only). */
export function mergeProfileIntoOnboardingData(
  data: Record<string, unknown>,
  profile?: ProfileSlice | null,
): Record<string, unknown> {
  if (!profile) return data;
  const merged: Record<string, unknown> = { ...data };

  if (profile.displayName && !merged.displayName) merged.displayName = profile.displayName;
  if (profile.gender && !merged.gender) merged.gender = profile.gender;
  if (profile.height != null && merged.height == null) merged.height = profile.height;
  if (profile.weight != null && merged.weight == null) merged.weight = profile.weight;
  if (profile.fitnessGoal && !merged.primaryGoal) merged.primaryGoal = profile.fitnessGoal;
  if (profile.fitnessLevel && !merged.fitnessLevel) merged.fitnessLevel = profile.fitnessLevel;
  if (profile.businessPhone && !merged.phone) merged.phone = profile.businessPhone;

  const age = ageFromDateOfBirth(profile.dateOfBirth);
  if (age != null && merged.age == null && merged.age !== 0) merged.age = age;

  return merged;
}

function profileFallbackForStep(step: OnboardingStep, profile?: ProfileSlice | null): unknown {
  if (!profile) return undefined;
  const key = 'field' in step && step.field ? step.field : step.id;
  switch (key) {
    case 'displayName':
      return profile.displayName;
    case 'gender':
      return profile.gender;
    case 'height':
      return profile.height;
    case 'weight':
      return profile.weight;
    case 'fitnessLevel':
      return profile.fitnessLevel;
    case 'primaryGoal':
      return profile.fitnessGoal;
    case 'phone':
      return profile.businessPhone;
    case 'age': {
      const fromData = profile.dateOfBirth ? ageFromDateOfBirth(profile.dateOfBirth) : null;
      return fromData;
    }
    default:
      return undefined;
  }
}

function dossierText(language: AppLanguage, key: TranslationKey): string {
  return translations[language][key] as string;
}

function localizeStoredOptionValue(stepId: string, value: string, language: AppLanguage): string {
  const step = getLocalizedQuestionnaireStep(stepId, language);
  if (step && (step.type === 'single' || step.type === 'multi')) {
    const opt = step.options.find((o) => o.value === value);
    if (opt) return opt.label;
  }
  return value;
}

function answerRaw(
  step: OnboardingStep,
  data: Record<string, unknown>,
  language: AppLanguage,
  profile?: Parameters<typeof profileFallbackForStep>[1],
): unknown {
  if (step.type === 'measurements') {
    const parts: string[] = [];
    const labels: Record<string, TranslationKey> = {
      measureChest: 'profile.dossier.measure.chest',
      measureWaist: 'profile.dossier.measure.waist',
      measureHips: 'profile.dossier.measure.hips',
      measureArm: 'profile.dossier.measure.arm',
    };
    for (const [k, labelKey] of Object.entries(labels)) {
      const v = data[k];
      if (v !== undefined && v !== null && v !== '') {
        parts.push(`${dossierText(language, labelKey)} ${v} ${language === 'ar' ? 'سم' : 'cm'}`);
      }
    }
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (step.type === 'inbody') {
    const parts: string[] = [];
    if (data.inbodyBodyFat) {
      parts.push(`${dossierText(language, 'profile.dossier.inbody.bf')} ${data.inbodyBodyFat}%`);
    }
    if (data.inbodyMuscle) {
      parts.push(
        `${dossierText(language, 'profile.dossier.inbody.muscle')} ${data.inbodyMuscle} ${language === 'ar' ? 'كجم' : 'kg'}`,
      );
    }
    if (data.inbodyBmr) {
      parts.push(`${dossierText(language, 'profile.dossier.inbody.bmr')} ${data.inbodyBmr}`);
    }
    if (data.inbodyAcknowledged) {
      parts.push(dossierText(language, 'profile.dossier.inbody.acknowledged'));
    }
    return parts.length ? parts.join(' · ') : undefined;
  }
  if (step.type === 'photos') {
    const bits: string[] = [];
    if (typeof data.photoFrontUrl === 'string' && data.photoFrontUrl) {
      bits.push(dossierText(language, 'profile.dossier.photo.front'));
    } else if (data.photoFrontDone) {
      bits.push(dossierText(language, 'profile.dossier.photo.front'));
    }
    if (typeof data.photoBackUrl === 'string' && data.photoBackUrl) {
      bits.push(dossierText(language, 'profile.dossier.photo.back'));
    } else if (data.photoBackDone) {
      bits.push(dossierText(language, 'profile.dossier.photo.back'));
    }
    return bits.length ? bits.join(' + ') : undefined;
  }

  if ('field' in step && step.field) {
    const fromData = data[step.field] ?? data[step.id];
    if (fromData !== undefined && fromData !== null && fromData !== '') return fromData;
    return profileFallbackForStep(step, profile);
  }
  const fromId = data[step.id];
  if (fromId !== undefined && fromId !== null && fromId !== '') return fromId;
  return profileFallbackForStep(step, profile);
}

function formatFieldValue(
  step: OnboardingStep,
  raw: unknown,
  data: Record<string, unknown>,
  language: AppLanguage,
): string | null {
  if (raw === undefined || raw === null || raw === '') {
    if (step.type === 'measurements' || step.type === 'inbody' || step.type === 'photos') {
      const synthetic = answerRaw(step, data, language);
      if (typeof synthetic === 'string') return synthetic;
    }
    return null;
  }

  const answers = { [step.id]: raw, ...('field' in step && step.field ? { [step.field]: raw } : {}) };
  const formatted = formatAnswerText(step, answers as OnboardingAnswers, language);
  if (formatted) return formatted;

  if (Array.isArray(raw)) return raw.map(String).join(', ');
  if (typeof raw === 'boolean') {
    return raw ? dossierText(language, 'profile.dossier.yes') : dossierText(language, 'profile.dossier.no');
  }
  return String(raw);
}

function chipsFromValue(
  value: string,
  raw?: unknown,
  language: AppLanguage = 'ar',
  foodLookup?: WebtebFoodNameLookup,
): string[] | undefined {
  if (Array.isArray(raw) && raw.length && typeof raw[0] === 'object' && raw[0] != null && 'name' in raw[0]) {
    const names = (raw as CatalogPickItem[])
      .map((x) => resolveCatalogPickName(x, language, foodLookup))
      .filter(Boolean);
    return names.length > 1 ? names : names.length === 1 ? names : undefined;
  }
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

function countFlowFields(
  flow: QuestionnaireFlowId,
  data: Record<string, unknown>,
  language: AppLanguage,
): number {
  return getActiveStepsForFlow(flow, data, language).filter((s) => !SKIP_TYPES.has(s.type)).length;
}

export function dossierFlowRestartUrl(flow: QuestionnaireFlowId): string {
  return `${FLOW_ROUTES[flow]}?restart=1`;
}

function buildCategory(
  flow: QuestionnaireFlowId,
  data: Record<string, unknown>,
  language: AppLanguage,
  profile?: ProfileSlice | null,
  foodLookup?: WebtebFoodNameLookup,
): DossierCategory {
  const style = FLOW_STYLE[flow];
  const fields: DossierField[] = [];
  const source =
    flow === 'core' ? mergeProfileIntoOnboardingData(data, profile) : data;

  const activeSteps = getActiveStepsForFlow(flow, source, language).filter(
    (s) => !SKIP_TYPES.has(s.type),
  );

  for (const step of activeSteps) {
    const stepId = step.id;
    const raw = answerRaw(step, source, language, profile);
    const value = formatFieldValue(step, raw, source, language);
    const skipped = isStepSkipped(step, source);
    const status: DossierFieldStatus = skipped ? 'skipped' : value ? 'answered' : 'empty';

    fields.push({
      id: stepId,
      label: dossierFieldLabel(stepId, step, language),
      value: value ?? null,
      status,
      chips: value ? chipsFromValue(value, raw, language, foodLookup) : undefined,
      flow,
    });
  }

  const completedKey = FLOW_META[flow].completedKey;
  const flowComplete = isFlowCompleted(source, flow, language);
  const completedAt = flowComplete && data[completedKey] ? String(data[completedKey]) : undefined;
  const answeredCount = fields.filter((f) => f.status === 'answered').length;

  return {
    flow,
    titleKey: style.titleKey,
    subtitleKey: style.subtitleKey,
    icon: style.icon,
    accent: style.accent,
    completed: flowComplete,
    completedAt,
    fields,
    restartRoute: dossierFlowRestartUrl(flow),
    resumeRoute: FLOW_ROUTES[flow],
    answeredCount,
    totalCount: fields.length,
  };
}

function computeBmi(height?: number | null, weight?: number | null): string | null {
  if (!height || !weight || height <= 0) return null;
  const bmi = weight / (height / 100) ** 2;
  return bmi.toFixed(1);
}

export function buildProfileDossier(
  data: Record<string, unknown> | null | undefined,
  profile?: ProfileSlice | null,
  language: AppLanguage = 'en',
  foodLookup?: WebtebFoodNameLookup,
): ProfileDossier | null {
  const base = data && typeof data === 'object' ? data : {};
  const mergedCore = mergeProfileIntoOnboardingData(base, profile);
  const hasData =
    Object.keys(mergedCore).some(
      (k) => !QUESTIONNAIRE_META_KEYS.has(k) && mergedCore[k] != null && mergedCore[k] !== '',
    ) || Boolean(profile?.displayName);

  if (!hasData) return null;

  const categories: QuestionnaireFlowId[] = ['core', 'workout', 'diet', 'wellness'];
  const built = categories.map((f) =>
    buildCategory(f, f === 'core' ? mergedCore : base, language, profile, foodLookup),
  );
  const allFields = built.flatMap((c) => c.fields);
  const totalFields = built.reduce((n, c) => n + c.totalCount, 0);
  const filledCount = allFields.filter((f) => f.status === 'answered').length;

  const flowStats = categories.map((f) =>
    getFlowCompletionStats(f === 'core' ? mergedCore : base, f, language),
  );
  const totalAnswerable = flowStats.reduce((n, s) => n + s.total, 0);
  const totalAnswered = flowStats.reduce((n, s) => n + s.answered, 0);
  const completionPct =
    totalAnswerable > 0
      ? Math.round((totalAnswered / totalAnswerable) * 100)
      : Math.round((filledCount / Math.max(totalFields, 1)) * 100);

  const height =
    profile?.height ??
    ((typeof mergedCore.height === 'number' ? mergedCore.height : Number(mergedCore.height)) || null);
  const weight =
    profile?.weight ??
    ((typeof mergedCore.weight === 'number' ? mergedCore.weight : Number(mergedCore.weight)) || null);
  const bmi = computeBmi(height, weight);

  const highlightStats: ProfileDossier['highlightStats'] = [];
  if (height) {
    highlightStats.push({
      labelKey: 'profile.dossier.stat.height',
      value: language === 'ar' ? `${height} سم` : `${height} cm`,
      icon: 'height',
    });
  }
  if (weight) {
    highlightStats.push({
      labelKey: 'profile.dossier.stat.weight',
      value: language === 'ar' ? `${weight} كجم` : `${weight} kg`,
      icon: 'monitor_weight',
    });
  }
  if (bmi) highlightStats.push({ labelKey: 'profile.dossier.stat.bmi', value: bmi, icon: 'analytics' });
  if (profile?.fitnessGoal) {
    highlightStats.push({
      labelKey: 'profile.dossier.stat.goal',
      value: localizeStoredOptionValue('primaryGoal', profile.fitnessGoal, language),
      icon: 'flag',
    });
  } else if (mergedCore.primaryGoal) {
    highlightStats.push({
      labelKey: 'profile.dossier.stat.goal',
      value: localizeStoredOptionValue('primaryGoal', String(mergedCore.primaryGoal), language),
      icon: 'flag',
    });
  }

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
