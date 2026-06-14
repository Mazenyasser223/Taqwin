/**
 * Start/stop Node API + ai-service for E7 cross-service integration.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

function aiServiceRoot() {
  const root = path.join(__dirname, '..', '..', '..', 'ai-service');
  if (!fs.existsSync(root)) {
    throw new Error(`ai-service not found at ${root}`);
  }
  return root;
}

async function waitForHealth(url, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    await new Promise((r) => setTimeout(r, 750));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startNodeServer(app) {
  const server = http.createServer(app);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

function startAiService(env = {}) {
  const aiRoot = aiServiceRoot();
  const port = Number(env.AI_SERVICE_PORT || 9000 + (process.pid % 800));
  const childEnv = {
    ...process.env,
    ...env,
    LOG_LEVEL: 'warning',
    AI_INTERNAL_KEY: env.AI_INTERNAL_KEY || process.env.AI_INTERNAL_KEY || 'test-internal-key-min-16-chars',
    NODE_INTERNAL_API_URL: env.NODE_INTERNAL_API_URL || process.env.NODE_INTERNAL_API_URL,
    // E7 integration must use no-LLM fast_confirm (CI has no Anthropic key).
    ANTHROPIC_API_KEY: '',
    COHERE_API_KEY: '',
    VOYAGE_API_KEY: '',
    RAG_RERANK_ENABLED: 'false',
  };

  const isWin = process.platform === 'win32';
  const py = isWin ? 'python' : 'python3';
  const stderrBuf = [];

  const proc = spawn(py, ['-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: aiRoot,
    env: childEnv,
    stdio: ['ignore', 'ignore', 'pipe'],
    shell: isWin,
  });

  proc.stderr?.on('data', (chunk) => {
    stderrBuf.push(String(chunk));
  });

  const healthUrl = `http://127.0.0.1:${port}/health`;
  return {
    proc,
    port,
    healthUrl,
    async waitReady(timeoutMs = 90000) {
      try {
        await waitForHealth(healthUrl, timeoutMs);
        return true;
      } catch (err) {
        const tail = stderrBuf.join('').slice(-800);
        err.message += tail ? `\n--- ai-service stderr ---\n${tail}` : '';
        throw err;
      }
    },
  };
}

function stopProcess(proc) {
  if (!proc || proc.killed) return Promise.resolve();
  return new Promise((resolve) => {
    proc.once('exit', () => resolve());
    proc.kill('SIGTERM');
    setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolve();
    }, 3000);
  });
}

async function stopNodeServer(server) {
  if (!server) return;
  await new Promise((resolve) => server.close(() => resolve()));
}

module.exports = {
  waitForHealth,
  startNodeServer,
  startAiService,
  stopProcess,
  stopNodeServer,
  aiServiceRoot,
};
