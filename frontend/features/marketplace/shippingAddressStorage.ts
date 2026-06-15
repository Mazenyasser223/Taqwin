export interface ShippingAddress {
  governorate: string;
  city: string;
  address: string;
  phone: string;
}

const STORAGE_KEY = 'taqwin_shipping_address';

export function readSavedShippingAddress(): ShippingAddress | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ShippingAddress;
    if (!parsed?.governorate || !parsed?.city || !parsed?.address || !parsed?.phone) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveShippingAddress(address: ShippingAddress) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(address));
}

export function validateShippingAddress(
  address: ShippingAddress,
  t: (key: string) => string
): string | null {
  if (!address.governorate.trim()) return t('marketplace.shippingGovernorateRequired');
  if (!address.city.trim()) return t('marketplace.shippingCityRequired');
  if (address.address.trim().length < 5) return t('marketplace.shippingAddressRequired');
  const phone = address.phone.replace(/\s+/g, '');
  if (!/^(\+20|0)?1[0125]\d{8}$/.test(phone)) return t('marketplace.shippingPhoneInvalid');
  return null;
}

export function normalizeShippingPhone(phone: string): string {
  const trimmed = phone.replace(/\s+/g, '');
  if (trimmed.startsWith('+20')) return trimmed;
  if (trimmed.startsWith('0')) return `+20${trimmed.slice(1)}`;
  if (trimmed.startsWith('1')) return `+20${trimmed}`;
  return trimmed;
}
