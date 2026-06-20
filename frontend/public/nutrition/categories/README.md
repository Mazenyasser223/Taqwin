# Nutrition category images

Place one image per food category in this folder. Preferred format: **`.jpg`** or **`.webp`**, ~800×1000 px.

After adding images, refresh the app (F5) or run the sync script to copy from the repo `nutrition/` asset tree:

```bash
npm run sync:nutrition-categories --prefix backend-node
```

## File naming

| Filename | Category |
|----------|----------|
| `dairy-eggs.jpg` | Dairy & eggs |
| `fats-oils.jpg` | Fats & oils |
| `herbs-spices.jpg` | Herbs & spices |
| `soups-broths.jpg` | Soups & broths |
| `breakfast-cereals.jpg` | Breakfast cereals |
| `vegetables.jpg` | Vegetables |
| `beef.jpg` | Beef |
| `seafood.jpg` | Seafood |
| `lamb-veal.jpg` | Lamb & veal |
| `sweets.jpg` | Sweets |
| `fast-food.jpg` | Fast food |
| `snacks.jpg` | Snacks |
| `poultry.jpg` | Poultry |
| `processed-meats.jpg` | Processed meats |
| `fruits-juices.jpg` | Fruits & juices |
| `nuts-seeds.jpg` | Nuts & seeds |
| `beverages.jpg` | Beverages |
| `legumes.jpg` | Legumes |
| `bakery.jpg` | Bakery |
| `grains-pasta.jpg` | Grains & pasta |

## Alternate IDs

If the database category id differs (e.g. `spices-and-herbs`), either:

- Copy the same image as `spices-and-herbs.jpg`, or
- Rely on the app fallback to `herbs-spices.jpg`

## Related paths

- Cover images for the nutrition browse UI also live in `frontend/public/nutrition-categories/`
- Source food photos (repo root): `nutrition/` — synced via `npm run sync:nutrition-photos --prefix backend-node`
- Frontend nutrition module: `frontend/features/nutrition/`
- Frontend overview: [../../../README.md](../../../README.md)
