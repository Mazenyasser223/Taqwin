/**
 * WebSocket helpers for E7 confirm tests.
 */
function waitForType(ws, type, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for ${type}`));
    }, timeoutMs);

    const onMessage = (raw) => {
      try {
        const env = JSON.parse(String(raw));
        if (env.type === type) {
          cleanup();
          resolve(env);
        }
      } catch {
        /* ignore */
      }
    };

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('message', onMessage);
    };

    ws.on('message', onMessage);
  });
}

async function wsAuth(ws, token) {
  ws.send(JSON.stringify({ type: 'auth', token }));
  const authOk = await waitForType(ws, 'auth.ok');
  if (!authOk.userId) throw new Error('auth.ok missing userId');
  return authOk;
}

async function waitForCoachPhase(ws, phase, timeoutMs = 8000) {
  let envelope;
  while (true) {
    envelope = await waitForType(ws, 'coach.phase', timeoutMs);
    if (envelope.phase === phase) return envelope;
    if (envelope.phase !== 'starting') {
      throw new Error(`expected coach.phase ${phase}, got ${envelope.phase}`);
    }
  }
}

async function wsCoachConfirm(ws, payload) {
  ws.send(JSON.stringify({ type: 'coach.confirm', ...payload }));
  await waitForCoachPhase(ws, 'saving');
  return waitForType(ws, 'coach.done');
}

module.exports = {
  waitForType,
  wsAuth,
  wsCoachConfirm,
};
