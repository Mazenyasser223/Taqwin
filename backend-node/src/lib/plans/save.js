/**
 * Save a generated plan to MongoDB and deactivate the previous active plan.
 *
 * "Active" semantics: exactly one document per user has `isActive: true`.
 * Regenerating produces a new document with `version = previous.version + 1`
 * and flips the older one off in the same atomic batch (best-effort — Mongo
 * has no multi-doc transactions outside of Atlas replica sets, but the read
 * path always sorts by `createdAt: -1` so the newest wins anyway).
 */
const { connectMongo, isMongoConfigured } = require('../../db/mongo/client');
const { logger } = require('../logger');

async function savePlan({
  userId,
  planData,
  source = 'ai',
  locale = 'ar',
  inputSnapshot = {},
  regenerationReason = '',
} = {}) {
  if (!userId) throw new Error('savePlan: userId required');
  if (!planData?.dailyTargets) throw new Error('savePlan: planData.dailyTargets required');
  if (!isMongoConfigured()) {
    throw new Error('savePlan: MONGO_URI not configured.');
  }

  await connectMongo();
  const Plan = require('../../db/mongo/models/plan');

  const latest = await Plan.findOne({ userId }).sort({ version: -1 }).select('version').lean();
  const nextVersion = (latest?.version || 0) + 1;

  await Plan.updateMany(
    { userId, isActive: true },
    { $set: { isActive: false } }
  );

  const doc = await Plan.create({
    userId,
    version: nextVersion,
    isActive: true,
    source,
    locale,
    coachNotes: planData.coachNotes || '',
    regenerationReason: regenerationReason || planData.regenerationReason || '',
    dailyTargets: {
      calories: planData.dailyTargets.calories,
      protein: planData.dailyTargets.protein,
      carbs: planData.dailyTargets.carbs,
      fat: planData.dailyTargets.fat,
      waterMl: planData.dailyTargets.waterMl,
    },
    dietDays: planData.dietDays || [],
    workoutWeeks: planData.workoutWeeks || [],
    inputSnapshot,
  });

  logger.info(
    { userId, version: nextVersion, source, dietDays: doc.dietDays.length, weeks: doc.workoutWeeks.length },
    'Plan saved'
  );

  return doc.toObject();
}

async function deactivateActivePlan(userId) {
  if (!isMongoConfigured()) return;
  await connectMongo();
  const Plan = require('../../db/mongo/models/plan');
  await Plan.updateMany({ userId, isActive: true }, { $set: { isActive: false } });
}

async function getActivePlan(userId) {
  if (!isMongoConfigured()) return null;
  await connectMongo();
  const Plan = require('../../db/mongo/models/plan');
  return Plan.findOne({ userId, isActive: true }).sort({ createdAt: -1 }).lean();
}

module.exports = {
  savePlan,
  deactivateActivePlan,
  getActivePlan,
};
