import type { TranslationKey } from './i18n/translations';

export const GYM_AMENITY_IDS = [
  'swimming_pool',
  'sauna_steam',
  'free_parking',
  'protein_cafe',
  'showers',
  'secure_lockers',
  'personal_training',
  'yoga_studio',
  'free_weights',
  'music_system',
  'air_conditioned',
  'wifi_access',
] as const;

export type GymAmenityId = (typeof GYM_AMENITY_IDS)[number];

export const GYM_AMENITY_CATALOG: ReadonlyArray<{
  id: GymAmenityId;
  icon: string;
  labelKey: TranslationKey;
}> = [
  { id: 'swimming_pool', icon: '🏊', labelKey: 'gymAmenity.swimming_pool' },
  { id: 'sauna_steam', icon: '♨️', labelKey: 'gymAmenity.sauna_steam' },
  { id: 'free_parking', icon: '🅿️', labelKey: 'gymAmenity.free_parking' },
  { id: 'protein_cafe', icon: '🥤', labelKey: 'gymAmenity.protein_cafe' },
  { id: 'showers', icon: '🚿', labelKey: 'gymAmenity.showers' },
  { id: 'secure_lockers', icon: '🔐', labelKey: 'gymAmenity.secure_lockers' },
  { id: 'personal_training', icon: '💪', labelKey: 'gymAmenity.personal_training' },
  { id: 'yoga_studio', icon: '🧘', labelKey: 'gymAmenity.yoga_studio' },
  { id: 'free_weights', icon: '🏋️', labelKey: 'gymAmenity.free_weights' },
  { id: 'music_system', icon: '🎵', labelKey: 'gymAmenity.music_system' },
  { id: 'air_conditioned', icon: '❄️', labelKey: 'gymAmenity.air_conditioned' },
  { id: 'wifi_access', icon: '📶', labelKey: 'gymAmenity.wifi_access' },
];

const ID_SET = new Set<string>(GYM_AMENITY_IDS);

/** Map legacy free-text amenities from seed / old profiles to catalog ids. */
const LEGACY_ALIASES: Record<string, GymAmenityId> = {
  'swimming pool': 'swimming_pool',
  'pool': 'swimming_pool',
  'sauna': 'sauna_steam',
  'steam': 'sauna_steam',
  'sauna & steam': 'sauna_steam',
  'parking': 'free_parking',
  'free parking': 'free_parking',
  'café': 'protein_cafe',
  'cafe': 'protein_cafe',
  'protein cafe': 'protein_cafe',
  'protein café': 'protein_cafe',
  'showers': 'showers',
  'lockers': 'secure_lockers',
  'secure lockers': 'secure_lockers',
  'personal training': 'personal_training',
  'yoga': 'yoga_studio',
  'yoga studio': 'yoga_studio',
  'pilates': 'yoga_studio',
  'heated yoga': 'yoga_studio',
  'heated pilates': 'yoga_studio',
  'free weights': 'free_weights',
  'weights': 'free_weights',
  'music': 'music_system',
  'music system': 'music_system',
  'air conditioned': 'air_conditioned',
  'ac': 'air_conditioned',
  'a/c': 'air_conditioned',
  'wifi': 'wifi_access',
  'wi-fi': 'wifi_access',
  'wifi access': 'wifi_access',
  'crossfit box': 'free_weights',
  'spin': 'music_system',
};

function normalizeToken(raw: string): string {
  return raw.trim().toLowerCase();
}

function tokenToId(token: string): GymAmenityId | null {
  if (ID_SET.has(token)) return token as GymAmenityId;
  return LEGACY_ALIASES[normalizeToken(token)] ?? null;
}

/** Parse stored amenities (comma/newline separated ids or legacy labels). */
export function parseGymAmenities(raw: unknown): GymAmenityId[] {
  const text = raw == null ? '' : Array.isArray(raw) ? raw.join(',') : String(raw);
  const seen = new Set<GymAmenityId>();
  const out: GymAmenityId[] = [];
  for (const part of text.split(/[,\n]/)) {
    const id = tokenToId(part);
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

export function serializeGymAmenities(ids: GymAmenityId[]): string {
  return ids.join(',');
}

export function amenityLabel(
  token: string,
  t: (key: TranslationKey, params?: Record<string, string>) => string,
): string {
  const id = tokenToId(token);
  if (id) {
    const entry = GYM_AMENITY_CATALOG.find((a) => a.id === id);
    if (entry) return t(entry.labelKey);
  }
  return token.trim();
}

export function listGymAmenityLabels(
  raw: unknown,
  t: (key: TranslationKey, params?: Record<string, string>) => string,
): string[] {
  return parseGymAmenities(raw).map((id) => {
    const entry = GYM_AMENITY_CATALOG.find((a) => a.id === id);
    return entry ? t(entry.labelKey) : id;
  });
}
