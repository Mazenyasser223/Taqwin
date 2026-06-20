import type { Gym } from '../../types';
import { parseGymAmenities, type GymAmenityId } from '../../lib/gymAmenities';
import { distanceKm, resolveGymCoordinates } from '../../lib/gymGeo';

export type GymOccupancyFilter = 'all' | 'quiet' | 'active' | 'busy';
export type GymMembershipFilter = 'all' | 'mine';
export type GymSortOption = 'default' | 'nearest' | 'name' | 'leastBusy';

export interface GymFilterState {
  areas: string[];
  occupancy: GymOccupancyFilter;
  membership: GymMembershipFilter;
  amenities: GymAmenityId[];
  sort: GymSortOption;
}

export const DEFAULT_GYM_FILTERS: GymFilterState = {
  areas: [],
  occupancy: 'all',
  membership: 'all',
  amenities: [],
  sort: 'default',
};

export interface GymFilterOptionCounts {
  areas: Array<{ city: string; count: number; sampleLocation: string }>;
  amenities: Array<{ id: GymAmenityId; count: number }>;
  occupancy: Record<GymOccupancyFilter, number>;
}

/** City part before comma — matches Cairo / Alexandria / Giza in seed data. */
export function extractGymCity(location: string): string {
  const trimmed = location.trim();
  if (!trimmed) return '';
  return trimmed.split(',')[0]?.trim() || trimmed;
}

export function getGymOccupancyStatus(gym: Gym): 'quiet' | 'active' | 'busy' {
  const presentNow = gym.currentOccupancy ?? 0;
  const maxCapacity = gym.maxCapacity || 100;
  const utilization = maxCapacity ? (presentNow / maxCapacity) * 100 : 0;
  if (utilization > 75) return 'busy';
  if (utilization > 30) return 'active';
  return 'quiet';
}

export function buildGymFilterOptions(gyms: Gym[]): GymFilterOptionCounts {
  const areaCounts = new Map<string, { count: number; sampleLocation: string }>();
  const amenityCounts = new Map<GymAmenityId, number>();
  const occupancy: Record<GymOccupancyFilter, number> = {
    all: gyms.length,
    quiet: 0,
    active: 0,
    busy: 0,
  };

  for (const gym of gyms) {
    const city = extractGymCity(gym.location);
    if (city) {
      const prev = areaCounts.get(city);
      areaCounts.set(city, {
        count: (prev?.count ?? 0) + 1,
        sampleLocation: prev?.sampleLocation ?? gym.location,
      });
    }

    for (const id of parseGymAmenities(gym.amenities)) {
      amenityCounts.set(id, (amenityCounts.get(id) ?? 0) + 1);
    }

    occupancy[getGymOccupancyStatus(gym)] += 1;
  }

  return {
    areas: [...areaCounts.entries()]
      .map(([city, meta]) => ({ city, count: meta.count, sampleLocation: meta.sampleLocation }))
      .sort((a, b) => a.city.localeCompare(b.city)),
    amenities: [...amenityCounts.entries()]
      .map(([id, count]) => ({ id, count }))
      .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id)),
    occupancy,
  };
}

export function sanitizeGymFilters(filters: GymFilterState, gyms: Gym[]): GymFilterState {
  if (gyms.length === 0) return DEFAULT_GYM_FILTERS;
  const options = buildGymFilterOptions(gyms);
  const validAreas = new Set(options.areas.map((a) => a.city));
  const validAmenities = new Set(options.amenities.map((a) => a.id));
  return {
    ...filters,
    areas: filters.areas.filter((city) => validAreas.has(city)),
    amenities: filters.amenities.filter((id) => validAmenities.has(id)),
  };
}

export function countActiveGymFilters(filters: GymFilterState): number {
  let count = 0;
  if (filters.areas.length > 0) count += 1;
  if (filters.occupancy !== 'all') count += 1;
  if (filters.membership !== 'all') count += 1;
  if (filters.amenities.length > 0) count += 1;
  if (filters.sort !== 'default') count += 1;
  return count;
}

export function gymSearchHaystack(gym: Gym): string {
  return [gym.name, gym.location, gym.bio ?? '', gym.amenities ?? '', ...parseGymAmenities(gym.amenities)]
    .join(' ')
    .toLowerCase();
}

export function gymMatchesSearch(gym: Gym, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return gymSearchHaystack(gym).includes(q);
}

export function applyGymFilters(
  gyms: Gym[],
  opts: {
    query: string;
    filters: GymFilterState;
    isMember: (id: string) => boolean;
    userPos?: { lat: number; lng: number } | null;
    language?: string;
  },
): Gym[] {
  let result = gyms.filter((gym) => {
    if (!gymMatchesSearch(gym, opts.query)) return false;

    if (opts.filters.areas.length > 0) {
      const city = extractGymCity(gym.location);
      if (!opts.filters.areas.includes(city)) return false;
    }

    if (opts.filters.membership === 'mine' && !opts.isMember(gym.id)) return false;

    if (opts.filters.occupancy !== 'all' && getGymOccupancyStatus(gym) !== opts.filters.occupancy) {
      return false;
    }

    if (opts.filters.amenities.length > 0) {
      const gymAmenities = parseGymAmenities(gym.amenities);
      const matchesAny = opts.filters.amenities.some((id) => gymAmenities.includes(id));
      if (!matchesAny) return false;
    }

    return true;
  });

  if (opts.filters.sort === 'name') {
    const locale = opts.language === 'ar' ? 'ar' : 'en';
    result = [...result].sort((a, b) => a.name.localeCompare(b.name, locale));
  } else if (opts.filters.sort === 'leastBusy') {
    result = [...result].sort((a, b) => {
      const ua = (a.currentOccupancy ?? 0) / (a.maxCapacity || 100);
      const ub = (b.currentOccupancy ?? 0) / (b.maxCapacity || 100);
      return ua - ub;
    });
  } else if (opts.filters.sort === 'nearest' && opts.userPos) {
    result = [...result].sort((a, b) => {
      const ca = resolveGymCoordinates(a);
      const cb = resolveGymCoordinates(b);
      if (!ca && !cb) return 0;
      if (!ca) return 1;
      if (!cb) return -1;
      return (
        distanceKm(opts.userPos!.lat, opts.userPos!.lng, ca.lat, ca.lng)
        - distanceKm(opts.userPos!.lat, opts.userPos!.lng, cb.lat, cb.lng)
      );
    });
  }

  return result;
}
