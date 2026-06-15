import inbodyService, {
  hasAnyInbodyValue,
  inbodyFromAnswers,
} from '../../services/inbodyService';
import { inbodyDataForOnboarding } from './fields';
import type { OnboardingAnswers } from '../../features/onboarding/types';

/** Save InBody metrics to API when dossier / onboarding answers include scan data. */
export async function persistInbodyFromAnswers(
  answers: OnboardingAnswers,
): Promise<{ ok: boolean; bodyMetricId?: string; error?: string }> {
  const { data, reportUrl, source } = inbodyFromAnswers(answers);
  const formData = data;

  if (!hasAnyInbodyValue(formData) && !reportUrl) {
    return { ok: true };
  }

  const measuredAt = formData.testDate
    ? new Date(`${formData.testDate}T12:00:00Z`).toISOString()
    : undefined;

  const res = await inbodyService.saveMetrics({
    ...formData,
    reportUrl,
    source: reportUrl && source === 'manual' ? 'inbody_upload' : source ?? 'manual',
    measuredAt,
  });

  if (res.error) {
    return { ok: false, error: res.error };
  }

  const id = res.data?.bodyMetric?.id;
  return { ok: true, bodyMetricId: id };
}

/** Merge InBody API result into onboarding answers before profile save. */
export function mergeInbodySaveIntoAnswers(
  answers: OnboardingAnswers,
  bodyMetricId?: string,
): OnboardingAnswers {
  const { data, reportUrl, source } = inbodyFromAnswers(answers);
  const next: OnboardingAnswers = {
    ...answers,
    inbodyData: inbodyDataForOnboarding(data),
    inbodyReportUrl: reportUrl ?? undefined,
    inbodySource: source ?? undefined,
  };
  if (bodyMetricId) next.inbodyBodyMetricId = bodyMetricId;
  if (data.bodyFatPercent != null) next.inbodyBodyFat = String(data.bodyFatPercent);
  if (data.skeletalMuscleMassKg != null) next.inbodyMuscle = String(data.skeletalMuscleMassKg);
  if (data.basalMetabolicRate != null) next.inbodyBmr = String(data.basalMetabolicRate);
  if (hasAnyInbodyValue(data) || reportUrl) next.inbodyAcknowledged = true;
  return next;
}
