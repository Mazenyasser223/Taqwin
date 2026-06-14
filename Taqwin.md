# Taqwin — AI-Powered Fitness Platform

> Graduation project, Faculty of Computer Science & Data Science, Alexandria University.  
> Status document — what is actually built today, not what's aspirational.

Taqwin (تكوين, "formation") is a deployable web platform for two fitness roles in one product:

- **Athletes** — workouts, exercise catalog with video demos, nutrition (WebTeb + seeded foods), AI coach, personalized plans + adaptation, community (feed, stories, DMs, groups), marketplace, gym discovery.
- **Gym owners** — gym profile, membership roster, check-in tracking, owner dashboard.

> **Removed:** `trainer` role, trainer bookings, and `/api/trainers` / `/api/bookings` (migration `20260608120000_split_profiles_remove_trainer`).

**Production topology:** **Hostinger KVM 2 (Docker: nginx + Node API + FastAPI + worker) → Supabase (Postgres + pgvector + Storage) + MongoDB Atlas + Upstash Redis**. Legacy: Vercel (SPA) + Render (API) — see [`docs/DEPLOY-HOSTINGER.md`](docs/DEPLOY-HOSTINGER.md).

---

## Repository layout

```text
Taqwin/
├── package.json                 # Root scripts: npm run dev (concurrently), install:all
├── package-lock.json
├── README.md
├── DEPLOY.md                    # Deployment index (Hostinger + legacy Render/Vercel)
├── Taqwin.md                    # This file — project status & conventions
├── USER.md                      # User account & profile API reference
├── Logo.png
│
├── .github/workflows/ci.yml     # backend lint+test, frontend typecheck+build
├── .cursor/rules/               # Cursor agent rules (if present)
├── docs/
│   ├── SYSTEM-ARCHITECTURE.md   # Production topology (Docker, KVM 2)
│   ├── DEPLOY-HOSTINGER.md      # VPS runbook
│   └── GITHUB.md
│
├── scripts/                     # Repo-level helpers (if any)
│
├── backend-node/                # Express + Prisma API (JavaScript)
│   ├── src/
│   │   ├── app.js               # Express wiring (helmet, cors, pino, passport, static uploads)
│   │   ├── index.js             # listen + optional FDC cache warm on boot
│   │   ├── db.js
│   │   ├── config/passport.js   # Google OAuth
│   │   ├── middleware/          # auth, validate, errorHandler, rateLimitAuth
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── profile.js
│   │   │   ├── uploads.js       # Supabase signed URLs + local dev uploads
│   │   │   ├── gyms.js
│   │   │   ├── workouts.js
│   │   │   ├── exercises.js     # MuscleWiki exercise catalog API
│   │   │   ├── nutrition.js     # foods, logs, WebTeb search/import
│   │   │   ├── marketplace.js
│   │   │   ├── community.js     # feed, posts, comments, follows, groups, DMs
│   │   │   ├── communityExtras.js  # stories, saves, rings, privacy (mounted under community)
│   │   │   ├── notifications.js
│   │   │   ├── dashboard.js
│   │   │   ├── plans.js         # /api/plans/today, week, day
│   │   │   ├── adaptation.js    # /api/adaptation/* (readiness, skip, swap, life-modes)
│   │   │   ├── ai.js            # POST /api/ai/chat, confirm, plan, conversations, notify
│   │   │   ├── internal/        # /api/internal/ai/*, /api/internal/cron/* (FastAPI bridge)
│   │   │   ├── settings.js
│   │   │   ├── settingsAccount.js
│   │   │   ├── support.js
│   │   │   └── emergency-migrate.js
│   │   ├── services/            # email, sms, aiFastApiClient, aiToolExecutor, activePlanService, …
│   │   └── lib/                 # contextBundle (CAG), rag/ragRetrieve, plans/, adaptation/, musclewiki, webteb, …
│   ├── worker.js                # BullMQ workers (plans, adaptation, memory summarize, smart notify)
│   ├── scripts/                 # Data import & video sync (see below)
│   ├── uploads/                 # Local media (gitignored content) — exercise MP4s, avatars, etc.
│   │   └── exercises/{muscleWikiId}/*.mp4
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/          # 44 migrations (through 20260609120000_remove_l4_scientific)
│   │   ├── shopCatalogSeed.js   # categories + EGP products
│   │   ├── seedShopOnly.js
│   │   └── seed.js
│   ├── tests/                   # vitest smoke tests
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
│
├── ai-service/                  # FastAPI — intent, RAG, coach graph, plan JSON, memory summarize
│   ├── app/                     # routers, agent/, rag/, prompts/, services/
│   └── tests/
│
└── frontend/                    # React 19 + Vite SPA (TypeScript)
    ├── App.tsx                  # HashRouter + role-gated routes
    ├── index.tsx, index.html, index.css
    ├── vite.config.ts           # dev :3000, proxies /api and /uploads → backend
    ├── vercel.json
    ├── components/
    │   ├── ui/                  # Layout, MobileBottomNav, NotificationDrawer, LazyRoute, …
    │   ├── shared/              # Logo, LanguageToggle, MotionWrappers, ImageUploader
    │   ├── chat/                # ChatMessageBody
    │   └── tailadmin/
    ├── features/
    │   ├── landing/             # LandingPage, LandingVideoBackground
    │   ├── auth/                # AuthPage + AuthPageLayout (login video bg), OAuthCallback, SetPasswordPage
    │   ├── onboarding/          # Multi-flow wizard, questionnaires, chat-style athlete flow
    │   ├── profile/             # ProfilePage, onboarding summary, coach dossier
    │   ├── dashboard/           # RoleDashboard, User/Trainer/GymOwner dashboards
    │   ├── ai-chat/             # ChatAssistant
    │   ├── workouts/            # WorkoutLibrary (exercise cards + inline video)
    │   ├── muscle-wiki/         # Captain Hema 3D muscle picker + ExercisePanel videos
    │   ├── nutrition/           # WebTeb categories, search, macros, log modal
    │   ├── marketplace/         # Marketplace (categories, brands, EGP products, cart)
    │   │   ├── Marketplace.tsx
    │   │   ├── ShopCategoryCard.tsx
    │   │   ├── ShopBrandCard.tsx
    │   │   └── ShopProductCard.tsx
    │   ├── orders/              # OrderHistory
    │   ├── gyms/                # GymList, MemberManagement
    │   ├── community/           # Hub, feed, stories, inbox, groups, browse, settings (40+ files)
    │   ├── settings/            # SettingsPage, account dialogs, 2FA UI
    │   └── support/             # SupportPage + FAQ
    ├── services/                # api.ts + per-domain modules (auth, community, exercise, …)
    ├── store/                   # zustand: auth, cart, notifications, language, settings, config
    ├── lib/
    │   ├── motion.ts            # Framer variants + getAuthCardEnterMotion (slide from right)
    │   ├── i18n/                # translations.ts (en + ar), useI18n
    │   ├── mediaUrl.ts          # Resolve /uploads and Supabase URLs
    │   └── …                    # authRoutes, passwordPolicy, communityCache, …
    ├── 3d/                      # R3F accents (onboarding hero, etc.)
    └── public/
        ├── assets/
        │   ├── landing/         # landing-bg.mp4 (optional — not committed; see Videos section)
        │   └── onboarding/    # SVG illustrations per onboarding option
        ├── nutrition/categories/  # Category hero images (*.jpg — see README there)
        ├── captain_hema_fixed_final.glb  # optional 3D model for muscle-wiki
        ├── favicon.svg, manifest.webmanifest, icons/
        └── …
```

No Turborepo / pnpm workspaces — root `package.json` only orchestrates `concurrently`; each app has its own dependencies. No mobile app yet.

---

## Videos & media assets

Where video files live, how they are served, and what you need to add locally.

### 1. Auth (login / sign-up) background video

| Item | Detail |
|------|--------|
| **Path** | `frontend/public/taqwin-login.mp4` |
| **URL in app** | `/taqwin-login.mp4` |
| **Components** | `AuthVideoBackground.tsx`, `AuthPageLayout.tsx` (used by `AuthPage.tsx`) |
| **Notes** | Looped, muted autoplay; dark scrim over video for card readability. Skipped when reduced-motion / performance mode. |

### 2. Landing page background video

| Item | Detail |
|------|--------|
| **Path (add locally)** | `frontend/public/assets/landing/landing-bg.mp4` |
| **URL in app** | `/assets/landing/landing-bg.mp4` |
| **Component** | `frontend/features/landing/LandingVideoBackground.tsx` |
| **Notes** | Large MP4 is usually **not** in git. Muted autoplay; skipped when reduced-motion / performance mode. |

### 3. Exercise demo videos (MuscleWiki catalog)

| Item | Detail |
|------|--------|
| **Source** | MuscleWiki CDN URLs stored in Postgres `exercises.videos` JSON (`url`, `angle`, optional `localUrl`) |
| **Local cache (dev / self-host)** | `backend-node/uploads/exercises/{muscleWikiId}/{filename}.mp4` |
| **Served at** | `GET /uploads/exercises/{muscleWikiId}/{file}.mp4` (Express static + `Cache-Control` in `app.js`) |
| **API field** | `GET /api/exercises` → each row includes `videoUrl` (prefers `localUrl`, else CDN `url`) |
| **UI** | `WorkoutLibrary.tsx`, `muscle-wiki/components/ExercisePanel.tsx` (`<video src={exercise.videoUrl}>`) |
| **Populate DB** | `npm run import:musclewiki` (scrape) or `npm run import:musclewiki:api` |
| **Download MP4s locally** | `npm run sync:musclewiki-videos` (Playwright; optional `MUSCLEWIKI_API_KEY`) |
| **Status / verify** | `npm run sync:musclewiki-videos:status`, `npm run verify:exercise-videos` |
| **Implementation** | `src/lib/exerciseVideoCache.js`, `src/lib/musclewikiVideoSync.js`, `src/lib/exerciseMuscleMap.js` (`pickVideoUrl`) |

Vite dev server proxies `/uploads` → backend so the browser can play cached files from port 3000.

### 4. Community post & story videos

| Item | Detail |
|------|--------|
| **Upload** | `POST /api/uploads/sign` → Supabase Storage bucket `taqwin-uploads`, or `POST /api/uploads/local` in dev |
| **DB** | `community_posts.video_url`, `community_post_media`, `community_stories` |
| **UI** | `PostMedia.tsx`, `PostMediaViewer.tsx`, `CommunityStoryViewerOverlay.tsx`, composer upload via `uploadService.ts` |
| **Types** | `mediaType`: `image` \| `video` \| `mixed` |

### 5. Onboarding & static illustrations (not video files)

| Item | Detail |
|------|--------|
| **Path** | `frontend/public/assets/onboarding/*.svg` |
| **Registry** | `frontend/features/onboarding/onboardingAssets.ts` |
| **“Past videos” step** | Uses `past-videos.svg` (illustration only) |

### 6. Nutrition category images (static)

| Item | Detail |
|------|--------|
| **Path** | `frontend/public/nutrition/categories/*.jpg` (and aliases per id) |
| **Doc** | `frontend/public/nutrition/categories/README.md` (Arabic table of filenames) |

### 7. Captain Hema 3D (GLB, not video)

| Item | Detail |
|------|--------|
| **Path (add locally)** | `frontend/public/captain_hema_fixed_final.glb` |
| **Doc** | `frontend/features/muscle-wiki/README.md` |

### 8. General uploads (avatars, support, etc.)

| Item | Detail |
|------|--------|
| **Local dev root** | `backend-node/uploads/` (avatars, signed-upload fallbacks) |
| **Production** | Supabase Storage + public/signed URLs |
| **Helper** | `src/lib/localUploads.js`, `src/lib/normalizeMediaUrl.js` |

---

## Tech stack (actual)

### Frontend (`frontend/`)
- **React 19** + **Vite 6** + **TypeScript**
- **React Router 7** (`HashRouter` — routes are `/#/path`)
- **Zustand 5** — auth, cart, notifications, language, settings, performance mode
- **Tailwind CSS 3** + design tokens in `index.css`
- **Framer Motion 12** — page transitions, auth card enter (`getAuthCardEnterMotion` in `lib/motion.ts`), community/workout motion
- **Three.js** + **@react-three/fiber** + **@react-three/drei** — landing hero, onboarding 3D, muscle-wiki canvas
- **Recharts** / **ApexCharts** — dashboards
- **vite-plugin-pwa** — service worker / offline shell
- **i18n** — custom `lib/i18n` (English + Arabic strings; RTL via `textDirection` / language store)
- AI chat uses backend proxy only — no API keys in the browser bundle

### Backend (`backend-node/`)
- **Node.js 18+** + **Express 4** (JavaScript)
- **Prisma 5** → **PostgreSQL** (Supabase)
- **JWT** + **bcryptjs**; **Passport** Google OAuth
- **Nodemailer** (Gmail app password); **Twilio Verify** (SMS reset — optional)
- **Helmet**, **compression**, **cors**, **express-rate-limit**, **Zod 4** + `validate` middleware
- **Pino** logging
- **@supabase/supabase-js** — Storage signed uploads
- **AI** — `services/aiFastApiClient.js` → FastAPI `ai-service` (required for chat; `aiChatProvider.js` is a stub — no Node LLM fallback)
- **USDA FDC** — `services/fdcService.js` + Redis optional cache warm on boot (library code; primary UI nutrition path is WebTeb)
- **FatSecret** client (optional env)
- **Playwright** (optional) — MuscleWiki video download
- **Vitest** + **Supertest**; **ESLint** + **Prettier**

### Infra / DevOps
- **GitHub Actions** CI (+ optional RAG eval workflow)
- **Production:** Hostinger KVM 2 + Docker Compose — see `docs/DEPLOY-HOSTINGER.md`
- **Legacy:** Render (API) + Vercel (SPA) — see `DEPLOY.md`
- **Managed data:** Supabase (Postgres + pgvector + Storage), MongoDB Atlas, Upstash Redis
- **BullMQ workers** — `npm run worker` (plan generate, adaptation crons, memory summarize, smart notify)
- **WebSocket realtime** — `/ws` hub (coach streaming, notifications, community push, presence); Redis pub/sub for multi-instance; `FEATURE_REALTIME_WS=true`
- No Stripe yet

---

## Database (Prisma)

Roles: `athlete | gym` (legacy `trainer` removed).

**Implemented models** (see `prisma/schema.prisma`):

```text
User, AthleteProfile, GymProfile, UserSettings, SupportTicket
Gym, GymMembership, GymCheckIn
Workout, WorkoutLog
Exercise, ExerciseLog                    # MuscleWiki catalog
FoodItem, FoodLog
WebtebCategory, WebtebFood               # Arabic nutrition DB
Product, Order, OrderItem
CommunityPost, CommunityPostMedia, CommunityPostRepost
CommunityFollow, CommunityBlock
CommunityGroup, CommunityGroupMember
CommunityConversation, CommunityConversationParticipant, CommunityMessage
CommunityPrivacySettings
CommunityPostTag, CommunitySavedPost, CommunityPostRing
CommunityStory, CommunityStoryReaction, CommunityStoryReply, CommunityStoryView
CommunityComment, CommunityCommentLike, CommunityPostLike
CommunityPostGymMention
Notification
AiMemory, AiToolExecution
WorkoutPlan, WorkoutPlanDay, WorkoutPlanExercise
DietPlan, DietPlanDay, DietPlanMeal, DietPlanMealItem
DailyAthletePlan, BodyMetric, ReadinessLog, ProgressSnapshot
PlanFeedback, PlanChangeLog, ProgressPhoto
KnowledgeDocument, KnowledgeChunk         # pgvector RAG (L1–L3 + L5)
```

**Backlog** (not in schema yet): `FormSession`, dedicated `NotificationRule` table, etc.

- Migrations: `prisma/migrations/` (44 applied as of `20260609120000_remove_l4_scientific`).
- Seed: `prisma/seed.js` — demo users, workouts, foods, community samples; shop catalog via `prisma/shopCatalogSeed.js` (MFB-style categories, 22 EGP demo products). Quick shop-only: `node prisma/seedShopOnly.js`.  
  Demo login: `demo@taqwin.app` / `Taqwin#2025`.

---

## API surface (mounted in `src/app.js`)

Base: `/api`. JWT bearer except auth/OAuth/health.

```
GET    /health

POST   /api/auth/register | login | verify-email | resend-verification
POST   /api/auth/forgot-password | reset-password
GET    /api/auth/google | /api/auth/google/callback

GET/PATCH   /api/profile
POST        /api/uploads/sign | /api/uploads/local (dev)
GET         /api/uploads/...

GET/POST/PATCH   /api/gyms, memberships, check-ins, members

GET/POST    /api/workouts, /api/workouts/logs

GET         /api/exercises              # list, categories, muscle-counts
GET         /api/exercises/:id
POST/GET    /api/exercises/logs

GET         /api/nutrition/foods, /logs, /summary
GET/POST    /api/nutrition/webteb/*     # categories, search, details, import, resolve-names

GET         /api/marketplace/categories     # parent + child category tree
GET         /api/marketplace/products       # ?search=&brand=&category=&onSale=true
GET/POST    /api/marketplace/orders

GET/POST/PATCH/DELETE   /api/community/*   # posts, comments, likes, follows, groups, inbox
                        # + communityExtras: stories, saves, rings, privacy settings

GET/PATCH   /api/notifications
GET         /api/dashboard

GET         /api/plans/today | /week
PATCH       /api/plans/day                 # skip/swap/life-mode

GET/POST    /api/adaptation/*              # readiness, feedback, explainability

POST        /api/ai/chat                   # FastAPI proxy (required)
POST        /api/ai/chat/confirm           # confirm pending tool action by actionId
GET/POST    /api/ai/plan/*                 # generate, regenerate, me
GET/POST    /api/ai/conversations/*        # chat threads (Mongo-backed)
GET         /api/ai/notify/preview         # smart notification preview

POST        /api/internal/ai/tools/execute # FastAPI → Node tool execution
POST        /api/internal/ai/rag/search    # FastAPI → pgvector RAG
POST        /api/internal/cron/*           # scheduled job triggers

GET/PATCH   /api/settings, /api/settings/account/*
POST        /api/support/tickets

POST        /api/admin/migrate          # emergency token
```

Static (no `/api` prefix):

```
GET    /uploads/**                      # local files (exercises, avatars, …)
```

---

## Frontend routes (`App.tsx`, HashRouter)

| Path | Guard | Page |
|------|-------|------|
| `/#/` | public | `LandingPage` |
| `/#/auth` | public | `AuthPage` — sign-in card **slides in from the right** on first paint |
| `/#/oauth/callback` | public | `OAuthCallback` |
| `/#/auth/set-password` | authed | `SetPasswordPage` |
| `/#/onboarding` | authed | `OnboardingPage` |
| `/#/onboarding/workout` | authed | `WorkoutPlanQuestionnaire` |
| `/#/onboarding/diet` | authed | `DietPlanQuestionnaire` |
| `/#/onboarding/wellness` | authed | `WellnessQuestionnaire` |
| `/#/dashboard` | authed | `RoleDashboard` |
| `/#/profile` | authed | `ProfilePage` |
| `/#/ai-assistant` | authed | `ChatAssistant` |
| `/#/workouts` | authed | `WorkoutLibrary` |
| `/#/muscle-wiki` | authed | `MuscleWikiPage` |
| `/#/nutrition` | authed | `NutritionLibrary` |
| `/#/marketplace` | authed | `Marketplace` |
| `/#/orders` | authed | `OrderHistory` |
| `/#/community` | authed | `CommunityHub` → feed (index) |
| `/#/community/profile` | authed | `CommunityProfile` |
| `/#/community/browse` | authed | `CommunityBrowse` |
| `/#/community/inbox` | authed | `CommunityInbox` (DMs) |
| `/#/community/groups` | authed | `CommunityGroups` |
| `/#/community/settings` | authed | `CommunitySettings` |
| `/#/settings` | authed | `SettingsPage` |
| `/#/support` | authed | `SupportPage` |
| `/#/trainers`, `/#/clients` | authed | redirect → `/dashboard` (legacy trainer routes removed) |
| `/#/gyms` | authed | `GymList` |
| `/#/owner/dashboard` | gym | `GymOwnerDashboard` |
| `/#/owner/members` | gym | `MemberManagement` |

---

## UI motion (auth)

- **Files:** `authCardReveal.tsx`, `AuthVideoBackground.tsx`, `lib/motion.ts` (`authCardSlideVariants`)
- **Usage:** `AuthRevealCard` wraps every auth glass panel
- **Behavior:** Login video plays once; **1 second before the clip ends** the card slides in from `x: 100vw` (spring). Reduced-motion / performance mode → card shows immediately with a short fade.
- **Note:** Do not combine `layout` on the same motion node as horizontal enter — it suppresses `translateX`.

---

## Feature status

### Done
- Auth: email/password, Google OAuth, email OTP, password reset (email + optional SMS), 2FA (TOTP), set-password flow, role RBAC, remember-me.
- Onboarding: multi-step athlete chat flow, gym wizard, workout/diet/wellness questionnaires, catalog-driven steps, persistence to `AthleteProfile.onboardingData`.
- Exercise catalog: MuscleWiki import, ~1,900+ exercises, Arabic names (`nameAr`), categories, muscle-zone filter, video URL resolution, exercise logs.
- Muscle Wiki UI: 3D muscle zones + exercise panel with video player.
- Nutrition: WebTeb categories/search/import, seeded `FoodItem`, daily logs + macro summary, category images, filters.
- AI coach: **WebSocket-only streaming UI** (`/ws` → FastAPI `/chat/stream` SSE, live Anthropic tokens); intent routing, unified pgvector RAG (L1–L3 + L5 books), bounded tool loop, confirm/disambiguate by `actionId` over WS (`coach.confirm`, `coach.disambiguate`). REST `POST /api/ai/chat` remains for scripts/internal use only — not used by the SPA.
- RAG ingest + eval harness — `rag:ingest:*`, `verify:b2`–`b8`, `ai-service/scripts/eval_rag_ragas.py` + `eval/golden_dataset.json`.
- RAG embeddings in Supabase — L1 (6), L2 (1,981 exercises), L3 (2,243 foods), L5 (26 BLS chapters / 165 chunks); verified with `verify:b5`.
- AI Coach system (Blocks A–E, see `AI-COACH-ARCHITECTURE.md`): hybrid Postgres+Mongo+Redis, CAG context bundle, pgvector RAG, plan generation/validation/persist, `DailyAthletePlan`, weekly/daily/mid-week adaptation, readiness/skip/swap/life-modes, explainability, long-term memory pipeline, and smart notifications (D10).
- Community v2: feed, multi-image/video posts, comments/reactions, follows, blocks, DMs, groups, stories (view/react/reply), saves, close-friends ring, mentions, reposts, privacy settings.
- Marketplace, gyms, dashboards, notifications drawer, settings (account, password, 2FA, locale), support tickets.
- i18n: EN/AR toggle, many screens translated; RTL helpers.
- PWA shell, lazy routes, CI (backend lint+test, frontend typecheck+build, ai-service pytest).

### Partial / in progress
- Landing `landing-bg.mp4` and `captain_hema_fixed_final.glb` — paths documented; assets may be missing in clone.
- Exercise video cache — requires `sync:musclewiki-videos` for offline/fast playback.
- AI (remaining): form-check (camera) and food-vision detection are still backlog; everything else (plans, adaptation, agent, memory, smart notifications) is implemented.
- FDC integration — backend libraries exist; UI primarily uses WebTeb.
- Production deploy of the 3-service Docker topology (Hostinger KVM 2) — see `docs/DEPLOY-HOSTINGER.md`. Re-run `rag:ingest:*` on the VPS after book/source edits (L5 `.md` stays local/gitignored).
- Graduation demo recording — not in repo; add link when published (e.g. README or this section).

### Not started / backlog
- Mobile app, Stripe, achievements/leaderboards, OpenAPI, Cypress E2E, wearables.

---

## AI services

| Service | API | Status |
|---------|-----|--------|
| Text coach (streaming) | `WS /ws` → `POST /chat/stream` (SSE) | **Shipped** — WS-only in UI; verify: `npm run verify:ws-streaming` |
| Plan generator | `/api/ai/plan/*`, `/api/plans/*` | **Shipped** (Block C) |
| Adaptation engine | `/api/adaptation/*` | **Shipped** (Block C9–C11) |
| Tool pipeline + tools | FastAPI coach graph + Node internal tools | **Shipped** (Block E) |
| Smart notifications | cron + `GET /api/ai/notify/preview` | **Shipped** (Block D10) |
| Form tracer | `/api/ai/form-check/*` | Planned |
| Food detect | `/api/ai/food/detect`, `/nutrition` | Planned |

Design notes for planned features remain in git history; implementation should follow server-side Claude/proxy pattern and rate limits in `.env.example`.

---

## Local development

### Prerequisites
- Node.js **18+**, npm, Python **3.11+** (for `ai-service`)
- **PostgreSQL** (Supabase recommended) — official plans, catalogs, RAG pgvector
- **MongoDB** — chat threads, agent traces, LLM audit (recommended for full AI features)
- **Redis** — CAG cache + BullMQ queues (recommended for production)
- LLM API key in `ai-service/.env` (`ANTHROPIC_API_KEY` or equivalent)
- Optional: Google OAuth, Gmail, Supabase service key, Twilio, Playwright (video sync)

### Quick start (monorepo root)

```bash
npm run install:all
# Configure backend-node/.env and frontend/.env.local (see .env.example)
npm run dev
```

| Service | Default URL | Notes |
|---------|-------------|--------|
| Frontend | http://localhost:3000 | Vite (`vite.config.ts`); use `/#/auth` not `/auth` |
| API | http://localhost:4000 | Set `PORT` in `backend-node/.env` |
| Health | http://localhost:4000/health | |

**Windows note:** If PostgreSQL 15 listens on port **4000**, set `PORT=4002` (or another free port) in `backend-node/.env` and match `frontend/vite.config.ts` proxy target.

Vite proxies `/api`, `/uploads`, and `/health` to the API — leave `VITE_API_URL` unset in dev.

### Backend only

```bash
cd backend-node
cp .env.example .env
npm install
npm run db:migrate
npm run db:seed          # optional; npm run db:seed:force to reset seed data
npm run dev
```

**Data / video scripts** (`backend-node/`):

```bash
npm run import:musclewiki              # Scrape catalog into DB
npm run sync:musclewiki-videos         # Cache MP4s under uploads/exercises/
npm run import:webteb                  # WebTeb nutrition DB
npm run sync:musclewiki-videos:status
npm run verify:exercise-videos
```

### Frontend only

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

### Demo account
`demo@taqwin.app` / `Taqwin#2025`

---

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) and [`docs/DEPLOY-HOSTINGER.md`](docs/DEPLOY-HOSTINGER.md).

**Production (current target):** Hostinger KVM 2 — Docker Compose (`deploy/docker-compose.production.yml`) with nginx, Node API, FastAPI, optional worker. Data: Supabase Postgres + pgvector, MongoDB Atlas, Upstash Redis.

**Legacy:** Supabase → Render (`backend-node`) → Vercel (`frontend`). Run migrations on deploy; seed once. Exercise videos: MuscleWiki CDN or `sync:musclewiki-videos` on a worker with Playwright.

---

## Security posture

- Helmet, CORS (`FRONTEND_URL`, optional Vercel preview regex in dev).
- Rate limits on auth and AI routes.
- Zod validation on mutating routes; Prisma parameterized queries.
- Uploads via signed Supabase URLs; service key server-only.
- Coach context built server-side; client never sees LLM keys.
- Exercise/community videos: CDN or self-hosted static; no raw webcam upload for form tracer yet.

Known gaps: JWT in `localStorage`, no upload virus scan, limited automated test coverage.

---

## Conventions

- Backend: JavaScript only; routers in `src/routes/`; Zod in `validate` middleware; use `logger` (pino).
- Frontend: strict TypeScript; API calls via `services/*`; Tailwind + `components/ui/`.
- Media: resolve URLs with `lib/mediaUrl.ts`; do not hardcode API host in components.
- Motion: use `useMotionPrefs()`; respect reduced motion.
- Before push: `npm run lint` in `backend-node` and `frontend`.

---

## Roadmap (next milestones)

1. Form-check (camera) and food-vision detection (`/api/ai/form-check/*`, `/api/ai/food/detect`).
2. Stripe + subscriptions.
3. Full RTL polish and complete AR coverage.
4. E2E tests + OpenAPI.
5. Optional: commit or document large binary assets (landing video, GLB) in release notes or LFS.
