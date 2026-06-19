/**
 * Block E3 — persist agent traces to MongoDB.
 */
const { connectMongo, isMongoConfigured } = require('../db/mongo/client');
const { logger } = require('../lib/logger');

async function logAgentTrace(payload) {
  if (!isMongoConfigured()) return null;
  try {
    await connectMongo();
    const AgentTrace = require('../db/mongo/models/agentTrace');
    const row = await AgentTrace.create({
      userId: payload.userId,
      threadId: payload.threadId || null,
      turnId: payload.turnId || null,
      intent: payload.intent || 'general',
      routing: payload.routing || null,
      rag: payload.rag || null,
      cag: payload.cag || null,
      llm: payload.llm || null,
      tools: payload.tools || null,
      nodes: payload.nodes || [],
      toolCalls: payload.toolCalls || [],
      latencyMs: payload.latencyMs || 0,
      model: payload.model || null,
      locale: payload.locale || 'ar',
      success: payload.success !== false,
      error: payload.error || null,
    });
    return row._id?.toString() || null;
  } catch (err) {
    logger.debug({ err }, 'agent trace write failed');
    return null;
  }
}

module.exports = { logAgentTrace };
