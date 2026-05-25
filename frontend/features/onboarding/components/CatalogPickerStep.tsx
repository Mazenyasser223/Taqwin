import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import exerciseService from '../../../services/exerciseService';
import nutritionService from '../../../services/nutritionService';
import type { Exercise, FdcCategory, FdcFoodPreview } from '../../../types';
import type { CatalogHint, CatalogPickItem, OnboardingAnswers } from '../types';
import { exerciseImageUrl, foodImageUrl, categoryChipImage } from '../lib/catalogImages';
import { resolveExerciseDisplayName, localizeMuscleLabel } from '../../workouts/exerciseLocale';
import { resolveCatalogPickName } from '../catalogLocale';

const EXERCISE_FALLBACK =
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=600';

export interface CatalogPickerStepProps {
  stepId: string;
  catalog: 'exercise' | 'food';
  multi?: boolean;
  maxSelect?: number;
  minSelect?: number;
  categoryId?: string;
  searchHints?: CatalogHint[];
  optional?: boolean;
  answers: OnboardingAnswers;
  onAnswer: (stepId: string, value: CatalogPickItem[]) => void;
  onContinue: () => void;
}

function parseSelections(raw: unknown): CatalogPickItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is CatalogPickItem =>
      x != null && typeof x === 'object' && 'id' in x && 'name' in x && 'catalog' in x,
  );
}

function CatalogTile({
  imageUrl,
  title,
  subtitle,
  selected,
  onToggle,
}: {
  imageUrl: string;
  title: string;
  subtitle?: string;
  selected: boolean;
  onToggle: () => void;
}) {
  const [imgSrc, setImgSrc] = useState(imageUrl);
  return (
    <motion.button
      type="button"
      layout
      onClick={onToggle}
      whileTap={{ scale: 0.96 }}
      className={`relative overflow-hidden rounded-2xl border text-left transition-all ${
        selected
          ? 'border-primary ring-2 ring-primary/40 shadow-lg shadow-primary/15'
          : 'border-subtle/80 bg-surface/50 hover:border-primary/35'
      }`}
    >
      <motion.div className="aspect-[4/3] w-full overflow-hidden bg-black/20">
        <img
          src={imgSrc}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgSrc(EXERCISE_FALLBACK)}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        {selected && (
          <span className="absolute top-2 end-2 size-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-base">check</span>
          </span>
        )}
      </motion.div>
      <div className="p-2.5">
        <p className="text-xs sm:text-sm font-bold leading-snug line-clamp-2">{title}</p>
        {subtitle && <p className="text-[10px] text-faint mt-0.5">{subtitle}</p>}
      </div>
    </motion.button>
  );
}

export const CatalogPickerStep: React.FC<CatalogPickerStepProps> = ({
  stepId,
  catalog,
  multi = true,
  maxSelect = 12,
  minSelect = 0,
  categoryId: defaultCategoryId,
  searchHints = [],
  optional = false,
  answers,
  onAnswer,
  onContinue,
}) => {
  const { t, language } = useI18n();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? '');
  const [categories, setCategories] = useState<FdcCategory[]>([]);
  const [exerciseCategories, setExerciseCategories] = useState<{ category: string; count: number }[]>([]);
  const [exerciseCategory, setExerciseCategory] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [foods, setFoods] = useState<FdcFoodPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => parseSelections(answers[stepId]), [answers, stepId]);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const loadGen = useRef(0);

  useEffect(() => {
    setCategoryId(defaultCategoryId ?? '');
    setExerciseCategory('');
    setSearch('');
    setDebounced('');
  }, [stepId, defaultCategoryId]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 320);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (catalog === 'food') {
      nutritionService.getCategories().then((res) => {
        if (res.data?.categories) setCategories(res.data.categories);
      });
      return;
    }
    exerciseService.getCategories().then((res) => {
      if (res.data) setExerciseCategories(res.data.slice(0, 12));
    });
  }, [catalog]);

  const loadCatalog = useCallback(async () => {
    const gen = ++loadGen.current;
    setLoading(true);
    setError(null);

    if (catalog === 'exercise') {
      const res = await exerciseService.list({
        search: debounced || undefined,
        category: exerciseCategory || undefined,
        page: 1,
        locale: language,
      });
      if (gen !== loadGen.current) return;
      if (res.error) setError(res.error);
      else setExercises(res.data?.items ?? []);
    } else {
      const res = await nutritionService.searchFoods({
        q: debounced || undefined,
        categoryId: categoryId || undefined,
        page: 1,
        pageSize: 24,
      });
      if (gen !== loadGen.current) return;
      if (res.error) setError(res.error);
      else setFoods(res.data?.foods ?? []);
    }
    setLoading(false);
  }, [catalog, debounced, categoryId, exerciseCategory, language]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const toggleExercise = (ex: Exercise) => {
    const item: CatalogPickItem = {
      id: ex.id,
      name: ex.name,
      nameAr: ex.nameAr ?? null,
      nameEn: ex.name,
      imageUrl: exerciseImageUrl(ex),
      catalog: 'exercise',
    };
    if (!multi) {
      onAnswer(stepId, [item]);
      return;
    }
    if (selectedIds.has(ex.id)) {
      onAnswer(stepId, selected.filter((s) => s.id !== ex.id));
      return;
    }
    if (selected.length >= maxSelect) return;
    onAnswer(stepId, [...selected, item]);
  };

  const toggleFood = (food: FdcFoodPreview) => {
    const id = String(food.webtebId ?? food.id ?? food.name);
    const item: CatalogPickItem = {
      id,
      name: food.nameEn || food.name,
      nameAr: food.name,
      nameEn: food.nameEn ?? null,
      imageUrl: foodImageUrl(food),
      catalog: 'food',
    };
    if (!multi) {
      onAnswer(stepId, [item]);
      return;
    }
    if (selectedIds.has(id)) {
      onAnswer(stepId, selected.filter((s) => s.id !== id));
      return;
    }
    if (selected.length >= maxSelect) return;
    onAnswer(stepId, [...selected, item]);
  };

  const applyHint = (hint: CatalogHint) => {
    setSearch(hint.query);
    if (hint.categoryId) setCategoryId(hint.categoryId);
  };

  const canContinue = optional ? true : selected.length >= Math.max(minSelect, 1);

  return (
    <div className="space-y-3 font-[Cairo,'Space_Grotesk',sans-serif]">
      {selected.length > 0 && (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-2.5">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-2 px-1">
            {t('onboarding.catalog.selected', { count: String(selected.length) })}
          </p>
          <motion.div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {selected.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAnswer(stepId, selected.filter((s) => s.id !== item.id))}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-surface border border-subtle pl-1 pr-2 py-1 hover:border-red-400/50"
              >
                <img src={item.imageUrl} alt="" className="size-9 rounded-lg object-cover" />
                <span className="text-xs font-bold max-w-[7rem] truncate">{resolveCatalogPickName(item, language)}</span>
                <span className="material-symbols-outlined text-sm text-faint">close</span>
              </button>
            ))}
          </motion.div>
        </div>
      )}

      <div className="relative">
        <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-faint text-lg">
          search
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            catalog === 'exercise'
              ? t('onboarding.catalog.searchExercises')
              : t('onboarding.catalog.searchFoods')
          }
          className="w-full rounded-2xl border border-subtle bg-surface/80 ps-10 pe-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>

      {searchHints.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchHints.map((hint) => (
            <button
              key={hint.label}
              type="button"
              onClick={() => applyHint(hint)}
              className="text-xs font-bold px-3 py-1.5 rounded-full border border-subtle bg-elevated/60 hover:border-primary/40 hover:text-primary"
            >
              {hint.label}
            </button>
          ))}
        </div>
      )}

      {catalog === 'exercise' && exerciseCategories.length > 0 && (
        <motion.div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setExerciseCategory('')}
            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold ${
              !exerciseCategory ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface/60'
            }`}
          >
            {t('onboarding.catalog.allExercises')}
          </button>
          {exerciseCategories.map((cat) => (
            <button
              key={cat.category}
              type="button"
              onClick={() => setExerciseCategory(cat.category)}
              className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-bold capitalize ${
                exerciseCategory === cat.category ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface/60'
              }`}
            >
              {cat.category.replace(/_/g, ' ')}
            </button>
          ))}
        </motion.div>
      )}

      {catalog === 'food' && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar -mx-1 px-1">
          <button
            type="button"
            onClick={() => setCategoryId('')}
            className={`shrink-0 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs font-bold ${
              !categoryId ? 'border-primary bg-primary/10 text-primary' : 'border-subtle bg-surface/60'
            }`}
          >
            {t('onboarding.catalog.allFoods')}
          </button>
          {categories.slice(0, 14).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setCategoryId(cat.id)}
              className={`shrink-0 flex items-center gap-2 rounded-xl border px-2 py-1.5 ${
                categoryId === cat.id ? 'border-primary bg-primary/10' : 'border-subtle bg-surface/60'
              }`}
            >
              <img
                src={categoryChipImage(cat.id)}
                alt=""
                className="size-7 rounded-lg object-cover"
              />
              <span className="text-[10px] font-bold max-w-[5.5rem] truncate">
                {cat.nameAr || cat.query}
              </span>
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400 text-center">{error}</p>}

      {loading ? (
        <p className="text-sm text-faint text-center py-8 animate-pulse">{t('onboarding.catalog.loading')}</p>
      ) : (
        <motion.div layout className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[min(50vh,420px)] overflow-y-auto custom-scrollbar pe-0.5">
          <AnimatePresence mode="popLayout">
            {catalog === 'exercise'
              ? exercises.map((ex) => (
                  <CatalogTile
                    key={ex.id}
                    imageUrl={exerciseImageUrl(ex)}
                    title={resolveExerciseDisplayName(ex, language)}
                    subtitle={ex.primaryMuscles?.[0] ? localizeMuscleLabel(ex.primaryMuscles[0], language) : undefined}
                    selected={selectedIds.has(ex.id)}
                    onToggle={() => toggleExercise(ex)}
                  />
                ))
              : foods.map((food) => {
                  const fid = String(food.webtebId ?? food.id ?? food.name);
                  return (
                    <CatalogTile
                      key={fid}
                      imageUrl={foodImageUrl(food)}
                      title={food.nameEn || food.name}
                      subtitle={`${Math.round(food.calories)} kcal · ${Math.round(food.protein)}g P`}
                      selected={selectedIds.has(fid)}
                      onToggle={() => toggleFood(food)}
                    />
                  );
                })}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && catalog === 'exercise' && exercises.length === 0 && (
        <p className="text-sm text-faint text-center py-6">{t('onboarding.catalog.empty')}</p>
      )}
      {!loading && catalog === 'food' && foods.length === 0 && (
        <p className="text-sm text-faint text-center py-6">{t('onboarding.catalog.empty')}</p>
      )}

      <motion.button
        type="button"
        disabled={!canContinue}
        onClick={onContinue}
        whileTap={canContinue ? { scale: 0.98 } : undefined}
        className="w-full py-3.5 rounded-2xl bg-primary text-white font-black text-sm disabled:opacity-40 shadow-lg shadow-primary/20"
      >
        {optional && selected.length === 0
          ? t('onboarding.catalog.skipStep')
          : t('common.continue')}
      </motion.button>
    </div>
  );
};
