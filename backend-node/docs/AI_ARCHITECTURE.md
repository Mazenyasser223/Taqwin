# Taqwin AI Architecture

> **Migration in progress:** Target architecture is **Node (data + tools) + FastAPI (reasoning)**.
> See [docs/AI_COACH_ROADMAP.md](../../docs/AI_COACH_ROADMAP.md) and [ai-service/CONTRACT.md](../../ai-service/CONTRACT.md).
> When `AI_SERVICE_URL` is set, `POST /api/ai/chat` proxies to FastAPI; this document describes the **legacy Node + Mongo** stack still used for plans and fallback chat.

Generated personalized fitness + nutrition plans, persistent coach memory, and retrieval-augmented coaching, built on a hybrid Postgres + MongoDB stack.

## High-level flow

```mermaid
flowchart LR
  subgraph pg [Postgres]
    Prof[Profile + onboardingData]
    Food[FoodItem / WebtebFood]
    Ex[Exercise]
    Logs[FoodLog / WorkoutLog]
  end
  subgraph mongo [MongoDB]
    Plans[(plans)]
    Conv[(ai_conversations)]
    Msgs[(ai_messages)]
    Book[(book_chunks)]
    FoodVec[(food_embeddings)]
    ExVec[(exercise_embeddings)]
  end
  subgraph api [Express API]
    Tgts[plans/targets.js]
    Retr[rag/retrieveFoods | retrieveExercises | retrieveBook]
    Gen[POST /api/ai/plan/generate]
    Val[plans/validator.js]
    Fall[plans/fallback.js]
    Chat[POST /api/ai/chat]
    Guard[coach/offTopicGuard]
  end
  Prof --> Tgts --> Gen
  Food --> Retr --> Gen
  Ex --> Retr --> Gen
  Book --> Retr --> Gen
  FoodVec --> Retr
  ExVec --> Retr
  Gen --> Val --> Plans
  Val -- on fail x2 --> Fall --> Plans
  Plans --> Dash[GET /api/dashboard/athlete/home]
  Plans --> Chat
  Chat --> Guard
  Chat --> Msgs
  Conv --> Chat
```

## Storage split

| Concern                            | Store    | Reason |
|------------------------------------|----------|--------|
| Users, profiles, onboardingData    | Postgres | Stable, joins, ACID, existing |
| Food catalog (FoodItem, WebtebFood)| Postgres | Joins with logs, structured |
| Exercise catalog                   | Postgres | Joins with logs, structured |
| Food + workout logs                | Postgres | Transactional |
| AI-generated plans                 | Mongo    | Flexible JSON, frequent regenerations |
| AI chat conversations + messages   | Mongo    | Append-heavy, schemaless meta |
| Coaching book chunks               | Mongo    | Variable length, optional embeddings |
| Embeddings (food/exercise/book)    | Mongo    | Vector index via Atlas Vector Search |

Postgres remains the source of truth for everything the user actively edits. MongoDB stores AI-derived artifacts that we regenerate freely.

## Phase summary

1. **Targets** — `src/lib/plans/targets.js` — single source of truth for calories, protein, carbs, fat, and water. Used by dashboard, coach context, plan generator, and validator.
2. **Mongo plumbing** — `src/db/mongo/client.js` (lazy mongoose connection) + `models/plan.js` + `routes/ai/plan.js` (`GET /me`, `POST /generate`, `POST /regenerate`).
3. **Validator + fallback** — `src/lib/plans/schema.js` (Zod), `validator.js` (safety floors, gender-aware min calories, 85% protein coverage, ID whitelist, allergy/injury filters), `fallback.js` (deterministic safe plan).
4. **RAG-lite** — `src/lib/rag/retrieveFoods.js` (SQL filtered by allergy/budget/diet), `retrieveExercises.js` (filtered by injury/level/equipment).
5. **Generator** — `src/lib/plans/generator.js` orchestrates: load profile → targets → retrieve → LLM (temp 0.2) → parse JSON → validate → retry on failure → save plan to Mongo. After two failed attempts, the deterministic fallback is saved.
6. **Active plan everywhere** — `src/services/activePlanService.js` is read by `routes/dashboard.js` (so dashboard targets and exercises come from the saved plan) and `lib/coachContext.js` (so the chat coach mirrors the dashboard).
7. **Book RAG** — Markdown files under `data/coaching-book/` ingested with `scripts/ingest-coaching-book.js` into the `book_chunks` collection. `lib/rag/retrieveBook.js` returns chunks based on tag overlap and message keywords.
8. **Embeddings + vector search** — `src/services/embeddingsProvider.js` (OpenAI / Voyage / Ollama). Backfill scripts: `embed-foods.js`, `embed-exercises.js`, `embed-book.js`. `src/lib/rag/vectorSearch.js` uses `$vectorSearch` when `MONGO_VECTOR_SEARCH=true` and the corresponding index env vars are set in `.env`.
9. **Chat memory + guard** — `models/conversation.js` + `models/message.js` + `routes/ai/conversations.js` (list / messages / archive). `lib/coach/offTopicGuard.js` short-circuits unrelated requests. The frontend `ChatAssistant` stores the `conversationId` in `localStorage` and only sends the new turn once the server has history.
10. **Profile + dashboard surfaces** — `frontend/features/profile/AIPlanCard.tsx` shows the active plan and offers regeneration. Dashboard renders `analytics.dietToday.meals` and the workout day's `exercises` from the saved plan.

## Plan JSON contract

See `src/lib/plans/schema.js` and `src/db/mongo/models/plan.js`. Required fields per meal: `slot`, `name`, `grams`, macros. Foods reference Postgres via `foodItemId` (UUID) or `webtebId` (int). Exercises reference Postgres via `exerciseId` (UUID).

Anything not whitelisted is rejected by the validator. The plan generator retries once with the validator errors fed back to the model; a second failure triggers `fallback.js`, which composes a safe plan from a curated meal + exercise pool that respects the user's allergies and injuries.

## Safety guardrails (hardcoded, intentional)

- `SAFETY_MIN_CALORIES_MEN = 1700`, `SAFETY_MIN_CALORIES_WOMEN = 1500` — applied at both the targets layer and the validator. Overridden only when `Profile.medicalNotes` is non-empty.
- `MAX_DEFICIT_FRACTION = 0.25` — caps how far below maintenance a plan can go.
- `PROTEIN_COVERAGE_MIN = 0.85` — every day's planned meals must hit ≥85% of the daily protein target.
- `INJURY_BLOCKED_PATTERNS`, `ALLERGY_KEYWORDS`, `RELIGIOUS_DIET_BLOCKLIST` — see `src/lib/plans/constraints.js`. Tested via `scripts/test-plan-validator.js`.

## Environment

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL`, `DIRECT_URL` | Postgres | yes |
| `MONGO_URI` | Plan + conversation + book storage | needed for Phases 2–10 |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OLLAMA_BASE_URL` | LLM provider | needed for Phase 5+ |
| `OPENAI_API_KEY` / `VOYAGE_API_KEY` / `OLLAMA_BASE_URL` + `EMBED_PROVIDER` | Embeddings | optional (Phase 8) |
| `MONGO_VECTOR_SEARCH=true` + `MONGO_VECTOR_BOOK_INDEX` etc. | Atlas Vector Search | optional (Phase 8) |
| `AI_PLAN_RATE_LIMIT_MAX` | per-IP plan generation limit/min | optional (default 5) |
| `AI_PLAN_TEMPERATURE`, `AI_PLAN_MAX_TOKENS` | tuning | optional |

## NPM scripts

```
npm run ingest:coaching-book   # parse + write data/coaching-book/*.md to book_chunks
npm run embed:book             # add vector embeddings to book_chunks
npm run embed:foods            # food_embeddings collection
npm run embed:exercises        # exercise_embeddings collection
```

## Manual test checklist

1. **Onboarding triggers generation** — finish the diet questionnaire as an athlete with `foodAllergies=['nuts']`, `injuries=['knees']`. Verify the backend logs `AI plan generated` and `GET /api/ai/plan/me` returns a plan whose names contain no nut keywords and whose exercises don't include deep squats or box jumps.
2. **Dashboard mirrors saved plan** — open the dashboard; the Diet tab shows the new meals and the Workout tab lists the planned exercises. Macro targets equal `plan.dailyTargets`.
3. **Coach mirrors the plan** — ask the chat "what should I eat today?" — the reply references the same calorie/protein numbers and meal names.
4. **Regenerate** — open Profile → press *Regenerate*. The plan version increments by 1 and the previous one is deactivated.
5. **Off-topic guard** — ask "write me a python function". Expect the fixed off-topic reply.
6. **Persistent memory** — refresh the page; previous chat turns load from `/api/ai/conversations/:id/messages`.
7. **Validator failure path** — set `AI_PLAN_TEMPERATURE=1.5` and regenerate. With a high-temp model the validator should reject at least once; check logs for `plan validation failed` and `falling back to deterministic plan`. The saved plan's `source` will be `fallback`.
8. **No-Mongo degrade** — temporarily clear `MONGO_URI`. The dashboard should still render with formula-based targets and the chat should still respond; `GET /api/ai/plan/me` should return 503.
