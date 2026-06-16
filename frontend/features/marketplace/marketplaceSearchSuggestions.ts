export type MarketplaceSearchSuggestion = {
  label: string;
  query: string;
};

export type MarketplaceSearchSuggestionApi = {
  labelEn: string;
  labelAr: string;
  query: string;
};

export function mapSearchSuggestion(
  item: MarketplaceSearchSuggestionApi,
  language: string,
): MarketplaceSearchSuggestion {
  return {
    label: language === 'ar' && item.labelAr ? item.labelAr : item.labelEn,
    query: item.query,
  };
}

export function mapSearchSuggestions(
  items: MarketplaceSearchSuggestionApi[],
  language: string,
): MarketplaceSearchSuggestion[] {
  return items.map((item) => mapSearchSuggestion(item, language));
}
