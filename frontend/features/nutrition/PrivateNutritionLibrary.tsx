import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import nutritionService, {
  type KitchenFoodInput,
  type SavedMeal,
  type SavedMealItemInput,
} from '../../services/nutritionService';
import type { FdcCategory, FdcFoodPreview, FoodItem } from '../../types';
import type { MealAddContext } from '../dashboard/mealAddContext';
import { PlanItemInfoButton } from '../dashboard/PlanItemInfoButton';
import { macrosFromPer100 } from '../dashboard/mealEntryMacros';
import { cn } from '../../lib/cn';
import { isApiUnreachableMessage, sleepMs } from '../../lib/apiTransientError';
import { useI18n } from '../../lib/i18n/useI18n';
import { NutritionDetailsModal } from './NutritionDetailsModal';
import { NutritionFoodList, type NutritionFoodRow } from './NutritionFoodList';
import { NutritionCategoryGrid } from './NutritionCategoryGrid';
import { NutritionMacroDonut } from './NutritionMacroDonut';

type Props = {
  open?: boolean;
  mealAddContext?: MealAddContext | null;
  onLogFood: (row: NutritionFoodRow) => void;
  onLogged: (message: string) => void;
  onClose?: () => void;
};

type MealPickTab = 'kitchen' | 'library';

const MEAL_ITEM_MAX = 50;
const MEAL_SEARCH_RESULTS_MAX = 30;

type MealDraftItem = SavedMealItemInput & {
  webtebId?: number | null;
  draftKey: string;
};

type KitchenFoodDraft = {
  name: string;
  category: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  saturatedFat: string;
  transFat: string;
  cholesterol: string;
  sodium: string;
  potassium: string;
  dietaryFiber: string;
  sugars: string;
  vitaminA: string;
  vitaminC: string;
  calcium: string;
  iron: string;
};

const emptyFood: KitchenFoodDraft = {
  name: '',
  category: 'user-kitchen',
  calories: '',
  protein: '',
  carbs: '',
  fat: '',
  saturatedFat: '',
  transFat: '',
  cholesterol: '',
  sodium: '',
  potassium: '',
  dietaryFiber: '',
  sugars: '',
  vitaminA: '',
  vitaminC: '',
  calcium: '',
  iron: '',
};

function foodToRow(food: FoodItem): NutritionFoodRow {
  return {
    key: `kitchen-${food.id}`,
    name: food.displayName || food.name,
    category: food.category || 'My Kitchen',
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    imageUrl: food.imageUrl,
    foodItem: food,
    subtitle: food.isPublic ? undefined : 'Personal food',
  };
}

function numberValue(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const macroFields = [
  { key: 'calories', label: 'Calories', suffix: 'optional - auto-calculated if blank', step: 1, required: false },
  { key: 'protein', label: 'Protein', suffix: 'required - grams per 100g', step: 0.1, required: true },
  { key: 'carbs', label: 'Carbs', suffix: 'required - grams per 100g', step: 0.1, required: true },
  { key: 'fat', label: 'Fat', suffix: 'required - grams per 100g', step: 0.1, required: true },
] as const;

const optionalNutrientFields = [
  { key: 'saturatedFat', label: 'Saturated fat', unit: 'g', step: 0.1 },
  { key: 'transFat', label: 'Trans fat', unit: 'g', step: 0.1 },
  { key: 'cholesterol', label: 'Cholesterol', unit: 'mg', step: 0.1 },
  { key: 'sodium', label: 'Sodium', unit: 'mg', step: 0.1 },
  { key: 'potassium', label: 'Potassium', unit: 'mg', step: 0.1 },
  { key: 'dietaryFiber', label: 'Dietary fibre', unit: 'g', step: 0.1 },
  { key: 'sugars', label: 'Sugars', unit: 'g', step: 0.1 },
  { key: 'vitaminA', label: 'Vitamin A (100% = 5000 IU)', unit: '%', step: 0.1 },
  { key: 'vitaminC', label: 'Vitamin C (100% = 60 mg)', unit: '%', step: 0.1 },
  { key: 'calcium', label: 'Calcium (100% = 1,000 mg)', unit: '%', step: 0.1 },
  { key: 'iron', label: 'Iron (100% = 18 mg)', unit: '%', step: 0.1 },
] as const;

type OptionalNutrientKey = (typeof optionalNutrientFields)[number]['key'];

type PersonalMode = 'food' | 'build' | 'log' | null;

function mealItemToRow(item: MealDraftItem, foods: FoodItem[]): NutritionFoodRow {
  const kitchenFood = item.foodItemId ? foods.find((food) => food.id === item.foodItemId) : undefined;
  const per100 = {
    calories: item.calories ?? kitchenFood?.calories ?? 0,
    protein: item.protein ?? kitchenFood?.protein ?? 0,
    carbs: item.carbs ?? kitchenFood?.carbs ?? 0,
    fat: item.fat ?? kitchenFood?.fat ?? 0,
  };
  return {
    key: `meal-item-${item.foodItemId ?? item.webtebId ?? item.name}`,
    name: item.name || kitchenFood?.name || 'Food',
    category: kitchenFood?.category || (item.webtebId ? 'Nutrition library' : 'My Kitchen'),
    ...per100,
    foodItem: kitchenFood,
    subtitle: kitchenFood ? 'Personal food' : item.webtebId ? 'Nutrition library' : undefined,
    fdcPreview:
      item.webtebId != null && item.webtebId > 0
        ? {
            source: 'webteb',
            webtebId: item.webtebId,
            name: item.name || 'Food',
            dataType: null,
            ...per100,
          }
        : undefined,
  };
}

function itemKcal(item: MealDraftItem): number {
  return macrosFromPer100(
    {
      calories: item.calories ?? 0,
      protein: item.protein ?? 0,
      carbs: item.carbs ?? 0,
      fat: item.fat ?? 0,
    },
    item.grams
  ).calories;
}

function formatMacroGrams(value: number): string {
  if (value > 0 && value < 0.1) return '<0.1';
  return value.toFixed(1);
}

function libraryPreviewToRow(preview: FdcFoodPreview): NutritionFoodRow | null {
  if (!preview.webtebId) return null;
  return {
    key: `library-${preview.webtebId}`,
    name: preview.nameEn || preview.name,
    category: preview.foodCategoryEn || preview.foodCategory || 'Nutrition library',
    calories: preview.calories,
    protein: preview.protein,
    carbs: preview.carbs,
    fat: preview.fat,
    fdcPreview: { ...preview, source: 'webteb' },
  };
}

export const PrivateNutritionLibrary: React.FC<Props> = ({
  open = true,
  mealAddContext,
  onLogFood,
  onLogged,
  onClose,
}) => {
  const { t } = useI18n();
  const [foods, setFoods] = useState<FoodItem[]>(() => nutritionService.peekKitchenFoods()?.data ?? []);
  const [meals, setMeals] = useState<SavedMeal[]>(() => nutritionService.peekSavedMeals()?.data ?? []);
  const [loading, setLoading] = useState(false);
  const [savingFood, setSavingFood] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const [foodDraft, setFoodDraft] = useState<KitchenFoodDraft>(emptyFood);
  const [mealName, setMealName] = useState('');
  const [mealItems, setMealItems] = useState<MealDraftItem[]>([]);
  const [mealFoodQuery, setMealFoodQuery] = useState('');
  const [libraryFoods, setLibraryFoods] = useState<FdcFoodPreview[]>([]);
  const [librarySearching, setLibrarySearching] = useState(false);
  const [mealPickTab, setMealPickTab] = useState<MealPickTab>('kitchen');
  const [mealLibraryCategories, setMealLibraryCategories] = useState<FdcCategory[]>([]);
  const [mealLibraryCategoryId, setMealLibraryCategoryId] = useState<string | null>(null);
  const [mealLibraryFoods, setMealLibraryFoods] = useState<FdcFoodPreview[]>([]);
  const [mealLibraryLoading, setMealLibraryLoading] = useState(false);
  const [savedMealsPickerOpen, setSavedMealsPickerOpen] = useState(false);
  const [pendingMealRow, setPendingMealRow] = useState<NutritionFoodRow | null>(null);
  const [pendingGrams, setPendingGrams] = useState('100');
  const [mode, setMode] = useState<PersonalMode>(null);
  const [optionalFactsOpen, setOptionalFactsOpen] = useState(false);
  const [detailsTarget, setDetailsTarget] = useState<NutritionFoodRow | null>(null);
  const [modalMessage, setModalMessage] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const modalScrollRef = useRef<HTMLDivElement>(null);
  const modeContentRef = useRef<HTMLElement | null>(null);
  const pendingMealPanelRef = useRef<HTMLDivElement>(null);

  const scrollModalToElement = useCallback((target: HTMLElement | null) => {
    const container = modalScrollRef.current;
    if (!container || !target) return;

    const scrollToContent = () => {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const nextTop = container.scrollTop + (targetRect.top - containerRect.top) - 16;
      container.scrollTo({ top: Math.max(0, nextTop), behavior: 'smooth' });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToContent);
    });
  }, []);

  useEffect(() => {
    if (!mode) return;
    if (window.matchMedia('(min-width: 768px)').matches) return;
    scrollModalToElement(modeContentRef.current);
  }, [mode, scrollModalToElement]);

  useEffect(() => {
    if (!pendingMealRow) return;
    scrollModalToElement(pendingMealPanelRef.current);
  }, [pendingMealRow, scrollModalToElement]);

  const notify = useCallback(
    (message: string) => {
      setModalMessage(message);
      onLogged(message);
    },
    [onLogged]
  );

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    const hasCachedPreview =
      foods.length > 0 ||
      meals.length > 0 ||
      Boolean(nutritionService.peekKitchenFoods()?.data?.length) ||
      Boolean(nutritionService.peekSavedMeals()?.data?.length);

    if (!silent && !hasCachedPreview) setLoading(true);
    setLoadFailed(false);
    if (!silent) setModalMessage(null);

    let foodRes = await nutritionService.getKitchenFoods();
    let mealRes = await nutritionService.getSavedMeals();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const unreachable =
        isApiUnreachableMessage(foodRes.error) || isApiUnreachableMessage(mealRes.error);
      if (!unreachable) break;
      await sleepMs(1500 * (attempt + 1));
      [foodRes, mealRes] = await Promise.all([
        nutritionService.getKitchenFoods(),
        nutritionService.getSavedMeals(),
      ]);
    }
    if (foodRes.data) setFoods(foodRes.data);
    if (mealRes.data) setMeals(mealRes.data);

    const unreachable =
      isApiUnreachableMessage(foodRes.error) || isApiUnreachableMessage(mealRes.error);
    if (unreachable) {
      if (!hasCachedPreview) {
        const message =
          'Cannot reach the API. From the project root run: npm run dev (or npm run dev:backend), then click Retry.';
        setLoadFailed(true);
        setModalMessage(message);
        notify(message);
      }
    } else if (foodRes.error || mealRes.error) {
      notify(foodRes.error || mealRes.error || 'Could not load personal nutrition');
    }

    setLoading(false);
  }, [notify]);

  useEffect(() => {
    if (!open) return;
    void load({ silent: true });
  }, [open, load]);

  useEffect(() => {
    if (mode !== 'build') {
      setMealPickTab('kitchen');
      setMealLibraryCategoryId(null);
      setMealFoodQuery('');
      setMealLibraryFoods([]);
      setSavedMealsPickerOpen(false);
      return;
    }
    void nutritionService.getCategories().then((res) => {
      if (res.data?.categories) setMealLibraryCategories(res.data.categories);
    });
  }, [mode]);

  useEffect(() => {
    if (mode !== 'build' || mealPickTab !== 'library' || !mealLibraryCategoryId || mealFoodQuery.trim()) {
      if (!mealLibraryCategoryId) setMealLibraryFoods([]);
      return;
    }

    let cancelled = false;
    setMealLibraryLoading(true);
    void nutritionService
      .searchFoods({ categoryId: mealLibraryCategoryId, page: 1, pageSize: 30 })
      .then((res) => {
        if (cancelled) return;
        setMealLibraryFoods(res.data?.foods ?? []);
        setMealLibraryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mode, mealPickTab, mealLibraryCategoryId, mealFoodQuery]);

  const kitchenFoodSearchRows = useMemo(() => {
    const query = mealFoodQuery.trim().toLowerCase();
    return foods
      .filter(
        (food) =>
          !query ||
          food.name.toLowerCase().includes(query) ||
          (food.category || '').toLowerCase().includes(query)
      )
      .slice(0, MEAL_SEARCH_RESULTS_MAX)
      .map(foodToRow);
  }, [foods, mealFoodQuery]);

  useEffect(() => {
    if (mode !== 'build') return;
    const query = mealFoodQuery.trim();
    if (!query) {
      setLibraryFoods([]);
      setLibrarySearching(false);
      return;
    }

    let cancelled = false;
    setLibrarySearching(true);
    const timer = window.setTimeout(() => {
      void nutritionService.searchFoods({ q: query, page: 1, pageSize: 20 }).then((res) => {
        if (cancelled) return;
        setLibraryFoods(res.data?.foods ?? []);
        setLibrarySearching(false);
      });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mealFoodQuery, mode]);

  const mealFoodSearchRows = useMemo(() => {
    const kitchenNames = new Set(kitchenFoodSearchRows.map((row) => row.name.toLowerCase()));
    const libraryRows = libraryFoods
      .map(libraryPreviewToRow)
      .filter((row): row is NutritionFoodRow => Boolean(row))
      .filter((row) => !kitchenNames.has(row.name.toLowerCase()));
    return [...kitchenFoodSearchRows, ...libraryRows].slice(0, MEAL_SEARCH_RESULTS_MAX);
  }, [kitchenFoodSearchRows, libraryFoods]);

  const hasMealSearch = mealFoodQuery.trim().length > 0;

  const mealLibraryBrowseRows = useMemo(
    () =>
      mealLibraryFoods
        .map(libraryPreviewToRow)
        .filter((row): row is NutritionFoodRow => Boolean(row)),
    [mealLibraryFoods]
  );

  const displayMealPickRows = useMemo(() => {
    if (hasMealSearch) return mealFoodSearchRows;
    if (mealPickTab === 'kitchen') {
      return foods.slice(0, MEAL_SEARCH_RESULTS_MAX).map(foodToRow);
    }
    if (mealLibraryCategoryId) return mealLibraryBrowseRows;
    return [];
  }, [
    hasMealSearch,
    mealFoodSearchRows,
    mealPickTab,
    foods,
    mealLibraryCategoryId,
    mealLibraryBrowseRows,
  ]);

  const rows = useMemo(() => foods.map(foodToRow), [foods]);

  const mealDraftTotals = useMemo(() => {
    const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const item of mealItems) {
      const scaled = macrosFromPer100(
        {
          calories: item.calories ?? 0,
          protein: item.protein ?? 0,
          carbs: item.carbs ?? 0,
          fat: item.fat ?? 0,
        },
        item.grams
      );
      totals.calories += scaled.calories;
      totals.protein += scaled.protein;
      totals.carbs += scaled.carbs;
      totals.fat += scaled.fat;
    }
    return {
      calories: totals.calories,
      protein: Math.round(totals.protein * 10) / 10,
      carbs: Math.round(totals.carbs * 10) / 10,
      fat: Math.round(totals.fat * 10) / 10,
    };
  }, [mealItems]);

  const updateFoodDraft = (key: keyof KitchenFoodDraft, value: string) => {
    setFoodDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const createFood = async (event: React.FormEvent) => {
    event.preventDefault();
    const requiredMacrosEntered = foodDraft.protein.trim() !== '' && foodDraft.carbs.trim() !== '' && foodDraft.fat.trim() !== '';
    if (!foodDraft.name.trim() || !requiredMacrosEntered) {
      notify('Food name, protein, carbs, and fat are required');
      return;
    }
    const protein = numberValue(foodDraft.protein);
    const carbs = numberValue(foodDraft.carbs);
    const fat = numberValue(foodDraft.fat);
    const calories =
      foodDraft.calories.trim() === ''
        ? Math.round(protein * 4 + carbs * 4 + fat * 9)
        : Math.round(numberValue(foodDraft.calories));
    setSavingFood(true);
    const payload: KitchenFoodInput = {
      name: foodDraft.name.trim(),
      category: foodDraft.category?.trim() || 'user-kitchen',
      calories,
      protein,
      carbs,
      fat,
    };
    for (const field of optionalNutrientFields) {
      const value = foodDraft[field.key].trim();
      if (value !== '') {
        (payload as Partial<Record<OptionalNutrientKey, number>>)[field.key] = numberValue(value);
      }
    }
    const res = await nutritionService.createKitchenFood(payload);
    setSavingFood(false);
    if (res.error || !res.data) {
      notify(res.error || 'Could not save kitchen food');
      return;
    }
    setFoodDraft(emptyFood);
    setFoods((prev) => [res.data!, ...prev]);
    notify(`Saved kitchen food: ${res.data.name}`);
    await load();
  };

  const addMealItemFromRow = (row: NutritionFoodRow, grams: number) => {
    if (mealItems.length >= MEAL_ITEM_MAX) {
      notify(t('nutrition.mealItemLimit', { max: String(MEAL_ITEM_MAX) }));
      return;
    }
    setMealItems((prev) => [
      ...prev,
      {
        draftKey: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        foodItemId: row.foodItem?.id,
        webtebId: row.fdcPreview?.webtebId ?? null,
        name: row.name,
        grams,
        calories: row.calories,
        protein: row.protein,
        carbs: row.carbs,
        fat: row.fat,
      },
    ]);
    if (!mealName.trim()) setMealName(row.name);
    notify(`Added ${row.name} to this meal`);
  };

  const openMealFoodPicker = (row: NutritionFoodRow) => {
    setPendingMealRow(row);
    setPendingGrams('100');
  };

  const confirmAddPendingMealFood = () => {
    if (!pendingMealRow) return;
    const grams = Math.max(1, numberValue(pendingGrams));
    addMealItemFromRow(pendingMealRow, grams);
    setPendingMealRow(null);
    setPendingGrams('100');
  };

  const updateMealItemGrams = (index: number, grams: number) => {
    const safeGrams = Math.max(1, Math.round(grams));
    setMealItems((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, grams: safeGrams } : item))
    );
  };

  const removeMealItem = (index: number) => {
    setMealItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const renderMealFoodPickList = (rows: NutritionFoodRow[]) => (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li
          key={row.key}
          className="flex items-center justify-between gap-2 rounded-xl border border-subtle/80 bg-background/60 px-3 py-2"
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="material-symbols-outlined shrink-0 text-[14px] text-accent">restaurant</span>
            <span className="truncate text-sm font-semibold text-foreground">{row.name}</span>
            <PlanItemInfoButton
              size="sm"
              onClick={() => setDetailsTarget(row)}
              ariaLabel={t('nutrition.details')}
            />
          </span>
          <button
            type="button"
            onClick={() => openMealFoodPicker(row)}
            disabled={mealItems.length >= MEAL_ITEM_MAX}
            className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent/20 disabled:opacity-40"
          >
            Add
          </button>
        </li>
      ))}
    </ul>
  );

  const addItemsFromSavedMeal = (meal: SavedMeal) => {
    if (!meal.items.length) {
      notify(t('nutrition.savedMealEmpty'));
      return;
    }
    const remaining = MEAL_ITEM_MAX - mealItems.length;
    if (remaining <= 0) {
      notify(t('nutrition.mealItemLimit', { max: String(MEAL_ITEM_MAX) }));
      return;
    }
    const toAdd: MealDraftItem[] = meal.items.slice(0, remaining).map((item) => ({
      draftKey: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      foodItemId: item.foodItemId ?? item.foodItem?.id ?? null,
      webtebId: null,
      name: item.name,
      grams: item.grams,
      calories: item.calories ?? item.foodItem?.calories ?? undefined,
      protein: item.protein ?? item.foodItem?.protein ?? undefined,
      carbs: item.carbs ?? item.foodItem?.carbs ?? undefined,
      fat: item.fat ?? item.foodItem?.fat ?? undefined,
    }));
    setMealItems((prev) => [...prev, ...toAdd]);
    setSavedMealsPickerOpen(false);
    if (toAdd.length < meal.items.length) {
      notify(
        t('nutrition.mealPartialAdd', {
          added: String(toAdd.length),
          total: String(meal.items.length),
        })
      );
    } else {
      notify(t('nutrition.addedFromSavedMeal', { meal: meal.name, count: String(toAdd.length) }));
    }
  };

  const createMeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (mealItems.length === 0) {
      notify('Add at least one food item before saving the meal');
      return;
    }
    const resolvedMealName =
      mealName.trim() ||
      mealItems
        .slice(0, 3)
        .map((item) => item.name)
        .filter(Boolean)
        .join(' + ') ||
      'Personal meal';
    setSavingMeal(true);
    const res = await nutritionService.createSavedMeal({
      name: resolvedMealName,
      defaultSlotId: mealAddContext?.slotId,
      items: mealItems.map(({ webtebId: _webtebId, draftKey: _draftKey, ...item }) => item),
    });
    setSavingMeal(false);
    if (res.error || !res.data) {
      notify(res.error || 'Could not save personal meal');
      return;
    }
    setMeals((prev) => [res.data!, ...prev]);
    setMealName('');
    setMealItems([]);
    notify(`Saved personal meal: ${res.data.name}`);
    await load();
  };

  const logMeal = async (meal: SavedMeal) => {
    const res = await nutritionService.logSavedMeal(meal.id, {
      date: mealAddContext?.date,
      slotId: mealAddContext?.slotId,
    });
    if (res.error || !res.data) {
      notify(res.error || 'Could not log personal meal');
      return;
    }
    notify(
      mealAddContext
        ? `Added ${meal.name} to ${mealAddContext.slotLabel}`
        : `Logged personal meal: ${meal.name}`
    );
  };

  const content = (
    <div
      ref={modalScrollRef}
      className="glass-panel max-h-[88vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-subtle p-5 shadow-2xl sm:p-6 space-y-6"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-accent">Personal nutrition</p>
          <h2 className="text-xl font-black text-foreground">Personal</h2>
          <p className="mt-1 max-w-2xl text-sm font-medium text-muted">
            Save your own foods, or build meals from your kitchen and the nutrition library.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {loading ? <span className="text-xs font-bold text-muted">Loading...</span> : null}
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="flex size-10 items-center justify-center rounded-xl border border-subtle bg-elevated text-muted hover:text-foreground"
              aria-label="Close personal nutrition"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          ) : null}
        </div>
      </div>

      {modalMessage ? (
        <div
          className={cn(
            'rounded-2xl border px-4 py-3 text-sm font-bold',
            loadFailed
              ? 'border-error-500/35 bg-error-500/10 text-error-600 dark:text-error-400'
              : 'border-accent/30 bg-accent/10 text-foreground'
          )}
        >
          <p>{modalMessage}</p>
          {loadFailed ? (
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="mt-2 text-xs font-black uppercase tracking-widest text-accent hover:underline disabled:opacity-50"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setMode('food')}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            mode === 'food'
              ? 'border-accent bg-accent/15'
              : 'border-subtle bg-elevated/50 hover:border-accent/40 hover:bg-accent/10'
          }`}
        >
          <span className="material-symbols-outlined text-3xl text-accent">add_circle</span>
          <h3 className="mt-3 text-lg font-black text-foreground">Add custom food</h3>
          <p className="mt-1 text-sm font-semibold text-muted">
            Save one food or ingredient that is not found in the nutrition library.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setMode('build')}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            mode === 'build'
              ? 'border-accent bg-accent/15'
              : 'border-subtle bg-elevated/50 hover:border-accent/40 hover:bg-accent/10'
          }`}
        >
          <span className="material-symbols-outlined text-3xl text-accent">restaurant</span>
          <h3 className="mt-3 text-lg font-black text-foreground">{t('nutrition.personalBuildTitle')}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">{t('nutrition.personalBuildDesc')}</p>
        </button>

        <button
          type="button"
          onClick={() => setMode('log')}
          className={`rounded-2xl border p-5 text-left transition-colors ${
            mode === 'log'
              ? 'border-accent bg-accent/15'
              : 'border-subtle bg-elevated/50 hover:border-accent/40 hover:bg-accent/10'
          }`}
        >
          <span className="material-symbols-outlined text-3xl text-accent">lunch_dining</span>
          <h3 className="mt-3 text-lg font-black text-foreground">{t('nutrition.personalLogTitle')}</h3>
          <p className="mt-1 text-sm font-semibold text-muted">{t('nutrition.personalLogDesc')}</p>
          {meals.length ? (
            <span className="mt-3 inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-black text-accent">
              {meals.length} saved
            </span>
          ) : null}
        </button>
      </div>

      {!mode ? (
        <section className="rounded-2xl border border-subtle bg-elevated/40 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-black text-foreground">Your kitchen foods</h3>
                <p className="mt-1 text-xs font-semibold text-muted">
                  Foods you added yourself. Use them for logging or building personal meals.
                </p>
              </div>
              <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-black text-accent">
                {foods.length}
              </span>
            </div>
            {foods.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {foods.slice(0, 6).map((food) => (
                  <span key={food.id} className="rounded-full bg-background px-3 py-1 text-xs font-bold text-muted">
                    {food.name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl border border-dashed border-subtle p-3 text-xs font-bold text-muted">
                No kitchen foods saved yet.
              </p>
            )}
            <button
              type="button"
              onClick={() => setMode('food')}
              className="mt-4 w-full rounded-xl border border-accent/40 px-4 py-3 text-xs font-black uppercase tracking-widest text-accent"
            >
              {foods.length ? 'View and add kitchen foods' : 'Add first kitchen food'}
          </button>
        </section>
      ) : null}

      {mode === 'food' ? (
      <form ref={modeContentRef} onSubmit={createFood} className="space-y-4 rounded-2xl border border-subtle bg-elevated/50 p-4">
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-black text-foreground">Add a custom food</h3>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="text-xs font-black uppercase tracking-widest text-accent hover:underline"
            >
              Change option
            </button>
          </div>
          <p className="mt-1 text-xs font-semibold text-muted">
            Protein, carbs, and fat are required. Calories are optional and will be calculated from macros if blank.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="space-y-1.5 xl:col-span-2">
            <span className="text-xs font-black uppercase tracking-wider text-muted">Food name</span>
            <input
              value={foodDraft.name}
              onChange={(e) => updateFoodDraft('name', e.target.value)}
              placeholder="e.g. Homemade chicken wrap"
              className="w-full rounded-xl border border-subtle bg-background px-3 py-3 text-sm font-semibold"
            />
          </label>

          {macroFields.map((field) => (
            <label key={field.key} className="space-y-1.5">
              <span className="text-xs font-black uppercase tracking-wider text-muted">
                {field.label}
                {field.required ? ' *' : ''}
              </span>
              <input
                value={foodDraft[field.key]}
                onChange={(e) => updateFoodDraft(field.key, e.target.value)}
                type="number"
                min={0}
                step={field.step}
                aria-required={field.required}
                placeholder={field.key === 'calories' ? 'optional' : 'e.g. 20'}
                className="w-full rounded-xl border border-subtle bg-background px-3 py-3 text-sm font-semibold"
              />
              <span className="block text-[11px] font-semibold text-faint">{field.suffix}</span>
            </label>
          ))}
        </div>

        <div className="rounded-2xl border border-subtle bg-background/60">
          <button
            type="button"
            onClick={() => setOptionalFactsOpen((open) => !open)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
            aria-expanded={optionalFactsOpen}
          >
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Optional nutrition facts</h4>
              <p className="mt-1 text-[11px] font-semibold text-muted">
                Fill only what you know. These fields are optional.
              </p>
            </div>
            <span className="material-symbols-outlined shrink-0 text-2xl text-muted">
              {optionalFactsOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
            </span>
          </button>
          {optionalFactsOpen ? (
            <div className="grid gap-3 border-t border-subtle p-4 md:grid-cols-2 xl:grid-cols-3">
              {optionalNutrientFields.map((field) => (
                <label key={field.key} className="space-y-1.5">
                  <span className="text-xs font-black uppercase tracking-wider text-muted">{field.label}</span>
                  <div className="flex items-center gap-2">
                    <input
                      value={foodDraft[field.key]}
                      onChange={(e) => updateFoodDraft(field.key, e.target.value)}
                      type="number"
                      min={0}
                      step={field.step}
                      placeholder="optional"
                      className="w-full rounded-xl border border-subtle bg-background px-3 py-3 text-sm font-semibold"
                    />
                    <span className="min-w-8 text-right text-xs font-black text-muted">{field.unit}</span>
                  </div>
                </label>
              ))}
            </div>
          ) : null}
        </div>

        <button
          type="submit"
          disabled={savingFood}
          className="w-full rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
        >
          {savingFood ? 'Saving...' : 'Add kitchen food'}
        </button>
      </form>
      ) : null}

      {mode === 'food' && rows.length ? (
        <NutritionFoodList rows={rows} onLog={onLogFood} onDetails={setDetailsTarget} />
      ) : mode === 'food' ? (
        <p className="rounded-2xl border border-subtle p-4 text-sm font-bold text-muted">
          Add foods that are not found in the nutrition library, then reuse them in personal meals.
        </p>
      ) : null}

      {mode === 'build' ? (
      <form ref={modeContentRef} onSubmit={createMeal}>
        <div className="rounded-2xl border border-subtle bg-elevated/50 p-4 sm:p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-black text-foreground">{t('nutrition.personalBuildTitle')}</h3>
              <p className="mt-1 text-xs font-semibold text-muted">{t('nutrition.personalBuildDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="text-xs font-black uppercase tracking-widest text-accent hover:underline"
            >
              {t('nutrition.changePersonalOption')}
            </button>
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-black uppercase tracking-wider text-muted">Meal name (optional)</span>
            <input
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g. My lunch wrap"
              className="w-full rounded-xl border border-subtle bg-background px-3 py-3 text-sm font-semibold"
            />
          </label>

          <div className="space-y-3 border-t border-subtle/80 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-bold text-foreground">
                {mealName.trim() || 'Personal meal'}
              </h4>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">
                Meal
              </span>
            </div>
            <p className="text-[11px] font-medium text-muted">
              {mealItems.length > 0
                ? `${t('nutrition.mealFoodCount', { count: String(mealItems.length) })} · `
                : ''}
              ~{mealDraftTotals.calories} kcal · ~{formatMacroGrams(mealDraftTotals.protein)}g protein
            </p>
            <p className="text-[10px] font-semibold text-faint">{t('nutrition.mealBuilderHint')}</p>

            {mealItems.length > 0 ? (
              <NutritionMacroDonut
                protein={mealDraftTotals.protein}
                carbs={mealDraftTotals.carbs}
                fat={mealDraftTotals.fat}
                calories={mealDraftTotals.calories}
                compact
              />
            ) : null}

            {mealItems.length ? (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {mealItems.map((item, index) => {
                  const kcal = itemKcal(item);
                  const detailsRow = mealItemToRow(item, foods);
                  return (
                    <li
                      key={item.draftKey}
                      className="flex items-center justify-between gap-2 rounded-lg border border-accent/20 bg-accent/5 px-2 py-1.5 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="material-symbols-outlined shrink-0 text-[14px] text-accent">restaurant</span>
                        <span className="truncate font-medium text-foreground">{item.name}</span>
                        <PlanItemInfoButton
                          size="sm"
                          onClick={() => setDetailsTarget(detailsRow)}
                          ariaLabel={t('nutrition.details')}
                        />
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-subtle bg-background px-1.5 py-0.5">
                          <input
                            type="number"
                            min={5}
                            max={5000}
                            step={5}
                            value={Math.round(item.grams)}
                            onChange={(e) => updateMealItemGrams(index, Number(e.target.value))}
                            className="w-12 bg-transparent text-center text-xs font-semibold tabular-nums text-foreground outline-none"
                            aria-label={t('dashboard.editGrams')}
                          />
                          <span className="text-[11px] font-semibold text-muted">g</span>
                          <span className="mx-0.5 text-[11px] text-faint">·</span>
                          <span className="pr-1 text-xs font-semibold tabular-nums text-foreground">{kcal} kcal</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeMealItem(index)}
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full border border-error-500/30 text-error-500 transition-colors hover:bg-error-500/10'
                          )}
                          aria-label={t('dashboard.removeFood')}
                        >
                          <span className="material-symbols-outlined text-[16px]">close</span>
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-subtle px-3 py-2 text-xs font-semibold text-muted">
                {t('nutrition.mealBuilderEmpty')}
              </p>
            )}

            {mealItems.length ? (
              <button
                type="submit"
                disabled={savingMeal}
                className="w-full rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-white disabled:opacity-50"
              >
                {savingMeal ? 'Saving...' : t('nutrition.savePersonalMeal')}
              </button>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-subtle/80 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-muted">
                {t('nutrition.searchMealFoods')}
              </span>
              <button
                type="button"
                onClick={() => setSavedMealsPickerOpen((open) => !open)}
                disabled={!meals.length}
                className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent/20 disabled:opacity-40"
              >
                {t('nutrition.addFromSavedMeals')}
              </button>
            </div>

            {savedMealsPickerOpen && meals.length ? (
              <div className="space-y-2 rounded-xl border border-subtle/80 bg-background/40 p-3">
                <p className="text-[10px] font-semibold text-faint">{t('nutrition.savedMealsPickerHint')}</p>
                <ul className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
                  {meals.map((meal) => (
                    <li
                      key={meal.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-subtle/80 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{meal.name}</p>
                        <p className="text-[11px] font-medium text-muted">
                          {meal.items.length} foods · {meal.totals?.calories ?? 0} kcal
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addItemsFromSavedMeal(meal)}
                        disabled={mealItems.length >= MEAL_ITEM_MAX}
                        className="shrink-0 rounded-lg border border-accent/30 bg-accent/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-accent hover:bg-accent/20 disabled:opacity-40"
                      >
                        {t('nutrition.addSavedMealFoods')}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <label className="block space-y-1.5">
              <input
                value={mealFoodQuery}
                onChange={(e) => setMealFoodQuery(e.target.value)}
                className="w-full rounded-xl border border-subtle bg-background px-4 py-3 text-sm font-semibold"
                placeholder={t('nutrition.searchMealFoods')}
              />
            </label>

            {!hasMealSearch ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMealPickTab('kitchen');
                    setMealLibraryCategoryId(null);
                  }}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors',
                    mealPickTab === 'kitchen'
                      ? 'bg-accent text-white'
                      : 'border border-subtle bg-background text-muted hover:text-foreground'
                  )}
                >
                  {t('nutrition.mealPickKitchen')}
                </button>
                <button
                  type="button"
                  onClick={() => setMealPickTab('library')}
                  className={cn(
                    'rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors',
                    mealPickTab === 'library'
                      ? 'bg-accent text-white'
                      : 'border border-subtle bg-background text-muted hover:text-foreground'
                  )}
                >
                  {t('nutrition.mealPickLibrary')}
                </button>
              </div>
            ) : null}

            {librarySearching || mealLibraryLoading ? (
              <p className="text-xs font-bold text-accent animate-pulse">{t('nutrition.searching')}</p>
            ) : null}

            {!hasMealSearch && mealPickTab === 'library' && !mealLibraryCategoryId ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-faint">{t('nutrition.mealBrowseCategories')}</p>
                <NutritionCategoryGrid
                  compact
                  categories={mealLibraryCategories}
                  onSelect={(id) => setMealLibraryCategoryId(id)}
                />
              </div>
            ) : null}

            {!hasMealSearch && mealPickTab === 'library' && mealLibraryCategoryId ? (
              <button
                type="button"
                onClick={() => setMealLibraryCategoryId(null)}
                className="text-xs font-black uppercase tracking-widest text-accent hover:underline"
              >
                {t('nutrition.backToCategories')}
              </button>
            ) : null}

            {displayMealPickRows.length ? (
              renderMealFoodPickList(displayMealPickRows)
            ) : (
              <p className="rounded-xl border border-dashed border-subtle px-3 py-3 text-sm font-bold text-muted">
                {hasMealSearch
                  ? t('nutrition.mealFoodSearchEmpty')
                  : mealPickTab === 'kitchen'
                    ? t('nutrition.mealKitchenEmpty')
                    : mealLibraryCategoryId
                      ? t('nutrition.categoryBrowseEmpty')
                      : t('nutrition.mealBrowseCategories')}
              </p>
            )}
          </div>

          {pendingMealRow ? (
            <div ref={pendingMealPanelRef} className="space-y-4 border-t border-accent/25 pt-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-accent/80">Add to meal</p>
                <h4 className="mt-1 text-lg font-black text-foreground">{pendingMealRow.name}</h4>
                <p className="mt-1 text-xs font-bold text-muted">{t('nutrition.per100g')}</p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-black uppercase tracking-wider text-muted">Amount (grams)</span>
                <input
                  value={pendingGrams}
                  onChange={(e) => setPendingGrams(e.target.value)}
                  type="number"
                  min={1}
                  className="w-full rounded-xl border border-subtle bg-background px-3 py-3 text-sm font-semibold"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={confirmAddPendingMealFood}
                  className="rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
                >
                  Add to meal
                </button>
                <button
                  type="button"
                  onClick={() => setPendingMealRow(null)}
                  className="rounded-xl border border-subtle px-4 py-3 text-xs font-black uppercase tracking-widest text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </form>
      ) : null}

      {mode === 'log' ? (
        <div ref={modeContentRef} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-subtle bg-elevated/50 p-4 sm:p-5">
            <div>
              <h3 className="text-sm font-black text-foreground">{t('nutrition.personalLogTitle')}</h3>
              <p className="mt-1 text-xs font-semibold text-muted">{t('nutrition.personalLogDesc')}</p>
            </div>
            <button
              type="button"
              onClick={() => setMode(null)}
              className="text-xs font-black uppercase tracking-widest text-accent hover:underline"
            >
              {t('nutrition.changePersonalOption')}
            </button>
          </div>

          {meals.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              {meals.map((meal) => (
                <article key={meal.id} className="glass-panel rounded-3xl border border-subtle p-5 space-y-3">
                  <div>
                    <span className="inline-block text-[10px] font-black uppercase tracking-[0.2em] text-accent/80 bg-accent/5 px-2.5 py-1 rounded-full border border-accent/10">
                      Personal meal
                    </span>
                    <h3 className="mt-2 text-lg font-black text-foreground">{meal.name}</h3>
                    <p className="mt-1 text-xs font-bold text-muted">
                      {meal.items.length} items · {meal.totals?.calories ?? 0} kcal · P {meal.totals?.protein ?? 0} · C{' '}
                      {meal.totals?.carbs ?? 0} · F {meal.totals?.fat ?? 0}
                    </p>
                  </div>
                  {meal.totals ? (
                    <NutritionMacroDonut
                      protein={meal.totals.protein}
                      carbs={meal.totals.carbs}
                      fat={meal.totals.fat}
                      calories={meal.totals.calories}
                      compact
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void logMeal(meal)}
                    className="w-full rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
                  >
                    {mealAddContext ? `Log to ${mealAddContext.slotLabel}` : 'Log meal'}
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-subtle p-5 space-y-4 text-center">
              <p className="text-sm font-bold text-muted">{t('nutrition.personalLogEmpty')}</p>
              <button
                type="button"
                onClick={() => setMode('build')}
                className="rounded-xl bg-accent px-4 py-3 text-xs font-black uppercase tracking-widest text-white"
              >
                {t('nutrition.buildFirstPersonalMeal')}
              </button>
            </div>
          )}
        </div>
      ) : null}
      <NutritionDetailsModal
        row={detailsTarget}
        onClose={() => setDetailsTarget(null)}
        stackAboveModal
      />
    </div>
  );

  if (typeof document === 'undefined') return content;

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {content}
    </div>,
    document.body
  );
};
