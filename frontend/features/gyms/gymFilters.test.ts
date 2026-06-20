import { describe, it, expect } from 'vitest';
import type { Gym } from '../../types';
import {
  applyGymFilters,
  buildGymFilterOptions,
  DEFAULT_GYM_FILTERS,
  extractGymCity,
  gymMatchesSearch,
  sanitizeGymFilters,
} from './gymFilters';

const SEED_GYMS: Gym[] = [
  {
    id: '1',
    ownerId: 'a',
    name: 'Iron House Gym',
    location: 'Cairo, Maadi',
    maxCapacity: 250,
    amenities: 'Free weights, Sauna, Showers',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    currentOccupancy: 0,
    latitude: 30.0128,
    longitude: 31.2819,
  },
  {
    id: '2',
    ownerId: 'b',
    name: 'Pulse Fitness Studio',
    location: 'Alexandria, Smouha',
    maxCapacity: 180,
    amenities: 'Yoga, Spin, Crossfit Box',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    currentOccupancy: 0,
    latitude: 31.2156,
    longitude: 29.9425,
  },
  {
    id: '3',
    ownerId: 'c',
    name: 'Flow Yoga & Pilates',
    location: 'Giza, Sheikh Zayed',
    maxCapacity: 80,
    amenities: 'Heated Yoga, Pilates',
    isActive: true,
    createdAt: '',
    updatedAt: '',
    currentOccupancy: 0,
    latitude: 30.0287,
    longitude: 30.9783,
  },
];

describe('gymFilters', () => {
  it('extracts city from location', () => {
    expect(extractGymCity('Cairo, Maadi')).toBe('Cairo');
    expect(extractGymCity('Giza, Sheikh Zayed')).toBe('Giza');
  });

  it('builds filter options from seed gyms', () => {
    const options = buildGymFilterOptions(SEED_GYMS);
    expect(options.areas.map((a) => a.city)).toEqual(['Alexandria', 'Cairo', 'Giza']);
    expect(options.occupancy.quiet).toBe(3);
    expect(options.amenities.some((a) => a.id === 'yoga_studio')).toBe(true);
    expect(options.amenities.some((a) => a.id === 'swimming_pool')).toBe(false);
  });

  it('matches heated yoga amenities in search and filters', () => {
    expect(gymMatchesSearch(SEED_GYMS[2], 'pilates')).toBe(true);
    expect(gymMatchesSearch(SEED_GYMS[2], 'heated')).toBe(true);

    const filtered = applyGymFilters(SEED_GYMS, {
      query: '',
      filters: { ...DEFAULT_GYM_FILTERS, amenities: ['yoga_studio'] },
      isMember: () => false,
    });
    expect(filtered.map((g) => g.name)).toEqual(['Pulse Fitness Studio', 'Flow Yoga & Pilates']);
  });

  it('filters by city', () => {
    const filtered = applyGymFilters(SEED_GYMS, {
      query: '',
      filters: { ...DEFAULT_GYM_FILTERS, areas: ['Cairo'] },
      isMember: () => false,
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('Iron House Gym');
  });

  it('filters membership gyms only', () => {
    const filtered = applyGymFilters(SEED_GYMS, {
      query: '',
      filters: { ...DEFAULT_GYM_FILTERS, membership: 'mine' },
      isMember: (id) => id === '2',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('2');
  });

  it('sanitizes stale filter selections when gym list changes', () => {
    const dirty = {
      ...DEFAULT_GYM_FILTERS,
      areas: ['Cairo', 'Luxor'],
      amenities: ['swimming_pool', 'yoga_studio'],
    };
    const clean = sanitizeGymFilters(dirty, SEED_GYMS);
    expect(clean.areas).toEqual(['Cairo']);
    expect(clean.amenities).toEqual(['yoga_studio']);
  });
});
