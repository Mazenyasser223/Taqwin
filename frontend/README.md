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
| Charts | Recharts, ApexCharts |
| PWA | vite-plugin-pwa |

## Project structure

```text
frontend/
├── README.md
├── package.json
├── vite.config.ts                 # Dev server, API proxy, PWA
├── tailwind.config.js
├── tsconfig.json
├── index.html
├── App.tsx                        # Root routes and auth guards
├── types.ts                       # Shared TypeScript types
│
├── features/                      # Feature modules (pages + logic)
│   ├── landing/                   # Public landing page
│   ├── auth/                      # Login, register, OAuth, set-password
│   ├── onboarding/                # Core, workout, diet, wellness questionnaires
│   ├── dashboard/                 # Athlete dashboard, gym owner dashboard
│   ├── profile/                   # User dossier and profile editing
│   ├── ai-chat/                   # AI coach chat assistant
│   ├── workouts/                  # Exercise library (MuscleWiki catalog)
│   ├── nutrition/                 # Food search, logging, macro tracking
│   ├── muscle-wiki/               # 3D muscle explorer → see features/muscle-wiki/README.md
│   ├── community/                 # Feed, stories, DMs, groups, profiles
│   ├── marketplace/               # Market Vault shop catalog
│   ├── orders/                    # Order history
│   ├── gyms/                      # Gym list, member management
│   ├── settings/                  # App settings
│   ├── support/                   # Support page
│   └── trainers/                  # Legacy trainer UI remnants
│
├── components/
│   ├── ui/                        # Layout, skeletons, lazy route wrapper
│   ├── shared/                    # Logo, password input, language toggle, …
│   ├── chat/                      # Chat UI components
│   └── tailadmin/                 # Dashboard shell components
│
├── store/                         # Zustand stores
│   ├── useAuthStore.ts
│   ├── useCartStore.ts
│   ├── useConfigStore.ts
│   ├── useLanguageStore.ts
│   ├── useNotificationStore.ts
│   ├── useSettingsStore.ts
│   └── …
│
├── lib/                           # Utilities and hooks
│   ├── i18n/                      # Internationalization (AR/EN)
│   ├── realtime/                  # WebSocket provider and hooks
│   ├── hooks/
│   ├── apiBaseUrl.ts
│   ├── authRoutes.ts
│   ├── authStorage.ts
│   ├── hashRouteQuery.ts
│   ├── motion.ts
│   └── …
│
├── services/                      # API client modules
├── 3d/                            # Three.js scene components
│   ├── FitnessOrb.tsx
│   ├── GymScene.tsx
│   └── …
│
├── docs/
│   └── mobile.md                  # Mobile/PWA notes
│
└── public/                        # Static assets
    ├── assets/                    # Onboarding, landing media
    ├── icons/                     # PWA icons
    ├── nutrition/                 # Nutrition category images
    │   └── categories/            # → see public/nutrition/categories/README.md
    └── nutrition-categories/      # Category cover images
```

## Getting started

### Prerequisites

- Node.js 18+
- Running `backend-node` API (default port 4000 or 4002)

### Install

```bash
cd frontend
npm install
```

### Environment

Create `.env` or `.env.local` in `frontend/` if needed:

```env
# Optional — dev uses Vite proxy to backend (see vite.config.ts)
# VITE_API_URL=http://localhost:4000
```

In production builds, set `VITE_API_URL` to the public API origin.

### Run

```bash
npm run dev
```

Default URL: **http://localhost:3000**

`/api` and `/uploads` are proxied to the backend during development.

### Build

```bash
npm run build      # Output → dist/
npm run preview    # Preview production build locally
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
| `/auth/*` | Login, register, OAuth callback |
| `/onboarding/*` | Questionnaire flows |
| `/dashboard` | Role-based dashboard (athlete / gym) |
| `/profile` | User dossier |
| `/chat` | AI coach assistant |
| `/workouts` | Exercise library |
| `/nutrition` | Food search and logging |
| `/muscle-wiki` | 3D muscle explorer |
| `/community/*` | Feed, inbox, groups, profiles |
| `/marketplace` | Shop catalog |
| `/orders` | Order history |
| `/gyms` | Gym management |
| `/settings` | App settings |

Protected routes require authentication via `useAuthStore`. Onboarding completion is enforced before dashboard access.

## Real-time

`lib/realtime/RealtimeProvider.tsx` connects to the backend WebSocket for:

- Coach token streaming
- Community presence
- Live notifications

## Asset guides

- **Nutrition category images:** [public/nutrition/categories/README.md](./public/nutrition/categories/README.md)
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
