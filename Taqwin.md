# Taqwin — AI-Powered Fitness Platform

> Graduation project, Faculty of Computer Science & Data Science, Alexandria University.
> Status document — what is actually built today, not what's aspirational.

Taqwin (تكوين, "formation") is a deployable web platform connecting three fitness roles in one product:

- **Athletes** — workouts, nutrition logging, AI coach, community, marketplace, trainer/gym discovery.
- **Trainers** — public profile, client list, bookings inbox.
- **Gym owners** — gym profile, membership roster, check-in tracking, owner dashboard.

Live deployment topology: **Vercel (SPA) → Render (Express API) → Supabase (Postgres + Storage)**, with **Anthropic Claude** as the AI provider proxied through the API for all `/api/ai/*` services (chat coach, live form tracer, food detection, plan generator, smart notifications).

---

## Repository layout

```text
Taqwin/
├── backend-node/                # Express + Prisma API (JavaScript)
│   ├── src/
│   │   ├── app.js               # Express wiring (helmet, cors, pino, passport)
│   │   ├── index.js
│   │   ├── config/              # passport (Google OAuth)
│   │   ├── db.js                # PrismaClient singleton
│   │   ├── lib/                 # logger (pino), notifications
│   │   ├── middleware/          # auth, validate, errorHandler, rateLimitAuth
│   │   ├── routes/              # auth, profile, gyms, workouts, nutrition,
│   │   │                        # marketplace, bookings, community,
│   │   │                        # notifications, dashboard, uploads, ai,
│   │   │                        # emergency-migrate
│   │   └── services/            # emailService (nodemailer)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.js              # idempotent seed (workouts, foods, demo users)
│   ├── tests/                   # vitest smoke tests
│   ├── Dockerfile
│   └── eslint.config.js
│
├── frontend/                    # React 19 + Vite SPA (TypeScript)
│   ├── App.tsx                  # HashRouter + role-gated routes
│   ├── index.tsx, index.html, index.css
│   ├── components/
│   │   ├── ui/                  # Layout, ChatWidget, NotificationDrawer
│   │   └── shared/              # Logo, ImageUploader
│   ├── features/
│   │   ├── auth/                # AuthPage, OAuthCallback
│   │   ├── onboarding/          # OnboardingPage (multi-step wizard)
│   │   ├── profile/             # ProfilePage
│   │   ├── dashboard/           # RoleDashboard, User/Trainer/GymOwner dashboards
│   │   ├── ai-chat/             # ChatAssistant (Claude proxy)
│   │   ├── form-tracer/         # planned: webcam + MediaPipe pose + rep counter
│   │   ├── food-scan/           # planned: camera capture → /api/ai/food/detect
│   │   ├── plan/                # planned: generated workout + diet plan viewer
│   │   ├── workouts/            # WorkoutLibrary
│   │   ├── nutrition/           # NutritionLibrary
│   │   ├── marketplace/         # Marketplace
│   │   ├── orders/              # OrderHistory
│   │   ├── trainers/            # TrainerList, ClientList
│   │   ├── gyms/                # GymList, MemberManagement
│   │   ├── community/           # CommunityFeed
│   │   └── landing/             # LandingPage (3D hero)
│   ├── services/                # api client + per-feature service modules
│   ├── store/                   # zustand (auth, cart, notifications)
│   ├── 3d/                      # R3F header + page accents
│   ├── tailwind.config.js, postcss.config.js, vite.config.ts
│   └── .env.example
│
├── docs/                        # DATABASE-DESIGN, AWS-SETUP, GOOGLE-OAUTH,
│                                # EMAIL-VERIFICATION, POSTGRES-WINDOWS
├── .github/workflows/ci.yml     # backend lint+test, frontend typecheck+build
├── DEPLOY.md                    # Supabase + Render + Vercel runbook
└── README.md
```

No Turborepo / pnpm workspaces — each side has its own `package.json`. No mobile app yet.

---

## Tech stack (actual)

### Frontend (`frontend/`)
- **React 19** + **Vite 6** + **TypeScript**
- **React Router 7** (HashRouter)
- **Zustand 5** for auth / cart / notifications
- **Tailwind CSS 3** + custom design tokens
- **Framer Motion** for page transitions
- **Three.js** + **@react-three/fiber** + **@react-three/drei** for the landing 3D hero and per-page accents
- **Recharts** for dashboards
- **MediaPipe Tasks Vision** (planned) for in-browser real-time pose estimation used by the live form tracer — runs at 30 fps on-device, zero per-frame cost
- All Claude traffic goes through the backend AI proxy — no Anthropic API key is ever shipped to the browser

### Backend (`backend-node/`)
- **Node.js 18+** + **Express 4** (JavaScript, not TypeScript)
- **Prisma 5** ORM → **PostgreSQL** (Supabase)
- **JWT** (`jsonwebtoken`) + **bcryptjs** for credentials
- **Passport** + **passport-google-oauth20** for Google sign-in
- **Nodemailer** + Gmail App Password for verification / reset emails
- **Helmet**, **compression**, **cors**, **express-rate-limit**, **express-async-errors**
- **Zod 4** schemas via a custom `validate` middleware
- **Pino** + **pino-http** structured logging
- **@supabase/supabase-js** for server-side Storage uploads (bucket `taqwin-uploads`, signed URLs)
- **@anthropic-ai/sdk** powering every `/api/ai/*` endpoint (default model `claude-sonnet-4-5`; vision used by food detection)
- **multer** (planned) for parsing image uploads on the food-detection route
- **node-cron** (planned) for the notification rule scheduler (will graduate to BullMQ when Redis lands)
- **Vitest** + **Supertest** for tests (smoke coverage)
- **ESLint** + **Prettier**

### Infra / DevOps
- **GitHub Actions** CI: backend `lint + test`, frontend `tsc --noEmit + vite build`
- **Render** native Node runtime hosts the API; optional **Dockerfile** is checked in
- **Vercel** hosts the SPA
- **Supabase** provides Postgres + Storage (signed-URL uploads)
- No Redis / BullMQ / Socket.IO / Stripe / Sentry / Winston / Morgan / Nginx / AWS S3 / CloudFront

---

## Database (Prisma)

Roles enum: `athlete | trainer | gym`. Models currently in `prisma/schema.prisma`:

```
User, Profile
Gym, GymMembership, GymCheckIn
Workout, WorkoutLog
FoodItem, FoodLog
Product, Order, OrderItem
TrainerBooking
CommunityPost, CommunityComment, CommunityPostLike
Notification
```

Planned models to support the new AI services (next migration):

```
WorkoutPlan, WorkoutPlanDay          # generated by /api/ai/plan/generate
DietPlan, DietPlanMeal               # generated by /api/ai/plan/generate
FormSession, FormRepEvent            # live tracer telemetry per workout session
AIConversation, AIMessage            # persisted Claude chats with memory
NotificationRule, NotificationDispatch  # rule engine + audit trail
```

Notes:
- `Profile` is a single flat model that carries athlete fields (DOB, height, weight, goal, level, medical notes), trainer fields (bio, specialties, yearsExperience), and gym/business fields (businessName, address, phone, websiteUrl).
- All ids are UUIDs; every row has `createdAt`; mutable rows have `updatedAt`. No soft-delete column yet.
- Migrations live in `prisma/migrations/`; the latest is `20260517000000_add_domain_models`.
- `prisma/seed.js` is idempotent (uses a `_meta.seeded` guard) and inserts 20 workouts, ~30 foods, demo users (`demo@taqwin.app` / `Taqwin#2025`), products, and sample community content.

Models from the original master spec that are **not yet** in the schema: `UserGoals`, `UserHealth`, separate `Trainer`/`GymOwner`, `GymBranch`, `GymService`, `MembershipPlan`, `Subscription`, `Exercise`/`ExerciseSet`, `MealEntry`, `BodyMeasurement`, `ProgressPhoto`, `BookingSlot`, `Class`, `Payment`/`Invoice`/`Transaction`, `NotificationPreference`, `Achievement`/`UserAchievement`, `Challenge`/`ChallengeParticipant`, `Follow`, `Review`/`Rating`.

---

## API surface (mounted in `src/app.js`)

Base prefix: `/api`. All non-public routes go through `authMiddleware` (JWT bearer); role-restricted routes use `requireRole(...)`.

```
GET    /health                     # liveness + db ping

POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/verify-email
POST   /api/auth/resend-verification
POST   /api/auth/forgot-password
POST   /api/auth/reset-password
GET    /api/auth/google            # OAuth start
GET    /api/auth/google/callback   # redirects to SPA /oauth/callback?token=

GET/PATCH   /api/profile
POST        /api/uploads/avatar    # Supabase Storage signed write

GET         /api/gyms
GET         /api/gyms/:id
POST        /api/gyms              # gym role
PATCH       /api/gyms/:id          # gym role (owner)
POST        /api/gyms/:id/join     # athlete membership
POST        /api/gyms/:id/check-in
GET         /api/gyms/:id/members  # gym owner

GET/POST    /api/workouts
GET         /api/workouts/logs
POST        /api/workouts/:id/log

GET         /api/nutrition/foods
GET/POST    /api/nutrition/logs

GET         /api/marketplace/products
GET/POST    /api/marketplace/orders
GET         /api/marketplace/orders/:id

GET         /api/trainers
GET         /api/trainers/:id
POST        /api/bookings          # athlete books trainer
GET         /api/bookings          # role-aware list (athlete vs trainer)
PATCH       /api/bookings/:id      # confirm / cancel / complete

GET/POST    /api/community/posts
POST        /api/community/posts/:id/like
POST        /api/community/posts/:id/comments

GET         /api/notifications
PATCH       /api/notifications/:id/read

GET         /api/dashboard         # role-routed aggregate stats

# AI services — all proxied through Claude on the server, all JWT-protected,
# all rate-limited per user. No Anthropic key ever reaches the browser.
POST        /api/ai/chat                       # text coach (existing — being swapped to Claude)
POST        /api/ai/form-check/session         # open a tracking session for an exercise
POST        /api/ai/form-check/feedback        # body: keypoint metrics + rep events → coaching text
POST        /api/ai/form-check/session/:id/close
POST        /api/ai/food/detect                # multipart image → [{ name, confidence, suggestedUnit }]
POST        /api/ai/food/nutrition             # body: [{ foodId|name, quantity, unit }] → totals + per-item macros
POST        /api/ai/plan/generate              # build initial workout + diet plan from onboarding data
GET         /api/ai/plan/me                    # latest active plan for the current user
POST        /api/ai/plan/regenerate            # re-run after profile/goal change
POST        /api/ai/notify/preview             # dev/admin: render a personalized notification body
# Notification dispatch itself is a scheduled job (node-cron loop), not a user-facing route.

POST        /api/admin/migrate     # gated by x-emergency-migrate-token
```

Response shape is plain JSON; pagination is offset-based where present. Swagger/OpenAPI is **not** wired up yet.

---

## Frontend routes (`frontend/App.tsx`)

Uses `HashRouter` so it works on any static host without rewrite rules.

| Path                 | Guard                | Page |
|----------------------|----------------------|------|
| `/`                  | public               | `LandingPage` (3D hero) |
| `/auth`              | public               | `AuthPage` (login + register tabs) |
| `/oauth/callback`    | public               | `OAuthCallback` (consume `?token=`) |
| `/onboarding`        | authed               | `OnboardingPage` (multi-step wizard) |
| `/dashboard`         | authed               | `RoleDashboard` → User/Trainer/GymOwner |
| `/profile`           | authed               | `ProfilePage` |
| `/ai-assistant`      | authed               | `ChatAssistant` |
| `/workouts`          | authed (lazy)        | `WorkoutLibrary` |
| `/nutrition`         | authed (lazy)        | `NutritionLibrary` |
| `/marketplace`       | authed (lazy)        | `Marketplace` |
| `/orders`            | authed (lazy)        | `OrderHistory` |
| `/community`         | authed               | `CommunityFeed` |
| `/trainers`          | authed (lazy)        | `TrainerList` |
| `/clients`           | role `trainer`       | `ClientList` |
| `/gyms`              | authed (lazy)        | `GymList` |
| `/owner/dashboard`   | role `gym`           | `GymOwnerDashboard` |
| `/owner/members`     | role `gym`           | `MemberManagement` |

State stores: `useAuthStore`, `useCartStore`, `useNotificationStore`.

---

## Feature status

### Done
- **Auth & onboarding**: email/password (bcrypt), JWT (`JWT_EXPIRES_IN=7d`, localStorage), Google OAuth, email OTP verification + resend, password reset link flow, three-role RBAC (`athlete | trainer | gym`), multi-step onboarding wizard collecting profile + role-specific fields, avatar upload to Supabase Storage.
- **User dashboard**: today summary card, workout/nutrition tiles, AI tip entrypoint, Recharts progress.
- **Trainer dashboard + portal**: profile fields (bio, specialties, yearsExperience), client list, bookings inbox.
- **Gym-owner dashboard + portal**: gym profile, member roster, check-ins, basic occupancy stat.
- **Workout system**: workout library with category/difficulty/duration/calories, log a completed workout, history list. *(No AI generator, no in-session timer/rest UI, no per-exercise sets.)*
- **Nutrition tracking**: searchable seeded food database, manual meal log, daily totals. *(No photo recognition, no AI meal plans, no water tracker.)*
- **AI Chat Coach**: server-proxied LLM call, per-user rate limit, system prompt scoped to Taqwin. *(No streaming, no persisted conversation history table, no sentiment analysis. Provider is being swapped from Gemini to Anthropic Claude — see the AI services section below.)*
- **Marketplace**: product catalog, cart store, checkout creates a `pending` order. *(No Stripe.)*
- **Trainer bookings**: athlete → trainer booking with status workflow (`pending → confirmed → completed | cancelled`).
- **Gym discovery**: list + detail + join + check-in. *(No map view, no filters by amenities/price yet.)*
- **Community**: posts, comments, likes (REST polling).
- **Notifications**: in-app drawer, per-user notifications table, mark-as-read.
- **Settings basics**: dark theme baseline, role-aware nav, logout.
- **Tooling**: ESLint + Prettier on backend, `tsc --noEmit` lint on frontend, CI runs both on every PR.

### Partial / in progress
- Profile completion gating before dashboard.
- Gym filters and richer detail page.
- Trainer plan assignment to clients (model exists conceptually, no plan entity yet).
- Dashboard analytics depth (still mostly counts + recent activity).

### Not started / backlog
- Mobile app (React Native / Expo).
- Body composition analysis from photos, 90-day progress prediction, PDF report export.
- Stripe payments + subscription billing, MRR/churn analytics.
- Multi-branch gyms, class scheduling, booking slots, staff management.
- Google Maps gym discovery + nearby search.
- Achievements, streaks, badges, challenges, leaderboards, follow graph, reviews/ratings.
- Real-time (Socket.IO) chat + presence; push notifications (Expo).
- Apple OAuth, biometric login.
- next-intl Arabic/RTL pass (currently English-only LTR).
- Wearable integrations (Apple Health / Google Fit).
- Cypress E2E suite; meaningful Jest/Vitest coverage beyond smoke.
- Swagger / OpenAPI docs.
- Redis cache, BullMQ workers, Sentry, CDN.

---

## AI services (planned — all exposed as REST APIs)

All four models are proxied through the backend; the client never holds an Anthropic key. Each route is JWT-protected and rate-limited per user. Default model is `claude-sonnet-4-5` (configurable via `ANTHROPIC_MODEL`).

### 1. Live form tracer & rep counter — `POST /api/ai/form-check/*`

The user opens the camera in the workout screen, picks an exercise, and gets real-time rep counting plus form feedback.

- **Client side (in browser, no network)**: **MediaPipe Tasks Vision** (Pose Landmarker) runs the webcam stream at ~30 fps and emits 33 joint keypoints per frame.
- **Local rep counter + form rules**: a per-exercise state machine (squat, push-up, lunge, deadlift, bicep curl, OHP, plank) consumes the keypoint stream and:
  - Counts reps from joint-angle cycles (e.g. hip angle for squat, elbow angle for push-up).
  - Tags form errors live: knee valgus, back rounding, ROM cut-off, tempo too fast/slow, asymmetry.
  - Zero latency, zero per-frame cost — no LLM round-trip.
- **Server side (Claude)**: every N reps or at set-end the client POSTs a compact telemetry blob to `/api/ai/form-check/feedback`:

  ```json
  {
    "sessionId": "…",
    "exercise": "squat",
    "repCount": 10,
    "avgTempoSec": 2.6,
    "errorTags": ["knee_valgus", "shallow_depth"],
    "angleStats": { "hipMin": 95, "kneeMin": 78, "torsoMaxLean": 42 }
  }
  ```

  Claude returns a short coaching message (≤ 50 words). Each call writes a `FormRepEvent` row; sessions are summarized in `FormSession`.

- **Why split**: live inference must be on-device. LLM cost/latency only makes sense at the coaching layer (one call every ~20 seconds, not 30 calls per second).

### 2. Multi-item food detection — `POST /api/ai/food/detect` + `POST /api/ai/food/nutrition`

The user snaps one photo of a plate that may contain multiple items, adjusts quantities, and gets the full nutrition breakdown.

- **Detect** (`/api/ai/food/detect`): multipart image upload (handled by `multer`, stored ephemerally on disk or proxied to the Supabase `taqwin-uploads` bucket). The server sends the image to **Claude Vision** with a structured-output prompt and returns:

  ```json
  [
    { "name": "Grilled Chicken Breast", "confidence": 0.92, "suggestedUnit": "g",     "suggestedQuantity": 150, "foodItemId": "uuid-or-null" },
    { "name": "Brown Rice",             "confidence": 0.87, "suggestedUnit": "g",     "suggestedQuantity": 120, "foodItemId": "uuid-or-null" },
    { "name": "Broccoli",               "confidence": 0.81, "suggestedUnit": "g",     "suggestedQuantity": 80,  "foodItemId": "uuid-or-null" }
  ]
  ```

  We normalize each detected item against the seeded `FoodItem` table first (so the rest of the app can chart it); unknown items get a one-off `FoodItem` row marked `isPublic: false`.

- **Compute** (`/api/ai/food/nutrition`): the client lets the user edit each `quantity` (and `unit`, with conversions like `g → tbsp → cup → piece`), then POSTs the array. The server multiplies per-100 g macros by the user's quantity and returns:

  ```json
  {
    "items":   [{ "foodItemId": "…", "quantity": 175, "calories": 289, "protein": 54.25, "carbs": 0, "fat": 6.3 }, …],
    "totals":  { "calories": 612, "protein": 71.3, "carbs": 88.4, "fat": 11.2 }
  }
  ```

  Pass `?log=true` to also write a `FoodLog` row per item against today's date.

### 3. Onboarding-driven plan generator — `POST /api/ai/plan/generate`

Triggered **automatically at the end of the onboarding wizard**, and re-runnable from the profile page via `/api/ai/plan/regenerate`.

- **Input** (pulled from `Profile`): `{ goal, fitnessLevel, daysPerWeek, equipmentAvailable, dietaryPrefs, allergies, height, weight, age, gender, medicalNotes }`.
- **Output** (Claude returns structured JSON, validated by Zod before persisting):
  - A **4-week progressive workout plan**, mapped to existing `Workout` rows where possible, else generated as ad-hoc days. Persisted to `WorkoutPlan` + `WorkoutPlanDay`.
  - A **7-day rotating diet plan** with daily macro targets aligned to the goal (cut / maintain / bulk), built from items in the `FoodItem` table whenever possible. Persisted to `DietPlan` + `DietPlanMeal`.
- `GET /api/ai/plan/me` returns the user's currently active plan. The User dashboard reads from it on first login.
- Re-generation marks the previous plan `isActive=false` rather than deleting it — full history is kept.

### 4. Smart notification engine — scheduled job + `POST /api/ai/notify/preview`

A rule-based scheduler (node-cron loop in the API process, will graduate to BullMQ when Redis lands) evaluates `NotificationRule` rows against each user. Built-in rules:

| Rule                     | Trigger                                                                |
|--------------------------|-------------------------------------------------------------------------|
| Inactivity               | No workout log in the last 48 h                                         |
| Streak at risk           | Active streak and last log > 22 h ago                                   |
| Missed scheduled workout | Active plan day passed without a corresponding `WorkoutLog`             |
| Macro shortfall          | Protein < 70 % of plan target by 18:00 user-local                       |
| Trainer booking reminder | 24 h before and 1 h before a confirmed `TrainerBooking`                 |
| Membership expiry        | 7 days and 1 day before `GymMembership.expiresAt`                       |
| Community engagement     | Comment / like on the user's post                                       |
| Marketplace status       | `Order.status` transitions to `confirmed` / `shipped` / `delivered`     |

For each fired rule:

1. The scheduler builds a context blob (`{ userName, ruleType, relevantData }`).
2. Claude personalizes the body text in the user's preferred tone (set in `Profile`).
3. The dispatch is written to the existing `Notification` table (so the in-app drawer picks it up) **and** sent via the existing Nodemailer pipeline as an email digest. A `NotificationDispatch` row records the rule fired + delivery channels.

`POST /api/ai/notify/preview` is a dev/admin helper that renders a specific rule against a specific user without actually sending — useful for testing tone changes.

---

## Local development

### Prerequisites
- Node.js **18+**, npm
- A Postgres database (Supabase free tier recommended — see `backend-node/README.md`)
- Optional: Google OAuth client, Gmail App Password, Anthropic API key, Supabase service key + storage bucket

### Backend
```bash
cd backend-node
cp .env.example .env          # fill in DATABASE_URL, DIRECT_URL, JWT_SECRET, etc.
npm install
npm run db:migrate            # prisma migrate deploy
npm run db:seed               # idempotent; add :force to re-seed
npm run dev                   # http://localhost:4000
```

Useful scripts: `npm run lint`, `npm test` (vitest), `npm run db:generate`, `npm run db:migrate:dev`, `npm run format`.

### Frontend
```bash
cd frontend
cp .env.example .env          # VITE_API_URL=http://localhost:4000
npm install
npm run dev                   # http://localhost:5173
```

Useful scripts: `npm run lint` (tsc --noEmit), `npm run build`, `npm run preview`.

### Health check
`GET http://localhost:4000/health` → `{ "status": "ok", "service": "taqwin-api", "database": "connected", "version": "0.2.0" }`

### Demo accounts (from seed)
`demo@taqwin.app` / `Taqwin#2025` — plus seeded trainer and gym-owner accounts (see `prisma/seed.js`).

---

## Deployment

See [`DEPLOY.md`](./DEPLOY.md) for the full runbook. Summary:

1. **Supabase** — create project, copy `DATABASE_URL` (pooler `:6543` + `?pgbouncer=true&connection_limit=1`) and `DIRECT_URL` (direct `:5432`); create public Storage bucket `taqwin-uploads`.
2. **Render** (Web Service, root `backend-node`) — build `npm install && npx prisma generate && npx prisma migrate deploy`, start `npm start`, env from `.env.example`, health check `/health`. Run `npm run db:seed` once after first deploy.
3. **Google OAuth** — add `https://<render-host>/api/auth/google/callback` as an authorized redirect URI.
4. **Vercel** (root `frontend`, framework Vite) — set `VITE_API_URL` to the Render URL.

---

## Security posture

- Helmet HTTP headers, CORS allowlist (`FRONTEND_URL` in prod, LAN-IPv4 regex in dev).
- `express-rate-limit` on auth (`AUTH_RATE_LIMIT_MAX`) and AI (`AI_RATE_LIMIT_MAX`) routes.
- Zod schemas on every mutating endpoint via the `validate` middleware.
- Prisma parameterized queries (no raw SQL except the seed-guard `_meta` table and the emergency migration endpoint).
- Avatars and food-detection uploads go through Supabase signed write URLs — the service key never leaves the server.
- Anthropic API key never reaches the browser; all AI traffic (chat, form-check, food detection, plan generation, notification personalization) goes through `/api/ai/*`.
- Live form-tracer keypoint data stays on the client; only aggregated metrics (rep counts, angle stats, error tags) are sent for coaching — raw video is never uploaded.
- Emergency admin migration routes require `EMERGENCY_MIGRATE_TOKEN` plus the `x-emergency-migrate-token` header.

Known limitations: JWT in `localStorage` (httpOnly-cookie refactor is backlog), no virus scan on uploads, no automated dependency auditing in CI, no Sentry.

---

## Conventions

- Backend is **JavaScript with JSDoc-friendly comments**; do not introduce TypeScript files there until we migrate intentionally.
- All route files export an Express `router` and live under `src/routes/`.
- Validation belongs in Zod schemas, not in handlers.
- Use the shared `logger` (pino) — no `console.log` in committed code.
- Frontend strict-TS via `tsc --noEmit`; avoid `any`.
- Tailwind utility-first; shared primitives in `frontend/components/ui/`.
- Use the `services/*.ts` modules for API calls — components do not call `fetch` directly.
- Run `npm run lint` (both sides) before pushing; CI will fail otherwise.

---

## Roadmap (next likely milestones)

**AI workstream (priority — the four planned APIs above):**

1. **Swap AI provider Gemini → Anthropic Claude** in `routes/ai.js`, update `package.json` (`-@google/genai`, `+@anthropic-ai/sdk`) and `.env.example` (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`). Smoke-test the existing `/api/ai/chat` against Claude before any new route ships.
2. **Onboarding-driven plan generator** — new Prisma models (`WorkoutPlan`, `WorkoutPlanDay`, `DietPlan`, `DietPlanMeal`), `POST /api/ai/plan/generate` + `GET /api/ai/plan/me` + `POST /api/ai/plan/regenerate`, wizard final-step trigger, dashboard "your plan today" card.
3. **Live form tracer** — `frontend/features/form-tracer/` with MediaPipe Pose, per-exercise rep state machines (start with squat + push-up + bicep curl), `FormSession` + `FormRepEvent` tables, `POST /api/ai/form-check/*` Claude coaching API.
4. **Food detection + nutrition compute** — `multer`-backed `POST /api/ai/food/detect` calling Claude Vision, `POST /api/ai/food/nutrition` for quantity-scaled macros, `frontend/features/food-scan/` UI on top of the existing nutrition flow.
5. **Notification engine** — `NotificationRule` + `NotificationDispatch` tables, `node-cron` evaluator inside the API, Claude-personalized message body, dispatch into the existing `Notification` table + email via Nodemailer, `POST /api/ai/notify/preview` for dev.

**General workstream:**

6. Wire workout plans into the active-workout UI, add per-exercise sets/reps logging.
7. Stripe-backed memberships and trainer bookings; refunds + invoice download.
8. Multi-branch gyms + class scheduling with booking slots.
9. Achievements, streaks, monthly challenges, leaderboards.
10. Arabic/RTL i18n pass (next-intl-equivalent for a Vite SPA).
11. Real-time layer (Socket.IO or Supabase Realtime) for community + trainer chat.
12. Mobile app (Expo) once the web feature set stabilizes.
13. OpenAPI/Swagger docs + Cypress E2E suite + meaningful unit coverage.
