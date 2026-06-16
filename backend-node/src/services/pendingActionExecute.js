/**
 * Execute a stored pending action via LangGraph resume (FastAPI) or Node tool executor.
 */
const { logger } = require('../lib/logger');
const { executeTool } = require('./aiToolExecutor');
const { isFastApiBridgeEnabled, resumeChatViaFastApi } = require('./aiFastApiClient');
const {
  cancelReply,
  executionSuccessReply,
} = require('../lib/coach/pendingActionReplies');
const { serializeCandidates } = require('../lib/coach/foodDisambiguation');

function toolResultNeedsDisambiguation(out) {
  return Boolean(out?.disambiguation?.kind === 'food' && out.disambiguation.candidates?.length);
}

/**
 * @param {object} pending
 * @param {{ threadId?: string, contextBundle?: object }} [opts]
 * @returns {Promise<{ results: object[], reply: string|null, disambiguation?: object }>}
 */
async function executePendingAction(pending, opts = {}) {
  const checkpoint = pending.executionCheckpoint || null;
  const startIndex = Number.isFinite(checkpoint?.resumeFromIndex) ? checkpoint.resumeFromIndex : 0;
  const priorResults = Array.isArray(checkpoint?.completedResults) ? checkpoint.completedResults : [];
  const allTools = pending.tools || [];

  if (isFastApiBridgeEnabled() && startIndex === 0 && !priorResults.length) {
    try {
      const out = await resumeChatViaFastApi({
        userId: pending.userId,
        threadId: opts.threadId || pending.conversationId,
        locale: pending.locale || 'ar',
        tools: allTools,
        inputsByTool: pending.inputsByTool || {},
        planSteps: pending.planSteps || [],
        userMessage: pending.userMessage || '',
        intent: pending.intent || 'execute_action',
        contextBundle: opts.contextBundle ?? null,
      });
      const results = Array.isArray(out.toolResults)
        ? out.toolResults
        : allTools.map((name) => ({
            tool: name,
            success: true,
            output: pending.inputsByTool?.[name] || {},
          }));
      return { results, reply: out.reply || null };
    } catch (err) {
      logger.warn({ err, userId: pending.userId }, 'FastAPI resume failed — falling back to Node executor');
    }
  }

  const results = [...priorResults];
  const toolsToRun = allTools.slice(startIndex);

  for (let offset = 0; offset < toolsToRun.length; offset += 1) {
    const name = toolsToRun[offset];
    const absoluteIndex = startIndex + offset;
    const input = pending.inputsByTool?.[name] || { message: pending.userMessage };
    try {
      const out = await executeTool({
        userId: pending.userId,
        toolName: name,
        input,
        threadId: opts.threadId || pending.conversationId,
      });

      if (toolResultNeedsDisambiguation(out)) {
        return {
          results,
          reply: null,
          disambiguation: {
            kind: 'food',
            candidates: serializeCandidates(out.disambiguation.candidates),
            grams: out.disambiguation.grams,
            resumeFromIndex: absoluteIndex,
            completedResults: results,
          },
        };
      }

      results.push({
        tool: name,
        success: Boolean(out?.success),
        output: out?.output,
        error: out?.error,
      });

      if (!out?.success) break;
    } catch (err) {
      results.push({ tool: name, success: false, error: err.message || 'execution_failed' });
      break;
    }
  }

  return { results, reply: null };
}

function buildExecuteReply(pending, results, fastApiReply) {
  if (typeof fastApiReply === 'string' && fastApiReply.trim()) {
    return fastApiReply.trim();
  }
  return executionSuccessReply(pending.tools, results, pending.locale || 'ar');
}

module.exports = {
  executePendingAction,
  buildExecuteReply,
  cancelReply,
  toolResultNeedsDisambiguation,
};
