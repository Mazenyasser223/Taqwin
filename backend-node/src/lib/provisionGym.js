/**
 * Auto-create / sync a public Gym row from the owner's profile (signup + listing).
 */
const { prisma } = require('../db');

const DEFAULT_GYM_PLANS = [
  { name: 'Monthly', nameAr: 'شهري', durationDays: 30, price: 500, sortOrder: 0 },
  { name: 'Quarterly', nameAr: '3 شهور', durationDays: 90, price: 1350, sortOrder: 1 },
  { name: 'Annual', nameAr: 'سنوي', durationDays: 365, price: 4800, sortOrder: 2 },
];

async function seedDefaultPlans(gymId) {
  for (const plan of DEFAULT_GYM_PLANS) {
    const existing = await prisma.gymSubscriptionPlan.findFirst({
      where: { gymId, name: plan.name },
    });
    if (!existing) {
      await prisma.gymSubscriptionPlan.create({ data: { gymId, ...plan } });
    }
  }
}

function pickGymFields(profile) {
  const name = profile?.businessName?.trim();
  const location = profile?.businessAddress?.trim();
  const phone = profile?.businessPhone?.trim();
  return { name, location, phone: phone || null };
}

/**
 * Create gym + default plans when missing, or sync name/location/phone from profile.
 * Returns the gym row or null if required profile fields are missing.
 */
async function ensureGymForOwner(ownerId) {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      role: true,
      profile: {
        select: {
          businessName: true,
          businessAddress: true,
          businessPhone: true,
        },
      },
    },
  });

  if (!user || user.role !== 'gym') return null;

  const { name, location, phone } = pickGymFields(user.profile);
  let gym = await prisma.gym.findFirst({ where: { ownerId } });

  if (!gym) {
    if (!name || name.length < 2 || !location || location.length < 2) return null;
    gym = await prisma.gym.create({
      data: {
        ownerId,
        name,
        location,
        phone,
        maxCapacity: 100,
        isActive: true,
      },
    });
    await seedDefaultPlans(gym.id);
    return gym;
  }

  const updates = {};
  if (name && name.length >= 2 && name !== gym.name) updates.name = name;
  if (location && location.length >= 2 && location !== gym.location) updates.location = location;
  if (phone !== gym.phone) updates.phone = phone;

  if (Object.keys(updates).length === 0) return gym;

  return prisma.gym.update({
    where: { id: gym.id },
    data: updates,
  });
}

module.exports = { ensureGymForOwner, seedDefaultPlans, DEFAULT_GYM_PLANS };
