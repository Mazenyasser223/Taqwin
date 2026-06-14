/**
 * Block C2 — optional Mongo audit log for plan generation (verbose, not official plan).
 */
const { connectMongo, isMongoConfigured } = require('../../db/mongo/client');
const { logger } = require('../logger');

let PlanGenerationLog = null;

async function getModel() {
  if (!isMongoConfigured()) return null;
  if (PlanGenerationLog) return PlanGenerationLog;
  await connectMongo();
  const { mongoose } = require('../../db/mongo/client');
  const schema = new mongoose.Schema(
    {
      userId: { type: String, required: true, index: true },
      weekStart: { type: String, default: '' },
      rawPlan: { type: mongoose.Schema.Types.Mixed },
      validationResult: { type: String, enum: ['accepted', 'rejected'], required: true },
      validationErrors: { type: [String], default: [] },
      source: { type: String, default: '' },
      fastApiSource: { type: String, default: '' },
      inputSnapshot: { type: mongoose.Schema.Types.Mixed },
      createdAt: { type: Date, default: Date.now },
    },
    { collection: 'plan_generation_logs' }
  );
  PlanGenerationLog = mongoose.models.PlanGenerationLog || mongoose.model('PlanGenerationLog', schema);
  return PlanGenerationLog;
}

/**
 * @param {{
 *   userId: string,
 *   weekStart?: string,
 *   rawPlan?: object | null,
 *   validationResult: 'accepted'|'rejected',
 *   validationErrors?: string[],
 *   source?: string,
 *   fastApiSource?: string,
 *   inputSnapshot?: object,
 * }} entry
 */
async function logPlanGeneration(entry) {
  try {
    const Model = await getModel();
    if (!Model) return;
    await Model.create(entry);
  } catch (err) {
    logger.warn({ err: err.message, userId: entry.userId }, 'plan_generation_log write failed');
  }
}

module.exports = { logPlanGeneration };
