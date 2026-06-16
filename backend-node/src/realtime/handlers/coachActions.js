/**
 * WebSocket coach confirm / cancel / disambiguate handlers.
 */
const {
  processCoachConfirm,
  processCoachCancel,
  processCoachDisambiguate,
} = require('../../services/coachChatActions');
const { serverEnvelope } = require('../envelope');
const { streamTextAsCoachTokens } = require('../streamCoachTokens');

function send(ws, envelope) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(envelope));
}

async function emitCoachActionResult(ws, turnId, result, extra = {}) {
  if (!result.ok) {
    const { coachActionErrorBody } = require('../../services/coachChatActions');
    send(
      ws,
      serverEnvelope('coach.error', {
        turnId,
        message: result.error || 'Action failed',
        ...coachActionErrorBody(result),
      }),
    );
    return;
  }
  const reply = result.data?.reply || '';
  if (reply) {
    await streamTextAsCoachTokens(send, ws, turnId, reply);
  }
  send(ws, serverEnvelope('coach.phase', { turnId, phase: 'saving' }));
  send(ws, serverEnvelope('coach.done', { turnId, ...result.data, ...extra }));
}

async function handleCoachConfirm(ws, userId, payload) {
  const turnId = payload.turnId || `turn-${Date.now()}`;
  send(ws, serverEnvelope('coach.started', { turnId }));
  send(ws, serverEnvelope('coach.phase', { turnId, phase: 'starting' }));
  const result = await processCoachConfirm(userId, payload);
  await emitCoachActionResult(ws, turnId, result, { afterConfirm: true });
}

async function handleCoachCancelPending(ws, userId, payload) {
  const turnId = payload.turnId || `turn-${Date.now()}`;
  send(ws, serverEnvelope('coach.started', { turnId }));
  send(ws, serverEnvelope('coach.phase', { turnId, phase: 'starting' }));
  const result = await processCoachCancel(userId, payload);
  await emitCoachActionResult(ws, turnId, result);
}

async function handleCoachDisambiguate(ws, userId, payload) {
  const turnId = payload.turnId || `turn-${Date.now()}`;
  send(ws, serverEnvelope('coach.started', { turnId }));
  send(ws, serverEnvelope('coach.phase', { turnId, phase: 'starting' }));
  const result = await processCoachDisambiguate(userId, payload);
  await emitCoachActionResult(ws, turnId, result);
}

module.exports = {
  handleCoachConfirm,
  handleCoachCancelPending,
  handleCoachDisambiguate,
};
