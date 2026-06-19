/**
 * Account export PDF generation.
 */
import { describe, it, expect } from 'vitest';
import { buildAccountExportPdf } from '../src/lib/accountDataExportPdf.js';

const samplePayload = {
  exportedAt: new Date('2026-06-18T10:00:00Z'),
  user: {
    email: 'athlete@example.com',
    role: 'athlete',
    twoFactorEnabled: false,
    telegramLinkedAt: null,
    createdAt: new Date('2025-01-01'),
  },
  profile: { displayName: 'Test Athlete' },
  settings: { language: 'en', timezone: 'Africa/Cairo', theme: 'dark' },
  workoutLogs: [
    {
      loggedAt: new Date('2026-06-17'),
      durationMin: 45,
      workout: { title: 'Push Day' },
    },
  ],
  foodLogs: [
    {
      loggedAt: new Date('2026-06-17'),
      snapshotName: 'Chicken breast',
      grams: 150,
      snapshotCalories: 248,
    },
  ],
  orders: [],
  communityPosts: [],
  communityComments: [],
  communityFollows: [],
  notifications: [{ type: 'fitness.pr_achieved', title: 'New PR', createdAt: new Date() }],
  gamification: { currentTier: 'silver', lifetimeXp: 1200, currentXp: 300 },
  achievements: [{ slug: 'first_workout', earnedAt: new Date('2025-02-01') }],
  supportTickets: [],
};

describe('accountDataExportPdf', () => {
  it('builds a valid PDF buffer in English', async () => {
    const pdf = await buildAccountExportPdf(samplePayload);
    expect(Buffer.isBuffer(pdf)).toBe(true);
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('builds a valid PDF buffer in Arabic', async () => {
    const pdf = await buildAccountExportPdf({
      ...samplePayload,
      settings: { ...samplePayload.settings, language: 'ar' },
    });
    expect(pdf.slice(0, 4).toString()).toBe('%PDF');
  });
});
