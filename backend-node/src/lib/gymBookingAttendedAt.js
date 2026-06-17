/** Helpers for attended-at revenue tracking (graceful before migration is applied). */

function isMissingAttendedAtColumn(err) {
  const msg = String(err?.message ?? err ?? '');
  return (
    err?.code === 'P2022' ||
    msg.includes('attended_at') ||
    msg.includes('attendedAt') ||
    (msg.includes('column') && msg.includes('attended'))
  );
}

function attendedStatusUpdate(status) {
  if (status === 'attended') {
    return { status, attendedAt: new Date() };
  }
  return { status };
}

async function sumAttendedBookingRevenue(prisma, model, gymId, since) {
  if (typeof prisma[model]?.findMany !== 'function') return 0;
  const attendedWhere = { gymId, status: 'attended', attendedAt: { gte: since } };
  try {
    const rows = await prisma[model].findMany({
      where: attendedWhere,
      select: { paidAmount: true },
    });
    return rows.reduce((sum, row) => sum + (row.paidAmount || 0), 0);
  } catch (err) {
    if (!isMissingAttendedAtColumn(err)) throw err;
    const rows = await prisma[model].findMany({
      where: { gymId, status: 'attended', createdAt: { gte: since } },
      select: { paidAmount: true },
    });
    return rows.reduce((sum, row) => sum + (row.paidAmount || 0), 0);
  }
}

async function updateBookingWithAttendedAt(prisma, model, where, status, include) {
  try {
    return await prisma[model].update({
      where,
      data: attendedStatusUpdate(status),
      include,
    });
  } catch (err) {
    if (!isMissingAttendedAtColumn(err) || status !== 'attended') throw err;
    return prisma[model].update({
      where,
      data: { status },
      include,
    });
  }
}

module.exports = {
  isMissingAttendedAtColumn,
  attendedStatusUpdate,
  sumAttendedBookingRevenue,
  updateBookingWithAttendedAt,
};
