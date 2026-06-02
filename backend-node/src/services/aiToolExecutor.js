/**
 * Block A4 — execute AI tools in Node (Prisma writes) and audit to AiToolExecution.
 * FastAPI must never touch Postgres directly.
 */
const { prisma } = require('../db');
const { logger } = require('../lib/logger');

/** @type {Record<string, (ctx: { userId: string, input: object, threadId?: string }) => Promise<object>>} */
const TOOL_HANDLERS = {
  /** Connectivity / contract check for internal API wiring. */
  async ping() {
    return { ok: true, service: 'taqwin-api', block: 'A4' };
  },

  /** Echo payload for integration tests. */
  async echo({ input }) {
    return { echoed: input ?? {} };
  },
};

/**
 * @param {{ userId: string, toolName: string, input?: object, threadId?: string }} params
 * @returns {Promise<{ success: boolean, output: object | null, error: string | null, executionId: string }>}
 */
async function executeTool({ userId, toolName, input = {}, threadId }) {
  const started = Date.now();
  let success = false;
  let output = null;
  let error = null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const handler = TOOL_HANDLERS[toolName];
    if (!handler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    output = await handler({ userId, input, threadId });
    success = true;
  } catch (err) {
    error = err.message || 'Tool execution failed';
    logger.debug({ err, toolName, userId }, 'AI tool execution failed');
  }

  const durationMs = Math.max(1, Date.now() - started);

  const row = await prisma.aiToolExecution.create({
    data: {
      userId,
      threadId: threadId || null,
      toolName,
      input,
      output: success ? output : undefined,
      success,
      error,
      durationMs,
    },
  });

  return {
    success,
    output: success ? output : null,
    error,
    executionId: row.id,
  };
}

function listStubTools() {
  return Object.keys(TOOL_HANDLERS);
}

module.exports = { executeTool, listStubTools, TOOL_HANDLERS };
