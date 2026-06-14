/** Public gym brand label — profile business name wins over stored gym.name */
function resolveGymDisplayName(gymName, businessName) {
  const brand = typeof businessName === 'string' ? businessName.trim() : '';
  if (brand) return brand;
  return typeof gymName === 'string' ? gymName.trim() : '';
}

module.exports = { resolveGymDisplayName };
