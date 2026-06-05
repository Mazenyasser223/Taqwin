# Taqwin AI Coach — Master Architecture & Implementation Blueprint

> **Status:** Approved design — ready for implementation  
> **Last updated:** 2026-06-01  
> **Audience:** Developers implementing Block A → E step-by-step

**Production hosting:** [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md) · [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) (Hostinger **KVM 2** + **Docker Compose**). Legacy Vercel/Render: [DEPLOY.md](DEPLOY.md).

This document is the **single source of truth** for the AI Coach system. It merges:

- Modular Monolith (Node.js) + AI microservice (FastAPI)
- Adaptive weekly/daily plans (Phase 2.6)
- Smart layer (Phase 2.6+): mid-week triggers, life modes, explainability
- Multi-store stack: **PostgreSQL + MongoDB + Redis + Supabase Storage**

**Golden rules:**

1. **Node.js owns execution** — all DB writes for business data go through Node.
2. **FastAPI owns reasoning** — Claude, RAG retrieval, intent routing, plan JSON generation.
3. **FastAPI NEVER writes PostgreSQL directly.**
4. **PostgreSQL is source of truth** for users, plans, logs, orders, tool audit.
5. **MongoDB is AI/analytics warehouse** — verbose, flexible, high-volume.
6. **Redis is ephemeral** — cache, queues, rate limits, hot chat context.
7. **LangGraph Agent only after** CAG + RAG + Tools + Internal APIs + Plans core exist.

---

## Table of contents

1. [System overview](#1-system-overview)
2. [Data stores — what goes where and why](#2-data-stores--what-goes-where-and-why)
3. [User journey (product flow)](#3-user-journey-product-flow)
4. [Repository structure](#4-repository-structure)
5. [PostgreSQL schema (Prisma)](#5-postgresql-schema-prisma)
6. [MongoDB collections](#6-mongodb-collections)
7. [Redis keys & queues](#7-redis-keys--queues)
8. [Supabase Storage](#8-supabase-storage)
9. [API surface](#9-api-surface)
10. [Context bundle (CAG)](#10-context-bundle-cag)
11. [RAG knowledge base](#11-rag-knowledge-base)
12. [Intent router](#12-intent-router)
13. [Tools registry](#13-tools-registry)
14. [Adaptation engine & smart layer](#14-adaptation-engine--smart-layer)
15. [Memory strategy](#15-memory-strategy)
16. [Safety & guardrails](#16-safety--guardrails)
17. [Cron jobs & BullMQ workers](#17-cron-jobs--bullmq-workers)
18. [Frontend integration map](#18-frontend-integration-map)
19. [Environment variables](#19-environment-variables)
20. [Implementation blocks (execution order)](#20-implementation-blocks-execution-order)
21. [Testing scenarios](#21-testing-scenarios)
22. [Deploy topology](#22-deploy-topology)
23. [Definition of done](#23-definition-of-done)
24. [Deferred to v2](#24-deferred-to-v2)

---

## 1) System overview

**Production target:** one **Hostinger VPS (KVM 2)** runs **Docker Compose** (nginx + Node API + FastAPI + optional worker). The SPA and API share the same host; databases stay managed off-VPS. Full diagrams: **[docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md)**.

```
┌──────────────────────────────────────────────────────────────────────────┐
│  HOSTINGER VPS — KVM 2 (Docker Compose)                                  │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  nginx :443  →  taqwin.com (React SPA dist)                         │  │
│  │            →  api.taqwin.com → taqwin-api :4000                     │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │  taqwin-api — Express + Prisma                                     │  │
│  │  • Auth, plans CRUD, CAG, internal tools, BullMQ producers         │  │
│  │  • POST /api/ai/chat → proxy taqwin-ai (fallback: Node LLM)        │  │
│  ├────────────────────────────────────────────────────────────────────┤  │
│  │  taqwin-ai — FastAPI :8000 (Docker network only, not public)       │  │
│  │  • Intent, Claude, RAG, plan JSON → tools via Node internal API      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────┬────────────────────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
   ┌─────────────┐         ┌─────────────┐         ┌─────────────────┐
   │ Supabase    │         │ MongoDB     │         │ Upstash Redis   │
   │ Postgres +  │         │ Atlas       │         │ cache · queues  │
   │ Storage     │         │ AI verbose  │         │ rate limits     │
   └─────────────┘         └─────────────┘         └─────────────────┘
```

**Frontend (in nginx container volume):** React 19 + Vite — dashboard today plan, onboarding, ChatWidget, PWA offline cache for today’s plan JSON.

### Why this split?

| Layer | Why separate |
|-------|--------------|
| **Node monolith** | Already exists; owns JWT, Prisma, marketplace, community, nutrition — don't fragment business logic |
| **FastAPI microservice** | Python AI stack (LangGraph, embeddings pipelines); scale AI independently; isolate API key & prompt logic |
| **Not full microservices** | Only ONE extra service (ai-service). Everything else stays in Node |

---

## 2) Data stores — what goes where and why

### 2.1 PostgreSQL (Supabase) — Official / relational

**Why Postgres:** ACID transactions, foreign keys, joins for dashboard, plans linked to Exercise/FoodItem, cron queries, RAG pgvector on same DB.

| Domain | Tables / models | Why here |
|--------|-----------------|----------|
| Users & auth | `User`, `Profile`, `UserSettings` | Core identity — must be transactional |
| Onboarding | structured summary on Profile or dedicated JSON column | Drives plan generation — relational |
| **Plans** | `WorkoutPlan`, `WorkoutPlanDay`, `WorkoutPlanExercise`, `DietPlan`, `DietPlanDay`, `DietPlanMeal`, `DietPlanMealItem`, `DailyAthletePlan` | Dashboard joins, FK to Exercise/FoodItem, cron |
| **Logs** | `FoodLog`, `WorkoutLog`, `ExerciseLog` | Adherence calculation, progress |
| **Progress** | `BodyMetric`, `ReadinessLog`, `ProgressSnapshot`, `PlanChangeLog` | Weekly adaptation decisions |
| **Feedback** | `PlanFeedback` | Weekly 👍/👎 tied to user + week |
| Commerce | `Order`, `Product`, `TrainerBooking`, `GymMembership` | Existing — CAG context |
| Community | existing models | Unchanged |
| **AI audit** | `AiToolExecution` | Every tool call — must join with plans/logs for debugging & compliance |
| **AI memory summaries** | `AiMemory` | Short structured preferences — queryable, small |
| **RAG** | `KnowledgeDocument`, `KnowledgeChunk` + **pgvector** | Join L2 exercises / L3 foods; single infra with Supabase |
| **File metadata** | URLs, mime, size on Profile/FoodLog/etc. | Pointer to Storage — not the bytes |

**NOT in Postgres (moved to Mongo):** raw chat messages at scale, full LLM request/response bodies, LangGraph step traces.

---

### 2.2 MongoDB — Flexible / high-volume AI data

**Why Mongo:** Schema-flexible nested JSON, high write volume, analytics events, verbose LLM I/O — doesn't need FK joins with plans.

| Collection | Contents | Why Mongo |
|------------|----------|-----------|
| `ai_threads` | `threadId`, `userId`, `locale`, `createdAt`, `lastMessageAt` | Lightweight thread metadata |
| `ai_messages` | `threadId`, `role`, `content`, `tokens`, `createdAt` | Chat history — large volume |
| `ai_agent_traces` | LangGraph nodes, tool attempts, reasoning steps | Deep nested JSON |
| `ai_llm_outputs` | raw prompt hash, request, response, model, latencyMs, cost | Debugging, cost tracking |
| `ai_memories_raw` | draft memories before dedupe → Postgres `AiMemory` | Pipeline staging (optional) |
| `plan_generation_logs` | full prompt + raw generated JSON before Node validation | Audit verbose generation |
| `analytics_events` | `event`, `userId`, `properties`, `timestamp` | Flexible product analytics |

**Pattern:**

```
FastAPI generates plan JSON
  → Mongo: plan_generation_logs (verbose)
  → Node: validate IDs + macros
  → Postgres: WorkoutPlan + DietPlan (official)
  → Postgres: AiToolExecution (summary)
```

**Rule:** Mongo logs are **never** the official plan. Postgres always wins after validation.

---

### 2.3 Redis — Speed & ephemeral

**Why Redis:** Multi-instance Render Node needs shared rate limits & locks; sub-ms cache for dashboard; BullMQ backend.

| Use | Key pattern | TTL | Why |
|-----|-------------|-----|-----|
| CAG cache | `cag:{userId}` | 5–15 min | Avoid rebuilding context every chat turn |
| Today plan cache | `plan:today:{userId}:{YYYY-MM-DD}` | until midnight user TZ | Dashboard hot path |
| Week plan summary | `plan:week:{userId}:{weekStart}` | 1 hour | Reduce joins |
| Rate limit (AI chat) | `rl:ai:{userId}` | 1 min sliding | Shared across Node instances |
| Rate limit (plan gen) | `rl:plan:{userId}` | 1 hour | Expensive operation |
| Short-term chat memory | `chat:ctx:{threadId}` | 24h | Last 20 messages — fast read |
| Cron lock | `lock:weekly:{userId}` | 10 min | Prevent duplicate weekly generation |
| BullMQ queues | `bull:plan:generate`, etc. | — | Async heavy jobs |
| Feature flag cache | `ff:ai-service-url` | 1 min | Fast fallback detection |

**Rule:** If Redis data is lost → rebuild from Postgres/Mongo. Not source of truth.

---

### 2.4 Supabase Storage — Binary files only

**Why Storage:** CDN-friendly signed URLs; Postgres stores metadata only.

| Path / bucket | Content | Metadata in Postgres |
|---------------|---------|---------------------|
| `avatars/` | Profile pictures | `Profile.avatarUrl` |
| `food-scans/` | Meal photos from camera | `FoodLog.imageUrl` |
| `progress-photos/` | Before/after body photos | `ProgressPhoto` (new model) |
| `exercise-videos/` | Demo videos | `Exercise.videoUrl` |
| `documents/` | RAG source PDFs | `KnowledgeDocument.storagePath` |
| `community/` | Posts, stories media | Existing community models |

---

## 3) User journey (product flow)

```
1. Register / Login
2. Onboarding questionnaire (existing — injuries, diet, training days, gym, etc.)
3. Onboarding complete
   └─→ BullMQ job: generate-week (workout + diet)
   └─→ Save WorkoutPlan + DietPlan in Postgres
   └─→ Create DailyAthletePlan for today
4. Dashboard Home (first visit)
   └─→ todayWorkout + todayDiet + calorie/protein targets
   └─→ explainabilityText ("why this plan")
   └─→ optional readiness check-in
   └─→ Skip/Swap day buttons
5. Daily usage
   ├─ Manual: log food, log workout, update weight
   └─ Chat: ask questions, swap exercise, log meal via agent
6. Mid-week (Wed cron + event triggers)
   └─→ 3 missed days? weight spike? pain report? → adapt (micro/meso/macro)
7. Weekly (Sunday cron, user timezone)
   └─→ ProgressSnapshot → keep | micro | meso | macro → new week or extend
8. User updates profile/measurements/goals
   └─→ adaptation evaluation → partial or full regen (confirm if macro)
```

**Key UX principle:** Athlete sees their plan on Dashboard **without opening chat**. Chat is for questions and actions, not for viewing today's workout.

---

## 4) Repository structure

```text
Taqwin/
├── frontend/                              # React SPA (EXISTS)
│   ├── features/
│   │   ├── onboarding/                    # ✅ questionnaire
│   │   ├── dashboard/
│   │   │   └── athlete/
│   │   │       ├── TodayWorkoutCard.tsx     # NEW
│   │   │       ├── TodayDietCard.tsx        # NEW
│   │   │       ├── PlanExplainability.tsx   # NEW
│   │   │       ├── SkipSwapDayActions.tsx   # NEW
│   │   │       ├── ReadinessCheckIn.tsx     # NEW
│   │   │       └── LifeModeSelector.tsx     # NEW
│   │   ├── ai-chat/
│   │   │   ├── ChatWidget.tsx               # UPGRADE
│   │   │   ├── ConfirmationModal.tsx        # NEW
│   │   │   └── ToolResultCard.tsx           # NEW
│   │   └── plan/
│   │       └── WeekPlanViewer.tsx           # NEW
│   └── services/
│       ├── aiService.ts                     # EXISTS
│       ├── planService.ts                   # NEW
│       └── dashboardService.ts              # EXTEND
│
├── backend-node/                            # Express API (EXISTS)
│   ├── src/
│   │   ├── db/
│   │   │   ├── prisma.js                    # NEW wrapper
│   │   │   ├── mongo.js                     # NEW
│   │   │   └── redis.js                     # NEW
│   │   ├── routes/
│   │   │   ├── ai.js                        # UPGRADE → proxy FastAPI
│   │   │   ├── dashboard.js                 # EXTEND today plan
│   │   │   ├── plans.js                     # NEW
│   │   │   ├── progress.js                  # NEW
│   │   │   └── internal/
│   │   │       └── ai.js                    # NEW — tool execution
│   │   ├── lib/
│   │   │   ├── coachContext.js              # EXISTS → merge into contextBundle
│   │   │   ├── contextBundle.js             # NEW — full CAG
│   │   │   ├── adaptationEngine.js          # NEW
│   │   │   ├── adherence.js                 # NEW
│   │   │   ├── midWeekTriggers.js           # NEW
│   │   │   ├── planValidation.js            # NEW
│   │   │   └── chatMemory.js                # NEW — Redis + Mongo
│   │   ├── services/
│   │   │   ├── aiChatProvider.js            # EXISTS — fallback when FastAPI down
│   │   │   ├── aiFastApiClient.js           # NEW
│   │   │   └── aiToolExecutor.js            # NEW
│   │   ├── jobs/
│   │   │   ├── queues.js                    # NEW — BullMQ setup
│   │   │   ├── workers/
│   │   │   │   ├── planGenerateWorker.js    # NEW
│   │   │   │   ├── weeklyCronWorker.js      # NEW
│   │   │   │   ├── dailyRefreshWorker.js    # NEW
│   │   │   │   ├── midWeekWorker.js         # NEW
│   │   │   │   └── ragIngestWorker.js       # NEW
│   │   │   └── schedulers.js                # NEW — node-cron triggers → enqueue
│   │   └── middleware/
│   │       └── internalAuth.js              # NEW — X-Internal-Key
│   └── prisma/
│       └── schema.prisma                    # EXTEND — see §5
│
├── ai-service/                              # NEW — FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── routers/
│   │   │   ├── health.py
│   │   │   ├── chat.py
│   │   │   ├── plan_generate.py
│   │   │   └── adapt.py
│   │   ├── intent/
│   │   │   ├── router.py
│   │   │   └── intents.py
│   │   ├── rag/
│   │   │   ├── retriever.py
│   │   │   ├── levels.py
│   │   │   └── ingest/
│   │   │       └── pipeline.py
│   │   ├── tools/
│   │   │   ├── registry.py
│   │   │   └── schemas/
│   │   ├── agent/
│   │   │   └── graph.py                     # LangGraph — Block E only
│   │   ├── memory/
│   │   │   ├── short_term.py
│   │   │   └── long_term.py
│   │   ├── prompts/
│   │   │   ├── coach_system.py
│   │   │   ├── plan_workout.py
│   │   │   └── plan_diet.py
│   │   └── clients/
│   │       ├── node_internal.py
│   │       ├── mongo.py
│   │       └── redis.py
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── pytest.ini
│   └── .env.example
│
├── docs/
│   ├── SYSTEM-ARCHITECTURE.md               # Production topology (KVM 2 + Docker)
│   ├── DEPLOY-HOSTINGER.md                  # VPS deploy runbook
│   ├── GITHUB.md
│   ├── AI-TOOLS-REFERENCE.md                # TODO — Block A tool schemas
│   └── AI-RAG-SOURCES.md                    # TODO — Block B ingestion list
│
├── deploy/
│   ├── docker-compose.production.yml        # nginx + api + ai + worker
│   ├── nginx.conf                           # HTTP config for Compose
│   ├── nginx.conf.example                   # HTTPS template
│   └── .env.production.example
│
├── AI-COACH-ARCHITECTURE.md                 # THIS FILE (root)
├── .github/workflows/ci.yml                 # EXTEND — ai-service pytest
└── DEPLOY.md                                # Supabase + legacy Vercel/Render
```

---

## 5) PostgreSQL schema (Prisma)

Add these models in migration order (dependencies first).

### 5.1 AI audit & memory (small, relational)

```prisma
model AiMemory {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  key        String   // e.g. "prefers_free_weights", "shoulder_injury"
  summary    String   // human-readable, locale-aware
  confidence Float    @default(0.8)
  source     String   // "chat_summary" | "onboarding" | "behavior"
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@unique([userId, key])
  @@index([userId])
}

model AiToolExecution {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  threadId    String?  // Mongo thread reference
  toolName    String
  input       Json
  output      Json?
  success     Boolean
  error       String?
  durationMs  Int
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
  @@index([toolName])
}
```

**Why Postgres for AiToolExecution:** Joins with user plans/logs; transactional audit; required for adaptation debugging.

**Why NOT raw chat in Postgres:** Volume → Mongo (see §6).

---

### 5.2 Workout plans

```prisma
enum PlanSource {
  onboarding
  weekly_cron
  adaptation
  manual
}

enum PlanStatus {
  draft
  active
  superseded
  archived
}

model WorkoutPlan {
  id          String       @id @default(uuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  weekStart   DateTime     @db.Date
  status      PlanStatus   @default(active)
  source      PlanSource
  aiNotes     String?
  explainabilityText String?
  locale      String       @default("ar")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  days        WorkoutPlanDay[]

  @@index([userId, weekStart])
}

model WorkoutPlanDay {
  id        String   @id @default(uuid())
  planId    String
  plan      WorkoutPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  dayIndex  Int      // 0=Mon .. 6=Sun (or user-defined mapping)
  focus     String?  // "push", "pull", "legs", "rest"
  isRestDay Boolean  @default(false)
  exercises WorkoutPlanExercise[]

  @@unique([planId, dayIndex])
}

model WorkoutPlanExercise {
  id         String   @id @default(uuid())
  dayId      String
  day        WorkoutPlanDay @relation(fields: [dayId], references: [id], onDelete: Cascade)
  exerciseId String
  exercise   Exercise @relation(fields: [exerciseId], references: [id])
  sortOrder  Int      @default(0)
  sets       Int?
  reps       String?  // "8-12" or "AMRAP"
  restSec    Int?
  notes      String?
}
```

**Why FK to Exercise:** Validate AI output — reject hallucinated exercise IDs.

---

### 5.3 Diet plans

```prisma
model DietPlan {
  id              String       @id @default(uuid())
  userId          String
  user            User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  weekStart       DateTime     @db.Date
  status          PlanStatus   @default(active)
  source          PlanSource
  targetCalories  Int?
  targetProteinG  Int?
  targetCarbsG    Int?
  targetFatG      Int?
  aiNotes         String?
  explainabilityText String?
  locale          String       @default("ar")
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
  days            DietPlanDay[]

  @@index([userId, weekStart])
}

model DietPlanDay {
  id       String @id @default(uuid())
  planId   String
  plan     DietPlan @relation(fields: [planId], references: [id], onDelete: Cascade)
  dayIndex Int
  meals    DietPlanMeal[]

  @@unique([planId, dayIndex])
}

model DietPlanMeal {
  id        String @id @default(uuid())
  dayId     String
  day       DietPlanDay @relation(fields: [dayId], references: [id], onDelete: Cascade)
  mealType  String  // breakfast, lunch, dinner, snack
  timeWindow String? // "07:00-09:00"
  items     DietPlanMealItem[]
}

model DietPlanMealItem {
  id         String   @id @default(uuid())
  mealId     String
  meal       DietPlanMeal @relation(fields: [mealId], references: [id], onDelete: Cascade)
  foodItemId String?
  foodItem   FoodItem? @relation(fields: [foodItemId], references: [id])
  label      String?  // free-text if no FoodItem match
  quantity   Float?
  unit       String?
}
```

---

### 5.4 Daily plan (Dashboard core)

```prisma
enum LifeMode {
  normal
  travel
  sick
  fasting
  injury_flare
}

enum DailyPlanStatus {
  pending
  active
  skipped
  completed
  adapted
}

model DailyAthletePlan {
  id                 String          @id @default(uuid())
  userId             String
  user               User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  date               DateTime        @db.Date
  workoutPlanDayId   String?
  workoutPlanDay     WorkoutPlanDay? @relation(fields: [workoutPlanDayId], references: [id])
  dietPlanDayId      String?
  dietPlanDay        DietPlanDay?    @relation(fields: [dietPlanDayId], references: [id])
  status             DailyPlanStatus @default(active)
  lifeMode           LifeMode        @default(normal)
  aiNotes            String?
  explainabilityText String?
  adaptedFromProgress Boolean        @default(false)
  readinessScore     Int?            // 1-10 composite
  createdAt          DateTime        @default(now())
  updatedAt          DateTime        @updatedAt

  @@unique([userId, date])
  @@index([userId, date])
}
```

**Why DailyAthletePlan:** Dashboard reads ONE row per user per day — fast, cacheable in Redis.

---

### 5.5 Progress & feedback

```prisma
model BodyMetric {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  weightKg    Float?
  bodyFatPct  Float?
  measurements Json?   // chest, waist, arms, etc.
  recordedAt  DateTime @default(now())
  createdAt   DateTime @default(now())

  @@index([userId, recordedAt])
}

model ReadinessLog {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date         DateTime @db.Date
  sleepQuality Int?     // 1-5
  soreness     Int?     // 1-5
  rpe          Int?     // 1-10 post-workout
  notes        String?
  createdAt    DateTime @default(now())

  @@unique([userId, date])
}

enum AdaptationDecision {
  keep
  micro
  meso
  macro
}

model ProgressSnapshot {
  id              String             @id @default(uuid())
  userId          String
  user            User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  weekStart       DateTime           @db.Date
  adherencePct    Float?
  workoutAdherence Float?
  nutritionAdherence Float?
  weightDeltaKg   Float?
  plateauFlag     Boolean            @default(false)
  aiSummary       String?
  decision        AdaptationDecision @default(keep)
  createdAt       DateTime           @default(now())

  @@unique([userId, weekStart])
}

model PlanFeedback {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  planId    String?  // workout or diet plan id
  weekStart DateTime @db.Date
  rating    String   // "up" | "down"
  reason    String?
  createdAt DateTime @default(now())

  @@index([userId, weekStart])
}

model PlanChangeLog {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  changeType  String   // skip_day, swap_rest, life_mode, macro_regen, etc.
  reason      String?
  beforeSummary Json?
  afterSummary  Json?
  triggeredBy String   // cron | user | chat | mid_week
  createdAt   DateTime @default(now())

  @@index([userId, createdAt])
}

model ProgressPhoto {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  storagePath String
  caption   String?
  takenAt   DateTime @default(now())
  createdAt DateTime @default(now())

  @@index([userId])
}
```

---

### 5.6 RAG (pgvector)

```prisma
enum KnowledgeLevel {
  L1_INTERNAL
  L2_EXERCISE
  L3_NUTRITION
  L4_SCIENTIFIC
  L5_BOOKS
}

model KnowledgeDocument {
  id           String         @id @default(uuid())
  level        KnowledgeLevel
  source       String
  title        String
  locale       String         @default("en")
  storagePath  String?        // Supabase Storage for PDFs
  metadata     Json?
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  chunks       KnowledgeChunk[]
}

model KnowledgeChunk {
  id         String            @id @default(uuid())
  documentId String
  document   KnowledgeDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
  content    String
  metadata   Json?
  // embedding: vector(1536) — add via raw SQL migration with pgvector extension
  createdAt  DateTime          @default(now())

  @@index([documentId])
}
```

**Why pgvector in Postgres (not Mongo):** Same Supabase instance; join retrieval with Exercise/FoodItem IDs; simpler ops.

---

## 6) MongoDB collections

### Indexes (create on setup)

```javascript
// ai_messages
db.ai_messages.createIndex({ threadId: 1, createdAt: 1 })
db.ai_messages.createIndex({ userId: 1, createdAt: -1 })

// ai_llm_outputs — TTL 90 days
db.ai_llm_outputs.createIndex({ createdAt: 1 }, { expireAfterSeconds: 7776000 })

// analytics_events
db.analytics_events.createIndex({ userId: 1, timestamp: -1 })
db.analytics_events.createIndex({ event: 1, timestamp: -1 })
```

### Document shapes

```javascript
// ai_threads
{
  _id: "thread-uuid",
  userId: "user-uuid",
  locale: "ar",
  createdAt: ISODate(),
  lastMessageAt: ISODate()
}

// ai_messages
{
  _id: ObjectId(),
  threadId: "thread-uuid",
  userId: "user-uuid",
  role: "user" | "assistant" | "system",
  content: "...",
  tokenCount: 42,
  createdAt: ISODate()
}

// ai_agent_traces (LangGraph)
{
  _id: ObjectId(),
  threadId: "...",
  userId: "...",
  turnId: "...",
  steps: [{ node: "intent_router", output: {} }, { node: "tool_call", ... }],
  createdAt: ISODate()
}

// ai_llm_outputs
{
  _id: ObjectId(),
  userId: "...",
  operation: "chat" | "plan_generate" | "adapt",
  model: "claude-sonnet-4-5",
  promptHash: "sha256...",
  request: { /* redacted if needed */ },
  response: "...",
  latencyMs: 1200,
  inputTokens: 800,
  outputTokens: 400,
  createdAt: ISODate()
}

// plan_generation_logs
{
  _id: ObjectId(),
  userId: "...",
  weekStart: "2026-05-19",
  rawWorkoutJson: {},
  rawDietJson: {},
  validationResult: "accepted" | "rejected",
  validationErrors: [],
  createdAt: ISODate()
}

// analytics_events
{
  _id: ObjectId(),
  event: "plan_generated" | "skip_day" | "chat_sent" | "onboarding_complete",
  userId: "...",
  properties: {},
  timestamp: ISODate()
}
```

---

## 7) Redis keys & queues

### BullMQ queue names

| Queue | Producer | Worker action |
|-------|----------|---------------|
| `plan:generate` | onboarding complete, manual regen | Call FastAPI → validate → Postgres |
| `plan:weekly` | Sunday scheduler | ProgressSnapshot → adapt → new week |
| `plan:daily-refresh` | daily 00:05 user TZ | Ensure DailyAthletePlan exists |
| `plan:mid-week` | Wed scheduler + event hooks | Run midWeekTriggers |
| `rag:ingest` | admin script / cron | Chunk + embed → pgvector |

### Chat memory flow

```
1. Read chat:ctx:{threadId} from Redis (last 20 msgs)
2. Miss → load from Mongo ai_messages → warm Redis
3. After reply → append Mongo + update Redis
4. Session end → summarize → Postgres AiMemory + optional Mongo archive
```

---

## 8) Supabase Storage

See §2.4. Implementation uses existing `POST /api/uploads/sign` pattern.

**New buckets/prefixes to document in DEPLOY.md:**

- `progress-photos/`
- `documents/` (RAG PDFs — admin only upload)

---

## 9) API surface

### 9.1 Public — Athlete (JWT)

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/ai/chat` | Chat — proxy FastAPI; preserve `{ messages, locale } → { reply }` contract |
| GET | `/api/dashboard/athlete/home` | Extended: todayWorkout, todayDiet, progressSummary, aiInsights, nextAction |
| GET | `/api/plans/today` | Today's DailyAthletePlan + joined exercises/meals |
| GET | `/api/plans/week` | Active week workout + diet plans |
| POST | `/api/plans/skip-day` | Skip today → reschedule (meso) |
| POST | `/api/plans/swap-rest` | Swap rest day |
| POST | `/api/plans/life-mode` | Set travel/sick/fasting/injury_flare |
| POST | `/api/plans/feedback` | Weekly 👍/👎 |
| GET | `/api/progress/summary` | Week summary |
| POST | `/api/progress/metrics` | Log weight/measurements |
| POST | `/api/progress/readiness` | Daily check-in |

**Onboarding hook (extend existing complete endpoint):**

```
POST /api/onboarding/complete
  → enqueue plan:generate job
  → return 202 { status: "generating" } or sync if fast enough in dev
```

### 9.2 Internal — FastAPI only

Header: `X-Internal-Key: ${AI_INTERNAL_KEY}`

```
POST /api/internal/ai/tools/execute
  body: { userId, toolName, input, threadId? }
  → validate → Prisma write/read → AiToolExecution log
  → return { success, output }
```

Tool-specific routes (optional split):

```
/api/internal/ai/nutrition/*
/api/internal/ai/workout/*
/api/internal/ai/plans/*
/api/internal/ai/progress/*
/api/internal/ai/profile/*
/api/internal/ai/rag/search        # pgvector query for FastAPI
/api/internal/ai/memory/read
/api/internal/ai/memory/write
```

### 9.3 FastAPI (ai-service)

```
GET  /health
POST /chat          # { userId, threadId, messages, contextBundle, locale }
POST /plan/generate # { userId, contextBundle, weekStart }
POST /plan/adapt    # { userId, contextBundle, snapshot, decisionHint }
POST /intent        # debug: classify message only
```

**FastAPI response for /chat:**

```json
{
  "reply": "string",
  "toolCalls": [{ "name": "...", "input": {} }],
  "confirmationRequired": false,
  "confirmationPreview": null,
  "intent": "nutrition"
}
```

Node executes `toolCalls` via internal API when `confirmationRequired` is false.

---

## 10) Context bundle (CAG)

Built in Node `lib/contextBundle.js`. Cached in Redis `cag:{userId}`.

```json
{
  "profile": {},
  "onboardingSummary": {},
  "nutritionToday": {},
  "nutritionWeek": {},
  "workoutToday": {},
  "workoutWeek": {},
  "todayPlan": {},
  "weekPlanSummary": {},
  "bodyMetricsLatest": {},
  "readinessLatest": {},
  "progressSnapshot": {},
  "aiMemories": [],
  "behavioralSignals": {
    "skippedMuscleGroups": [],
    "preferredExercises": [],
    "mealSkipPatterns": []
  },
  "constraints": {
    "injuries": [],
    "excludedExercises": [],
    "excludedFoods": [],
    "religiousDiet": "",
    "lifeMode": "normal"
  },
  "gymTrainerOrdersSummary": {},
  "locale": "ar",
  "timezone": "Africa/Cairo"
}
```

**Token budget:** 2,000–4,000 tokens. Node truncates week summaries intelligently.

**Why CAG before RAG:** User-specific truth (weight, injuries, today's logs) beats generic documents.

---

## 11) RAG knowledge base

### Levels & conflict priority

```
L1 Taqwin Internal  >  L2 Exercise Library  >  L3 Nutrition  >  L4 Scientific  >  L5 Books
```

| Level | Source | When to retrieve |
|-------|--------|------------------|
| L1 | Platform rules, features, onboarding logic | platform_help, constraints |
| L2 | Exercise table + MuscleWiki metadata | workout, exercise_alternative |
| L3 | FoodItem, WebtebFood, FDC | nutrition, meal swap |
| L4 | Scientific PDFs | scientific intent + disclaimer |
| L5 | Books/long refs | deep scientific only |

### Ingestion pipeline (Block B)

```
Source file/DB row
  → extract text
  → chunk (500-800 tokens)
  → embed (OpenAI/Voyage/Claude embeddings)
  → store KnowledgeChunk + vector
  → metadata: level, locale, sourceId
```

**Re-index:** `npm run rag:reindex` + optional weekly `rag:ingest` queue job.

---

## 12) Intent router

Runs in FastAPI **before** full Agent (Block B). Rules first, lightweight LLM if unclear.

### Intents

```
personal_status | nutrition | workout | exercise_alternative
| platform_help | execute_action | scientific | life_mode | unclear
```

### Routing table

| Intent | CAG | RAG | Tools |
|--------|-----|-----|-------|
| personal_status | ✅ | ❌ | ❌ |
| nutrition | ✅ | L3 | optional log_food |
| workout | ✅ | L2 | optional |
| exercise_alternative | ✅ | L2+L1 | replace_exercise |
| platform_help | ✅ | L1 | ❌ |
| execute_action | ✅ | maybe | ✅ |
| scientific | ✅ | L4/L5 | ❌ + disclaimer |
| life_mode | ✅ | L1 | set_life_mode, adapt |
| unclear | ✅ | ❌ | ask clarify |

---

## 13) Tools registry

Schemas live in `ai-service/app/tools/schemas/`. Execution in Node `aiToolExecutor.js`.

### Profile
`update_weight`, `update_height`, `update_fitness_goal`, `update_level`, `update_medical_notes`

### Nutrition
`log_food`, `update_food_log`, `delete_food_log`, `get_nutrition_today`, `get_nutrition_week`, `replace_meal_today`

### Workout
`log_workout`, `log_exercise_set`, `get_workout_today`, `replace_exercise_today`, `add_exercise`, `remove_exercise`

### Plans
`get_today_plan`, `generate_weekly_workout`, `generate_weekly_diet`, `generate_today`, `adapt_plan`, `skip_day`, `swap_rest_day`, `set_life_mode`

### Progress
`record_body_metric`, `record_readiness`, `get_progress_summary`, `create_progress_snapshot`

### Gym / Marketplace / System
`search_trainers`, `request_booking`, `search_gyms`, `search_products`, `create_support_ticket`

**Limits:** Max 5 tool loops per chat turn. Every execution → Postgres `AiToolExecution`.

### Confirmation required (Block E frontend)

`delete_food_log`, `remove_exercise`, `generate_weekly_*` (replace), `update_medical_notes`, `request_booking`, marketplace purchase actions.

---

## 14) Adaptation engine & smart layer

### 14.1 Decision levels

| Level | Triggers | Action | User confirm? |
|-------|----------|--------|---------------|
| **keep** | adherence >80%, progress OK | Extend/similar week | No |
| **micro** | swap meal, one exercise, low readiness 1 day | Patch today only | No |
| **meso** | 3 missed days, swap rest, plateau 2w | Reschedule week | Optional |
| **macro** | goal change, injury, plateau 3w, weight spike | New weekly plan | **Yes** |

### 14.2 Adherence bands

| Adherence | Response |
|-----------|----------|
| >80% | Progress or keep |
| 50–80% | Simplify + ask blocker |
| <50% | Reduce volume + suggest life mode |

### 14.3 Mid-week triggers (Phase 2.6+)

| Trigger | Action |
|---------|--------|
| 3 workout days missed | meso — reschedule |
| Weight ±X% in 7 days | macro review |
| Plateau 2–3 weeks | meso/macro |
| Pain keywords in chat | micro — reduce/swap + safety flag |
| Readiness low 3 consecutive days | deload suggestion |
| Deload every 4–6 weeks | meso — deload week |

### 14.4 Life modes

| Mode | Plan behavior |
|------|---------------|
| normal | Full plan |
| travel | 3x bodyweight + simple meals |
| sick | Rest or mobility |
| fasting | Shift meal + workout timing (from religious diet onboarding) |
| injury_flare | Respect injuries, reduce load |

### 14.5 Explainability

Every `DailyAthletePlan` and weekly plan stores `explainabilityText` (1–2 sentences, AR/EN).

### 14.6 Preference learning (silent)

From skips, swaps, chat → `behavioralSignals` in CAG → next `generate-week`.

### 14.7 Feedback loop

Weekly `PlanFeedback` 👍/👎 stored and linked to `ProgressSnapshot`.

---

## 15) Memory strategy

| Tier | Storage | Content | Loaded when |
|------|---------|---------|-------------|
| Hot chat | Redis `chat:ctx:{threadId}` | Last 20 messages | Every chat turn |
| Persistent chat | Mongo `ai_messages` | Full history | History UI, Redis miss |
| Long-term summaries | Postgres `AiMemory` | Preferences, injuries, goals | Chat + plan generation |
| Behavioral | Computed in CAG | Skip patterns, adherence | Plan gen + adapt |

**End-of-session pipeline (Block E):**

```
Mongo messages (last N) → Claude summary → 0-3 AiMemory rows → dedupe by key
```

**NOT in long-term memory:** greetings, single meal details (→ FoodLog).

---

## 16) Safety & guardrails

- No medical diagnosis — redirect to professional
- No hallucinated exercise/food IDs — Node `planValidation.js` rejects invalid FKs
- Pain/medical keywords → stop load recommendations + safety message
- Scientific answers → disclaimer + L4/L5 only
- Confirmations for destructive/large changes (see §13)
- Optional: suggest trainer from marketplace on injury escalation

---

## 17) Cron jobs & BullMQ workers

All times in **user timezone** (from Profile or UserSettings).

| Scheduler | Enqueues | Worker |
|-----------|----------|--------|
| Daily 00:05 | `plan:daily-refresh` | Ensure DailyAthletePlan |
| Wed 18:00 | `plan:mid-week` | midWeekTriggers |
| Sun 00:00 | `plan:weekly` | ProgressSnapshot → adapt |
| On onboarding complete | `plan:generate` | First week |
| On weight/metric POST | optional debounced adapt check | micro/meso |
| Weekly (admin) | `rag:ingest` | Re-embed changed docs |

**Cron implementation:** `node-cron` in Node enqueues to BullMQ — workers do heavy lifting (don't block HTTP).

**Redis lock:** `lock:weekly:{userId}` prevents duplicate generation.

---

## 18) Frontend integration map

| UI | API | Notes |
|----|-----|-------|
| Dashboard Home cards | `GET /dashboard/athlete/home` | Primary athlete landing |
| Today workout detail | `GET /plans/today` | Exercises, sets, reps |
| Today diet detail | `GET /plans/today` | Meals, macros |
| Skip / Swap buttons | `POST /plans/skip-day`, `/swap-rest` | Optimistic UI + refetch |
| Life mode selector | `POST /plans/life-mode` | Modal confirm |
| Readiness widget | `POST /progress/readiness` | Optional daily |
| Weight update | `POST /progress/metrics` | Profile + progress |
| ChatWidget | `POST /api/ai/chat` | Preserve existing contract initially |
| Confirmation modal | chat response `confirmationRequired` | User OK → resend with confirm flag |
| Tool success toast | after chat + refetch | nutrition, workouts, dashboard |
| Week plan viewer | `GET /plans/week` | Calendar layout |
| PWA offline | cache `plans/today` in IndexedDB | Read-only |

**After any tool success:** refetch dashboard, nutrition, workouts.

---

## 19) Environment variables

### backend-node/.env (additions)

```env
# AI Service
AI_SERVICE_URL=http://localhost:8000
AI_INTERNAL_KEY=long-random-shared-secret
FEATURE_AI_VIA_FASTAPI=true

# MongoDB
MONGODB_URI=mongodb+srv://...
MONGODB_DB=taqwin_ai

# Redis
REDIS_URL=redis://localhost:6379

# Existing — keep as fallback
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
AI_RATE_LIMIT_MAX=20
```

### ai-service/.env

```env
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-5
AI_INTERNAL_KEY=same-as-node
NODE_INTERNAL_API_URL=http://localhost:4000
MONGODB_URI=mongodb+srv://...
MONGODB_DB=taqwin_ai
REDIS_URL=redis://localhost:6379
EMBEDDING_MODEL=text-embedding-3-small
LOG_LEVEL=info
```

---

## 20) Implementation blocks (execution order)

**Do not skip blocks. Do not start LangGraph before Block C is done.**

---

### BLOCK A0 — Database foundation (Week 1, days 1–2)

**Why first:** Everything else depends on schema.

| Step | Task | Files |
|------|------|-------|
| A0.1 | Enable pgvector extension in Supabase | SQL migration |
| A0.2 | Add Prisma models §5.1–5.6 | `schema.prisma` |
| A0.3 | Run migration | `prisma migrate dev` |
| A0.4 | Add User relations for new models | `schema.prisma` |

**Done when:** `prisma migrate` succeeds; empty tables exist.

---

### BLOCK A1 — Redis + Mongo clients (Week 1, day 2)

**Why:** Shared infra for cache, chat, queues — needed before bridge testing at scale.

| Step | Task | Files |
|------|------|-------|
| A1.1 | Redis client + connect on boot | `src/db/redis.js` |
| A1.2 | Mongo client + connect on boot | `src/db/mongo.js` |
| A1.3 | Health check includes Redis/Mongo status | `src/routes/health.js` or extend existing |
| A1.4 | Update `.env.example` | `backend-node/.env.example` |

**Done when:** Server starts; logs show Redis/Mongo connected (graceful degrade if missing in dev).

---

### BLOCK A2 — ai-service skeleton (Week 1, days 2–3)

**Why:** Isolated AI container before moving chat traffic.

| Step | Task | Files |
|------|------|-------|
| A2.1 | FastAPI app + `/health` | `ai-service/app/main.py` |
| A2.2 | `/chat` stub returns echo | `ai-service/app/routers/chat.py` |
| A2.3 | `requirements.txt`, `Dockerfile`, `.env.example` | `ai-service/` |
| A2.4 | pytest for `/health` | `ai-service/tests/` |

**Done when:** `uvicorn app.main:app` runs; `/health` 200.

---

### BLOCK A3 — Node ↔ FastAPI bridge (Week 1, days 3–4)

**Why:** Switch chat path without breaking frontend.

| Step | Task | Files |
|------|------|-------|
| A3.1 | `aiFastApiClient.js` | `src/services/aiFastApiClient.js` |
| A3.2 | Modify `/api/ai/chat` to proxy when `FEATURE_AI_VIA_FASTAPI=true` | `src/routes/ai.js` |
| A3.3 | Fallback to `aiChatProvider.js` if FastAPI down | `src/routes/ai.js` |
| A3.4 | Pass `threadId` optional in chat schema | `src/routes/ai.js` |

**Done when:** ChatWidget works via FastAPI stub; fallback works when URL empty.

---

### BLOCK A4 — Internal API + tool executor skeleton (Week 1, days 4–5)

**Why:** FastAPI must never touch Prisma directly.

| Step | Task | Files |
|------|------|-------|
| A4.1 | `internalAuth.js` middleware | `src/middleware/internalAuth.js` |
| A4.2 | `POST /api/internal/ai/tools/execute` | `src/routes/internal/ai.js` |
| A4.3 | `aiToolExecutor.js` + AiToolExecution log | `src/services/aiToolExecutor.js` |
| A4.4 | Wire route in `app.js` | `src/app.js` |

**Done when:** curl with `X-Internal-Key` executes a stub tool and logs row in Postgres.

---

### BLOCK A5 — CAG context bundle (Week 1, day 5 – Week 2, day 1)

**Why:** Quality of all AI outputs depends on context.

| Step | Task | Files |
|------|------|-------|
| A5.1 | `contextBundle.js` — merge coachContext + plans + progress | `src/lib/contextBundle.js` |
| A5.2 | Redis cache `cag:{userId}` | uses `redis.js` |
| A5.3 | Pass bundle to FastAPI in chat + plan routes | `aiFastApiClient.js` |
| A5.4 | `chatMemory.js` — Redis hot + Mongo persist | `src/lib/chatMemory.js` |

**Done when:** `/api/ai/chat` sends full bundle; messages persist in Mongo.

---

### BLOCK B — RAG + Intent (Week 2)

| Step | Task |
|------|------|
| B1 | pgvector index on KnowledgeChunk |
| B2 | Ingest L1 (Taqwin internal docs) |
| B3 | Ingest L2 (Exercise catalog) |
| B4 | Ingest L3 (FoodItem/Webteb) |
| B5 | `POST /api/internal/ai/rag/search` |
| B6 | FastAPI retriever + level priority |
| B7 | Intent router (rules + LLM fallback) |
| B8 | L4/L5 ingestion (can parallelize later) |

**Done when:** "بديل لتمرين البنش" retrieves real exercises; platform questions use L1.

---

### BLOCK C — Plans core (Week 3) ⭐ Product MVP

| Step | Task |
|------|------|
| C1 | FastAPI `/plan/generate` — workout + diet JSON |
| C2 | `planValidation.js` — FK check, macro sanity |
| C3 | BullMQ `plan:generate` worker |
| C4 | Hook `onboarding/complete` → enqueue |
| C5 | `DailyAthletePlan` service — slice from weekly |
| C6 | `GET /plans/today`, `GET /plans/week` |
| C7 | Extend `GET /dashboard/athlete/home` |
| C8 | Frontend: TodayWorkoutCard, TodayDietCard |
| C9 | `adaptationEngine.js` — keep/micro/meso/macro |
| C10 | `ProgressSnapshot` + weekly worker |
| C11 | Daily refresh worker |

**Done when:** Complete onboarding → see today plan on dashboard without chat.

---

### BLOCK D — Smart layer (Week 3–4)

| Step | Task |
|------|------|
| D1 | `midWeekTriggers.js` + Wed worker |
| D2 | ReadinessLog API + UI |
| D3 | Skip/Swap API + UI |
| D4 | Life modes API + UI |
| D5 | Explainability text on plan generation |
| D6 | Adherence bands in adaptation |
| D7 | Behavioral signals in CAG |
| D8 | PlanFeedback weekly |
| D9 | Deload week logic |
| D10 | Smart notifications (meal/workout reminders) |

**Done when:** Skip day works; mid-week missed days triggers simplify; fasting mode shifts meals.

---

### BLOCK E — Agent + polish (Week 4–5)

| Step | Task |
|------|------|
| E1 | LangGraph agent in FastAPI |
| E2 | Tool loop (max 5) via Node internal API |
| E3 | Mongo agent traces |
| E4 | Long-term memory pipeline → AiMemory |
| E5 | Chat confirmation modal + tool cards |
| E6 | Safety guardrails |
| E7 | 15 test scenarios (§21) |
| E8 | CI: ai-service pytest |
| E9 | Deploy 3 services + Mongo + Redis |

**Done when:** Chat executes log_food and replace_exercise; confirmations work; CI green.

---

### Dependency graph (never violate)

```
A0 (Prisma) ──→ A4 (Internal API) ──→ B (RAG) ──→ C (Plans)
A1 (Redis/Mongo) ──→ A5 (CAG) ──→ A3 (Bridge) ──→ C
A2 (FastAPI skeleton) ──→ A3 ──→ B ──→ C
C (Plans core) ──→ D (Smart) ──→ E (Agent)
✗ No LangGraph before C done
✗ No plan generation before A0 + A4
✗ FastAPI never writes Postgres
```

---

## 21) Testing scenarios

1. Onboarding complete → plans in Postgres → dashboard shows today
2. Dashboard loads without chat
3. Manual food log → progress updates → CAG reflects it
4. Chat: "بدّلي تمرين النهارده" → replace_exercise → dashboard refetch
5. Chat: "سجّل وجبة..." → log_food → nutrition updates
6. Skip day → meso reschedule → PlanChangeLog
7. 3 missed days (mid-week) → simplified plan
8. Weekly cron 90% adherence → keep decision
9. Weight spike → macro review + confirmation
10. FastAPI down → 503 chat + dashboard still shows cached plan
11. Pain report → safety message + load reduction
12. Life mode travel → simplified week
13. Fasting mode → meal timing shift
14. Plan feedback 👎 saved
15. Invalid exercise ID in AI output → validation rejects → no corrupt plan

---

## 22) Deploy topology

### 22.1 Production (recommended) — Hostinger KVM 2 + Docker

| Component | Platform | Notes |
|-----------|----------|--------|
| **SPA + API edge** | Hostinger VPS **KVM 2** | `nginx` container — `taqwin.com`, `api.taqwin.com` |
| **Node API** | Docker `taqwin-api` | Built from `backend-node/Dockerfile` |
| **AI service** | Docker `taqwin-ai` | FastAPI — **not** exposed on host port 8000 |
| **Background jobs** | Docker `taqwin-worker` (profile) | BullMQ — enable when worker entry exists |
| **PostgreSQL** | Supabase | + pgvector; not on VPS |
| **MongoDB** | MongoDB Atlas | `MONGODB_URI` |
| **Redis** | Upstash | `REDIS_URL` |
| **Files** | Supabase Storage | Signed uploads |

**Runbook:** [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) · **Diagrams:** [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md) · **Compose:** [deploy/docker-compose.production.yml](deploy/docker-compose.production.yml)

### 22.2 Alternative — Vercel + Render (legacy)

| Service | Platform | Notes |
|---------|----------|-------|
| Frontend | Vercel | `frontend/` |
| Node API | Render Web Service | `backend-node/` |
| ai-service | Render Web Service #2 | Private URL when added |
| Data stores | Same as §22.1 | Supabase · Atlas · Upstash |

See [DEPLOY.md](DEPLOY.md#legacy-vercel--render).

### 22.3 CI

- backend: lint + test
- frontend: `tsc` + build
- ai-service: pytest + ruff (when `ai-service/` exists)

---

## 23) Definition of done

### Infrastructure
- [ ] PostgreSQL: all models §5 migrated
- [ ] pgvector enabled
- [ ] MongoDB: collections + indexes
- [ ] Redis: cache + BullMQ + rate limit
- [ ] ai-service deployed and reachable from Node
- [ ] Internal API secured with shared key

### Product
- [ ] Onboarding → weekly plans auto-generated
- [ ] Dashboard home → today workout + diet without chat
- [ ] Manual log + chat log → same progress pipeline
- [ ] Weekly cron → snapshot → keep/adapt/new week
- [ ] Mid-week triggers active
- [ ] Skip/Swap + Life modes
- [ ] Explainability on plans
- [ ] Readiness check-in optional
- [ ] AR/EN locale in plans and chat

### AI
- [ ] CAG on every AI call
- [ ] RAG L1–L3 operational
- [ ] Intent router active
- [ ] Tools execute via Node + AiToolExecution logged
- [ ] Agent with tool loop (Block E)
- [ ] Confirmations for destructive actions
- [ ] Safety on pain/medical keywords

### Ops
- [ ] 15 test scenarios pass
- [ ] CI green for all 3 packages
- [ ] DEPLOY-HOSTINGER.md and SYSTEM-ARCHITECTURE.md updated
- [ ] `.env.example` complete for all services

---

## 24) Deferred to v2

- Wearables (Apple Watch) sync
- Full periodization / mesocycles
- Grocery list from diet plan
- Live coach video
- SSE streaming chat
- BullMQ → separate `taqwin-worker` container on VPS (start with same Node process in dev)
- RAG L5 bulk book ingest
- Multi-agent architectures

---

## Quick start — what to run first

```bash
# 1. Block A0 — Prisma migration (after adding models to schema.prisma)
cd backend-node && npx prisma migrate dev --name ai_coach_foundation

# 2. Block A2 — ai-service locally
cd ai-service && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000

# 3. Block A3 — Node with FastAPI bridge
cd backend-node && FEATURE_AI_VIA_FASTAPI=true AI_SERVICE_URL=http://localhost:8000 npm run dev
```

**First implementation PR should contain:** Block A0 + A1 + A2 + A3 (foundation only — no plans yet).

---

*End of master blueprint. For tool JSON schemas see `docs/AI-TOOLS-REFERENCE.md` (create in Block A4). For RAG source list see `docs/AI-RAG-SOURCES.md` (create in Block B).*
