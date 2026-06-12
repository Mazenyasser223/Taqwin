/** Map FastAPI / Node coach.phase values to i18n keys under `ai.phase.*`. */
const PHASE_I18N: Record<string, string> = {
  starting: 'ai.phase.starting',
  saving: 'ai.phase.saving',
  safety_guard: 'ai.phase.safety',
  handle_pending: 'ai.phase.pending',
  intent_route: 'ai.phase.understanding',
  clarify_reply: 'ai.phase.understanding',
  retrieve_rag: 'ai.phase.searching',
  build_prompt: 'ai.phase.preparing',
  coach_llm: 'ai.phase.writing',
  execute_tools: 'ai.phase.tools',
  prepare_confirmation: 'ai.phase.confirming',
  summarize_results: 'ai.phase.summarizing',
  execute_subgraph: 'ai.phase.tools',
  plan_compound: 'ai.phase.planning',
  fast_confirm: 'ai.phase.confirming',
};

export function coachPhaseI18nKey(phase: string | null | undefined): string | null {
  if (!phase) return null;
  const key = PHASE_I18N[phase];
  if (key) return key;
  return 'ai.phase.working';
}
