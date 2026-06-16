/**
 * BullMQ worker — ai-memory-summarize (Block E4).
 */
const { Worker } = require('bullmq');
const { AI_MEMORY_SUMMARIZE_QUEUE } = require('../queues');
const { getBullConnection } = require('../../lib/redisBull');
const { logger } = require('../../lib/logger');
const { summarizeUserMemories } = require('../../lib/ai/memoryPipeline');

let workerInstance = null;

function startAiMemoryWorker() {
  if (workerInstance) return workerInstance;

  const concurrency = Math.max(1, Number(process.env.AI_MEMORY_WORKER_CONCURRENCY || 2));

  workerInstance = new Worker(
    AI_MEMORY_SUMMARIZE_QUEUE,
    async (job) => {
      const { userId, locale, hours, dryRun, source } = job.data || {};
      if (!userId) throw new Error('ai-memory-summarize missing userId');
      return summarizeUserMemories(userId, {
        locale: locale === 'en' ? 'en' : 'ar',
        hours: hours || 48,
        dryRun: Boolean(dryRun),
        source:
          source === 'session_chat'
            ? 'session_chat'
            : source === 'tool_success'
              ? 'tool_success'
              : 'nightly_chat',
      });
    },
    { connection: getBullConnection(), concurrency }
  );

  workerInstance.on('completed', (job, ret) => {
    logger.info(
      {
        jobId: job.id,
        userId: job.data?.userId,
        source: ret?.source || job.data?.source,
        keysWritten: ret?.keys || [],
        model: ret?.model,
        latencyMs: ret?.latencyMs,
        written: ret?.written,
        skipped: ret?.skipped,
      },
      'ai-memory-summarize job completed'
    );
  });

  workerInstance.on('failed', (job, err) => {
    logger.warn({ jobId: job?.id, err: err.message }, 'ai-memory-summarize failed');
  });

  return workerInstance;
}

async function stopAiMemoryWorker() {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
  }
}

module.exports = { startAiMemoryWorker, stopAiMemoryWorker };
