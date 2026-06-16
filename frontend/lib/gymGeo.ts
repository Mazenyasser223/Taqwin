/** Default map center — Cairo, Egypt */
export const EGYPT_MAP_CENTER = { lat: 30.0444, lng: 31.2357 } as const;

export const GYM_MAP_TILES = {
  url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
};

export function hasGymCoordinates(gym: { latitude?: number | null; longitude?: number | null }): gym is {
  latitude: number;
  longitude: number;
} {
  return (
    typeof gym.latitude === 'number'
    && Number.isFinite(gym.latitude)
    && typeof gym.longitude === 'number'
    && Number.isFinite(gym.longitude)
  );
}

/** Haversine distance in km */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatDistanceKm(km: number, language: string): string {
  if (km < 1) {
    const m = Math.round(km * 1000);
    return language === 'ar' ? `${m} م` : `${m} m`;
  }
  const rounded = km < 10 ? km.toFixed(1) : String(Math.round(km));
  return language === 'ar' ? `${rounded} كم` : `${rounded} km`;
}

/** Known seed / city fallbacks for legacy gyms without coordinates */
export const LOCATION_COORD_FALLBACKS: Record<string, { lat: number; lng: number }> = {
  'cairo, maadi': { lat: 30.0128, lng: 31.2819 },
  'alexandria, smouha': { lat: 31.2156, lng: 29.9425 },
  'giza, sheikh zayed': { lat: 30.0287, lng: 30.9783 },
};

export function resolveGymCoordinates(gym: {
  location: string;
  latitude?: number | null;
  longitude?: number | null;
}): { lat: number; lng: number } | null {
  if (hasGymCoordinates(gym)) {
    return { lat: gym.latitude, lng: gym.longitude };
  }
  const key = gym.location.trim().toLowerCase();
  return LOCATION_COORD_FALLBACKS[key] ?? null;
}

export function findNearestGym<T extends { location: string; latitude?: number | null; longitude?: number | null }>(
  gyms: T[],
  userPos: { lat: number; lng: number },
): { gym: T; lat: number; lng: number; distanceKm: number } | null {
  let nearest: { gym: T; lat: number; lng: number; distanceKm: number } | null = null;
  for (const gym of gyms) {
    const coords = resolveGymCoordinates(gym);
    if (!coords) continue;
    const d = distanceKm(userPos.lat, userPos.lng, coords.lat, coords.lng);
    if (!nearest || d < nearest.distanceKm) {
      nearest = { gym, lat: coords.lat, lng: coords.lng, distanceKm: d };
    }
  }
  return nearest;
}
