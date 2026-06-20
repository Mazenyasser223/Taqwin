# Taqwin Frontend

React 19 single-page application for the Taqwin fitness platform. Hash-based routing, bilingual UI (Arabic/English), real-time WebSocket updates, and a feature-module architecture.

## Stack

| Component | Technology |
|-----------|------------|
| Framework | React 19, TypeScript |
| Build | Vite 6 |
| Routing | React Router 7 (HashRouter) |
| State | Zustand |
| Styling | Tailwind CSS |
| Animation | Framer Motion |
| 3D | Three.js, React Three Fiber, Drei |
| Vision | MediaPipe Tasks Vision (Cap Hema Eye) |
| Maps | Leaflet / React Leaflet |
| Charts | Recharts, ApexCharts |
| PWA | vite-plugin-pwa |
| Monitoring | Sentry |

## Project structure

```text
frontend/
├── README.md
├── package.json
├── vite.config.ts                 # Dev server (:3000), API proxy, PWA
├── tailwind.config.js
├── tsconfig.json
├── index.html
├── App.tsx                        # Root routes and auth guards
├── types.ts                       # Shared TypeScript types
│
├── features/                      # Feature modules (pages + logic)
│   ├── landing/                   # Public landing + legal pages
│   ├── auth/                      # Login, register, OAuth, set-password
│   ├── onboarding/                # Core, workout, diet, wellness questionnaires
│   ├── dashboard/                 # Athlete dashboard, gym owner dashboard, plans
│   ├── profile/                   # User dossier and profile editing
│   ├── ai-chat/                   # AI coach chat assistant (streaming, transcript)
│   ├── workouts/                  # Exercise library (MuscleWiki catalog)
│   ├── nutrition/                 # Food search, logging, macro tracking, private library
│   ├── muscle-wiki/               # 3D muscle explorer → see features/muscle-wiki/README.md
│   ├── cap-hema-eye/              # Live push-up / squat form analysis (MediaPipe)
│   ├── community/                 # Feed, stories, DMs, groups, browse, profiles
│   ├── compete/                   # Leagues, challenges, XP leaderboards
│   ├── marketplace/               # Market Vault shop catalog
│   ├── checkout/                  # Checkout wizard and success pages
│   ├── commerce/                  # Cart, wishlist, product detail
│   ├── payments/                  # Payment success/failure flows
│   ├── orders/                    # Order history and detail
│   ├── gyms/                      # Gym discovery list, filters, map
│   ├── admin/                     # Shop admin dashboard (/admin/shop)
│   ├── settings/                  # App settings, Telegram, privacy, account
│   ├── support/                   # Support page
│   └── guide/                     # In-app product tour
│
├── components/
│   ├── ui/                        # Layout, skeletons, lazy route, notifications
│   ├── shared/                    # Logo, password input, language toggle, motion
│   ├── chat/                      # Chat message body (markdown, Arabic bidi)
│   ├── gyms/                      # Gym map, detail drawer, amenities, reviews
│   └── tailadmin/                 # Dashboard shell components (KPI, tables, modals)
│
├── store/                         # Zustand stores
│   ├── useAuthStore.ts
│   ├── useCartStore.ts
│   ├── useConfigStore.ts
│   ├── useLanguageStore.ts
│   ├── useNotificationStore.ts
│   ├── useSettingsStore.ts
│   ├── useCommunityStoriesStore.ts
│   ├── usePlanGenerationSessionStore.ts
│   └── …
│
├── lib/                           # Utilities and hooks
│   ├── i18n/                      # Internationalization (AR/EN)
│   ├── realtime/                  # WebSocket provider and coach streaming hooks
│   ├── productTour/               # Guided tour targets and layout
│   ├── hooks/
│   ├── apiBaseUrl.ts
│   ├── apiTransientError.ts       # Retry + auth session + Prisma error sanitization
│   ├── authRoutes.ts
│   ├── authStorage.ts
│   ├── coachMessageMarkdown.tsx   # Coach reply markdown renderer
│   ├── normalizeArabicCoachText.ts
│   ├── gymAmenities.ts / gymGeo.ts
│   ├── hashRouteQuery.ts
│   ├── motion.ts
│   └── …
│
├── services/                      # API client modules
│   ├── api.ts                     # Base HTTP client with transient retry
│   ├── aiService.ts               # Coach chat + conversations
│   ├── authService.ts
│   ├── communityService.ts
│   ├── dashboardService.ts
│   ├── exerciseService.ts
│   ├── gamificationService.ts
│   ├── gymService.ts
│   ├── marketplaceService.ts
│   ├── nutritionService.ts
│   ├── plansService.ts
│   ├── settingsService.ts
│   └── …
│
├── tests/                         # Vitest unit tests (lib helpers)
├── docs/
│   └── mobile.md                  # Mobile/PWA notes
│
└── public/                        # Static assets
    ├── assets/                    # Onboarding, landing media
    ├── icons/                     # PWA icons
    ├── nutrition/                 # Nutrition category images
    │   └── categories/            # → see public/nutrition/categories/README.md
    ├── nutrition-categories/      # Category cover images (browse UI)
    └── workouts/
        └── categories/            # → see public/workouts/categories/README.md
```

## Getting started

### Prerequisites

- Node.js 18+
- Running `backend-node` API (default port **4000**)

### Install

```bash
cd frontend
npm install
```

### Environment

Create `.env` or `.env.local` in `frontend/` if needed:

```env
# Optional — dev uses Vite proxy to backend (see vite.config.ts)
# VITE_BACKEND_PORT=4000
# VITE_API_URL=http://localhost:4000   # production builds only
```

In production builds, set `VITE_API_URL` to the public API origin.

### Run

```bash
npm run dev
```

Default URL: **http://localhost:3000**

`/api` and `/uploads` are proxied to the backend during development (port from `VITE_BACKEND_PORT` / `BACKEND_PORT`, default `4000`).

### Build

```bash
npm run build      # Output → dist/
npm run preview    # Preview production build locally (:4173)
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Vite dev server (:3000) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript check (`tsc --noEmit`) |

## Routing overview

Hash-based routes in `App.tsx`:

| Route | Feature |
|-------|---------|
| `/` | Landing (public) |
| `/about`, `/privacy`, `/terms`, … | Legal / info pages |
| `/auth`, `/oauth/callback` | Login, register, OAuth |
| `/onboarding/*` | Questionnaire flows |
| `/dashboard`, `/dashboard/plans` | Role-based dashboard + plan views |
| `/profile` | User dossier |
| `/ai-assistant` | AI coach assistant |
| `/workouts` | Exercise library |
| `/nutrition` | Food search and logging |
| `/muscle-wiki` | 3D muscle explorer |
| `/cap-hema-eye` | Live push-up / squat analysis |
| `/community/*` | Feed, inbox, groups, browse, settings |
| `/compete/*` | League, challenges, social leaderboard |
| `/marketplace/*` | Shop catalog, cart, wishlist, product detail |
| `/checkout/*` | Checkout wizard and payment |
| `/orders/*` | Order history |
| `/gyms` | Gym discovery |
| `/settings` | App settings |
| `/support` | Support page |
| `/owner/*` | Gym owner dashboard, members, reception, equipment |
| `/admin/shop/*` | Shop admin (products, orders, marketing, AI commerce) |

Protected routes require authentication via `useAuthStore`. Onboarding completion is enforced before dashboard access. Legacy `/trainers` and `/clients` redirect to `/dashboard`.

## Real-time

`lib/realtime/RealtimeProvider.tsx` connects to the backend WebSocket for:

- Coach token streaming
- Community presence
- Live notifications

Coach chat persists transcript locally per user and hydrates from server history when a conversation exists.

## Asset guides

- **Nutrition category images:** [public/nutrition/categories/README.md](./public/nutrition/categories/README.md)
- **Exercise category covers:** [public/workouts/categories/README.md](./public/workouts/categories/README.md)
- **Muscle Wiki 3D model:** [features/muscle-wiki/README.md](./features/muscle-wiki/README.md)

## Development notes

- Keep API keys and tokens in `.env` only — never commit them
- Do not commit `node_modules` or `dist/`
- Coordinate major UI changes through pull requests
- Run `npm run lint` before opening a PR

## Related documentation

- [../README.md](../README.md) — Monorepo quick start
- [../Taqwin.md](../Taqwin.md) — Feature inventory and routes
- [../USER.md](../USER.md) — User/profile/settings reference
- [../DEPLOY.md](../DEPLOY.md) — Deployment index
- [docs/mobile.md](./docs/mobile.md) — Mobile/PWA notes
