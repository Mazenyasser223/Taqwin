# Taqwin

**Taqwin** (تكوين) is an AI-powered fitness platform built as a graduation project. It connects **athletes** and **gym owners** in one web application: structured onboarding, personalized workouts and nutrition, an AI coach with plans and adaptation, community and compete features, a supplement marketplace with admin tooling, and server-side LLM reasoning via FastAPI.

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js, MediaPipe |
| API | Node.js, Express, Prisma |
| AI service | Python 3.11+, FastAPI, LangGraph |
| Primary database | PostgreSQL (users, profiles, catalogs, logs, commerce, **official AI plans**, RAG pgvector) |
| AI datastore | MongoDB (chat history, agent traces, LLM audit logs, analytics — not official plans) |
| Cache & jobs | Redis (CAG cache, BullMQ job queues) |
| File storage | Supabase Storage (or local disk in development) |
| Hosting | Hostinger VPS KVM 2 (Docker: nginx + API + AI + worker) · Supabase + MongoDB Atlas + Upstash |
| AI providers | Anthropic Claude, Google Gemini, or local Ollama (server-side only) |

## Repository layout

```text
Taqwin/
├── README.md                      # This file — monorepo overview
├── package.json                   # Root scripts (dev, dev:all, install:all, e2e, db:up)
├── docker-compose.yml             # Local PostgreSQL for development
├── playwright.config.ts           # Playwright E2E (settings account flows)
├── tsconfig.e2e.json
│
├── ai-service/                    # FastAPI AI microservice → see ai-service/README.md
├── backend-node/                  # Express API, Prisma, jobs, RAG ingest → see backend-node/README.md
├── frontend/                      # React SPA (hash routing) → see frontend/README.md
├── deploy/                        # Production Docker + nginx → see deploy/README.md
│
├── shared/                        # Cross-service JSON contracts (CAG, plan prompts, staples, blueprints)
│   ├── cag-sanitize.json
│   ├── coach-step-up.json
│   ├── plan-prompt-contract.json
│   ├── plan-food-groups.json / plan-workout-groups.json
│   ├── plan-staple-foods.json / plan-staple-exercises.json
│   ├── plan-training-styles.json / plan-volume-prescription.json
│   └── plan-template-fill-contract.json
│
├── packages/
│   └── contracts/                 # Reserved for shared typed contracts
│
├── e2e/                           # Playwright specs (settings account, privacy, telegram, …)
├── scripts/                       # dev.ps1, push-github.sh, verify-tour-targets.js
├── docs/                          # Deployment and architecture runbooks
│   ├── SYSTEM-ARCHITECTURE.md
│   ├── DEPLOY-HOSTINGER.md
│   ├── DATABASE-BACKUPS.md
│   ├── GITHUB.md
│   ├── COMMUNITY-SETUP.md
│   ├── NOTIFICATIONS-RUNBOOK.md
│   ├── AI-PROJECT-STATUS.md
│   └── TAQWIN-MASTER-PLAN.md
│
├── nutrition/                     # Source nutrition food images (import/sync to frontend)
├── Taqwin.md                      # Feature inventory and conventions
├── USER.md                        # User, profile, and settings reference
├── DEPLOY.md                      # Deployment index
└── AI-COACH-ARCHITECTURE.md       # AI Coach blueprint (blocks A–E)
```

## Quick start

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.11+** (for `ai-service`)
- **PostgreSQL** — [Supabase](https://supabase.com) cloud or local Docker
- **MongoDB** (recommended) — chat memory, agent traces, generation audit
- **Redis** (recommended) — CAG cache + BullMQ job queues
- **LLM API key** — Anthropic, Gemini, or Ollama for coach chat and plans

### 1) Install dependencies

```bash
npm run install:all
```

Optional AI service setup:

```bash
npm run setup:ai
```

### 2) Databases

**PostgreSQL (required)**

```bash
# Option A — local Docker (from repo root)
npm run db:up

# Option B — Supabase: create a project and copy pooler + direct URLs
```

```bash
cd backend-node
cp .env.example .env
# Set DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL, etc.
npm run db:migrate
npm run db:seed          # optional demo data
```

**MongoDB & Redis** — add `MONGO_URI` and `REDIS_URL` to `backend-node/.env`. See `backend-node/.env.example`.

**RAG ingest (optional, after embedding key is set)**

```bash
npm run rag:ingest:l1 --prefix backend-node
npm run rag:ingest:l5 --prefix backend-node
```

### 3) Run the AI service

```bash
cd ai-service
python -m venv .venv
# Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Set in `backend-node/.env`:

```env
FEATURE_AI_VIA_FASTAPI=true
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_KEY=<shared secret>
```

### 4) Run the API

```bash
cd backend-node
npm run dev
```

Default API port: **4000**. The Vite dev proxy targets port **4000** by default (`VITE_BACKEND_PORT` / `BACKEND_PORT` override in `frontend/vite.config.ts`).

For full AI features (plan generation, memory summarize, mid-week adaptation), also run:

```bash
npm run worker
```

### 5) Run the frontend

```bash
cd frontend
npm run dev
```

Application: **http://localhost:3000** — `/api` and `/uploads` proxy to the backend.

### 6) Run everything (recommended)

From the repository root:

```bash
npm run dev          # backend + frontend
npm run dev:all      # ai-service + backend + frontend
```

Run `npm run worker` in a separate terminal when testing plan jobs and adaptation.

### Health check

```bash
curl http://localhost:4000/health
curl http://localhost:8000/health
```

## Core product areas

### Athletes

- Multi-flow **onboarding questionnaire** (core, workout, diet, wellness) with dossier editing
- **Dashboard** — calorie history, fitness score, workout completion, meal slots, sleep/hydration widgets, plan generation status
- **AI coach** — streaming chat, greeting fast-path, tool confirmation, off-topic guard, conversation memory, RAG (L1–L5), Arabic markdown rendering
- **AI plans** — validated workout + diet plans in **PostgreSQL**; template-fill pipeline with catalog staples and structure blueprints
- **Exercise library** — MuscleWiki catalog with localized names, category browse, and cached videos
- **Nutrition** — WebTeb catalog, private food library, food logging, macro targets shared with plan generator
- **Muscle Wiki** — interactive 3D muscle explorer (Captain Hema model)
- **Cap Hema Eye** — live push-up and squat form analysis via MediaPipe
- **Community** — feed, stories, direct messages, groups, browse, online presence, privacy settings
- **Compete** — leagues, challenges, XP/leaderboards
- **Market Vault** — categorized shop catalog (EGP), cart, checkout, wishlist, orders
- **Settings** — preferences, notifications, Telegram alerts, privacy, account management

### Gym owners

- Owner dashboard, member management, reception, equipment, classes, check-ins, analytics
- Gym discovery list with map, amenities, filters, and reviews

### Shop admin

- `/admin/shop` — products, orders, categories, marketing, conversion funnel, AI commerce, data quality

> User roles: `athlete | gym | shop_admin` (legacy trainer routes redirect to dashboard).

## Data architecture

| Data | Store |
|------|--------|
| Users, onboarding, food/exercise catalogs, logs, orders, **official plans** | PostgreSQL |
| Chat threads, agent traces, LLM audit, generation logs, analytics | MongoDB |
| RAG knowledge (L1 platform docs, L2 exercises, L3 foods, L5 coaching books) | PostgreSQL + pgvector (`KnowledgeChunk`) |
| CAG context bundle cache | Redis |

## NPM scripts reference

### Root (`package.json`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Backend + frontend concurrently |
| `npm run dev:all` | AI service + backend + frontend |
| `npm run dev:backend` | Backend only |
| `npm run dev:frontend` | Frontend only |
| `npm run dev:ai` | AI service only (uvicorn :8000) |
| `npm run install:all` | Install backend-node + frontend dependencies |
| `npm run setup:ai` | Create venv + pip install ai-service deps |
| `npm run db:up` | Start local PostgreSQL via Docker |
| `npm run db:setup` | Start DB + run Prisma migrations |
| `npm run setup:community` | Migrations + community schema helpers |
| `npm run seed:community` / `seed:compete` | Seed demo community / compete data |
| `npm run test:e2e` | Playwright E2E (settings account flows) |

### Service-specific scripts

See dedicated READMEs:

- [ai-service/README.md](./ai-service/README.md) — FastAPI endpoints, agent graph, RAG eval
- [backend-node/README.md](./backend-node/README.md) — API routes, RAG ingest, verify scripts, workers
- [frontend/README.md](./frontend/README.md) — Vite dev, features, routing
- [deploy/README.md](./deploy/README.md) — Production Docker stack

## Documentation

| Document | Purpose |
|----------|---------|
| [Taqwin.md](./Taqwin.md) | Built features, routes, media assets, environment variables |
| [USER.md](./USER.md) | User/profile/settings APIs and frontend routes |
| [DEPLOY.md](./DEPLOY.md) | Deployment index (Hostinger + legacy) |
| [docs/SYSTEM-ARCHITECTURE.md](./docs/SYSTEM-ARCHITECTURE.md) | Production topology (Docker, KVM 2) |
| [docs/DEPLOY-HOSTINGER.md](./docs/DEPLOY-HOSTINGER.md) | Hostinger VPS runbook |
| [docs/DATABASE-BACKUPS.md](./docs/DATABASE-BACKUPS.md) | Backup procedures |
| [docs/GITHUB.md](./docs/GITHUB.md) | GitHub remote and collaboration workflow |
| [docs/COMMUNITY-SETUP.md](./docs/COMMUNITY-SETUP.md) | Community seeding and verification |
| [docs/NOTIFICATIONS-RUNBOOK.md](./docs/NOTIFICATIONS-RUNBOOK.md) | Notification delivery ops |
| [AI-COACH-ARCHITECTURE.md](./AI-COACH-ARCHITECTURE.md) | AI Coach master blueprint (blocks A–E) |
| [backend-node/docs/AI_ARCHITECTURE.md](./backend-node/docs/AI_ARCHITECTURE.md) | AI plans, RAG, chat memory, tool execution |

## Development practices

- Keep secrets in local `.env` / `.env.local` only — **never commit** them
- Do not commit `node_modules`, build artifacts, or large generated media unless documented
- Run `npm run lint` in `backend-node` and `frontend` before opening a pull request
- Use feature branches and pull requests; see [docs/GITHUB.md](./docs/GITHUB.md)

## License

Academic graduation project — intended for educational use.
