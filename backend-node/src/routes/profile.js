/**
 * Taqwin — Profile API (current user only).
 * GET /api/profile — get my profile
 * PATCH /api/profile — update my profile (allowed fields only)
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOrCreateProfile, upsertProfile } = require('../lib/profile');
const { mergeOnboardingWeightLog } = require('../lib/weightLog');
const { maybeTriggerPlanOnOnboardingComplete } = require('../lib/plans/triggerPlanOnOnboarding');
const { moderateText, moderateImage, ModerationError } = require('../lib/moderation');

const router = express.Router();
router.use(authMiddleware);

const ALLOWED_PROFILE_FIELDS = [
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
  'bio',
  'specialties',
  'yearsExperience',
  'businessName',
  'businessAddress',
  'businessPhone',
  'websiteUrl',
  'onboardingData',
];

// GET /api/profile — current user's profile
router.get('/', async (req, res) => {
  try {
    const profile = await getOrCreateProfile(req.user.id);
    res.json(profile);
  } catch (err) {
    console.error('Profile GET error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

// PATCH /api/profile — update current user's profile
router.patch('/', async (req, res) => {
  try {
    const data = {};
    for (const field of ALLOWED_PROFILE_FIELDS) {
      if (req.body[field] !== undefined) {
        data[field] = req.body[field];
      }
    }
    if (Object.keys(data).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // ── Content moderation ────────────────────────────────────────────────
    const lang = (req.headers['accept-language'] || '').startsWith('en') ? 'en' : 'ar';
    try {
      if (data.displayName) await moderateText(data.displayName, lang);
      if (data.bio)         await moderateText(data.bio, lang);
      if (data.avatarUrl)   await moderateImage(data.avatarUrl, lang);
    } catch (err) {
      if (err instanceof ModerationError) {
        return res.status(422).json({ error: err.messageFor(lang), code: 'content_moderated', category: err.category });
      }
      throw err;
    }
    // ─────────────────────────────────────────────────────────────────────

    if (data.dateOfBirth !== undefined && data.dateOfBirth !== null) {
      data.dateOfBirth = new Date(data.dateOfBirth);
    }
    if (data.yearsExperience !== undefined && data.yearsExperience !== null) {
      const y = Number(data.yearsExperience);
      if (!Number.isFinite(y) || y < 0 || y > 80) {
        return res.status(400).json({ error: 'yearsExperience must be a number between 0 and 80' });
      }
      data.yearsExperience = Math.floor(y);
    }
    const existing = await getOrCreateProfile(req.user.id);
    const previousOnboarding = existing.onboardingData;

    if (data.weight !== undefined) {
      const baseOnboarding = data.onboardingData ?? existing.onboardingData;
      data.onboardingData = mergeOnboardingWeightLog(baseOnboarding, data.weight);
    }

    const profile = await upsertProfile(req.user.id, data);

    let planGeneration;
    if (data.onboardingData !== undefined) {
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
