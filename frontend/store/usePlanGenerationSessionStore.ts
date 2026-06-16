import { create } from 'zustand';

export type PlanGenTraceTone = 'info' | 'ok' | 'warn';

export type PlanGenTraceLine = {
  text: string;
  tone: PlanGenTraceTone;
};

const PHASE_COUNT = 5;

function phaseFills(overall: number, done: boolean): number[] {
  if (done) return Array.from({ length: PHASE_COUNT }, () => 100);
  const slice = 100 / PHASE_COUNT;
  return Array.from({ length: PHASE_COUNT }, (_, i) => {
    const start = i * slice;
    const end = (i + 1) * slice;
    if (overall >= end) return 100;
    if (overall <= start) return Math.max(4, ((overall - start) / slice) * 100);
    return Math.max(4, ((overall - start) / slice) * 100);
  });
}

function progressFromElapsed(startedAt: number): number {
  const elapsed = Date.now() - startedAt;
  return Math.min(98, 20 + Math.floor(elapsed / 4000));
}

interface PlanGenerationSessionState {
  startedAt: number | null;
  overallProgress: number;
  phaseDisplay: number[];
  traceLines: PlanGenTraceLine[];
  activeTrace: string | null;
  done: boolean;
  failed: 'timeout' | 'error' | 'pending' | null;
  failureDetail: string | null;
  lastTraceKey: string;
  ensureStartedAt: (requestedAtIso?: string | null) => void;
  bumpProgress: (next: number) => void;
  tickElapsed: () => void;
  setActiveTrace: (text: string | null) => void;
  appendTraceLine: (line: PlanGenTraceLine) => void;
  setLastTraceKey: (key: string) => void;
  markDone: () => void;
  markFailed: (kind: 'timeout' | 'error' | 'pending', detail?: string | null) => void;
  reset: () => void;
}

const initialPhase = Array.from({ length: PHASE_COUNT }, () => 0);

export const usePlanGenerationSessionStore = create<PlanGenerationSessionState>((set, get) => ({
  startedAt: null,
  overallProgress: 0,
  phaseDisplay: initialPhase,
  traceLines: [],
  activeTrace: null,
  done: false,
  failed: null,
  failureDetail: null,
  lastTraceKey: '',
  ensureStartedAt: (requestedAtIso) => {
    const parsed = requestedAtIso ? Date.parse(requestedAtIso) : NaN;
    const fromProfile = Number.isFinite(parsed) ? parsed : null;
    const state = get();
    if (fromProfile && state.startedAt && fromProfile > state.startedAt + 500) {
      get().reset();
    }
    const { startedAt, done, failed } = get();
    if (done || failed) return;
    const nextStartedAt = startedAt ?? fromProfile ?? Date.now();
    const overall = Math.max(get().overallProgress, progressFromElapsed(nextStartedAt));
    const phaseDisplay = phaseFills(overall, false).map((pct, i) =>
      Math.max(get().phaseDisplay[i] ?? 0, pct),
    );
    set({ startedAt: nextStartedAt, overallProgress: overall, phaseDisplay });
  },
  bumpProgress: (next) => {
    const { done, overallProgress, phaseDisplay } = get();
    if (done) return;
    const merged = Math.max(overallProgress, next);
    const phases = phaseFills(merged, false).map((pct, i) => Math.max(phaseDisplay[i] ?? 0, pct));
    set({ overallProgress: merged, phaseDisplay: phases });
  },
  tickElapsed: () => {
    const { startedAt, done, failed } = get();
    if (!startedAt || done || failed) return;
    get().bumpProgress(progressFromElapsed(startedAt));
  },
  setActiveTrace: (text) => set({ activeTrace: text }),
  appendTraceLine: (line) =>
    set((state) => {
      if (state.traceLines.length > 0 && state.traceLines[state.traceLines.length - 1]?.text === line.text) {
        return state;
      }
      return { traceLines: [...state.traceLines, line] };
    }),
  setLastTraceKey: (key) => set({ lastTraceKey: key }),
  markDone: () => {
    const phases = Array.from({ length: PHASE_COUNT }, () => 100);
    set({
      done: true,
      failed: null,
      failureDetail: null,
      activeTrace: null,
      overallProgress: 100,
      phaseDisplay: phases,
    });
  },
  markFailed: (kind, detail) =>
    set({
      failed: kind,
      failureDetail: detail ?? null,
      activeTrace: null,
    }),
  reset: () =>
    set({
      startedAt: null,
      overallProgress: 0,
      phaseDisplay: initialPhase,
      traceLines: [],
      activeTrace: null,
      done: false,
      failed: null,
      failureDetail: null,
      lastTraceKey: '',
    }),
}));
