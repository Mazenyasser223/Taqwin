/**
 * Create or update an athlete account from reception desk forms.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { prisma } = require('../db');
const { normalizePhoneE164 } = require('./phoneNormalize');

function buildOnboardingData(existing, { address, gender } = {}) {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing) ? { ...existing } : {};
  if (address?.trim()) {
    base.address = address.trim();
  }
  if (gender) {
    base.gender = gender;
  }
  return Object.keys(base).length ? base : undefined;
}

function buildDisplayName(firstName, lastName) {
  return `${firstName.trim()} ${lastName.trim()}`.trim();
}

/**
 * @returns {Promise<{ user: import('@prisma/client').User, accountCreated: boolean }>}
 */
async function ensureAthleteUser(input) {
  const {
    firstName,
    lastName,
    email,
    phone: rawPhone,
    address: rawAddress,
    gender,
    avatarUrl,
  } = input;

  const emailLower = email.trim().toLowerCase();
  const address = rawAddress?.trim() || null;
  let phone = null;
  if (rawPhone?.trim()) {
    phone = normalizePhoneE164(rawPhone);
    if (!phone) {
      const err = new Error('Enter a valid Egyptian mobile number (e.g. 01012345678)');
      err.status = 400;
      throw err;
    }
  }
  const displayName = buildDisplayName(firstName, lastName);

  if (phone) {
    const phoneTaken = await prisma.user.findFirst({
      where: { phone, NOT: { email: emailLower } },
      select: { id: true },
    });
    if (phoneTaken) {
      const err = new Error('Phone number is already used by another account');
      err.status = 409;
      throw err;
    }
  }

  let user = await prisma.user.findUnique({ where: { email: emailLower } });
  let accountCreated = false;

  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomBytes(18).toString('base64url'), 10);
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          role: 'athlete',
          phone,
          emailVerifiedAt: new Date(),
        },
      });
      await tx.athleteProfile.create({
        data: {
          userId: created.id,
          displayName,
          gender: gender || null,
          avatarUrl: avatarUrl || null,
          onboardingData: buildOnboardingData(null, { address, gender }),
        },
      });
      await tx.userSettings.create({ data: { userId: created.id } });
      return created;
    });
    accountCreated = true;
  } else {
    const existingProfile = await prisma.athleteProfile.findUnique({
      where: { userId: user.id },
      select: { onboardingData: true },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: phone ? { phone } : {},
    });
    await prisma.athleteProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        displayName,
        gender: gender || null,
        avatarUrl: avatarUrl || null,
        onboardingData: buildOnboardingData(null, { address, gender }),
      },
      update: {
        displayName,
        ...(gender ? { gender } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(address || gender
          ? { onboardingData: buildOnboardingData(existingProfile?.onboardingData, { address, gender }) }
          : {}),
      },
    });
  }

  return { user, accountCreated };
}

function nextClassSessionDate(dayOfWeek, from = new Date()) {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  const current = base.getDay();
  let diff = dayOfWeek - current;
  if (diff < 0) diff += 7;
  if (diff === 0) return base;
  base.setDate(base.getDate() + diff);
  return base;
}

module.exports = {
  ensureAthleteUser,
  buildDisplayName,
  nextClassSessionDate,
};
