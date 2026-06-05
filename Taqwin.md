# Taqwin — AI-Powered Fitness Platform

> Graduation project, Faculty of Computer Science & Data Science, Alexandria University.  
> Status document — what is actually built today, not what's aspirational.

Taqwin (تكوين, "formation") is a deployable web platform connecting three fitness roles in one product:

- **Athletes** — workouts, exercise catalog with video demos, nutrition (WebTeb + seeded foods), AI coach, community (feed, stories, DMs, groups), marketplace, trainer/gym discovery.
- **Trainers** — public profile, client list, bookings inbox.
- **Gym owners** — gym profile, membership roster, check-in tracking, owner dashboard.

Live deployment topology: **Vercel (SPA) → Render (Express API) → Supabase (Postgres + Storage)**, with **Anthropic Claude / Gemini / Ollama** (configurable) proxied through `/api/ai/chat` on the server.

---

## Repository layout

```text
Taqwin/
├── package.json                 # Root scripts: npm run dev (concurrently), install:all
├── package-lock.json
├── README.md
├── DEPLOY.md                    # Supabase + Render + Vercel runbook
├── Taqwin.md                    # This file — project status & conventions
├── USER.md                      # User account & profile API reference
├── Logo.png
│
├── .github/workflows/ci.yml     # backend lint+test, frontend typecheck+build
├── .cursor/rules/               # Cursor agent rules (if present)
├── docs/
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
│   │   │   ├── bookings.js      # /api/trainers, /api/bookings
│   │   │   ├── community.js     # feed, posts, comments, follows, groups, DMs
│   │   │   ├── communityExtras.js  # stories, saves, rings, privacy (mounted under community)
│   │   │   ├── notifications.js
│   │   │   ├── dashboard.js
│   │   │   ├── ai.js            # POST /api/ai/chat (implemented)
│   │   │   ├── settings.js
│   │   │   ├── settingsAccount.js
│   │   │   ├── support.js
│   │   │   └── emergency-migrate.js
│   │   ├── services/            # email, sms (Twilio), fdc, fatsecret, aiChatProvider, translate
│   │   └── lib/                 # musclewiki scrape/sync, webteb, exercise video cache, coach context, …
│   ├── scripts/                 # Data import & video sync (see below)
│   ├── uploads/                 # Local media (gitignored content) — exercise MP4s, avatars, etc.
│   │   └── exercises/{muscleWikiId}/*.mp4
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/          # 34 migrations (through 20260524120000_exercise_name_ar)
│   │   ├── shopCatalogSeed.js   # categories + EGP products
│   │   ├── seedShopOnly.js
│   │   └── seed.js
│   ├── tests/                   # vitest smoke tests
│   ├── Dockerfile
│   ├── .env.example
│   └── package.json
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
    │   ├── trainers/            # TrainerList, ClientList
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
- **AI** — `services/aiChatProvider.js` (Ollama / Anthropic / Gemini via env `AI_PROVIDER`)
- **USDA FDC** — `services/fdcService.js` + Redis optional cache warm on boot (library code; primary UI nutrition path is WebTeb)
- **FatSecret** client (optional env)
- **Playwright** (optional) — MuscleWiki video download
- **Vitest** + **Supertest**; **ESLint** + **Prettier**

### Infra / DevOps
- **GitHub Actions** CI
- **Render** — API; **Vercel** — SPA; **Supabase** — Postgres + Storage
- No Stripe / Socket.IO / BullMQ in production yet

---

## Database (Prisma)

Roles: `athlete | trainer | gym`.

**Implemented models** (see `prisma/schema.prisma`):

```text
User, Profile, UserSettings, SupportTicket
Gym, GymMembership, GymCheckIn
Workout, WorkoutLog
Exercise, ExerciseLog                    # MuscleWiki catalog
FoodItem, FoodLog
WebtebCategory, WebtebFood               # Arabic nutrition DB
Product, Order, OrderItem
TrainerBooking
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
```

**Planned** (not in schema yet): `WorkoutPlan`, `DietPlan`, `FormSession`, `AIConversation`, `NotificationRule`, etc.

- Migrations: `prisma/migrations/` (34 applied in production clone).
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

GET         /api/trainers, /api/trainers/:id
POST/GET/PATCH   /api/bookings

GET/POST/PATCH/DELETE   /api/community/*   # posts, comments, likes, follows, groups, inbox
                        # + communityExtras: stories, saves, rings, privacy settings

GET/PATCH   /api/notifications
GET         /api/dashboard

POST        /api/ai/chat                # implemented

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
| `/#/trainers` | authed | `TrainerList` |
| `/#/clients` | trainer | `ClientList` |
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
- Onboarding: multi-step athlete chat flow, trainer/gym wizards, workout/diet/wellness questionnaires, catalog-driven steps, persistence to `Profile.onboardingData`.
- Exercise catalog: MuscleWiki import, ~1,900+ exercises, Arabic names (`nameAr`), categories, muscle-zone filter, video URL resolution, exercise logs.
- Muscle Wiki UI: 3D muscle zones + exercise panel with video player.
- Nutrition: WebTeb categories/search/import, seeded `FoodItem`, daily logs + macro summary, category images, filters.
- AI coach: `/api/ai/chat` with profile + food context; provider switch via env.
- Community v2: feed, multi-image/video posts, comments/reactions, follows, blocks, DMs, groups, stories (view/react/reply), saves, close-friends ring, mentions, reposts, privacy settings.
- Marketplace, bookings, gyms, dashboards, notifications drawer, settings (account, password, 2FA, locale), support tickets.
- i18n: EN/AR toggle, many screens translated; RTL helpers.
- PWA shell, lazy routes, CI lint/build.

### Partial / in progress
- Landing `landing-bg.mp4` and `captain_hema_fixed_final.glb` — paths documented; assets may be missing in clone.
- Exercise video cache — requires `sync:musclewiki-videos` for offline/fast playback.
- AI: only chat shipped; form-check, food vision, plan generator, notify engine — backlog.
- FDC integration — backend libraries exist; UI primarily uses WebTeb.
- Profile/plan assignment for trainers.

### Not started / backlog
- Mobile app, Stripe, real-time sockets, achievements/leaderboards, OpenAPI, Cypress E2E, Redis/BullMQ in prod.

---

## AI services

| Service | API | Status |
|---------|-----|--------|
| Text coach | `POST /api/ai/chat` | **Shipped** (Ollama / Claude / Gemini) |
| Form tracer | `/api/ai/form-check/*` | Planned |
| Food detect | `/api/ai/food/detect`, `/nutrition` | Planned |
| Plan generator | `/api/ai/plan/*` | Planned |
| Smart notifications | cron + `/api/ai/notify/preview` | Planned |

Design notes for planned features remain in git history; implementation should follow server-side Claude/proxy pattern and rate limits in `.env.example`.

---

## Local development

### Prerequisites
- Node.js **18+**, npm
- Postgres (Supabase recommended) — see `backend-node/README.md`
- Optional: Google OAuth, Gmail, Anthropic/Gemini/Ollama, Supabase service key, Twilio, Playwright (video sync)

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

See [`DEPLOY.md`](./DEPLOY.md). Summary: Supabase (DB + `taqwin-uploads` bucket) → Render (`backend-node`) → Vercel (`frontend`, `VITE_API_URL` = Render URL). Run migrations on deploy; seed once. Exercise videos: either rely on MuscleWiki CDN or run `sync:musclewiki-videos` on a worker with Playwright and persist `uploads/` / Supabase.

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

1. Ship remaining `/api/ai/*` routes (form-check, food vision, plan, notifications).
2. Persist `AIConversation` + streaming chat.
3. Stripe + subscriptions.
4. Full RTL polish and complete AR coverage.
5. E2E tests + OpenAPI.
6. Optional: commit or document large binary assets (landing video, GLB) in release notes or LFS.
