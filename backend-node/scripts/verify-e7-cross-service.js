/* eslint-disable no-console */
/**
 * E7 cross-service orchestrator — Node HTTP + ai-service + pytest.
 *
 *   npm run verify:e7-cross-service
 *
 * Starts Node API and uvicorn, runs ai-service integration tests against Postgres.
 */
require('dotenv').config({ override: true });

const { spawn } = require('child_process');
const path = require('path');
const {
  configureConfirmEnv,
  configureChatEnv,
} = require('../tests/helpers/e7Fixtures.cjs');
const {
  waitForHealth,
  startNodeServer,
  startAiService,
  stopProcess,
  stopNodeServer,
} = require('./lib/e7-services.cjs');

const aiServiceRoot = path.join(__dirname, '..', '..', 'ai-service');
const backendRoot = path.join(__dirname, '..');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('FAIL DATABASE_URL required');
    process.exit(1);
  }

  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-ci';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.env.LOG_LEVEL = process.env.LOG_LEVEL || 'silent';
  process.env.AI_INTERNAL_KEY = process.env.AI_INTERNAL_KEY || 'test-internal-key-min-16-chars';

  configureConfirmEnv();
  const app = require('../src/app');
  let nodeSrv = null;
  let aiProc = null;
  const aiPort = 9000 + (process.pid % 800);

  try {
    nodeSrv = await startNodeServer(app);
    console.log(`OK  Node API ${nodeSrv.baseUrl}`);

    const ai = startAiService({
      NODE_INTERNAL_API_URL: nodeSrv.baseUrl,
      AI_SERVICE_PORT: String(aiPort),
    });
    aiProc = ai.proc;
    await ai.waitReady();
    console.log(`OK  ai-service ${ai.healthUrl}`);

    configureChatEnv(`http://127.0.0.1:${aiPort}`);

    const pyEnv = {
      ...process.env,
      E7_NODE_INTERNAL_URL: nodeSrv.baseUrl,
      E7_AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
      NODE_INTERNAL_API_URL: nodeSrv.baseUrl,
      AI_SERVICE_URL: `http://127.0.0.1:${aiPort}`,
      JWT_SECRET: process.env.JWT_SECRET,
      DATABASE_URL: process.env.DATABASE_URL,
      AI_INTERNAL_KEY: process.env.AI_INTERNAL_KEY,
    };

    const isWin = process.platform === 'win32';
    const pyCmd = isWin ? 'python' : 'python3';
    console.log('\n── ai-service E7 cross-service pytest ──\n');

    const code = await new Promise((resolve) => {
      const proc = spawn(
        pyCmd,
        [
          '-m',
          'pytest',
          'tests/test_e7_food_log_cross_service.py',
          '-v',
          '--tb=short',
          '-m',
          'integration',
        ],
        {
          cwd: aiServiceRoot,
          env: pyEnv,
          stdio: 'inherit',
          shell: isWin,
        }
      );
      proc.on('exit', (c) => resolve(c ?? 1));
    });

    if (code !== 0) {
      console.error(`\nFAIL pytest exit ${code}`);
      process.exit(1);
    }
    console.log('\nE7 cross-service verify PASSED');
  } finally {
    await stopProcess(aiProc);
    await stopNodeServer(nodeSrv?.server);
    await require('../src/db').prisma.$disconnect().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
