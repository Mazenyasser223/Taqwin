export type PlanViewMode = 'ai' | 'logs';

export const PLAN_VIEW_MODE_KEY = 'taqwin-plan-view-mode';
export const PLAN_VIEW_MODE_EVENT = 'taqwin-plan-view-mode';

/** Switch dashboard diet/workout panels to My logs (after logging anywhere on the site). */
export function requestPlanLogsView() {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(PLAN_VIEW_MODE_KEY, 'logs');
  window.dispatchEvent(new CustomEvent<PlanViewMode>(PLAN_VIEW_MODE_EVENT, { detail: 'logs' }));
}

export function readPlanViewMode(): PlanViewMode {
  if (typeof sessionStorage === 'undefined') return 'logs';
  const stored = sessionStorage.getItem(PLAN_VIEW_MODE_KEY);
  if (stored === 'ai') return 'ai';
  return 'logs';
}
