/** Public gym brand label — profile business name wins over stored gym.name */
export function gymBrandName(
  businessName?: string | null,
  gymName?: string | null,
): string {
  const brand = businessName?.trim();
  if (brand) return brand;
  return gymName?.trim() ?? '';
}
