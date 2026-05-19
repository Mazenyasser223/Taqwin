/** Accent colors for category browse tiles */
const CATEGORY_TILE_CLASS: Record<string, string> = {
  'dairy-eggs': 'from-sky-500/20 to-sky-600/5 text-sky-400',
  'fats-oils': 'from-amber-500/20 to-amber-600/5 text-amber-400',
  'soups-broths': 'from-orange-500/20 to-orange-600/5 text-orange-400',
  'breakfast-cereals': 'from-yellow-500/20 to-yellow-600/5 text-yellow-400',
  vegetables: 'from-emerald-500/20 to-emerald-600/5 text-emerald-400',
  beef: 'from-red-500/20 to-red-600/5 text-red-400',
  seafood: 'from-cyan-500/20 to-cyan-600/5 text-cyan-400',
  'lamb-veal': 'from-rose-500/20 to-rose-600/5 text-rose-400',
  sweets: 'from-pink-500/20 to-pink-600/5 text-pink-400',
  'fast-food': 'from-orange-600/20 to-orange-700/5 text-orange-400',
  snacks: 'from-lime-500/20 to-lime-600/5 text-lime-400',
  'herbs-spices': 'from-green-500/20 to-green-600/5 text-green-400',
  poultry: 'from-amber-600/20 to-amber-700/5 text-amber-300',
  'processed-meats': 'from-red-600/20 to-red-700/5 text-red-300',
  'fruits-juices': 'from-fuchsia-500/20 to-fuchsia-600/5 text-fuchsia-400',
  'nuts-seeds': 'from-yellow-600/20 to-yellow-700/5 text-yellow-300',
  beverages: 'from-blue-500/20 to-blue-600/5 text-blue-400',
  legumes: 'from-teal-500/20 to-teal-600/5 text-teal-400',
  bakery: 'from-amber-400/20 to-amber-500/5 text-amber-300',
  'grains-pasta': 'from-stone-500/20 to-stone-600/5 text-stone-400',
  'meals-sandwiches': 'from-violet-500/20 to-violet-600/5 text-violet-400',
};

export function categoryTileClass(id: string): string {
  return CATEGORY_TILE_CLASS[id] ?? 'from-accent/20 to-accent/5 text-accent';
}
