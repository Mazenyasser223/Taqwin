/** Build check-in chart buckets for gym owner dashboard. */

const VALID_RANGES = new Set(['1m', '6m', '1y']);

function parseCheckInsRange(raw) {
  const v = String(raw || '6m').toLowerCase();
  return VALID_RANGES.has(v) ? v : '6m';
}

function buildCheckInSeries(range, now = new Date()) {
  if (range === '1m') {
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const monthStart = new Date(Date.UTC(year, month, 1));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const series = Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const d = new Date(Date.UTC(year, month, day));
      return {
        month: String(day),
        label: d.toLocaleString('en-US', { day: 'numeric', month: 'short' }),
        date: d.toISOString().slice(0, 10),
        checkIns: 0,
      };
    });
    return { series, since: monthStart, range: '1m' };
  }

  const months = range === '1y' ? 12 : 6;
  const offset = months - 1;
  const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
  const series = Array.from({ length: months }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset + i, 1));
    return {
      month: d.toLocaleString('en-US', { month: 'short' }),
      label: d.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      date: d.toISOString().slice(0, 7),
      checkIns: 0,
    };
  });
  return { series, since, range };
}

function aggregateCheckIns(series, checkIns, range) {
  for (const c of checkIns) {
    const key =
      range === '1m'
        ? c.checkedInAt.toISOString().slice(0, 10)
        : c.checkedInAt.toISOString().slice(0, 7);
    const bucket = series.find((s) => s.date === key);
    if (bucket) bucket.checkIns += 1;
  }
  return series;
}

function applyBucketCounts(series, bucketRows) {
  const counts = new Map(
    bucketRows.map((row) => [String(row.bucket), Number(row.count) || 0]),
  );
  for (const bucket of series) {
    bucket.checkIns = counts.get(bucket.date) ?? 0;
  }
  return series;
}

function dayBounds(dateKey) {
  const gte = new Date(`${dateKey}T00:00:00.000Z`);
  const lt = new Date(gte);
  lt.setUTCDate(lt.getUTCDate() + 1);
  return { gte, lt };
}

function monthBounds(dateKey) {
  const [y, m] = dateKey.split('-').map(Number);
  return {
    gte: new Date(Date.UTC(y, m - 1, 1)),
    lt: new Date(Date.UTC(y, m, 1)),
  };
}

/** Count per chart bucket (indexed) instead of loading every check-in row. */
async function fetchCheckInAggregates(prisma, gymId, series, range) {
  const bucketRows = await Promise.all(
    series.map(async (bucket) => {
      const { gte, lt } = range === '1m' ? dayBounds(bucket.date) : monthBounds(bucket.date);
      const count = await prisma.gymCheckIn.count({
        where: { gymId, checkedInAt: { gte, lt } },
      });
      return { bucket: bucket.date, count };
    }),
  );
  return { bucketRows };
}

async function buildCheckInSeriesForGym(prisma, gymId, range, now = new Date()) {
  const { series, range: parsedRange } = buildCheckInSeries(range, now);
  const { bucketRows } = await fetchCheckInAggregates(prisma, gymId, series, parsedRange);
  applyBucketCounts(series, bucketRows);
  return { monthlySeries: series, checkInsRange: parsedRange };
}

module.exports = {
  parseCheckInsRange,
  buildCheckInSeries,
  aggregateCheckIns,
  applyBucketCounts,
  fetchCheckInAggregates,
  buildCheckInSeriesForGym,
};
