# Taqwin Backend API

Node.js / Express API for the Taqwin fitness platform. Handles authentication, profiles, plans, nutrition, exercises, community, compete/gamification, marketplace commerce, gym operations, and proxies AI coach traffic to the FastAPI `ai-service`.

## Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 18+ |
| Framework | Express |
| ORM | Prisma → PostgreSQL (+ pgvector for RAG) |
| AI datastore | MongoDB (chat, traces, audit — not official plans) |
| Cache & queues | Redis (CAG cache, BullMQ) |
| Auth | JWT + Passport Google OAuth + 2FA + step-up |
| Email | Nodemailer (Gmail) |
| Payments | Stripe / Paymob webhooks |
| Storage | Supabase Storage (or local disk in dev) |
| Realtime | WebSocket hub + Redis pub/sub |

## Project structure

```text
backend-node/
├── README.md
├── package.json
├── Dockerfile
├── .env.example
│
├── prisma/
│   ├── schema.prisma              # PostgreSQL schema (users, plans, catalogs, RAG, commerce)
│   ├── seed.js                    # Demo seed data
│   ├── communitySeed.js           # Community demo seed
│   ├── onboardingCatalogSeed.js
│   └── migrations/                # Prisma migration history
│
├── src/
│   ├── index.js                   # HTTP server entry
│   ├── worker.js                  # BullMQ worker entry (npm run worker)
│   ├── app.js                     # Express app setup, middleware, route mounting
│   ├── db.js                      # Prisma client + connection pool tuning
│   │
│   ├── config/
│   │   └── passport.js            # Google OAuth strategy
│   │
│   ├── routes/
│   │   ├── auth.js                # Login, register, OAuth, 2FA, password reset
│   │   ├── profile.js             # Athlete/gym profile CRUD
│   │   ├── settings.js            # User settings
│   │   ├── settingsAccount.js     # Account management (email, password, delete)
│   │   ├── dashboard.js           # Dashboard aggregates
│   │   ├── plans.js               # Plan CRUD, generation triggers
│   │   ├── adaptation.js          # Plan adaptation endpoints
│   │   ├── workouts.js            # Workout logging
│   │   ├── exercises.js           # Exercise catalog API
│   │   ├── nutrition.js           # Food search, logging, targets, private library
│   │   ├── ai.js                  # AI coach proxy → FastAPI
│   │   ├── ai/                    # Plan, conversations, commerce, notify sub-routes
│   │   ├── internal/              # FastAPI ↔ Node internal API (tools, CAG, RAG, cron, e2e)
│   │   ├── community/             # Feed router (index + router)
│   │   ├── communityExtras.js     # DMs, groups, mentions, follow, browse
│   │   ├── marketplace.js         # Shop catalog, cart, orders
│   │   ├── marketplacePayments.js # Checkout / payment session
│   │   ├── marketplaceMarketing.js
│   │   ├── marketplaceOptimization.js
│   │   ├── stripeWebhook.js       # Stripe webhook handler
│   │   ├── gyms.js                # Gym CRUD, discovery, reviews
│   │   ├── gymStaff.js            # Gym staff management
│   │   ├── gymReception.js        # Reception desk flows
│   │   ├── gymEquipment.js        # Equipment inventory
│   │   ├── gymClasses.js          # Class schedules
│   │   ├── gymBasicSessions.js    # Basic session booking
│   │   ├── gamification.js        # Compete leagues, challenges, XP
│   │   ├── inbody.js              # InBody scan integration
│   │   ├── progressPhotos.js      # Progress photo uploads
│   │   ├── telegram.js            # Telegram alert settings
│   │   ├── notifications.js       # Push/in-app notifications
│   │   ├── uploads.js             # File upload handling
│   │   ├── support.js             # Support tickets
│   │   └── admin/                 # Shop admin notifications, catalog ops
│   │
│   ├── services/
│   │   ├── aiFastApiClient.js     # HTTP client to ai-service
│   │   ├── aiChatProvider.js      # Chat provider abstraction
│   │   ├── coachChatTurn.js       # Single coach turn orchestration
│   │   ├── coachChatStream.js     # WebSocket token streaming
│   │   ├── coachChatActions.js    # Pending action handling
│   │   ├── aiToolExecutor.js      # Tool execution dispatcher
│   │   ├── pendingActionService.js
│   │   ├── pendingActionExecute.js
│   │   ├── activePlanService.js   # Single active plan for dashboard + coach
│   │   ├── aiMemoryService.js     # AiMemory read/write
│   │   ├── agentTraceService.js   # Agent trace persistence
│   │   ├── llmOutputService.js    # LLM audit log
│   │   ├── analyticsEventService.js
│   │   ├── ragObservabilityService.js
│   │   ├── embeddingsProvider.js  # OpenAI/Gemini embeddings for RAG
│   │   ├── emailService.js
│   │   ├── smsService.js
│   │   ├── stripeClient.js
│   │   ├── paymobService.js
│   │   ├── fdcService.js          # USDA FDC integration
│   │   ├── fatsecretClient.js
│   │   ├── translateService.js
│   │   └── community/             # Feed, posts, stories, inbox, groups, browse, …
│   │
│   ├── lib/
│   │   ├── plans/                 # Generator, validator, blueprints, staples, coach programs
│   │   ├── plan-generation/       # Plan generation orchestration helpers
│   │   ├── rag/                   # ragRetrieve, hybridSearch, pgvectorSearch, L5 retrieval
│   │   ├── adaptation/            # Mid-week triggers, smart notify, adherence
│   │   ├── ai/                    # Memory pipeline, memory events, summarize batch
│   │   ├── cag/                   # Context bundle build, sanitize, truncate
│   │   ├── coach/                 # Greeting, semantics, off-topic guard, step-up auth
│   │   ├── commerce/              # Shop catalog, cart, checkout helpers
│   │   ├── gamification/          # League/challenge logic
│   │   ├── nutrition/             # Food pipeline, validators, substitution, repair
│   │   ├── notifications/         # Notification builders and delivery
│   │   ├── telegram/              # Telegram bot integration
│   │   ├── inbody/                # InBody parsing helpers
│   │   ├── progressPhoto/         # Progress photo processing
│   │   ├── contextBundle.js       # CAG assembly for FastAPI coach
│   │   ├── chatMemory.js          # MongoDB chat thread storage
│   │   ├── coachPlan.js           # Coach plan context helpers
│   │   ├── dashboardCache.js      # Redis dashboard cache
│   │   ├── aiToolHandlersExtended.js
│   │   ├── aiToolResolvers.js
│   │   └── …                      # Exercise, community, storage, gym helpers
│   │
│   ├── jobs/
│   │   ├── queues.js              # BullMQ queue definitions
│   │   ├── planGenerateJobs.js
│   │   ├── planAdaptWeeklyJobs.js
│   │   ├── planDailyRefreshJobs.js
│   │   ├── planMidWeekJobs.js
│   │   ├── aiMemoryJobs.js
│   │   ├── schedulers/            # Cron schedulers (mid-week, memory, smart notify)
│   │   └── workers/               # BullMQ workers (plans, adaptation, memory)
│   │
│   ├── db/
│   │   └── mongo/                 # Mongoose models (chat, traces, analytics)
│   │
│   ├── realtime/
│   │   ├── wsHub.js               # WebSocket server
│   │   ├── publish.js             # Event publishing
│   │   ├── streamCoachTokens.js   # Coach token stream bridge
│   │   ├── redisBus.js            # Cross-instance pub/sub
│   │   └── handlers/              # coach, coachActions, presence
│   │
│   └── middleware/                # Auth, rate limit, error handling
│
├── data/
│   ├── knowledge/
│   │   └── l1/                    # Platform docs → RAG L1 ingest
│   └── books/                     # Coaching book markdown → RAG L5 ingest
│
├── scripts/
│   ├── rag/                       # ingest-l1 … l5, embed missing chunks, backfill
│   ├── lib/                       # Shared script utilities
│   ├── verify-*.js                # Block verification scripts (a0–e7, community, compete)
│   ├── cron-enqueue-*.js          # Cron job enqueue helpers
│   ├── import-webteb.js           # WebTeb nutrition catalog import
│   ├── import-musclewiki-*.js     # MuscleWiki exercise import
│   ├── sync-musclewiki-videos.js  # Exercise video sync
│   ├── build-plan-staple-*.js     # Generate shared/ plan staple JSON
│   └── seed-*.js                  # Community, compete, commerce demo seeds
│
├── tests/                         # Vitest unit tests
└── docs/
    ├── AI_ARCHITECTURE.md         # Detailed AI integration docs
    ├── STRIPE_CHECKOUT.md         # Stripe checkout setup
    └── SHOP_PRODUCTION_CHECKLIST.md
```

## Getting started

### Prerequisites

- Node.js 18+, npm
- PostgreSQL (Supabase recommended)
- MongoDB + Redis recommended for full AI features
- Running `ai-service` for chat (`FEATURE_AI_VIA_FASTAPI=true`)

### Install

```bash
cd backend-node
npm install
cp .env.example .env
```

### PostgreSQL via Supabase (recommended)

1. Create a project at [supabase.com](https://supabase.com).
2. Copy the **URI** connection string from **Project Settings → Database**.
3. Set `DATABASE_URL` with `?sslmode=require` if not present.
4. If using **pooling** (port `6543`), also set **`DIRECT_URL`** to the direct Postgres URL (port `5432`) for migrations.
5. Run migrations:

```bash
npm run db:migrate
npm run db:seed          # optional
```

### Minimum `.env` for local development

```env
PORT=4000
NODE_ENV=development
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
JWT_SECRET=your-secret-min-32-chars-change-in-production
FRONTEND_URL=http://localhost:3000
FEATURE_AI_VIA_FASTAPI=true
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_KEY=<shared with ai-service>
```

Optional: `MONGO_URI`, `REDIS_URL`, Google OAuth, Gmail SMTP, embedding keys for RAG ingest, Supabase storage keys.

### Run

```bash
npm run dev          # API with file watching (port 4000)
npm run worker       # BullMQ workers (separate terminal)
```

Health: `curl http://localhost:4000/health`

## Key scripts

### Database

| Command | Purpose |
|---------|---------|
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run db:generate` | Regenerate Prisma client |
| `npm run setup:community` | Migrations + community schema helpers |
| `npm run setup:compete` | Migrations + compete/challenge seed |
| `npm run setup:plans` | Migrations + plan demo seed |

### RAG ingest

| Command | Purpose |
|---------|---------|
| `npm run rag:ingest:l1` | Platform docs → pgvector L1 |
| `npm run rag:ingest:l2` | Exercise catalog → L2 |
| `npm run rag:ingest:l3` | Food catalog → L3 |
| `npm run rag:ingest:l5` | Coaching books → L5 |
| `npm run embed:foods` | Embed food catalog |
| `npm run embed:exercises` | Embed exercise catalog |

### Catalog imports & media sync

| Command | Purpose |
|---------|---------|
| `npm run import:webteb` | Import WebTeb nutrition catalog |
| `npm run import:musclewiki` | Import MuscleWiki exercises |
| `npm run sync:musclewiki-videos` | Sync exercise demo videos |
| `npm run sync:nutrition-categories` | Sync nutrition category cover photos |
| `npm run sync:exercise-categories` | Sync exercise category cover photos |
| `npm run build:plan-staples` | Build plan staple food JSON → `shared/` |
| `npm run build:plan-staple-exercises` | Build plan staple exercise JSON → `shared/` |

### Verification

| Command | Purpose |
|---------|---------|
| `npm run verify:production` | Env + storage + pgvector checks |
| `npm run verify:community` | Community feature smoke test |
| `npm run verify:compete` | Compete/gamification smoke test |
| `npm run verify:b1` … `b8` | RAG block smoke tests |
| `npm run verify:c2` … `c11` | Plan block smoke tests |
| `npm run verify:pre-e -- --live` | Pre-E integration checks |
| `npm run verify:e2e-ai -- --live` | End-to-end AI flow |
| `npm run verify:ws-streaming -- --live` | WebSocket coach streaming |

Full list: `package.json` and [docs/AI_ARCHITECTURE.md](./docs/AI_ARCHITECTURE.md).

### Quality

| Command | Purpose |
|---------|---------|
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm test` | Vitest smoke tests |

## Security notes

- Never commit `.env` or credentials
- Use a strong `JWT_SECRET` in all environments
- Restrict CORS to trusted frontend origins
- Auth routes are rate-limited (`AUTH_RATE_LIMIT_MAX` in `.env.example`)
- `AI_INTERNAL_KEY` secures FastAPI ↔ Node internal routes
- nginx denies `/api/internal/*` at the edge in production

## Related documentation

- [../README.md](../README.md) — Monorepo quick start
- [../Taqwin.md](../Taqwin.md) — Feature inventory
- [./docs/AI_ARCHITECTURE.md](./docs/AI_ARCHITECTURE.md) — AI plans, RAG, chat memory, tools
- [../ai-service/README.md](../ai-service/README.md) — FastAPI AI service
- [../docs/DEPLOY-HOSTINGER.md](../docs/DEPLOY-HOSTINGER.md) — Production deployment
