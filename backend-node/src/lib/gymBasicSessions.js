/**
 * Fixed spa / jacuzzi / sauna sessions — no trainer, no schedule.
 */
const { prisma } = require('../db');

function hasBasicSessionModel() {
  return typeof prisma.gymBasicSession?.findFirst === 'function';
}

function isMissingBasicSessionResource(err) {
  const msg = String(err?.message ?? err ?? '');
  return (
    err?.code === 'P2021' ||
    err?.code === 'P2022' ||
    msg.includes('gym_basic_sessions') ||
    msg.includes('gym_basic_session_bookings') ||
    msg.includes('GymBasicSession')
  );
}

const BASIC_SESSION_TYPES = ['spa', 'jacuzzi', 'sauna'];

const DEFAULT_BASIC_SESSIONS = [
  { type: 'spa', name: 'Spa', nameAr: 'سبا', price: 250, sortOrder: 0 },
  { type: 'jacuzzi', name: 'Jacuzzi', nameAr: 'جاكوزي', price: 200, sortOrder: 1 },
  { type: 'sauna', name: 'Sauna', nameAr: 'ساونا', price: 150, sortOrder: 2 },
];

const SESSION_ICONS = {
  spa: '🧖',
  jacuzzi: '🛁',
  sauna: '♨️',
};

function formatSessionRow(row) {
  return {
    id: row.id,
    gymId: row.gymId,
    type: row.type,
    name: row.name,
    nameAr: row.nameAr,
    price: row.price,
    currency: row.currency,
    isActive: row.isActive,
    icon: SESSION_ICONS[row.type] ?? '✨',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function formatBookingRow(row) {
  return {
    id: row.id,
    gymId: row.gymId,
    sessionId: row.sessionId,
    userId: row.userId,
    paidAmount: row.paidAmount,
    paymentMethod: row.paymentMethod,
    status: row.status,
    notes: row.notes,
    createdAt: row.createdAt,
    user: row.user ?? null,
    session: row.session
      ? {
          id: row.session.id,
          type: row.session.type,
          name: row.session.name,
          nameAr: row.session.nameAr,
          price: row.session.price,
        }
      : null,
  };
}

async function seedBasicSessions(gymId) {
  if (!hasBasicSessionModel()) {
    console.warn('[gymBasicSessions] Prisma model missing — run: npx prisma generate');
    return;
  }
  try {
    for (const item of DEFAULT_BASIC_SESSIONS) {
      const existing = await prisma.gymBasicSession.findFirst({
        where: { gymId, type: item.type },
      });
      if (!existing) {
        await prisma.gymBasicSession.create({
          data: {
            gymId,
            type: item.type,
            name: item.name,
            nameAr: item.nameAr,
            price: item.price,
          },
        });
      }
    }
  } catch (err) {
    if (isMissingBasicSessionResource(err)) {
      console.warn('[gymBasicSessions] tables missing — run: node scripts/ensure-gym-basic-sessions.js');
      return;
    }
    throw err;
  }
}

async function ensureBasicSessionsForGym(gymId) {
  if (!hasBasicSessionModel()) return [];
  try {
    await seedBasicSessions(gymId);
    const rows = await prisma.gymBasicSession.findMany({
      where: { gymId },
      orderBy: [{ type: 'asc' }],
    });
    return rows.map(formatSessionRow);
  } catch (err) {
    if (isMissingBasicSessionResource(err)) return [];
    throw err;
  }
}

function gymTodayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

module.exports = {
  BASIC_SESSION_TYPES,
  DEFAULT_BASIC_SESSIONS,
  SESSION_ICONS,
  formatSessionRow,
  formatBookingRow,
  seedBasicSessions,
  ensureBasicSessionsForGym,
  gymTodayBounds,
};
