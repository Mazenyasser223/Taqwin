import { getApiBaseUrl } from '../lib/apiBaseUrl';
import { getAuthToken } from '../lib/authStorage';
import { emptySegmental, hasAnyInbodyData } from '../lib/inbody/fields';
import apiClient, { ApiResponse } from './api';

export type InbodySource = 'manual' | 'inbody_upload' | 'ai_extracted';

export interface InbodySegmentPart {
  kg: number | null;
  percent: number | null;
  status: string | null;
}

export interface InbodySegmental {
  rightArm: InbodySegmentPart;
  leftArm: InbodySegmentPart;
  trunk: InbodySegmentPart;
  rightLeg: InbodySegmentPart;
  leftLeg: InbodySegmentPart;
}

export interface InbodyImpedanceBand {
  rightArm: number | null;
  leftArm: number | null;
  trunk: number | null;
  rightLeg: number | null;
  leftLeg: number | null;
}

export interface InbodyImpedance {
  at20kHz: InbodyImpedanceBand | null;
  at100kHz: InbodyImpedanceBand | null;
}

export interface InbodyHistory {
  previousTestDate: string | null;
  previousWeightKg: number | null;
  previousSkeletalMuscleMassKg: number | null;
  previousBodyFatPercent: number | null;
}

export interface InbodyExtractedData {
  patientId: string | null;
  patientName: string | null;
  heightCm: number | null;
  ageYears: number | null;
  gender: string | null;
  testDate: string | null;
  testTime: string | null;
  location: string | null;
  deviceModel: string | null;
  weightKg: number | null;
  totalBodyWaterL: number | null;
  proteinKg: number | null;
  mineralsKg: number | null;
  bodyFatMassKg: number | null;
  skeletalMuscleMassKg: number | null;
  bodyFatPercent: number | null;
  bmi: number | null;
  inbodyScore: number | null;
  targetWeightKg: number | null;
  weightControlKg: number | null;
  fatControlKg: number | null;
  muscleControlKg: number | null;
  basalMetabolicRate: number | null;
  waistHipRatio: number | null;
  visceralFatLevel: number | null;
  obesityDegreePercent: number | null;
  segmentalLean: InbodySegmental | null;
  segmentalFat: InbodySegmental | null;
  impedance: InbodyImpedance | null;
  history: InbodyHistory | null;
}

export interface InbodySavePayload extends InbodyExtractedData {
  reportUrl?: string | null;
  source?: InbodySource;
  measuredAt?: string | null;
}

export interface InbodyBodyMetric extends InbodySavePayload {
  id: string;
  recordedAt: string;
}

const FLAT_PARSE_KEYS: (keyof InbodyExtractedData)[] = [
  'patientId',
  'patientName',
  'heightCm',
  'ageYears',
  'gender',
  'testDate',
  'testTime',
  'location',
  'deviceModel',
  'weightKg',
  'totalBodyWaterL',
  'proteinKg',
  'mineralsKg',
  'bodyFatMassKg',
  'skeletalMuscleMassKg',
  'bodyFatPercent',
  'bmi',
  'inbodyScore',
  'targetWeightKg',
  'weightControlKg',
  'fatControlKg',
  'muscleControlKg',
  'basalMetabolicRate',
  'waistHipRatio',
  'visceralFatLevel',
  'obesityDegreePercent',
];

const STRING_KEYS = new Set<keyof InbodyExtractedData>([
  'patientId',
  'patientName',
  'gender',
  'testDate',
  'testTime',
  'location',
  'deviceModel',
]);

export function emptyInbodyData(): InbodyExtractedData {
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

export function hasAnyInbodyValue(data: InbodyExtractedData): boolean {
  return hasAnyInbodyData(data);
}

function parseSegmentPart(raw: unknown): InbodySegmentPart {
  if (!raw || typeof raw !== 'object') {
    return { kg: null, percent: null, status: null };
  }
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    kg: num(o.kg),
    percent: num(o.percent),
    status: o.status != null && o.status !== '' ? String(o.status) : null,
  };
}

function parseSegmental(raw: unknown): InbodySegmental | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out = emptySegmental();
  for (const part of ['rightArm', 'leftArm', 'trunk', 'rightLeg', 'leftLeg'] as const) {
    out[part] = parseSegmentPart(o[part]);
  }
  return out;
}

function parseImpedanceBand(raw: unknown): InbodyImpedanceBand | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const num = (v: unknown) => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    rightArm: num(o.rightArm),
    leftArm: num(o.leftArm),
    trunk: num(o.trunk),
    rightLeg: num(o.rightLeg),
    leftLeg: num(o.leftLeg),
  };
}

function parseStoredInbody(raw: unknown): InbodyExtractedData | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out = emptyInbodyData();

  for (const key of FLAT_PARSE_KEYS) {
    const v = o[key];
    if (v === null || v === undefined || v === '') continue;
    if (STRING_KEYS.has(key)) {
      (out as unknown as Record<string, unknown>)[key] = String(v);
    } else {
      const n = typeof v === 'number' ? v : Number(v);
      if (Number.isFinite(n)) (out as unknown as Record<string, unknown>)[key] = n;
    }
  }

  out.segmentalLean = parseSegmental(o.segmentalLean);
  out.segmentalFat = parseSegmental(o.segmentalFat);

  if (o.impedance && typeof o.impedance === 'object') {
    const imp = o.impedance as Record<string, unknown>;
    out.impedance = {
      at20kHz: parseImpedanceBand(imp.at20kHz),
      at100kHz: parseImpedanceBand(imp.at100kHz),
    };
  }

  if (o.history && typeof o.history === 'object') {
    const h = o.history as Record<string, unknown>;
    out.history = {
      previousTestDate: h.previousTestDate != null ? String(h.previousTestDate) : null,
      previousWeightKg: h.previousWeightKg != null ? Number(h.previousWeightKg) : null,
      previousSkeletalMuscleMassKg:
        h.previousSkeletalMuscleMassKg != null ? Number(h.previousSkeletalMuscleMassKg) : null,
      previousBodyFatPercent: h.previousBodyFatPercent != null ? Number(h.previousBodyFatPercent) : null,
    };
  }

  return out;
}

export function inbodyFromAnswers(answers: Record<string, unknown>): {
  data: InbodyExtractedData;
  reportUrl: string | null;
  source: InbodySource | null;
  bodyMetricId: string | null;
} {
  const stored = answers.inbodyData;
  const parsed = parseStoredInbody(stored);
  if (parsed) {
    return {
      data: parsed,
      reportUrl: typeof answers.inbodyReportUrl === 'string' ? answers.inbodyReportUrl : null,
      source:
        answers.inbodySource === 'manual' ||
        answers.inbodySource === 'inbody_upload' ||
        answers.inbodySource === 'ai_extracted'
          ? answers.inbodySource
          : null,
      bodyMetricId: typeof answers.inbodyBodyMetricId === 'string' ? answers.inbodyBodyMetricId : null,
    };
  }

  const legacy = emptyInbodyData();
  const bf = answers.inbodyBodyFat;
  const muscle = answers.inbodyMuscle;
  const bmr = answers.inbodyBmr;
  if (bf != null && bf !== '') legacy.bodyFatPercent = Number(bf) || null;
  if (muscle != null && muscle !== '') legacy.skeletalMuscleMassKg = Number(muscle) || null;
  if (bmr != null && bmr !== '') legacy.basalMetabolicRate = Number(bmr) || null;
  return { data: legacy, reportUrl: null, source: null, bodyMetricId: null };
}

class InbodyService {
  async extractReport(file: File): Promise<
    ApiResponse<{ reportUrl: string; extracted: InbodyExtractedData }>
  > {
    const token = getAuthToken();
    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/inbody/extract`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: form,
      });

      let payload: unknown = null;
      try {
        payload = await res.json();
      } catch {
        /* non-JSON */
      }

      const data =
        payload !== null && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : {};

      if (!res.ok) {
        return {
          error:
            (typeof data.error === 'string' && data.error) ||
            `InBody extraction failed (${res.status})`,
          data: data.reportUrl
            ? {
                reportUrl: String(data.reportUrl),
                extracted: parseStoredInbody(data.extracted) || emptyInbodyData(),
              }
            : undefined,
        };
      }

      return {
        data: {
          reportUrl: String(data.reportUrl || ''),
          extracted: parseStoredInbody(data.extracted) || emptyInbodyData(),
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return { error: msg };
    }
  }

  async saveMetrics(payload: InbodySavePayload): Promise<ApiResponse<{ bodyMetric: InbodyBodyMetric }>> {
    return apiClient.post('/api/inbody/save', payload);
  }
}

const inbodyService = new InbodyService();
export default inbodyService;
