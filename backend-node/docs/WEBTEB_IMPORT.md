# WebTeb nutrition import

Licensed import from [webteb.com/nutritionfacts](https://www.webteb.com/nutritionfacts) into PostgreSQL.

## Setup

```bash
cd backend-node
npm install
npx prisma migrate deploy
```

## Import (one-time or periodic)

```bash
# Full catalog via sitemap (~2110 foods, ~35–60 min at 900ms/request)
npm run import:webteb

# Single category, first N items (testing)
node scripts/import-webteb.js --category=vegetables --limit-per-category=50

# Options
#   --delay-ms=1200     pause between HTTP requests
#   --force             re-scrape even if webtebId exists
```

## API (auth required)

| Endpoint | Description |
|----------|-------------|
| `GET /api/nutrition/webteb/categories` | Browse categories |
| `GET /api/nutrition/webteb/search?q=&categoryId=&page=` | Search / list |
| `GET /api/nutrition/webteb/:webtebId` | Full details (all nutrient tables in `sections`) |
| `POST /api/nutrition/webteb/import` | Create `FoodItem` for logging |

USDA routes remain under `/api/nutrition/fdc/*`.

## Frontend

Nutrition Lab defaults to **WebTeb**; toggle **USDA** in the page header.
