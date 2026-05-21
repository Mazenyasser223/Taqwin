/**
 * Taqwin — Profile API (current user only).
 * GET /api/profile — get my profile
 * PATCH /api/profile — update my profile (allowed fields only)
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { getOrCreateProfile, upsertProfile } = require('../lib/profile');

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
    const profile = await upsertProfile(req.user.id, data);
    res.json(profile);
  } catch (err) {
    console.error('Profile PATCH error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

module.exports = router;
