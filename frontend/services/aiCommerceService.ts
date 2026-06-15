import apiClient, { ApiResponse } from './api';

import type { Product } from '../types';



export interface CommerceRecommendedRow {

  slot: string;

  reasonKey: string;

  reason?: string;

  reasonEn?: string;

  reasonAr?: string;

  reasonParams?: Record<string, string | null>;

  coOccurrenceCount?: number;

  matchedMeal?: string | null;

  product: Product;

}



export interface CommerceBundle {

  sessionId: string;

  bundleId: string;

  bundleTitle: string;

  locale: string;

  basedOn: {

    goal: string | null;

    weightKg: number | null;

    gender: string | null;

    fitnessLevel: string | null;

    proteinTargetG: number | null;

    trainingDaysPerWeek?: number | null;

  };

  products: CommerceRecommendedRow[];

  frequentlyBoughtTogether?: CommerceRecommendedRow[];

  subtotal: number;

  discountPercent: number;

  discountAmount: number;

  total: number;

  currency: string;

  empty: boolean;

  abTest?: {

    experimentId: string;

    experimentSlug: string;

    variantKey: string;

    variantName: string;

  } | null;

}



export interface DietPlanCommerce {

  locale: string;

  mealNames: string[];

  products: CommerceRecommendedRow[];

  subtotal: number;

  currency: string;

  empty: boolean;

}



export type CommerceEventType =

  | 'shown'

  | 'clicked'

  | 'bundle_added'

  | 'purchased'

  | 'dismissed'

  | 'feedback_positive'

  | 'feedback_negative';



/** Supabase pooler + multi-query bundle build can exceed the default 20s client timeout. */
const COMMERCE_READ_TIMEOUT_MS = 60_000;

class AiCommerceService {

  async getRecommendations(
    locale: 'en' | 'ar' = 'ar',
    source?: string,
  ): Promise<ApiResponse<{ bundle: CommerceBundle }>> {
    const params = new URLSearchParams({ locale });
    if (source) params.set('source', source);
    return apiClient.get<{ bundle: CommerceBundle }>(
      `/api/ai/commerce/recommendations?${params.toString()}`,
      { timeoutMs: COMMERCE_READ_TIMEOUT_MS },
    );
  }



  async getDietProducts(

    locale: 'en' | 'ar' = 'ar',

    dayIndex?: number,

  ): Promise<ApiResponse<{ dietProducts: DietPlanCommerce }>> {

    const params = new URLSearchParams({ locale });

    if (dayIndex != null) params.set('dayIndex', String(dayIndex));

    return apiClient.get<{ dietProducts: DietPlanCommerce }>(
      `/api/ai/commerce/diet-products?${params.toString()}`,
      { timeoutMs: COMMERCE_READ_TIMEOUT_MS },
    );

  }



  async trackEvent(payload: {

    eventType: CommerceEventType;

    source: string;

    sessionId?: string;

    bundleId?: string;

    productId?: string;

    productIds?: string[];

    metadata?: Record<string, unknown>;

  }): Promise<ApiResponse<{ ok: boolean; eventId: string | null }>> {

    return apiClient.post('/api/ai/commerce/events', payload);

  }

}



export const aiCommerceService = new AiCommerceService();

export default aiCommerceService;

