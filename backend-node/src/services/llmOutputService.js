/**
 * Persist LLM I/O summaries to MongoDB (ai_llm_outputs).
 */
const crypto = require('crypto');
const { isMongoConfigured } = require('../db/mongo/client');
const { logger } = require('../lib/logger');

function hashPrompt(system, messages) {
  const payload = JSON.stringify({ system: system || '', messages: messages || [] });
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 24);
}

async function logLlmOutput(payload) {
  if (!isMongoConfigured()) return null;
  try {
    const AiLlmOutput = require('../db/mongo/models/aiLlmOutput');
    const row = await AiLlmOutput.create({
      userId: payload.userId || null,
      threadId: payload.threadId || null,
      provider: payload.provider,
      model: payload.model || null,
      purpose: payload.purpose || 'chat',
      promptHash: payload.promptHash || null,
      systemChars: payload.systemChars || 0,
      inputChars: payload.inputChars || 0,
      outputChars: payload.outputChars || 0,
      latencyMs: payload.latencyMs || 0,
      success: payload.success !== false,
      error: payload.error || null,
    });
    return row._id?.toString() || null;
  } catch (err) {
    logger.debug({ err: err.message }, 'llm output log failed');
    return null;
  }
}

module.exports = { logLlmOutput, hashPrompt };
