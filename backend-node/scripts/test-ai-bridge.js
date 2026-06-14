/**
 * Smoke test: Node → FastAPI echo bridge (Phase 1).
 * Usage: node scripts/test-ai-bridge.js
 * Requires AI_SERVICE_URL and AI_INTERNAL_KEY in .env
 */
require('dotenv').config();
const { isAiServiceEnabled, chatViaFastApi } = require('../src/services/aiFastApiClient');

async function main() {
  if (!isAiServiceEnabled()) {
    console.error('Set AI_SERVICE_URL in backend-node/.env (e.g. http://127.0.0.1:8000)');
    process.exit(1);
  }
  const { reply, mode } = await chatViaFastApi({
    userId: '00000000-0000-0000-0000-000000000001',
    locale: 'ar',
    messages: [{ role: 'user', content: 'مرحباً' }],
    contextBundle: { test: true },
    threadId: null,
  });
  console.log('mode:', mode);
  console.log('reply:', reply);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
