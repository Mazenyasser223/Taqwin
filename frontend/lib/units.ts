import type { UnitSystem } from '../services/settingsService';

const STORAGE_KEY = 'taqwin_units';

export function applyUnitSystem(unitSystem: UnitSystem) {
  document.documentElement.dataset.units = unitSystem;
  localStorage.setItem(STORAGE_KEY, unitSystem);
}

export function bootstrapUnits() {
  const stored = localStorage.getItem(STORAGE_KEY) as UnitSystem | null;
  if (stored === 'metric' || stored === 'imperial') {
    applyUnitSystem(stored);
  }
}

export function formatWeight(kg: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    return `${(kg * 2.20462).toFixed(1)} lb`;
  }
  return `${kg.toFixed(1)} kg`;
}

export function formatHeight(cm: number, unitSystem: UnitSystem = 'metric'): string {
  if (unitSystem === 'imperial') {
    const totalIn = cm / 2.54;
    const ft = Math.floor(totalIn / 12);
    const inches = Math.round(totalIn % 12);
    return `${ft}'${inches}"`;
  }
  return `${cm} cm`;
}
