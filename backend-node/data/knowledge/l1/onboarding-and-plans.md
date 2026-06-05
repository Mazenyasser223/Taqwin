---
topic: Onboarding and AI plans
tags: [platform, onboarding, plans, questionnaire, injuries, allergies]
lang: en
locale: en
---
# Onboarding and plan generation

## Onboarding flow

The athlete questionnaire collects:

- **Primary goal** — lose fat, build muscle, maintain, endurance, etc.
- **Diet** — standard, vegetarian, vegan, religious restrictions (halal, etc.).
- **Food allergies** — nuts, dairy, gluten, etc. (excluded from plan foods).
- **Injuries** — knees, back, shoulders, etc. (blocked exercises filtered out).
- **Workout location** — home, gym, both (affects exercise selection).
- **Food budget** — influences food RAG ranking.
- **Optional** — InBody scan upload, progress photos, avatar.

Completing onboarding triggers **AI plan generation** (when Mongo and an LLM provider are configured).

## Plan structure

Generated plans include:

- **dailyTargets** — calories, protein, carbs, fat, water.
- **dietDays** — 7 days × meals (breakfast, lunch, dinner, snack) with `foodItemId` or `webtebId`.
- **workoutWeeks** — 4 weeks × 7 days with `exerciseId` per set (rest days allowed).

The validator enforces:

- Only whitelisted food and exercise IDs.
- No allergens or blocked injury exercises.
- Protein ≥ 85% of daily target per diet day.
- Calories within ±10% of target.

## Fallback

If the LLM returns invalid JSON twice, or no AI provider is configured, a **deterministic fallback plan** is saved so the dashboard still works.

## Dashboard without chat

After onboarding, the athlete should see today's workout and meals on the dashboard via `GET /api/ai/plan/me` and athlete home — no chat required.
