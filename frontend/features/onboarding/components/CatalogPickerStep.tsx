import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from '../../../lib/i18n/useI18n';
import exerciseService from '../../../services/exerciseService';
import nutritionService from '../../../services/nutritionService';
import type { Exercise, FdcCategory, FdcFoodPreview } from '../../../types';
import type { CatalogHint, CatalogPickItem, OnboardingAnswers } from '../types';
import { exerciseImageUrl, foodImageUrl } from '../lib/catalogImages';
import { resolveExerciseDisplayName, localizeMuscleLabel } from '../../workouts/exerciseLocale';
import { formatCategoryLabel } from '../../workouts/exerciseCategories';
import { resolveCatalogPickName } from '../catalogLocale';
import { NutritionCategoryGrid } from '../../nutrition/NutritionCategoryGrid';
import { resolveCategoryLabel, resolveFoodDisplayName } from '../../nutrition/nutritionLocale';
import { taqwinIdFromSlug } from '../../nutrition/nutritionCategoryTheme';
import type { FoodSort } from '../../../types';

const normalizeCategoryId = (id?: string) => (id ? taqwinIdFromSlug(id) : '');

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
  compact?: boolean;
  allowCustomText?: boolean;
  customTextField?: string;
  categoryFilter?: string[];
  minProtein?: number;
  minCarbs?: number;
  minFat?: number;
  foodSort?: FoodSort;
  answers: OnboardingAnswers;
  onAnswer: (stepId: string, value: CatalogPickItem[]) => void;
  onContinue: (pending?: OnboardingAnswers) => void;
  hideContinue?: boolean;
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
      <div className="aspect-[4/3] w-full overflow-hidden bg-black/20 relative">
        <img
          src={imgSrc}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setImgSrc(EXERCISE_FALLBACK)}
        />
        <motion.div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        {selected && (
          <span className="absolute top-2 end-2 size-7 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
            <span className="material-symbols-outlined text-base">check</span>
          </span>
        )}
      </div>
      <div className="p-2.5">
        <p className="text-xs sm:text-sm font-bold leading-snug line-clamp-2">{title}</p>
        {subtitle && <p className="text-[10px] text-faint mt-0.5">{subtitle}</p>}
      </div>
    </motion.button>
  );
}

function ExercisePickerRow({
  exercise,
  selected,
  language,
  onToggle,
  compact = false,
}: {
  exercise: Exercise;
  selected: boolean;
  language: 'ar' | 'en';
  onToggle: () => void;
  compact?: boolean;
}) {
  const name = resolveExerciseDisplayName(exercise, language);
  const muscle = exercise.primaryMuscles?.[0]
    ? localizeMuscleLabel(exercise.primaryMuscles[0], language)
    : undefined;
  const img = exerciseImageUrl(exercise);
  const [imgSrc, setImgSrc] = useState(img);

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.99 }}
      className={`w-full flex items-center gap-2.5 rounded-xl border text-start transition-all ${
        compact ? 'px-2 py-2' : 'px-2.5 py-2.5'
      } ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-subtle bg-surface/50 hover:border-primary/35'
      }`}
    >
      <img
        src={imgSrc}
        alt=""
        className={`shrink-0 rounded-lg object-cover bg-black/20 ${compact ? 'size-10' : 'size-12'}`}
        loading="lazy"
        onError={() => setImgSrc(EXERCISE_FALLBACK)}
      />
      <div className="flex-1 min-w-0">
        <p className={`font-bold text-foreground leading-snug line-clamp-2 ${compact ? 'text-xs' : 'text-sm'}`}>
          {name}
        </p>
        {muscle && (
          <p className="text-[10px] sm:text-[11px] text-faint mt-0.5 truncate">{muscle}</p>
        )}
      </div>
      <span
        className={`shrink-0 rounded-lg border flex items-center justify-center ${
          compact ? 'size-5' : 'size-6'
        } ${selected ? 'bg-primary border-primary' : 'border-subtle bg-background/50'}`}
      >
        {selected && (
          <span className={`material-symbols-outlined text-foreground ${compact ? 'text-xs' : 'text-sm'}`}>
            check
          </span>
        )}
      </span>
    </motion.button>
  );
}

function FoodPickerRow({
  food,
  selected,
  language,
  onToggle,
  categoryLabel,
}: {
  food: FdcFoodPreview;
  selected: boolean;
  language: 'ar' | 'en';
  onToggle: () => void;
  categoryLabel: string;
}) {
  const { t } = useI18n();
  const name = resolveFoodDisplayName(food.name, food.nameEn, language);
  return (
    <motion.button
      type="button"
      onClick={onToggle}
      whileTap={{ scale: 0.99 }}
      className={`w-full flex items-center gap-3 rounded-xl border px-2.5 py-2.5 text-start transition-all ${
        selected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
          : 'border-subtle bg-surface/50 hover:border-primary/35'
      }`}
    >
      <img
        src={foodImageUrl(food)}
        alt=""
        className="size-12 shrink-0 rounded-lg object-cover bg-black/20"
        loading="lazy"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-foreground leading-snug line-clamp-2">{name}</p>
        <p className="text-[11px] text-faint mt-0.5 truncate">
          {categoryLabel} · {Math.round(food.calories)} {t('nutrition.macroCal')}
        </p>
      </div>
      <span
        className={`size-6 shrink-0 rounded-lg border flex items-center justify-center ${
          selected ? 'bg-primary border-primary' : 'border-subtle bg-background/50'
        }`}
      >
        {selected && (
          <span className="material-symbols-outlined text-foreground text-sm">check</span>
        )}
      </span>
    </motion.button>
  );
}

const stopSwipeDrag = (e: React.PointerEvent) => {
  e.stopPropagation();
};

export const CatalogPickerStep: React.FC<CatalogPickerStepProps> = ({
  stepId,
  catalog,
  multi = true,
  maxSelect = 12,
  minSelect = 0,
  categoryId: defaultCategoryId,
  searchHints = [],
  optional = false,
  compact = false,
  allowCustomText = false,
  customTextField,
  categoryFilter,
  minProtein,
  minCarbs,
  minFat,
  foodSort,
  answers,
  onAnswer,
  onContinue,
  hideContinue = false,
}) => {
  const { t, language } = useI18n();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState(() => normalizeCategoryId(defaultCategoryId));
  const [foodView, setFoodView] = useState<'categories' | 'foods'>(() =>
    catalog === 'food' ? (defaultCategoryId ? 'foods' : 'categories') : 'foods',
  );
  const [categories, setCategories] = useState<FdcCategory[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [exerciseCategories, setExerciseCategories] = useState<{ category: string; count: number }[]>([]);
  const [exerciseCategory, setExerciseCategory] = useState('');
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [foods, setFoods] = useState<FdcFoodPreview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = useMemo(() => parseSelections(answers[stepId]), [answers, stepId]);
  const selectedIds = useMemo(() => new Set(selected.map((s) => s.id)), [selected]);
  const loadGen = useRef(0);
  const [customText, setCustomText] = useState('');
  const [inputMode, setInputMode] = useState<'library' | 'custom'>('library');

  useEffect(() => {
    if (allowCustomText && customTextField) {
      const saved = String(answers[customTextField] ?? '');
      setCustomText(saved);
      setInputMode(saved.trim() ? 'custom' : 'library');
    } else {
      setCustomText('');
      setInputMode('library');
    }
  }, [stepId, allowCustomText, customTextField, answers[customTextField ?? '']]);

  useEffect(() => {
    const normalizedDefault = normalizeCategoryId(defaultCategoryId);
    setExerciseCategory('');
    setSearch('');
    setDebounced('');

    if (catalog === 'food') {
      if (normalizedDefault) {
        setCategoryId(normalizedDefault);
        setFoodView('foods');
      } else if (categoryFilter?.length && categoryFilter.length <= 3) {
        setCategoryId(normalizeCategoryId(categoryFilter[0]));
        setFoodView('foods');
      } else {
        setCategoryId('');
        setFoodView('categories');
      }
    } else {
      setCategoryId(normalizedDefault);
      setFoodView('foods');
    }
  }, [stepId, defaultCategoryId, catalog, categoryFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 320);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (catalog === 'food' && debounced) setFoodView('foods');
  }, [catalog, debounced]);

  useEffect(() => {
    if (catalog === 'food') {
      setCategoriesLoading(true);
      nutritionService.getCategories().then((res) => {
        if (res.data?.categories) setCategories(res.data.categories);
        setCategoriesLoading(false);
      });
      return;
    }
    exerciseService.getCategories().then((res) => {
      if (res.data) setExerciseCategories(res.data.slice(0, 12));
    });
  }, [catalog]);

  const showFoodCategories =
    catalog === 'food' && foodView === 'categories' && !debounced && inputMode === 'library';
  const showLibraryPanel = catalog !== 'food' || inputMode === 'library';
  const showCustomPanel = allowCustomText && customTextField && catalog === 'food' && inputMode === 'custom';

  const allowedCategoryIds = useMemo(() => {
    if (!categoryFilter?.length) return null;
    return new Set(categoryFilter.map((id) => normalizeCategoryId(id)));
  }, [categoryFilter]);

  const visibleCategories = useMemo(() => {
    if (!allowedCategoryIds) return categories;
    return categories.filter((cat) => allowedCategoryIds.has(normalizeCategoryId(cat.id)));
  }, [categories, allowedCategoryIds]);

  const loadCatalog = useCallback(async () => {
    if (catalog === 'food' && (showFoodCategories || inputMode === 'custom')) return;

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
        minProtein,
        minCarbs,
        minFat,
        sort: foodSort,
      });
      if (gen !== loadGen.current) return;
      if (res.error) setError(res.error);
      else setFoods(res.data?.foods ?? []);
    }
    setLoading(false);
  }, [catalog, debounced, categoryId, exerciseCategory, language, showFoodCategories, inputMode, minProtein, minCarbs, minFat, foodSort]);

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === categoryId) ?? null,
    [categories, categoryId],
  );

  const activeCategoryLabel = activeCategory
    ? resolveCategoryLabel(
        activeCategory.id,
        activeCategory.nameAr ?? null,
        t,
        language,
        activeCategory.query,
      )
    : null;

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
    if (hint.categoryId) {
      setCategoryId(normalizeCategoryId(hint.categoryId));
      setFoodView('foods');
    }
  };

  const selectFoodCategory = (id: string) => {
    const normalized = normalizeCategoryId(id);
    setCategoryId(normalized);
    setSearch('');
    setDebounced('');
    setFoodView('foods');
    nutritionService.prefetchSearchFoods({
      categoryId: normalized,
      page: 1,
      pageSize: 24,
      minProtein,
      minCarbs,
      minFat,
      sort: foodSort,
    });
  };

  const backToFoodCategories = () => {
    setCategoryId('');
    setSearch('');
    setDebounced('');
    setFoodView('categories');
  };

  const canContinue = optional ? true : selected.length >= Math.max(minSelect, 1);
  const hasCustomText = Boolean(customText.trim());
  const showSkipLabel = optional && selected.length === 0 && !hasCustomText;
  const showCategorySwitcher = catalog === 'food' && visibleCategories.length > 1;
  const useCompactTabs = showCategorySwitcher && visibleCategories.length <= 4;
  const showFoodBrowseBack = catalog === 'food' && !showFoodCategories && !showCategorySwitcher;
  const showCompactSelected = compact && (showCategorySwitcher || catalog === 'exercise');

  const scrollPanelClass = compact
    ? 'flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pe-0.5'
    : 'max-h-[min(50vh,420px)] overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pe-0.5';

  return (
    <div
      className={`font-[Cairo,'Space_Grotesk',sans-serif] ${
        compact ? 'flex flex-col flex-1 min-h-0 gap-1.5' : 'space-y-3'
      }`}
    >
      {selected.length > 0 &&
        (showCompactSelected ? (
          <div
            className="flex gap-1.5 overflow-x-auto pb-0.5 shrink-0 custom-scrollbar touch-pan-x"
            onPointerDown={stopSwipeDrag}
          >
            {selected.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAnswer(stepId, selected.filter((s) => s.id !== item.id))}
                className="flex shrink-0 items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 pl-1 pr-1.5 py-0.5 hover:border-red-400/50"
              >
                <img src={item.imageUrl} alt="" className="size-7 rounded-md object-cover" />
                <span className="text-[11px] font-bold max-w-[5.5rem] truncate">
                  {resolveCatalogPickName(item, language)}
                </span>
                <span className="material-symbols-outlined text-xs text-faint">close</span>
              </button>
            ))}
          </div>
        ) : (
        <div className="rounded-2xl border border-primary/25 bg-primary/5 p-2.5 shrink-0">
          <p className="text-[10px] font-black uppercase tracking-wider text-primary mb-2 px-1">
            {t('onboarding.catalog.selected', { count: String(selected.length) })}
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {selected.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onAnswer(stepId, selected.filter((s) => s.id !== item.id))}
                className="flex shrink-0 items-center gap-2 rounded-xl bg-surface border border-subtle pl-1 pr-2 py-1 hover:border-red-400/50"
              >
                <img src={item.imageUrl} alt="" className="size-9 rounded-lg object-cover" />
                <span className="text-xs font-bold max-w-[7rem] truncate">
                  {resolveCatalogPickName(item, language)}
                </span>
                <span className="material-symbols-outlined text-sm text-faint">close</span>
              </button>
            ))}
          </div>
        </div>
        ))}

      {allowCustomText && catalog === 'food' && (
        <div className="grid grid-cols-2 gap-1.5 shrink-0 p-1 rounded-xl bg-surface/60 border border-subtle">
          <button
            type="button"
            onClick={() => setInputMode('library')}
            className={`rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold transition-colors ${
              inputMode === 'library'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t('onboarding.catalog.modeLibrary')}
          </button>
          <button
            type="button"
            onClick={() => setInputMode('custom')}
            className={`rounded-lg px-2 py-2 text-[11px] sm:text-xs font-bold transition-colors ${
              inputMode === 'custom'
                ? 'bg-primary text-white shadow-sm'
                : 'text-muted hover:text-foreground'
            }`}
          >
            {t('onboarding.catalog.modeCustom')}
          </button>
        </div>
      )}

      {showLibraryPanel && (
        <div className={compact ? 'flex flex-1 min-h-0 flex-col gap-1.5' : undefined}>
      <div className="relative shrink-0">
        <span className="material-symbols-outlined absolute start-3 top-1/2 -translate-y-1/2 text-faint text-lg">
          search
        </span>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            catalog === 'exercise'
              ? t('onboarding.catalog.searchExercises')
              : showFoodCategories
                ? t('onboarding.catalog.searchFoodsGlobal')
                : activeCategoryLabel
                  ? t('onboarding.catalog.searchFoodsInCategory', { category: activeCategoryLabel })
                  : t('onboarding.catalog.searchFoods')
          }
          className={`w-full rounded-2xl border border-subtle bg-surface/80 ps-10 pe-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/40 ${
            compact ? 'py-2' : 'py-3'
          }`}
        />
      </div>

      {catalog === 'exercise' && searchHints.length > 0 && (
        <div
          className={`flex flex-wrap shrink-0 ${compact ? 'gap-1' : 'gap-2'}`}
          onPointerDown={stopSwipeDrag}
        >
          {searchHints.map((hint) => (
            <button
              key={hint.label}
              type="button"
              onClick={() => applyHint(hint)}
              className={`font-bold rounded-full border border-subtle bg-elevated/60 hover:border-primary/40 hover:text-primary ${
                compact ? 'text-[10px] px-2 py-1' : 'text-xs px-3 py-1.5'
              }`}
            >
              {hint.label}
            </button>
          ))}
        </div>
      )}

      {catalog === 'food' && showCategorySwitcher && (
        <div
          className={`flex gap-1.5 overflow-x-auto custom-scrollbar -mx-1 px-1 shrink-0 touch-pan-x ${
            compact ? 'pb-0' : 'pb-1'
          }`}
          onPointerDown={stopSwipeDrag}
        >
          {!useCompactTabs && (
          <button
            type="button"
            onClick={backToFoodCategories}
            className={`shrink-0 rounded-xl border font-bold transition-colors ${
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
              showFoodCategories
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-subtle bg-surface/60 text-muted hover:border-primary/40 hover:text-primary'
            }`}
          >
            {t('onboarding.catalog.backToCategories')}
          </button>
          )}
          {visibleCategories.map((cat) => {
            const label = resolveCategoryLabel(
              cat.id,
              cat.nameAr ?? null,
              t,
              language,
              cat.query,
            );
            const isActive = foodView === 'foods' && categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => selectFoodCategory(cat.id)}
                className={`shrink-0 rounded-xl border font-bold transition-colors ${
                  compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
                } ${
                  isActive
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-subtle bg-surface/60 text-muted hover:border-primary/40 hover:text-primary'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {catalog === 'food' && !showFoodCategories && (
        <div className="flex items-center gap-2 shrink-0 min-h-[1.75rem]">
          {showFoodBrowseBack && (
            <button
              type="button"
              onClick={backToFoodCategories}
              className="inline-flex items-center gap-1 rounded-xl border border-subtle bg-surface/60 px-2.5 py-1.5 text-xs font-bold text-muted hover:text-primary hover:border-primary/40"
            >
              <span className="material-symbols-outlined text-base">arrow_back</span>
              {t('onboarding.catalog.backToCategories')}
            </button>
          )}
          {!showCategorySwitcher && activeCategoryLabel && (
            <span className="text-xs font-bold text-primary truncate">{activeCategoryLabel}</span>
          )}
          {debounced && !categoryId && (
            <span className="text-xs text-faint truncate">
              {t('onboarding.catalog.searchResultsFor', { query: debounced })}
            </span>
          )}
        </div>
      )}

      {catalog === 'food' && showFoodCategories && !compact && (
        <p className="text-[11px] sm:text-xs text-muted text-center shrink-0 px-1">
          {t('onboarding.catalog.pickCategoryHint')}
        </p>
      )}

      {catalog === 'exercise' && exerciseCategories.length > 0 && (
        <div
          className={`flex overflow-x-auto custom-scrollbar -mx-1 px-1 shrink-0 touch-pan-x ${
            compact ? 'gap-1 pb-0' : 'gap-2 pb-1'
          }`}
          onPointerDown={stopSwipeDrag}
        >
          <button
            type="button"
            onClick={() => setExerciseCategory('')}
            className={`shrink-0 rounded-xl border font-bold ${
              compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
            } ${
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
              className={`shrink-0 rounded-xl border font-bold ${
                compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
              } ${
                exerciseCategory === cat.category
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-subtle bg-surface/60'
              }`}
            >
              {formatCategoryLabel(cat.category, t)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400 text-center shrink-0">{error}</p>}

      <div className={compact ? 'flex-1 min-h-0 flex flex-col' : undefined}>
      {catalog === 'food' && showFoodCategories ? (
        <div
          className={compact ? scrollPanelClass : undefined}
          onPointerDown={stopSwipeDrag}
        >
          <NutritionCategoryGrid
            categories={visibleCategories}
            loading={categoriesLoading}
            compact={compact}
            onSelect={selectFoodCategory}
            onPrefetch={(id) =>
              nutritionService.prefetchSearchFoods({
                categoryId: normalizeCategoryId(id),
                page: 1,
                pageSize: 24,
                minProtein,
                minCarbs,
                minFat,
                sort: foodSort,
              })
            }
          />
        </div>
      ) : loading ? (
        <p className={`text-sm text-faint text-center animate-pulse ${
          compact ? 'flex-1 flex items-center justify-center min-h-0' : 'py-8 shrink-0'
        }`}>
          {t('onboarding.catalog.loading')}
        </p>
      ) : catalog === 'exercise' ? (
        compact ? (
          <motion.div
            layout
            className={`flex flex-col gap-1.5 ${scrollPanelClass}`}
            onPointerDown={stopSwipeDrag}
          >
            <AnimatePresence mode="popLayout">
              {exercises.map((ex) => (
                <ExercisePickerRow
                  key={ex.id}
                  exercise={ex}
                  language={language}
                  selected={selectedIds.has(ex.id)}
                  onToggle={() => toggleExercise(ex)}
                  compact
                />
              ))}
            </AnimatePresence>
          </motion.div>
        ) : (
        <motion.div
          layout
          className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${scrollPanelClass}`}
          onPointerDown={stopSwipeDrag}
        >
          <AnimatePresence mode="popLayout">
            {exercises.map((ex) => (
              <CatalogTile
                key={ex.id}
                imageUrl={exerciseImageUrl(ex)}
                title={resolveExerciseDisplayName(ex, language)}
                subtitle={ex.primaryMuscles?.[0] ? localizeMuscleLabel(ex.primaryMuscles[0], language) : undefined}
                selected={selectedIds.has(ex.id)}
                onToggle={() => toggleExercise(ex)}
              />
            ))}
          </AnimatePresence>
        </motion.div>
        )
      ) : (
        <motion.div
          className={`flex flex-col gap-2 ${scrollPanelClass}`}
          onPointerDown={stopSwipeDrag}
        >
          <AnimatePresence mode="popLayout">
            {foods.map((food) => {
              const fid = String(food.webtebId ?? food.id ?? food.name);
              const rowCategory = resolveCategoryLabel(
                food.categoryId,
                null,
                t,
                language,
              );
              return (
                <FoodPickerRow
                  key={fid}
                  food={food}
                  language={language}
                  categoryLabel={rowCategory}
                  selected={selectedIds.has(fid)}
                  onToggle={() => toggleFood(food)}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {!loading && !showFoodCategories && catalog === 'exercise' && exercises.length === 0 && (
        <p className="text-sm text-faint text-center py-6 shrink-0">{t('onboarding.catalog.empty')}</p>
      )}
      {!loading && !showFoodCategories && catalog === 'food' && foods.length === 0 && (
        <p className={`text-sm text-faint text-center ${compact ? 'flex-1 flex items-center justify-center' : 'py-6 shrink-0'}`}>{t('onboarding.catalog.empty')}</p>
      )}

      </div>

        </div>
      )}

      {showCustomPanel && (
        <div className={`shrink-0 space-y-1.5 ${compact ? 'flex-1 min-h-0 flex flex-col' : ''}`}>
          <p className="text-[11px] sm:text-xs font-bold text-muted px-0.5">
            {t('onboarding.catalog.customFoodsLabel')}
          </p>
          <textarea
            value={customText}
            onChange={(e) => {
              setCustomText(e.target.value);
              onAnswer(customTextField!, e.target.value);
            }}
            placeholder={t('onboarding.foodsExcluded.customPlaceholder')}
            rows={compact ? 5 : 4}
            className={`w-full resize-none rounded-xl sm:rounded-2xl border border-subtle bg-surface/80 px-3 sm:px-4 py-2.5 sm:py-3 text-sm font-medium text-foreground placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-primary/40 ${
              compact ? 'flex-1 min-h-[8rem]' : ''
            }`}
          />
        </div>
      )}

      {!hideContinue && (
        <motion.button
          type="button"
          disabled={!canContinue}
          onClick={() => {
            const pending: OnboardingAnswers = { [stepId]: selected };
            if (customTextField) pending[customTextField] = customText.trim();
            onContinue(pending);
          }}
          whileTap={canContinue ? { scale: 0.98 } : undefined}
          className={`w-full rounded-2xl bg-primary text-white font-black text-sm disabled:opacity-40 shadow-lg shadow-primary/20 ${
            compact ? 'shrink-0 mt-auto py-3' : 'py-3.5'
          }`}
        >
          {showSkipLabel ? t('onboarding.catalog.skipStep') : t('common.continue')}
        </motion.button>
      )}
    </div>
  );
};
