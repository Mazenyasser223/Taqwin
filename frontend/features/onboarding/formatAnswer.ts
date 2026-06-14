import type { OnboardingAnswers, OnboardingStep, CatalogPickItem } from './types';



function isCatalogPickItem(x: unknown): x is CatalogPickItem {

  return x != null && typeof x === 'object' && 'id' in x && 'name' in x && 'catalog' in x;

}



import type { AppLanguage } from '../../services/settingsService';

import { normalizeCatalogDisplayName, resolveCatalogPickName } from './catalogLocale';



export function formatAnswerText(

  step: OnboardingStep,

  answers: OnboardingAnswers,

  language: AppLanguage = 'en',

): string | null {

  const raw = answers[step.id] ?? ('field' in step ? answers[step.field] : undefined);



  if (step.type === 'catalogPicker') {

    const parts: string[] = [];

    if (Array.isArray(raw)) {

      const picks = raw.filter(isCatalogPickItem);

      if (picks.length) {

        parts.push(...picks.map((p) => resolveCatalogPickName(p, language)));

      } else if (raw.length) {

        parts.push(
          ...raw.map((entry) => {
            if (entry != null && typeof entry === 'object' && 'name' in entry) {
              return resolveCatalogPickName(entry as CatalogPickItem, language);
            }
            return normalizeCatalogDisplayName(entry, String(entry));
          }),
        );

      }

    }

    const customField = step.customTextField ?? (step.id === 'foodsExcluded' ? 'foodsExcludedCustom' : null);

    if (customField && typeof answers[customField] === 'string') {

      const custom = answers[customField].trim();

      if (custom) parts.push(custom);

    }

    if (step.allowDislike && step.dislikeField) {
      const dislikedRaw = answers[step.dislikeField];
      if (Array.isArray(dislikedRaw)) {
        const disliked = dislikedRaw.filter(isCatalogPickItem);
        if (disliked.length) {
          const label = language === 'ar' ? 'غير مفضل: ' : 'Not preferred: ';
          parts.push(label + disliked.map((p) => resolveCatalogPickName(p, language)).join('، '));
        }
      }
    }

    return parts.length ? parts.join('، ') : null;

  }



  if (step.type === 'mealsSnacks') {

    const mealsField = step.mealsField ?? 'mealsPerDay';

    const snacksField = step.snacksField ?? 'snacksPerDay';

    const meals = answers[mealsField];

    const snacks = answers[snacksField];

    if (meals === undefined || meals === null || meals === '') return null;

    if (snacks === undefined || snacks === null || snacks === '') return null;

    if (language === 'ar') {

      return `${meals} وجبات · ${snacks} سناكس`;

    }

    return `${meals} meals · ${snacks} snacks`;

  }



  if (raw === undefined || raw === null || raw === '') return null;



  if (step.type === 'single' || step.type === 'multi') {

    const values = Array.isArray(raw) ? raw : [String(raw)];

    const otherDetail =

      step.id === 'otherSports' && typeof answers.otherSportsOther === 'string'

        ? answers.otherSportsOther.trim()

        : step.id === 'foodAllergies' && typeof answers.foodAllergiesOther === 'string'

          ? answers.foodAllergiesOther.trim()

          : step.id === 'medicalHistory' && typeof answers.medicalHistoryDetails === 'string'

            ? answers.medicalHistoryDetails.trim()

            : '';

    const formatted = values

      .map(v => {

        if (v === 'other' && otherDetail && step.id !== 'medicalHistory') return otherDetail;

        return step.options.find(o => o.value === v)?.label ?? v;

      })

      .join('، ');

    if (step.id === 'medicalHistory' && otherDetail) {
      return formatted ? `${formatted} — ${otherDetail}` : otherDetail;
    }

    return formatted;

  }



  if (step.type === 'slider') {

    const level = step.levels.find(l => l.value === raw);

    return level?.label ?? String(raw);

  }



  if (step.type === 'number') {

    const unit = step.unit;

    if (language === 'ar') {

      if (unit === 'kg') return `${raw} كجم`;

      if (unit === 'cm') return `${raw} سم`;

    }

    return step.unit ? `${raw} ${step.unit}` : String(raw);

  }



  if (step.type === 'likert') return String(raw);



  if (step.type === 'text') return String(raw);



  if (step.type === 'weightOptional') {

    return raw === 'unknown'

      ? language === 'ar'

        ? 'مش عارف'

        : "I don't know"

      : `${raw} kg`;

  }



  return String(raw);

}


