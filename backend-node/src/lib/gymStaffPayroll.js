/**
 * Gym staff payroll — amount calculation, mock confirm, Paymob stub.
 */

const { prisma } = require('../db');

const WORKING_HOUR_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isPaymobConfigured() {
  return Boolean(process.env.PAYMOB_API_KEY && process.env.PAYMOB_INTEGRATION_ID);
}

function normalizeWorkingHours(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((slot) => ({
      day: Number(slot.day),
      start: String(slot.start || '').slice(0, 5),
      end: String(slot.end || '').slice(0, 5),
    }))
    .filter((slot) => slot.day >= 0 && slot.day <= 6 && slot.start && slot.end);
}

function summarizeWorkingHours(workingHours) {
  const slots = normalizeWorkingHours(workingHours);
  if (!slots.length) return null;
  const sorted = [...slots].sort((a, b) => a.day - b.day);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const sameHours = sorted.every((s) => s.start === first.start && s.end === first.end);
  if (sameHours && sorted.length > 1) {
    return `${WORKING_HOUR_DAYS[first.day]}–${WORKING_HOUR_DAYS[last.day]} ${first.start}–${first.end}`;
  }
  return sorted.map((s) => `${WORKING_HOUR_DAYS[s.day]} ${s.start}–${s.end}`).join(', ');
}

function computePayAmounts({ type, baseSalary, bonusAmount = 0, bonusOnlyAmount = 0 }) {
  if (type === 'bonus') {
    const total = Number(bonusOnlyAmount) || 0;
    return { baseAmount: 0, bonusAmount: total, totalAmount: total };
  }
  const base = Number(baseSalary) || 0;
  const bonus = Number(bonusAmount) || 0;
  return { baseAmount: base, bonusAmount: bonus, totalAmount: base + bonus };
}

function resolveProvider(requested) {
  if (requested === 'cash' || requested === 'manual') return requested;
  if (requested === 'paymob') {
    if (!isPaymobConfigured()) {
      const err = new Error('Paymob payroll not configured yet — add PAYMOB_API_KEY and PAYMOB_INTEGRATION_ID');
      err.status = 503;
      throw err;
    }
    return 'paymob';
  }
  if (requested === 'mock') return 'mock';
  if (isPaymobConfigured()) return 'paymob';
  return 'mock';
}

async function assertNoDuplicateSalary(staffId, periodMonth, periodYear) {
  const existing = await prisma.gymStaffPayout.findFirst({
    where: {
      staffId,
      type: 'salary',
      periodMonth,
      periodYear,
      status: { in: ['pending', 'paid'] },
    },
  });
  if (existing) {
    const err = new Error('Salary for this month was already recorded');
    err.status = 409;
    throw err;
  }
}

async function createPaymobIntention(_payout) {
  const err = new Error('Paymob payroll not configured yet');
  err.status = 503;
  throw err;
}

/**
 * @param {{ staff: object, gymId: string, type: 'salary'|'bonus', provider?: string, bonusAmount?: number, bonusOnlyAmount?: number, periodMonth?: number, periodYear?: number, notes?: string }} input
 */
async function initiatePayout(input) {
  const { staff, gymId, type } = input;
  const provider = resolveProvider(input.provider);

  if (type === 'salary') {
    const periodMonth = input.periodMonth;
    const periodYear = input.periodYear;
    if (!periodMonth || !periodYear) {
      const err = new Error('periodMonth and periodYear are required for salary');
      err.status = 400;
      throw err;
    }
    await assertNoDuplicateSalary(staff.id, periodMonth, periodYear);
  }

  const amounts = computePayAmounts({
    type,
    baseSalary: staff.baseSalary,
    bonusAmount: input.bonusAmount,
    bonusOnlyAmount: input.bonusOnlyAmount,
  });

  if (amounts.totalAmount <= 0) {
    const err = new Error('Payout amount must be greater than zero');
    err.status = 400;
    throw err;
  }

  const isInstant = provider === 'cash' || provider === 'manual';
  const payout = await prisma.gymStaffPayout.create({
    data: {
      gymId,
      staffId: staff.id,
      type,
      baseAmount: amounts.baseAmount,
      bonusAmount: amounts.bonusAmount,
      totalAmount: amounts.totalAmount,
      periodMonth: type === 'salary' ? input.periodMonth : null,
      periodYear: type === 'salary' ? input.periodYear : null,
      provider,
      status: isInstant ? 'paid' : 'pending',
      paidAt: isInstant ? new Date() : null,
      notes: input.notes ?? null,
    },
  });

  if (provider === 'paymob') {
    const intention = await createPaymobIntention(payout);
    const updated = await prisma.gymStaffPayout.update({
      where: { id: payout.id },
      data: { externalId: intention.externalId },
    });
    return { payout: updated, checkoutUrl: intention.checkoutUrl, requiresConfirm: false };
  }

  return { payout, requiresConfirm: provider === 'mock' };
}

async function confirmMockPayout(payoutId, staffId, gymId) {
  const payout = await prisma.gymStaffPayout.findFirst({
    where: { id: payoutId, staffId, gymId },
  });
  if (!payout) {
    const err = new Error('Payout not found');
    err.status = 404;
    throw err;
  }
  if (payout.provider !== 'mock') {
    const err = new Error('Only mock payouts can be confirmed via this endpoint');
    err.status = 400;
    throw err;
  }
  if (payout.status === 'paid') {
    return payout;
  }
  return prisma.gymStaffPayout.update({
    where: { id: payout.id },
    data: { status: 'paid', paidAt: new Date() },
  });
}

function buildPayrollCsv(rows) {
  const header = 'Staff Name,Email,Role,Type,Base,Bonus,Total,Period,Status,Provider,Paid At,Notes';
  const lines = rows.map((row) => {
    const period =
      row.periodMonth && row.periodYear ? `${row.periodYear}-${String(row.periodMonth).padStart(2, '0')}` : '';
    const paidAt = row.paidAt ? new Date(row.paidAt).toISOString() : '';
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [
      escape(row.staffName),
      escape(row.email),
      escape(row.role),
      escape(row.type),
      row.baseAmount,
      row.bonusAmount,
      row.totalAmount,
      escape(period),
      escape(row.status),
      escape(row.provider),
      escape(paidAt),
      escape(row.notes),
    ].join(',');
  });
  return [header, ...lines].join('\n');
}

module.exports = {
  WORKING_HOUR_DAYS,
  isPaymobConfigured,
  normalizeWorkingHours,
  summarizeWorkingHours,
  computePayAmounts,
  resolveProvider,
  initiatePayout,
  confirmMockPayout,
  buildPayrollCsv,
};
