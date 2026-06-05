/**
 * Wait for official Postgres plan after onboarding (Block C4).
 */
import aiService from './aiService';
import type { PlanGenerationKickoff } from './profileService';

const DEFAULT_MAX_MS = 6 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 5000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function shouldWaitForOfficialPlan(kickoff?: PlanGenerationKickoff | null): boolean {
  return Boolean(kickoff?.triggered && (kickoff.mode === 'queued' || kickoff.mode === 'background'));
}

/**
 * Poll GET /api/ai/plan/me until an active plan exists or timeout.
 */
export async function waitForOfficialPlan(opts?: {
  maxMs?: number;
  intervalMs?: number;
  onTick?: (attempt: number) => void;
}): Promise<{ ok: boolean; timedOut?: boolean }> {
  const maxMs = opts?.maxMs ?? DEFAULT_MAX_MS;
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const started = Date.now();
  let attempt = 0;

  while (Date.now() - started < maxMs) {
    attempt += 1;
    opts?.onTick?.(attempt);
    const res = await aiService.getActivePlan();
    if (res.data?.plan?.dietDays?.length && res.data.plan.workoutWeeks?.length) {
      return { ok: true };
    }
    const err = res.error || '';
    if (err && !/no active plan|not found|404/i.test(err)) {
      return { ok: false, timedOut: false };
    }
    await sleep(intervalMs);
  }
  return { ok: false, timedOut: true };
}
