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

async function fetchCheckInAggregates(prisma, gymId, checkInsSince, weekAgo, range) {
  const rows = await prisma.gymCheckIn.findMany({
    where: { gymId, checkedInAt: { gte: checkInsSince } },
    select: { checkedInAt: true },
  });
  const bucketRows = new Map();
  for (const row of rows) {
    const key =
      range === '1m'
        ? row.checkedInAt.toISOString().slice(0, 10)
        : row.checkedInAt.toISOString().slice(0, 7);
    bucketRows.set(key, (bucketRows.get(key) ?? 0) + 1);
  }
  const weekCheckIns = rows.filter((row) => row.checkedInAt >= weekAgo).length;
  return {
    bucketRows: [...bucketRows.entries()].map(([bucket, count]) => ({ bucket, count })),
    weekCheckIns,
  };
}

async function buildCheckInSeriesForGym(prisma, gymId, range, now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const { series, since, range: parsedRange } = buildCheckInSeries(range, now);
  const { bucketRows, weekCheckIns } = await fetchCheckInAggregates(
    prisma,
    gymId,
    since,
    weekAgo,
    parsedRange,
  );
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
