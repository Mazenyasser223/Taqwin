import type { InbodyExtractedData, InbodyHistory, InbodySegmentPart, InbodySegmental } from '../../services/inbodyService';
import type { TranslationKey } from '../i18n/translations';

export type InbodyFieldType = 'number' | 'string' | 'date';

export interface InbodyFlatFieldDef {
  key: keyof InbodyExtractedData;
  labelKey: TranslationKey;
  unitKey?: TranslationKey;
  type?: InbodyFieldType;
}

export interface InbodyFieldGroup {
  id: string;
  labelKey: TranslationKey;
  fields: InbodyFlatFieldDef[];
}

export const SEGMENT_PARTS = ['rightArm', 'leftArm', 'trunk', 'rightLeg', 'leftLeg'] as const;
export type SegmentPartKey = (typeof SEGMENT_PARTS)[number];

/** Already collected in core onboarding — hide from InBody step UI. */
export const INBODY_DUPLICATE_ONBOARDING_KEYS = new Set<keyof InbodyExtractedData>([
  'patientName',
  'patientId',
  'heightCm',
  'ageYears',
  'gender',
  'weightKg',
]);

export const SEGMENT_PART_LABELS: Record<SegmentPartKey, TranslationKey> = {
  rightArm: 'onboarding.inbody.segments.rightArm',
  leftArm: 'onboarding.inbody.segments.leftArm',
  trunk: 'onboarding.inbody.segments.trunk',
  rightLeg: 'onboarding.inbody.segments.rightLeg',
  leftLeg: 'onboarding.inbody.segments.leftLeg',
};

export const INBODY_FIELD_GROUPS: InbodyFieldGroup[] = [
  {
    id: 'scanMeta',
    labelKey: 'onboarding.inbody.groups.scanMeta',
    fields: [
      { key: 'testDate', labelKey: 'onboarding.inbody.fields.testDate', type: 'date' },
      { key: 'testTime', labelKey: 'onboarding.inbody.fields.testTime', type: 'string' },
      { key: 'location', labelKey: 'onboarding.inbody.fields.location', type: 'string' },
      { key: 'deviceModel', labelKey: 'onboarding.inbody.fields.device', type: 'string' },
    ],
  },
  {
    id: 'bodyComposition',
    labelKey: 'onboarding.inbody.groups.bodyComposition',
    fields: [
      { key: 'totalBodyWaterL', labelKey: 'onboarding.inbody.fields.tbw', unitKey: 'onboarding.inbody.units.l' },
      { key: 'proteinKg', labelKey: 'onboarding.inbody.fields.protein', unitKey: 'onboarding.inbody.units.kg' },
      { key: 'mineralsKg', labelKey: 'onboarding.inbody.fields.minerals', unitKey: 'onboarding.inbody.units.kg' },
      { key: 'bodyFatMassKg', labelKey: 'onboarding.inbody.fields.bodyFatMass', unitKey: 'onboarding.inbody.units.kg' },
    ],
  },
  {
    id: 'muscleFat',
    labelKey: 'onboarding.inbody.groups.muscleFat',
    fields: [
      { key: 'skeletalMuscleMassKg', labelKey: 'onboarding.inbody.fields.smm', unitKey: 'onboarding.inbody.units.kg' },
      { key: 'bodyFatPercent', labelKey: 'onboarding.inbody.fields.bodyFat', unitKey: 'onboarding.inbody.units.percent' },
      { key: 'bmi', labelKey: 'onboarding.inbody.fields.bmi' },
    ],
  },
  {
    id: 'scoreControl',
    labelKey: 'onboarding.inbody.groups.scoreControl',
    fields: [
      { key: 'inbodyScore', labelKey: 'onboarding.inbody.fields.score' },
      { key: 'targetWeightKg', labelKey: 'onboarding.inbody.fields.targetWeight', unitKey: 'onboarding.inbody.units.kg' },
      { key: 'weightControlKg', labelKey: 'onboarding.inbody.fields.weightControl', unitKey: 'onboarding.inbody.units.kg' },
      { key: 'fatControlKg', labelKey: 'onboarding.inbody.fields.fatControl', unitKey: 'onboarding.inbody.units.kg' },
      { key: 'muscleControlKg', labelKey: 'onboarding.inbody.fields.muscleControl', unitKey: 'onboarding.inbody.units.kg' },
    ],
  },
  {
    id: 'research',
    labelKey: 'onboarding.inbody.groups.research',
    fields: [
      { key: 'basalMetabolicRate', labelKey: 'onboarding.inbody.fields.bmr', unitKey: 'onboarding.inbody.units.kcal' },
      { key: 'waistHipRatio', labelKey: 'onboarding.inbody.fields.whr' },
      { key: 'visceralFatLevel', labelKey: 'onboarding.inbody.fields.visceralFat' },
      { key: 'obesityDegreePercent', labelKey: 'onboarding.inbody.fields.obesityDegree', unitKey: 'onboarding.inbody.units.percent' },
    ],
  },
  {
    id: 'history',
    labelKey: 'onboarding.inbody.groups.history',
    fields: [],
  },
];

export interface InbodyHistoryFieldDef {
  key: keyof InbodyHistory;
  labelKey: TranslationKey;
  unitKey?: TranslationKey;
  type?: InbodyFieldType;
}

export const HISTORY_FIELDS: InbodyHistoryFieldDef[] = [
  { key: 'previousTestDate', labelKey: 'onboarding.inbody.fields.prevDate', type: 'string' as const },
  { key: 'previousWeightKg', labelKey: 'onboarding.inbody.fields.prevWeight', unitKey: 'onboarding.inbody.units.kg' },
  { key: 'previousSkeletalMuscleMassKg', labelKey: 'onboarding.inbody.fields.prevSmm', unitKey: 'onboarding.inbody.units.kg' },
  { key: 'previousBodyFatPercent', labelKey: 'onboarding.inbody.fields.prevBf', unitKey: 'onboarding.inbody.units.percent' },
];

export const IMPEDANCE_BANDS = [
  { key: 'at20kHz', labelKey: 'onboarding.inbody.impedance.20kHz' },
  { key: 'at100kHz', labelKey: 'onboarding.inbody.impedance.100kHz' },
] as const;

export function emptySegmentPart(): InbodySegmentPart {
  return { kg: null, percent: null, status: null };
}

export function emptySegmental(): InbodySegmental {
  return {
    rightArm: emptySegmentPart(),
    leftArm: emptySegmentPart(),
    trunk: emptySegmentPart(),
    rightLeg: emptySegmentPart(),
    leftLeg: emptySegmentPart(),
  };
}

export function getFlatValue(data: InbodyExtractedData, key: keyof InbodyExtractedData): string {
  const v = data[key];
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return '';
  return String(v);
}

export function parseFlatValue(
  key: keyof InbodyExtractedData,
  raw: string,
  type: InbodyFieldType = 'number',
): string | number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (type === 'string' || type === 'date') return trimmed;
  const n = Number(trimmed.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

export function hasNestedValue(obj: unknown): boolean {
  if (obj == null) return false;
  if (typeof obj !== 'object') return obj !== '';
  if (Array.isArray(obj)) return obj.length > 0;
  return Object.values(obj).some((v) => {
    if (v == null || v === '') return false;
    if (typeof v === 'object') return hasNestedValue(v);
    return true;
  });
}

export function stripOnboardingDuplicates(data: InbodyExtractedData): InbodyExtractedData {
  const out = { ...data };
  for (const key of INBODY_DUPLICATE_ONBOARDING_KEYS) {
    (out as Record<string, unknown>)[key] = null;
  }
  return out;
}

/** Weight from scan — saved to BodyMetric but not shown in InBody step UI. */
export function pickHiddenScanMetrics(data: InbodyExtractedData): { weightKg: number | null } {
  return { weightKg: data.weightKg };
}

export function inbodyDataForOnboarding(data: InbodyExtractedData): InbodyExtractedData {
  return stripOnboardingDuplicates(data);
}

export function hasAnyInbodyData(data: InbodyExtractedData): boolean {
  for (const group of INBODY_FIELD_GROUPS) {
    for (const field of group.fields) {
      if (INBODY_DUPLICATE_ONBOARDING_KEYS.has(field.key)) continue;
      const v = data[field.key];
      if (v !== null && v !== undefined && v !== '') return true;
    }
  }
  if (hasNestedValue(data.segmentalLean)) return true;
  if (hasNestedValue(data.segmentalFat)) return true;
  if (hasNestedValue(data.impedance)) return true;
  if (hasNestedValue(data.history)) return true;
  return false;
}
