# Taqwin AI Architecture

> **Current implementation** (Mongo plans, in-process LLM). **Target production hosting:** [../../docs/SYSTEM-ARCHITECTURE.md](../../docs/SYSTEM-ARCHITECTURE.md) · [../../docs/DEPLOY-HOSTINGER.md](../../docs/DEPLOY-HOSTINGER.md). **Roadmap:** [../../AI-COACH-ARCHITECTURE.md](../../AI-COACH-ARCHITECTURE.md).

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
7. **Book RAG** — Markdown under `data/coaching-book/` (Taqwin-local topics) and `data/books/` (full books, e.g. Bigger Leaner Stronger) ingested with `scripts/ingest-coaching-book.js` into `book_chunks`. Split long books with `scripts/split-bls-pdf.js` (`npm run split:bls-pdf`). `lib/rag/retrieveBook.js` returns chunks based on tag overlap and message keywords.
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

## Block A1 — Redis + Mongo (foundation)

| Piece | Location |
|-------|----------|
| Mongo client + boot connect | `src/db/mongo/client.js` |
| Index sync on connect | `src/db/mongo/ensureIndexes.js` |
| Redis (TCP or Upstash REST) | `src/lib/redis.js` |
| `/health` store probes | `src/lib/infraHealth.js`, `src/app.js` |
| Verify script | `npm run verify:a1` |

**Done when:** `verify:a1` passes; server logs `Infrastructure ready`; `GET /health` includes `stores.postgres`, `stores.redis`, `stores.mongo`.

## Book sources (Mongo RAG today)

| Path | Content | `sourceFile` prefix |
|------|---------|---------------------|
| `data/coaching-book/*.md` | Short Taqwin supplements (injuries, Ramadan, budget protein, …) | `coaching-book/` |
| `data/books/<book-id>/*.md` | Full book chapters (YAML frontmatter + `#` heading) | `books/<book-id>/` |

**Bigger Leaner Stronger (2nd ed.)** — canonical tree at `data/books/bigger-leaner-stronger/`:

- `source/Bigger Leaner Stronger.pdf` — local only (gitignored)
- `00-promise.md` … `25-ch24-faq.md` — 26 chapters from `npm run split:bls-pdf`
- `_meta.yaml` — `level: L5_BOOKS` metadata for future Postgres ingest

Re-ingest after edits: `npm run ingest:coaching-book`. Chunks use file-level tags from frontmatter; PDF extract often yields one chunk per chapter until `##` headings are added or vector search is enabled.

## Block B8 — L5 books (Postgres + pgvector, planned)

Same markdown files above become the canonical source for **L5_BOOKS** when Block B8 lands. No duplicate copy in Supabase unless storing the PDF for archival.

| Step | Target |
|------|--------|
| Document | One `KnowledgeDocument` per chapter file (`storagePath` optional; content in `KnowledgeChunk`) |
| Chunking | 500–800 tokens with overlap (not heading-only splits) |
| Embed | pgvector on `KnowledgeChunk`; level filter `L5_BOOKS` |
| Script | Future `scripts/rag/ingest-knowledge.js` (or `npm run rag:ingest`) |
| Priority | L1 > L2 > L3 > L4 > **L5** — books used for deep/scientific intent only |

Schema already exists: `KnowledgeDocument`, `KnowledgeChunk`, enum `KnowledgeLevel.L5_BOOKS` in `prisma/schema.prisma`. See [AI-COACH-ARCHITECTURE.md](../../AI-COACH-ARCHITECTURE.md) Block B roadmap.

## Block A2 — ai-service skeleton (FastAPI)

| Piece | Location |
|-------|----------|
| FastAPI app + `/health` | `ai-service/app/main.py`, `app/routers/health.py` |
| `/chat` echo stub | `ai-service/app/routers/chat.py` |
| Docker + env template | `ai-service/Dockerfile`, `ai-service/.env.example` |
| Tests | `cd ai-service && pytest` |

**Done when:** `uvicorn app.main:app --port 8000` runs; `GET /health` → 200; `pytest` passes. Node bridge is **Block A3** (`FEATURE_AI_VIA_FASTAPI`).

## Block A3 — Node ↔ FastAPI bridge

| Piece | Location |
|-------|----------|
| FastAPI HTTP client | `src/services/aiFastApiClient.js` |
| Proxy + fallback | `src/routes/ai.js` (`FEATURE_AI_VIA_FASTAPI`, `AI_SERVICE_URL`) |
| Optional `threadId` on chat body | `src/routes/ai.js` (defaults to `conversationId`) |
| Env template | `backend-node/.env.example` |

**Done when:** With `FEATURE_AI_VIA_FASTAPI=true` and ai-service running, chat replies include `[taqwin-ai stub]`; with FastAPI down or flag off, Node LLM path still works.

```bash
# Terminal 1
cd ai-service && uvicorn app.main:app --reload --port 8000
# Terminal 2
cd backend-node && FEATURE_AI_VIA_FASTAPI=true AI_SERVICE_URL=http://localhost:8000 npm run dev
```

## Block A4 — Internal API + tool executor

| Piece | Location |
|-------|----------|
| `X-Internal-Key` middleware | `src/middleware/internalAuth.js` |
| Tool executor + audit log | `src/services/aiToolExecutor.js` |
| `POST /api/internal/ai/tools/execute` | `src/routes/internal/ai.js` |
| Mounted in app | `src/app.js` |

Stub tools: `ping`, `echo`. Every call writes `AiToolExecution` in Postgres.

**Done when:** `curl` with `X-Internal-Key` runs `ping` and returns `{ success: true, output: { ok: true, ... } }`.

```bash
# Set AI_INTERNAL_KEY in backend-node/.env (same as ai-service/.env)
curl -s -X POST http://localhost:4000/api/internal/ai/tools/execute \
  -H "Content-Type: application/json" \
  -H "X-Internal-Key: $AI_INTERNAL_KEY" \
  -d '{"userId":"<your-user-uuid>","toolName":"ping","input":{}}'
```

## Environment

| Variable | Purpose | Required |
|----------|---------|----------|
| `DATABASE_URL`, `DIRECT_URL` | Postgres | yes |
| `MONGO_URI` or `MONGODB_URI` | Plan + conversation + book storage | needed for Phases 2–10 |
| `REDIS_URL` or `UPSTASH_REDIS_REST_*` | FDC cache; CAG/queues later | optional in dev |
| `AI_INTERNAL_KEY` | FastAPI → Node internal API (`X-Internal-Key`) | Block A4+ |
| `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OLLAMA_BASE_URL` | LLM provider | needed for Phase 5+ |
| `OPENAI_API_KEY` / `VOYAGE_API_KEY` / `OLLAMA_BASE_URL` + `EMBED_PROVIDER` | Embeddings | optional (Phase 8) |
| `MONGO_VECTOR_SEARCH=true` + `MONGO_VECTOR_BOOK_INDEX` etc. | Atlas Vector Search | optional (Phase 8) |
| `AI_PLAN_RATE_LIMIT_MAX` | per-IP plan generation limit/min | optional (default 5) |
| `AI_PLAN_TEMPERATURE`, `AI_PLAN_MAX_TOKENS` | tuning | optional |

## NPM scripts

```
npm run verify:a0              # Postgres A0 schema + pgvector
npm run verify:a1              # Postgres + Redis + Mongo probes
npm run split:bls-pdf          # PDF → data/books/bigger-leaner-stronger/*.md
npm run ingest:coaching-book   # data/coaching-book + data/books → book_chunks
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
7. **Book RAG (BLS)** — after `npm run split:bls-pdf` and `npm run ingest:coaching-book`, ask "What are the three laws of muscle growth?" — reply should align with BLS Ch 6 content; ask about the BLS workout routine — should reference Ch 18 material.
8. **Validator failure path** — set `AI_PLAN_TEMPERATURE=1.5` and regenerate. With a high-temp model the validator should reject at least once; check logs for `plan validation failed` and `falling back to deterministic plan`. The saved plan's `source` will be `fallback`.
9. **No-Mongo degrade** — temporarily clear `MONGO_URI`. The dashboard should still render with formula-based targets and the chat should still respond; `GET /api/ai/plan/me` should return 503.
