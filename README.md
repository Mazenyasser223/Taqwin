# Taqwin

**Taqwin** (تكوين) is an AI-powered fitness platform built as a graduation project. It connects **athletes**, **trainers**, and **gym owners** in one web application: structured onboarding, personalized workouts and nutrition, community features, a supplement marketplace, and a server-side AI coach.

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Three.js |
| API | Node.js, Express, Prisma |
| Primary database | PostgreSQL (users, profiles, catalogs, logs, commerce) |
| AI datastore | MongoDB (generated plans, chat history, RAG chunks, optional embeddings) |
| File storage | Supabase Storage (or local disk in development) |
| Hosting | **Production:** Hostinger VPS KVM 2 (Docker: nginx + API) · **Data:** Supabase + MongoDB Atlas + Upstash · **Legacy:** Vercel + Render — see [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) |
| AI providers | Anthropic Claude, Google Gemini, or local Ollama (server-side only) |

## Repository layout

```text
Taqwin/
├── README.md                 # Quick start and overview (this file)
├── Taqwin.md                 # Detailed feature inventory and conventions
├── USER.md                   # User, profile, and settings reference
├── DEPLOY.md                 # Deployment index (Hostinger + legacy)
├── AI-COACH-ARCHITECTURE.md  # AI Coach blueprint (blocks A–E)
├── docs/
│   ├── SYSTEM-ARCHITECTURE.md   # Production topology (Docker, KVM 2)
│   ├── DEPLOY-HOSTINGER.md      # VPS runbook
│   └── GITHUB.md                # Remote, branches, and push workflow
├── deploy/                   # docker-compose.production.yml, nginx
├── docker-compose.yml        # Local PostgreSQL for development
├── package.json              # Root scripts (run frontend + backend together)
├── backend-node/             # Express API, Prisma, AI services
│   ├── docs/AI_ARCHITECTURE.md
│   ├── data/coaching-book/   # Markdown sources for coach RAG
│   └── src/                  # Routes, lib, Mongo models, plan generator
└── frontend/                 # React SPA (hash routing)
```

## Quick start

### Prerequisites

- **Node.js 18+** and npm
- **PostgreSQL** — [Supabase](https://supabase.com) cloud or local Docker (see below)
- **MongoDB** (optional but recommended) — for AI plans, chat memory, and RAG; without it the app falls back to formula-based targets and rules-based workouts
- **LLM API key** or [Ollama](https://ollama.com) for `/api/ai/*`

### 1) Install dependencies

From the repository root:

```bash
npm run install:all
```

### 2) Databases

**PostgreSQL (required)**

```bash
# Option A — local Docker (from repo root)
docker compose up -d

# Option B — Supabase: create a project and copy pooler + direct URLs
```

```bash
cd backend-node
cp .env.example .env
# Set DATABASE_URL, DIRECT_URL, JWT_SECRET, FRONTEND_URL, etc.
npm run db:migrate
npm run db:seed          # optional demo data
```

**MongoDB (AI features)**

Add `MONGO_URI` to `backend-node/.env`. See `backend-node/.env.example` for vector-search and embedding options.

```bash
# Ingest coaching knowledge (after MONGO_URI is set)
npm run ingest:coaching-book --prefix backend-node
```

### 3) Run the API

```bash
cd backend-node
npm run dev
```

Default API port: **4000** (override with `PORT` in `.env`). The Vite dev proxy targets **4002** by default — align `PORT` or `frontend/vite.config.ts` if needed.

### 4) Run the frontend

```bash
cd frontend
cp .env.example .env.local   # if present
npm run dev
```

Application: **http://localhost:3000** — `/api` and `/uploads` proxy to the backend.

### 5) Run both (recommended)

From the repository root:

```bash
npm run dev
```

### Health check

```bash
curl http://localhost:4000/health
```

## Core product areas

### Athletes

- Multi-flow **onboarding questionnaire** (core, workout, diet, wellness) with progress persistence and dossier editing on the profile page
- **Dashboard** — calorie history, fitness score, workout completion, meal slots, week navigation, sleep and hydration widgets
- **AI coach** — `/api/ai/chat` with off-topic guard, optional conversation memory (MongoDB), and coaching-book RAG
- **AI plans** — validated JSON workout + diet plans stored in MongoDB; dashboard and coach read the active plan via `activePlanService`
- **Exercise library** — MuscleWiki catalog with localized names and cached videos
- **Nutrition** — WebTeb catalog, food logging, macro targets shared with the plan generator
- **Community** — feed, stories, direct messages, groups, online presence
- **Market Vault** — categorized shop catalog (EGP), cart, and orders

### Trainers and gym owners

- Trainer profiles, client booking inbox, and gym owner dashboards (members, check-ins, analytics)

## AI system (summary)

Taqwin uses a **hybrid Postgres + MongoDB** design:

| Data | Store |
|------|--------|
| Users, onboarding, food/exercise catalogs, logs, orders | PostgreSQL |
| Generated plans, chat threads, book chunks, embeddings | MongoDB |

Key backend modules:

- `src/lib/plans/` — targets, Zod schema, validator, LLM generator, deterministic fallback
- `src/lib/rag/` — food, exercise, and coaching-book retrieval
- `src/routes/ai/` — plan and conversation endpoints
- `src/services/activePlanService.js` — single active plan for dashboard + coach context

Full diagrams, env vars, and manual test steps: **[backend-node/docs/AI_ARCHITECTURE.md](./backend-node/docs/AI_ARCHITECTURE.md)**.

### Useful AI maintenance scripts (`backend-node`)

| Command | Description |
|---------|-------------|
| `npm run ingest:coaching-book` | Load `data/coaching-book/*.md` into MongoDB |
| `npm run embed:book` | Embed coaching chunks (optional vector search) |
| `npm run embed:foods` | Embed food catalog for semantic retrieval |
| `npm run embed:exercises` | Embed exercise catalog |
| `node scripts/test-plan-validator.js` | Exercise plan validator rules offline |

## NPM scripts reference

### Root

| Command | Description |
|---------|-------------|
| `npm run dev` | Backend + frontend concurrently |
| `npm run install:all` | Install both packages |

### Backend (`backend-node`)

| Command | Description |
|---------|-------------|
| `npm run dev` | API with file watch |
| `npm run lint` | ESLint (zero warnings enforced) |
| `npm test` | Vitest smoke tests |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm run import:webteb` | Import WebTeb nutrition catalog |
| `npm run import:musclewiki` | Import exercise catalog |
| `npm run ensure:sections` | Backfill shop product description sections |

See `backend-node/package.json` for marketplace import, video sync, and audit scripts.

### Frontend (`frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (:3000) |
| `npm run lint` | TypeScript (`tsc --noEmit`) |
| `npm run build` | Production build |

## Documentation

| Document | Purpose |
|----------|---------|
| [Taqwin.md](./Taqwin.md) | Built features, routes, media assets, environment variables |
| [USER.md](./USER.md) | User/profile/settings APIs and frontend routes |
| [DEPLOY.md](./DEPLOY.md) | Supabase + Render + Vercel deployment |
| [backend-node/README.md](./backend-node/README.md) | API setup, migrations, Supabase |
| [backend-node/docs/AI_ARCHITECTURE.md](./backend-node/docs/AI_ARCHITECTURE.md) | AI plans, RAG, chat memory, MongoDB |
| [frontend/README.md](./frontend/README.md) | Frontend structure and environment |
| [docs/GITHUB.md](./docs/GITHUB.md) | GitHub remote and collaboration workflow |

## Development practices

- Keep secrets in local `.env` / `.env.local` only — **never commit** them
- Do not commit `node_modules`, build artifacts, or large generated media unless documented
- Run `npm run lint` in `backend-node` and `frontend` before opening a pull request
- Use feature branches and pull requests; see `docs/GITHUB.md`

## License

Academic graduation project — intended for educational use.
