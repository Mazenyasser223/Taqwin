/**
 * InBody extraction + save schemas (Zod) — full InBody 120 / 270 / 570 / 770 layouts.
 */
const { z } = require('zod');

const nullableNumber = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, '').trim());
    return Number.isFinite(n) ? n : null;
  });

const nullableString = z
  .union([z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v === null || v === undefined || v === '') return null;
    return String(v).trim() || null;
  });

function parseTestDate(v) {
  if (!v || typeof v !== 'string') return null;
  const trimmed = v.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return null;
}

const segmentPartSchema = z
  .object({
    kg: nullableNumber,
    percent: nullableNumber,
    status: nullableString,
  })
  .partial()
  .transform((v) => ({
    kg: v.kg ?? null,
    percent: v.percent ?? null,
    status: v.status ?? null,
  }));

const segmentalSchema = z
  .object({
    rightArm: segmentPartSchema.optional(),
    leftArm: segmentPartSchema.optional(),
    trunk: segmentPartSchema.optional(),
    rightLeg: segmentPartSchema.optional(),
    leftLeg: segmentPartSchema.optional(),
  })
  .optional()
  .nullable()
  .transform((v) => {
    if (!v) return null;
    const empty = { kg: null, percent: null, status: null };
    return {
      rightArm: v.rightArm ?? empty,
      leftArm: v.leftArm ?? empty,
      trunk: v.trunk ?? empty,
      rightLeg: v.rightLeg ?? empty,
      leftLeg: v.leftLeg ?? empty,
    };
  });

const impedanceBandSchema = z
  .object({
    rightArm: nullableNumber,
    leftArm: nullableNumber,
    trunk: nullableNumber,
    rightLeg: nullableNumber,
    leftLeg: nullableNumber,
  })
  .partial()
  .optional()
  .nullable();

const historySchema = z
  .object({
    previousTestDate: nullableString,
    previousWeightKg: nullableNumber,
    previousSkeletalMuscleMassKg: nullableNumber,
    previousBodyFatPercent: nullableNumber,
  })
  .optional()
  .nullable();

const extractedInbodySchema = z.object({
  // Header
  patientId: nullableString,
  patientName: nullableString,
  heightCm: nullableNumber,
  ageYears: nullableNumber,
  gender: nullableString,
  testDate: z.union([z.string(), z.null()]).transform(parseTestDate),
  testTime: nullableString,
  location: nullableString,
  deviceModel: nullableString,
  // Body composition
  weightKg: nullableNumber,
  totalBodyWaterL: nullableNumber,
  proteinKg: nullableNumber,
  mineralsKg: nullableNumber,
  bodyFatMassKg: nullableNumber,
  // Muscle / fat / obesity
  skeletalMuscleMassKg: nullableNumber,
  bodyFatPercent: nullableNumber,
  bmi: nullableNumber,
  // Score & control
  inbodyScore: nullableNumber,
  targetWeightKg: nullableNumber,
  weightControlKg: nullableNumber,
  fatControlKg: nullableNumber,
  muscleControlKg: nullableNumber,
  // Research parameters
  basalMetabolicRate: nullableNumber,
  waistHipRatio: nullableNumber,
  visceralFatLevel: nullableNumber,
  obesityDegreePercent: nullableNumber,
  // Segmental & advanced
  segmentalLean: segmentalSchema,
  segmentalFat: segmentalSchema,
  impedance: z
    .object({
      at20kHz: impedanceBandSchema,
      at100kHz: impedanceBandSchema,
    })
    .optional()
    .nullable(),
  history: historySchema,
});

const saveInbodySchema = z.object({
  body: extractedInbodySchema.extend({
    reportUrl: z
      .union([z.string().url(), z.string().startsWith('/uploads/')])
      .optional()
      .nullable(),
    source: z.enum(['manual', 'inbody_upload', 'ai_extracted']).default('manual'),
    measuredAt: z.string().datetime().optional().nullable(),
  }),
});

const CORE_FLAT_KEYS = [
  'weightKg',
  'bodyFatPercent',
  'bodyFatMassKg',
  'skeletalMuscleMassKg',
  'bmi',
  'basalMetabolicRate',
  'visceralFatLevel',
  'waistHipRatio',
  'inbodyScore',
  'targetWeightKg',
  'fatControlKg',
  'muscleControlKg',
  'testDate',
];

/** Profile fields collected elsewhere in onboarding — do not persist in measurements JSON. */
const ONBOARDING_DUPLICATE_KEYS = new Set([
  'patientId',
  'patientName',
  'heightCm',
  'ageYears',
  'gender',
]);

const EXTENDED_FLAT_KEYS = [
  'testTime',
  'location',
  'deviceModel',
  'totalBodyWaterL',
  'proteinKg',
  'mineralsKg',
  'weightControlKg',
  'obesityDegreePercent',
];

const NESTED_KEYS = ['segmentalLean', 'segmentalFat', 'impedance', 'history'];

function emptySegmentPart() {
  return { kg: null, percent: null, status: null };
}

function emptySegmental() {
  return {
    rightArm: emptySegmentPart(),
    leftArm: emptySegmentPart(),
    trunk: emptySegmentPart(),
    rightLeg: emptySegmentPart(),
    leftLeg: emptySegmentPart(),
  };
}

function emptyExtractedPayload() {
  return {
    patientId: null,
    patientName: null,
    heightCm: null,
    ageYears: null,
    gender: null,
    testDate: null,
    testTime: null,
    location: null,
    deviceModel: null,
    weightKg: null,
    totalBodyWaterL: null,
    proteinKg: null,
    mineralsKg: null,
    bodyFatMassKg: null,
    skeletalMuscleMassKg: null,
    bodyFatPercent: null,
    bmi: null,
    inbodyScore: null,
    targetWeightKg: null,
    weightControlKg: null,
    fatControlKg: null,
    muscleControlKg: null,
    basalMetabolicRate: null,
    waistHipRatio: null,
    visceralFatLevel: null,
    obesityDegreePercent: null,
    segmentalLean: null,
    segmentalFat: null,
    impedance: null,
    history: null,
  };
}

function pickExtendedMeasurements(data) {
  const measurements = {};
  for (const key of EXTENDED_FLAT_KEYS) {
    if (ONBOARDING_DUPLICATE_KEYS.has(key)) continue;
    if (data[key] != null && data[key] !== '') measurements[key] = data[key];
  }
  for (const key of NESTED_KEYS) {
    if (data[key] != null) measurements[key] = data[key];
  }
  return Object.keys(measurements).length ? measurements : null;
}

function mapExtractedToDb(data) {
  const measuredAt = data.testDate ? new Date(`${data.testDate}T12:00:00Z`) : null;
  return {
    weightKg: data.weightKg,
    bodyFatPct: data.bodyFatPercent,
    bodyFatMassKg: data.bodyFatMassKg,
    skeletalMuscleMassKg: data.skeletalMuscleMassKg,
    bmi: data.bmi,
    basalMetabolicRate: data.basalMetabolicRate,
    visceralFatLevel: data.visceralFatLevel,
    waistHipRatio: data.waistHipRatio,
    inbodyScore: data.inbodyScore,
    targetWeightKg: data.targetWeightKg,
    fatControlKg: data.fatControlKg,
    muscleControlKg: data.muscleControlKg,
    measuredAt,
    measurements: pickExtendedMeasurements(data),
  };
}

function mapDbToApi(row) {
  if (!row) return null;
  const measurements =
    row.measurements && typeof row.measurements === 'object' && !Array.isArray(row.measurements)
      ? row.measurements
      : {};

  return {
    id: row.id,
    weightKg: row.weightKg,
    bodyFatPercent: row.bodyFatPct,
    bodyFatMassKg: row.bodyFatMassKg,
    skeletalMuscleMassKg: row.skeletalMuscleMassKg,
    bmi: row.bmi,
    basalMetabolicRate: row.basalMetabolicRate,
    visceralFatLevel: row.visceralFatLevel,
    waistHipRatio: row.waistHipRatio,
    inbodyScore: row.inbodyScore,
    targetWeightKg: row.targetWeightKg,
    fatControlKg: row.fatControlKg,
    muscleControlKg: row.muscleControlKg,
    testDate: row.measuredAt ? row.measuredAt.toISOString().slice(0, 10) : null,
    reportUrl: row.reportUrl,
    source: row.source,
    measuredAt: row.measuredAt,
    recordedAt: row.recordedAt,
    ...measurements,
  };
}

module.exports = {
  extractedInbodySchema,
  saveInbodySchema,
  CORE_FLAT_KEYS,
  EXTENDED_FLAT_KEYS,
  NESTED_KEYS,
  emptyExtractedPayload,
  emptySegmental,
  mapExtractedToDb,
  mapDbToApi,
};
