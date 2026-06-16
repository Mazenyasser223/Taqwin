-- Remove "Meals, Appetizers, Sandwiches" nutrition category and its foods.

DELETE FROM "food_items"
WHERE "webteb_id" IN (
  SELECT "webteb_id" FROM "webteb_foods"
  WHERE "category_id" = 'meals-sandwiches'
     OR "category_slug" IN ('meals-entrees-and-sidedishes', 'meals-entrees-and-side-dishes')
);

DELETE FROM "webteb_foods"
WHERE "category_id" = 'meals-sandwiches'
   OR "category_slug" IN ('meals-entrees-and-sidedishes', 'meals-entrees-and-side-dishes');

DELETE FROM "webteb_categories"
WHERE "id" = 'meals-sandwiches'
   OR "slug" IN ('meals-entrees-and-sidedishes', 'meals-entrees-and-side-dishes');
