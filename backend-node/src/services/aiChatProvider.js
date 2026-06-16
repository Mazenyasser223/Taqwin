/**
 * Stub — all LLM calls route through ai-service (FastAPI).
 * Node workers use aiFastApiClient; legacy coachPlan enhancement skips AI when no provider.
 */

function resolveProvider() {
  return null;
}

async function completeChat() {
  throw new Error(
    'Node LLM calls removed. Set FEATURE_AI_VIA_FASTAPI=true and AI_SERVICE_URL; configure ANTHROPIC_API_KEY on ai-service.'
  );
}

function providerConfigHint() {
  return 'FEATURE_AI_VIA_FASTAPI + AI_SERVICE_URL (ANTHROPIC_API_KEY on ai-service)';
}

module.exports = { completeChat, resolveProvider, providerConfigHint };
