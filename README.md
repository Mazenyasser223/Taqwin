# Taqwin

**Taqwin** (تكوين) is an AI-powered fitness platform built as a graduation project. It connects **athletes**, **trainers**, and **gym owners** in one web app: personalized workouts and nutrition, community, marketplace, trainer/gym discovery, and an AI coach.

## Live stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind, Framer Motion, Three.js |
| Backend | Node.js, Express, Prisma, PostgreSQL |
| Hosting | Vercel (SPA) → Render (API) → Supabase (Postgres + Storage) |
| AI | Server-side `/api/ai/chat` (Claude / Gemini / Ollama — configurable) |

## Repository layout

```text
Taqwin/
├── README.md              # This file — quick start
├── Taqwin.md              # Detailed project status & conventions
├── USER.md                # User account, profile, settings reference
├── DEPLOY.md              # Supabase + Render + Vercel deployment
├── package.json           # Root: npm run dev (frontend + backend)
├── docs/GITHUB.md         # Remote, branches, push workflow
├── backend-node/          # Express API + Prisma
└── frontend/              # React SPA (HashRouter)
```

## Quick start

### Prerequisites

- Node.js **18+**
- npm
- PostgreSQL (recommended: [Supabase](https://supabase.com) — see `backend-node/README.md`)

### 1) Install dependencies

From the repo root:

```bash
npm run install:all
```

Or install each app separately:

```bash
cd backend-node && npm install
cd ../frontend && npm install
```

### 2) Backend

```bash
cd backend-node
cp .env.example .env
# Set DATABASE_URL, DIRECT_URL, JWT_SECRET, etc.
npm run db:migrate
npm run dev
```

Default API: `http://localhost:4000` (set `PORT` in `.env`; local Vite proxy targets **4002** — see `frontend/vite.config.ts`).

### 3) Frontend

```bash
cd frontend
cp .env.example .env.local
npm run dev
```

App: `http://localhost:3000` — `/api` and `/uploads` are proxied to the backend.

### 4) Run both (recommended)

From repo root:

```bash
npm run dev
```

## Main features

- **Athletes** — onboarding questionnaire, dashboard, exercise catalog (MuscleWiki + videos), nutrition (WebTeb + food logs), AI chat assistant, community (feed, stories, DMs, groups), **Market Vault** shop (categories, EGP checkout, orders)
- **Trainers** — profile, clients, booking inbox
- **Gym owners** — gym profile, members, check-ins, owner dashboard

## Useful scripts

### Root

| Command | Description |
|---------|-------------|
| `npm run dev` | Backend + frontend concurrently |
| `npm run install:all` | Install both packages |

### Backend (`backend-node`)

| Command | Description |
|---------|-------------|
| `npm run dev` | API with file watch |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed demo data |
| `npm test` | Vitest smoke tests |
| `npm run import:webteb` | Import WebTeb nutrition catalog |
| `npm run import:musclewiki` | Scrape/import exercise catalog |
| `npm run ensure:sections` | Backfill shop product description sections |

See `backend-node/package.json` for shop import, video sync, and audit scripts.

### Frontend (`frontend`)

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (:3000) |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |

## Documentation

| File | Purpose |
|------|---------|
| [Taqwin.md](./Taqwin.md) | What is built today, routes, media assets, env vars |
| [USER.md](./USER.md) | User/profile/settings APIs and frontend routes |
| [DEPLOY.md](./DEPLOY.md) | Production deployment runbook |
| [backend-node/README.md](./backend-node/README.md) | API setup, Supabase, migrations |
| [frontend/README.md](./frontend/README.md) | Frontend structure and env |
| [docs/GITHUB.md](./docs/GITHUB.md) | GitHub remote and push workflow |

## Health check

```bash
curl http://localhost:4000/health
```

(Use your configured `PORT` if different.)

## Team workflow

- Keep secrets in local `.env` / `.env.local` only — never commit them
- Do not commit `node_modules`, build output, or large generated media unless documented
- Use feature branches and pull requests; see `docs/GITHUB.md`

## License

Academic graduation project — intended for educational use.
