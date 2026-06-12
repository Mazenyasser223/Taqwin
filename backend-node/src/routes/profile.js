/**
 * Taqwin — Profile API (current user only).
 * GET /api/profile — get my profile
 * PATCH /api/profile — update my profile (allowed fields only)
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOrCreateProfile, isGymRole, upsertProfile } = require('../lib/profile');
const { mergeOnboardingWeightLog } = require('../lib/weightLog');
const { maybeTriggerPlanOnOnboardingComplete } = require('../lib/plans/triggerPlanOnOnboarding');

const router = express.Router();
router.use(authMiddleware);

const ATHLETE_PROFILE_FIELDS = [
  'displayName',
  'avatarUrl',
  'coverUrl',
  'dateOfBirth',
  'gender',
  'height',
  'weight',
  'fitnessGoal',
  'fitnessLevel',
  'medicalNotes',
  'onboardingData',
];

const GYM_PROFILE_FIELDS = [
  'displayName',
  'avatarUrl',
  'coverUrl',
  'bio',
  'businessName',
  'businessAddress',
  'businessPhone',
  'websiteUrl',
];

function allowedFieldsForRole(role) {
  return isGymRole(role) ? GYM_PROFILE_FIELDS : ATHLETE_PROFILE_FIELDS;
}

// GET /api/profile — current user's profile
router.get('/', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user.id, req.user.role);
    res.json(profile);
  } catch (err) {
    console.error('Profile GET error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PATCH /api/profile — update current user's profile
router.patch('/', async (req, res) => {
  try {
    const fields = allowedFieldsForRole(req.user.role);
    const data = {};
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }
    if (data.dateOfBirth !== undefined && data.dateOfBirth !== null) {
      data.dateOfBirth = new Date(data.dateOfBirth);
    }
    const existing = await getOrCreateProfile(req.user.id, req.user.role);
    const previousOnboarding = existing.onboardingData;

    if (data.weight !== undefined && !isGymRole(req.user.role)) {
      const baseOnboarding = data.onboardingData ?? existing.onboardingData;
      data.onboardingData = mergeOnboardingWeightLog(baseOnboarding, data.weight);
    }

    const profile = await upsertProfile(req.user.id, req.user.role, data);

    let planGeneration;
    if (data.onboardingData !== undefined && !isGymRole(req.user.role)) {
      planGeneration = await maybeTriggerPlanOnOnboardingComplete({
        userId: req.user.id,
        role: req.user.role,
        previousOnboarding,
        nextOnboarding: profile.onboardingData,
      });
    }

    if (planGeneration?.triggered) {
      return res.status(202).json({ profile, planGeneration });
    }
    res.json({ profile, planGeneration: planGeneration || { triggered: false } });
  } catch (err) {
    console.error('Profile PATCH error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
