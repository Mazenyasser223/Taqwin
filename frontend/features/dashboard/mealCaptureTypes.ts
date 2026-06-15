export type MealCaptureConfidence = 'low' | 'medium' | 'high';

export type MealCaptureFoodCategory =
  | 'main'
  | 'side'
  | 'drink'
  | 'dessert'
  | 'fruit'
  | 'vegetable'
  | 'condiment';

export type MealCaptureItemConfidence = {
  identification: MealCaptureConfidence;
  portion_estimation: MealCaptureConfidence;
  nutrition_estimation: MealCaptureConfidence;
};

export type MealCaptureFoodItem = {
  name: string;
  category?: MealCaptureFoodCategory;
  cooking_style?: string;
  visible_ingredients?: string[];
  estimated_weight_grams: number;
  portion_description?: string;
  estimated_calories: number;
  calorie_range?: { min: number; max: number };
  macros: { protein: number; carbs: number; fat: number };
  confidence?: MealCaptureItemConfidence | MealCaptureConfidence;
  confidence_score?: number;
  hidden_calorie_sources?: string[];
  webtebId?: number | null;
  kitchenFood?: boolean;
  dbMatched?: boolean;
  dbFoodName?: string;
  dbMatchScore?: number;
};

export type MealCaptureSameMealValidation = {
  passed: boolean;
  confidence: number;
  issues: string[];
};

export type MealCaptureImageQuality = {
  index: number;
  blur: 'ok' | 'warn' | 'fail';
  brightness: 'ok' | 'warn' | 'fail';
  resolution: 'ok' | 'warn' | 'fail';
  food_visible: boolean;
  full_plate_visible?: boolean;
  notes?: string;
};

export type MealCaptureResult = {
  meal_summary: {
    estimated_calories: number;
    calorie_range?: { min: number; max: number };
    macros: { protein: number; carbs: number; fat: number };
    confidence: MealCaptureConfidence;
    overall_confidence?: number;
    possible_hidden_calories?: number;
  };
  food_items: MealCaptureFoodItem[];
  same_meal_validation?: MealCaptureSameMealValidation;
  image_quality?: MealCaptureImageQuality[];
  analysis_notes?: string[];
  follow_up_questions?: string[];
  reference_found?: boolean;
  error?: string;
  message?: string;
};

export const MEAL_CAPTURE_REF_OPTIONS = [
  { id: 'none', labelKey: 'dashboard.captureRefNone' as const },
  { id: 'card', labelKey: 'dashboard.captureRefCard' as const },
  { id: 'coin', labelKey: 'dashboard.captureRefCoin' as const },
  { id: 'pen', labelKey: 'dashboard.captureRefPen' as const },
  { id: 'custom', labelKey: 'dashboard.captureRefCustom' as const },
] as const;

export const MEAL_CAPTURE_REF_VALUES: Record<string, string> = {
  none: 'None (AI Guess)',
  card: 'Standard Credit Card (8.5cm)',
  coin: 'Standard Coin (~2.5cm)',
  pen: 'Standard Pen/Pencil (~19cm)',
};

export const MAX_MEAL_CAPTURE_IMAGES = 6;

export const MEAL_CAPTURE_ANGLE_HINTS = [
  { id: 'top', labelKey: 'dashboard.captureAngleTop' as const },
  { id: 'side', labelKey: 'dashboard.captureAngleSide' as const },
  { id: 'oblique', labelKey: 'dashboard.captureAngleOblique' as const },
  { id: 'close', labelKey: 'dashboard.captureAngleClose' as const },
] as const;
