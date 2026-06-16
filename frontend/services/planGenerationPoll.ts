/**
 * Wait for official Postgres plan after onboarding (Block C4).
 */
import aiService, { type AiPlan, type PlanGenerateResponse } from './aiService';
import profileService, { type PlanGenerationKickoff } from './profileService';

const DEFAULT_MAX_MS = 6 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 2000;
const PLAN_GENERATE_TIMEOUT_MS = 5 * 60 * 1000;
const STUCK_QUEUE_JOB_MS = 20_000;

/** Profile flag `planGenerationRequestedAt` — only treat as in-flight within this window. */
export const PLAN_GENERATION_FLAG_MAX_AGE_MS = DEFAULT_MAX_MS;

export function parsePlanGenerationRequestedAt(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

/** True only after the athlete tapped Generate and the request is still within the poll window. */
export function isActivePlanGenerationRequest(requestedAt?: unknown, now = Date.now()): boolean {
  const ts = parsePlanGenerationRequestedAt(requestedAt);
  if (ts === null) return false;
  return now - ts < PLAN_GENERATION_FLAG_MAX_AGE_MS;
}

export type PlanGenTraceStage =
  | 'check_existing'
  | 'sync_generate'
  | 'queue_generate'
  | 'poll_plan'
  | 'poll_job'
  | 'sync_fallback'
  | 'plan_ready'
  | 'failed';

export interface PlanGenTraceEvent {
  stage: PlanGenTraceStage;
  /** i18n key under dashboard.planGenTrace.* */
  messageKey: string;
  vars?: Record<string, string | number>;
  detail?: string;
  at: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPlanRateLimitError(error?: string | null): boolean {
  return Boolean(error && /rate limit exceeded/i.test(error));
}

function isPlanAiPendingCode(code?: string | null): boolean {
  return code === 'plan_ai_pending';
}

function isPlanAiPendingMessage(error?: string | null): boolean {
  return Boolean(error && /contact you shortly|سنتواصل معك/i.test(error));
}

function isQueuedResponse(data?: PlanGenerateResponse | null): data is {
  status: 'queued' | 'already_queued';
  jobId: string;
} {
  return Boolean(data && 'jobId' in data && typeof data.jobId === 'string');
}

function emitTrace(
  onTrace: ((event: PlanGenTraceEvent) => void) | undefined,
  event: Omit<PlanGenTraceEvent, 'at'>,
) {
  onTrace?.({ ...event, at: Date.now() });
}

export function shouldWaitForOfficialPlan(kickoff?: PlanGenerationKickoff | null): boolean {
  return Boolean(kickoff?.triggered && (kickoff.mode === 'queued' || kickoff.mode === 'background'));
}

export function isOfficialPlanReady(plan?: AiPlan | null): boolean {
  if (!plan) return false;
  const hasDiet = (plan.dietDays?.length ?? 0) > 0;
  const hasWorkout =
    plan.workoutWeeks?.some((week) => (week.days?.length ?? 0) > 0) ?? false;
  return hasDiet && hasWorkout;
}

export async function clearPlanGenerationRequested(
  onboardingData?: Record<string, unknown> | null,
): Promise<void> {
  if (!onboardingData?.planGenerationRequestedAt) return;
  const next = { ...onboardingData };
  delete next.planGenerationRequestedAt;
  await profileService.updateProfile({ onboardingData: next });
}

export interface KickOffPlanGenerationResult {
  planReady: boolean;
  started: boolean;
  jobId?: string;
  error?: string;
  pending?: boolean;
}

export async function kickOffOfficialPlanGeneration(
  opts: {
    locale: 'en' | 'ar';
    reason?: string;
    sync?: boolean;
    onTrace?: (event: PlanGenTraceEvent) => void;
  },
): Promise<KickOffPlanGenerationResult> {
  const existing = await aiService.getActivePlan();
  if (isOfficialPlanReady(existing.data?.plan)) {
    return { planReady: true, started: false };
  }

  if (opts.sync) {
    emitTrace(opts.onTrace, {
      stage: 'sync_generate',
      messageKey: 'syncStart',
      detail: opts.reason,
    });
  } else {
    emitTrace(opts.onTrace, { stage: 'queue_generate', messageKey: 'queueStart' });
  }

  const res = await aiService.regeneratePlan(
    {
      locale: opts.locale,
      reason: opts.reason ?? 'dashboard_live',
      sync: opts.sync,
    },
    { timeoutMs: opts.sync ? PLAN_GENERATE_TIMEOUT_MS : 30_000 },
  );

  if (res.error) {
    emitTrace(opts.onTrace, {
      stage: 'failed',
      messageKey: isPlanAiPendingCode(res.code) ? 'pendingContact' : 'apiError',
      detail: isPlanAiPendingCode(res.code) ? undefined : res.error,
    });
    return {
      planReady: false,
      started: false,
      error: res.error,
      pending: isPlanAiPendingCode(res.code),
    };
  }

  const data = res.data;
  if (!isQueuedResponse(data) && data?.plan && isOfficialPlanReady(data.plan)) {
    emitTrace(opts.onTrace, { stage: 'plan_ready', messageKey: 'syncReturnedPlan' });
    return { planReady: true, started: true };
  }

  if (isQueuedResponse(data)) {
    emitTrace(opts.onTrace, {
      stage: 'queue_generate',
      messageKey: 'queued',
      vars: { jobId: data.jobId },
    });
    return { planReady: false, started: true, jobId: data.jobId };
  }

  if (opts.sync) {
    emitTrace(opts.onTrace, { stage: 'sync_generate', messageKey: 'syncRunning' });
  }

  return { planReady: false, started: true };
}

async function pollPlanJobState(
  jobId: string,
  onTrace?: (event: PlanGenTraceEvent) => void,
): Promise<{ failed: boolean; error?: string; stuck?: boolean; state?: string }> {
  const res = await aiService.getPlanJobStatus(jobId);
  const job = res.data?.job;
  if (!job) return { failed: false };
  if (job.state === 'active') {
    emitTrace(onTrace, { stage: 'poll_job', messageKey: 'jobActive' });
  } else if (job.state === 'waiting' || job.state === 'delayed') {
    emitTrace(onTrace, { stage: 'poll_job', messageKey: 'jobWaiting' });
  }
  if (job.state === 'failed') {
    return { failed: true, error: job.failedReason || 'Plan generation job failed', state: job.state };
  }
  if (job.state === 'waiting' || job.state === 'delayed') {
    const enqueuedAt = job.enqueuedAt ? Date.parse(job.enqueuedAt) : NaN;
    if (Number.isFinite(enqueuedAt) && Date.now() - enqueuedAt > STUCK_QUEUE_JOB_MS) {
      return { failed: false, stuck: true, state: job.state };
    }
  }
  return { failed: false, state: job.state };
}

export async function waitForOfficialPlan(opts?: {
  maxMs?: number;
  intervalMs?: number;
  onTick?: (attempt: number) => void;
  onTrace?: (event: PlanGenTraceEvent) => void;
  jobId?: string;
  waitStartedAt?: number;
}): Promise<{ ok: boolean; timedOut?: boolean; jobFailed?: boolean; jobStuck?: boolean; error?: string; pending?: boolean }> {
  const maxMs = opts?.maxMs ?? DEFAULT_MAX_MS;
  const intervalMs = opts?.intervalMs ?? DEFAULT_INTERVAL_MS;
  const started = opts?.waitStartedAt ?? Date.now();
  let attempt = 0;

  while (Date.now() - started < maxMs) {
    attempt += 1;
    opts?.onTick?.(attempt);
    emitTrace(opts?.onTrace, {
      stage: 'poll_plan',
      messageKey: 'pollPlan',
      vars: { attempt },
    });

    if (opts?.jobId) {
      const jobState = await pollPlanJobState(opts.jobId, opts.onTrace);
      if (jobState.failed) {
        return {
          ok: false,
          timedOut: false,
          jobFailed: true,
          error: jobState.error,
          pending: isPlanAiPendingMessage(jobState.error),
        };
      }
      if (jobState.stuck) {
        emitTrace(opts?.onTrace, { stage: 'sync_fallback', messageKey: 'jobStuck' });
        return { ok: false, timedOut: false, jobStuck: true };
      }
    }

    const res = await aiService.getActivePlan();
    if (isOfficialPlanReady(res.data?.plan)) {
      emitTrace(opts?.onTrace, { stage: 'plan_ready', messageKey: 'planDetected' });
      return { ok: true };
    }
    const err = res.error || '';
    if (err && !/no active plan|not found|404/i.test(err)) {
      return { ok: false, timedOut: false, error: err };
    }
    await sleep(intervalMs);
  }
  return { ok: false, timedOut: true };
}

async function runSyncGeneration(opts: {
  locale: 'en' | 'ar';
  reason?: string;
  onTrace?: (event: PlanGenTraceEvent) => void;
}): Promise<{ ok: boolean; error?: string; pending?: boolean }> {
  const kick = await kickOffOfficialPlanGeneration({
    locale: opts.locale,
    reason: opts.reason ?? 'dashboard_live_sync',
    sync: true,
    onTrace: opts.onTrace,
  });
  if (kick.planReady) return { ok: true };
  if (kick.error) return { ok: false, error: kick.error, pending: kick.pending };
  return { ok: false };
}

type PlanGenerationRunResult = { ok: boolean; timedOut?: boolean; error?: string; pending?: boolean };

let inflightGeneration: {
  promise: Promise<PlanGenerationRunResult>;
  listeners: Set<(event: PlanGenTraceEvent) => void>;
} | null = null;

function broadcastTrace(event: PlanGenTraceEvent) {
  inflightGeneration?.listeners.forEach((listener) => listener(event));
}

async function executeOfficialPlanGeneration(opts: {
  locale: 'en' | 'ar';
  reason?: string;
  maxMs?: number;
  intervalMs?: number;
  onTick?: (attempt: number) => void;
  onTrace?: (event: PlanGenTraceEvent) => void;
  preferSync?: boolean;
  kickOff?: boolean;
  /** Anchor for poll timeout (e.g. profile kickoff time). */
  waitStartedAt?: number;
}): Promise<PlanGenerationRunResult> {
  const onTrace = (event: PlanGenTraceEvent) => {
    broadcastTrace(event);
    opts.onTrace?.(event);
  };

  emitTrace(onTrace, { stage: 'check_existing', messageKey: 'checking' });

  const existing = await aiService.getActivePlan();
  if (isOfficialPlanReady(existing.data?.plan)) {
    emitTrace(onTrace, { stage: 'plan_ready', messageKey: 'alreadyReady' });
    return { ok: true };
  }

  if (opts.kickOff === false) {
    emitTrace(onTrace, { stage: 'poll_plan', messageKey: 'watching' });
    const wait = await waitForOfficialPlan({
      maxMs: opts.maxMs,
      intervalMs: opts.intervalMs ?? DEFAULT_INTERVAL_MS,
      onTick: opts.onTick,
      onTrace,
      waitStartedAt: opts.waitStartedAt ?? Date.now(),
    });
    if (wait.ok) return { ok: true };
    if (wait.pending) {
      return { ok: false, error: wait.error, pending: true };
    }
    return {
      ok: false,
      timedOut: wait.timedOut,
      error: wait.error,
    };
  }

  if (opts.preferSync) {
    const sync = await runSyncGeneration({
      locale: opts.locale,
      reason: opts.reason,
      onTrace,
    });
    if (sync.ok) return { ok: true };
    if (sync.error && (isPlanRateLimitError(sync.error) || sync.pending)) {
      return { ok: false, error: sync.error, pending: sync.pending };
    }
    const wait = await waitForOfficialPlan({
      maxMs: opts.maxMs,
      intervalMs: opts.intervalMs ?? DEFAULT_INTERVAL_MS,
      onTick: opts.onTick,
      onTrace,
      waitStartedAt: opts.waitStartedAt ?? Date.now(),
    });
    if (wait.ok) return { ok: true };
    if (!wait.timedOut && !wait.jobStuck && !wait.jobFailed) {
      return { ok: false, error: wait.error };
    }
    emitTrace(onTrace, { stage: 'sync_fallback', messageKey: 'retrySync' });
    const retry = await runSyncGeneration({
      locale: opts.locale,
      reason: opts.reason ?? 'dashboard_live_sync_fallback',
      onTrace,
    });
    if (retry.ok) return { ok: true };
    return {
      ok: false,
      timedOut: wait.timedOut,
      error: retry.error ?? wait.error,
    };
  }

  let kick = await kickOffOfficialPlanGeneration({
    locale: opts.locale,
    reason: opts.reason,
    onTrace,
  });

  if (kick.planReady) return { ok: true };

  if (kick.error) {
    if (isPlanRateLimitError(kick.error)) {
      return { ok: false, error: kick.error };
    }
    if (kick.pending || isPlanAiPendingMessage(kick.error)) {
      return { ok: false, error: kick.error, pending: true };
    }
    const sync = await runSyncGeneration({
      locale: opts.locale,
      reason: opts.reason ?? 'dashboard_live_retry',
      onTrace,
    });
    if (sync.ok) return { ok: true };
    return { ok: false, error: sync.error ?? kick.error };
  }

  const wait = await waitForOfficialPlan({
    maxMs: opts.maxMs,
    intervalMs: opts.intervalMs,
    onTick: opts.onTick,
    onTrace,
    jobId: kick.jobId,
    waitStartedAt: Date.now(),
  });

  if (wait.ok) return { ok: true };

  if (wait.jobFailed || wait.jobStuck || wait.timedOut) {
    const sync = await runSyncGeneration({
      locale: opts.locale,
      reason: opts.reason ?? 'dashboard_live_sync_fallback',
      onTrace,
    });
    if (sync.ok) return { ok: true };
    if (isPlanRateLimitError(sync.error)) {
      return { ok: false, timedOut: wait.timedOut, error: sync.error };
    }

    const retryWait = await waitForOfficialPlan({
      maxMs: Math.min(opts.maxMs ?? DEFAULT_MAX_MS, 2 * 60 * 1000),
      intervalMs: opts.intervalMs ?? DEFAULT_INTERVAL_MS,
      onTick: opts.onTick,
      onTrace,
      waitStartedAt: Date.now(),
    });
    if (retryWait.ok) return { ok: true };
    return {
      ok: false,
      timedOut: retryWait.timedOut ?? wait.timedOut,
      error: retryWait.error ?? wait.error ?? sync.error,
    };
  }

  return { ok: false, timedOut: wait.timedOut, error: wait.error };
}

/** Kick off generation (if needed) then poll until the official plan is ready. */
export async function runOfficialPlanGeneration(opts: {
  locale: 'en' | 'ar';
  reason?: string;
  maxMs?: number;
  intervalMs?: number;
  onTick?: (attempt: number) => void;
  onTrace?: (event: PlanGenTraceEvent) => void;
  preferSync?: boolean;
  /** When false, only poll for an in-flight generation (My Plans revisits). */
  kickOff?: boolean;
  /** Force a new run even if one is already in flight (Retry). */
  forceRestart?: boolean;
  /** Anchor for poll timeout (e.g. profile kickoff time). */
  waitStartedAt?: number;
}): Promise<PlanGenerationRunResult> {
  if (opts.forceRestart) {
    inflightGeneration = null;
  }

  if (inflightGeneration && !opts.forceRestart) {
    if (opts.onTrace) {
      inflightGeneration.listeners.add(opts.onTrace);
    }
    return inflightGeneration.promise.finally(() => {
      if (opts.onTrace) {
        inflightGeneration?.listeners.delete(opts.onTrace);
      }
    });
  }

  const listeners = new Set<(event: PlanGenTraceEvent) => void>();
  if (opts.onTrace) listeners.add(opts.onTrace);

  const promise = executeOfficialPlanGeneration({
    ...opts,
    onTrace: (event) => {
      listeners.forEach((listener) => listener(event));
    },
  });

  inflightGeneration = { promise, listeners };
  void promise.finally(() => {
    if (inflightGeneration?.promise === promise) {
      inflightGeneration = null;
    }
  });

  return promise;
}
