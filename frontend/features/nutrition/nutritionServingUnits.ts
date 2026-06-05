import type { WebtebServingUnit } from '../../types';
import type { TranslationKey } from '../../lib/i18n/translations';
import type { AppLanguage } from '../../services/settingsService';
import { formatUnitWeightHint, localizeServingUnitLabel } from './nutritionLocale';

export type { WebtebServingUnit };

export type ServingUnitLocale = {
  language: AppLanguage;
  t: (key: TranslationKey, params?: Record<string, string>) => string;
};

export interface ServingUnitOption {
  id: string;
  label: string;
  hint?: string;
  weightGrams: number;
}

function isGramLikeLabel(label: string): boolean {
  return /غرام|جرام|^gram$/i.test(label.trim());
}

export function buildServingUnitOptions(
  units: WebtebServingUnit[],
  locale?: ServingUnitLocale
): ServingUnitOption[] {
  const opts: ServingUnitOption[] = [];
  const seen = new Set<string>();
  const language = locale?.language ?? 'ar';
  const t = locale?.t;
  const gramLabel = t ? t('nutrition.servingUnitGram') : 'غرام';

  const add = (rawLabel: string, weightGrams: number, hint?: string) => {
    if (!Number.isFinite(weightGrams) || weightGrams <= 0) return;
    const label = localizeServingUnitLabel(rawLabel, language);
    const key = `${label}|${weightGrams}`;
    if (seen.has(key)) return;
    seen.add(key);
    const localizedHint =
      hint && t && /\d/.test(hint)
        ? formatUnitWeightHint(weightGrams, t)
        : hint
          ? localizeServingUnitLabel(hint, language)
          : t
            ? formatUnitWeightHint(weightGrams, t)
            : undefined;
    opts.push({ id: key, label, hint: localizedHint, weightGrams });
  };

  for (const u of units) {
    const raw = (u.label || '').trim();
    if (!raw) continue;
    if (u.weightGrams != null && u.weightGrams > 0) {
      add(raw, u.weightGrams, u.weightText ?? undefined);
    } else if (isGramLikeLabel(raw)) {
      add(raw, 1, u.weightText ?? undefined);
    }
  }

  if (!opts.some((o) => isGramUnitOption(o))) {
    add(gramLabel, 1);
  }

  const sortLocale = language === 'ar' ? 'ar' : 'en';
  return opts.sort((a, b) => {
    const aGram = isGramUnitOption(a) ? 0 : 1;
    const bGram = isGramUnitOption(b) ? 0 : 1;
    if (aGram !== bGram) return aGram - bGram;
    return a.label.localeCompare(b.label, sortLocale);
  });
}

export function isGramUnitOption(unit: ServingUnitOption): boolean {
  return unit.weightGrams === 1 && isGramLikeLabel(unit.label);
}

export function defaultQuantityForUnit(unit: ServingUnitOption): number {
  if (isGramUnitOption(unit)) return 100;
  return 1;
}

export function computeLogGrams(quantity: number, unit: ServingUnitOption): number {
  const q = isGramUnitOption(unit)
    ? Math.max(1, quantity)
    : Math.max(1, Math.round(quantity));
  return Math.max(1, Math.round(q * unit.weightGrams));
}

/** Piece/serving units (بيضة صغيرة، كأس، …) — quantity = عدد القطع */
export function isPieceUnitOption(unit: ServingUnitOption): boolean {
  return !isGramUnitOption(unit);
}
