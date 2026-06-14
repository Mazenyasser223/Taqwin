/** Egypt shipping zones for Taqwin Shop (demo / MVP). */

const FREE_SHIPPING_MIN = 2000;

const GOVERNORATE_ZONES = {
  cairo: ['Cairo', 'Giza', 'Qalyubia', 'القاهرة', 'الجيزة', 'القليوبية'],
  alex: ['Alexandria', 'Alexandria Governorate', 'الإسكندرية'],
};

const ZONE_FEES = {
  cairo: { fee: 49, days: '2-3' },
  alex: { fee: 59, days: '3-4' },
  other: { fee: 79, days: '4-5' },
};

function resolveZone(governorate) {
  const g = (governorate || '').trim();
  if (!g) return 'other';
  if (GOVERNORATE_ZONES.cairo.some((x) => x.toLowerCase() === g.toLowerCase())) return 'cairo';
  if (GOVERNORATE_ZONES.alex.some((x) => x.toLowerCase() === g.toLowerCase())) return 'alex';
  return 'other';
}

function getShippingQuote(governorate, subtotal) {
  const zone = resolveZone(governorate);
  const { fee, days } = ZONE_FEES[zone];
  const freeShippingApplied = subtotal >= FREE_SHIPPING_MIN;
  const shippingFee = freeShippingApplied ? 0 : fee;
  return {
    zone,
    shippingFee,
    estimatedDays: days,
    freeShippingApplied,
    freeShippingMin: FREE_SHIPPING_MIN,
  };
}

module.exports = { FREE_SHIPPING_MIN, getShippingQuote, resolveZone, ZONE_FEES };
