/**
 * Browse categories aligned with common Arabic nutrition apps.
 * Each maps to USDA FDC search terms (English — FDC is US/English).
 */
const FDC_CATEGORIES = [
  { id: 'dairy-eggs', query: 'dairy eggs milk cheese yogurt', icon: 'egg' },
  { id: 'fats-oils', query: 'cooking oil butter margarine', icon: 'water_drop' },
  { id: 'soups-broths', query: 'soup broth stock', icon: 'soup_kitchen' },
  { id: 'breakfast-cereals', query: 'breakfast cereal oats granola', icon: 'breakfast_dining' },
  { id: 'vegetables', query: 'vegetables fresh frozen', icon: 'eco' },
  { id: 'beef', query: 'beef steak ground beef', icon: 'set_meal' },
  { id: 'seafood', query: 'seafood fish shrimp salmon tuna', icon: 'phishing' },
  { id: 'lamb-veal', query: 'lamb veal mutton', icon: 'restaurant' },
  { id: 'sweets', query: 'candy chocolate dessert cookies', icon: 'cake' },
  { id: 'fast-food', query: 'fast food burger pizza', icon: 'fastfood' },
  { id: 'snacks', query: 'snacks chips crackers popcorn', icon: 'cookie' },
  { id: 'herbs-spices', query: 'herbs spices seasoning', icon: 'spa' },
  { id: 'poultry', query: 'poultry chicken turkey', icon: 'egg_alt' },
  { id: 'processed-meats', query: 'deli ham sausage bacon processed meat', icon: 'lunch_dining' },
  { id: 'fruits-juices', query: 'fruit juice smoothie', icon: 'nutrition' },
  { id: 'nuts-seeds', query: 'nuts seeds almonds peanut walnut', icon: 'grain' },
  { id: 'beverages', query: 'beverage drink soda tea coffee', icon: 'local_cafe' },
  { id: 'legumes', query: 'legumes beans lentils chickpeas', icon: 'grass' },
  { id: 'bakery', query: 'bakery bread pastry muffin', icon: 'bakery_dining' },
  { id: 'grains-pasta', query: 'rice pasta grains quinoa', icon: 'ramen_dining' },
  { id: 'meals-sandwiches', query: 'sandwich wrap meal appetizer', icon: 'lunch_dining' },
];

function getCategoryById(id) {
  return FDC_CATEGORIES.find((c) => c.id === id) || null;
}

module.exports = { FDC_CATEGORIES, getCategoryById };
