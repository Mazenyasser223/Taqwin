/**
 * Official Postgres plans are read-only for athletes — structure changes go through AI Coach tools.
 */
const { loadActivePlanDays } = require('./dailyAthletePlanService');

const AGENT_LOCKED_SOURCES = new Set(['onboarding', 'weekly_cron', 'adaptation']);

function isAgentLockedPlan(plan) {
  return Boolean(plan && AGENT_LOCKED_SOURCES.has(plan.source));
}

async function getActiveOfficialPlanContext(userId) {
  const { workoutPlan, dietPlan } = await loadActivePlanDays(userId, { detailed: false });
  const hasActiveOfficialPlan = Boolean(workoutPlan || dietPlan);
  return {
    hasActiveOfficialPlan,
    userCanEditPlanStructure: !isAgentLockedPlan(workoutPlan) && !isAgentLockedPlan(dietPlan),
    workoutPlanId: workoutPlan?.planId ?? workoutPlan?.id ?? null,
    dietPlanId: dietPlan?.planId ?? dietPlan?.id ?? null,
  };
}

function planStructureEditBlockedMessage(locale = 'ar') {
  return locale === 'en'
    ? 'Your AI plan can only be changed by AI Coach. Open chat and ask to swap meals, exercises, or regenerate your plan.'
    : 'لا يمكن تعديل خطة الذكاء الاصطناعي إلا عبر المدرب. افتح المحادثة واطلب تغيير الوجبات أو التمارين أو إعادة توليد الخطة.';
}

function createPlanStructureEditBlockedError(locale = 'ar') {
  const err = new Error(planStructureEditBlockedMessage(locale));
  err.statusCode = 403;
  err.code = 'PLAN_AGENT_ONLY';
  return err;
}

async function assertUserCanEditPlanStructure(userId, locale = 'ar') {
  const ctx = await getActiveOfficialPlanContext(userId);
  if (!ctx.userCanEditPlanStructure) {
    throw createPlanStructureEditBlockedError(locale);
  }
  return ctx;
}

module.exports = {
  AGENT_LOCKED_SOURCES,
  isAgentLockedPlan,
  getActiveOfficialPlanContext,
  assertUserCanEditPlanStructure,
  planStructureEditBlockedMessage,
  createPlanStructureEditBlockedError,
};
