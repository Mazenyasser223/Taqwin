# Taqwin — Deployment Guide

Taqwin supports two production layouts. **Recommended** for the AI Coach roadmap: a single **Hostinger VPS (KVM 2)** with **Docker Compose**. **Legacy:** Vercel + Render (still valid for development and transitional hosting).

| Approach | Document | Summary |
|----------|----------|---------|
| **Production (recommended)** | [docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md) | KVM 2 VPS · nginx + Node API (+ FastAPI when ready) · Supabase · Atlas · Upstash |
| **Architecture reference** | [docs/SYSTEM-ARCHITECTURE.md](docs/SYSTEM-ARCHITECTURE.md) | Diagrams, data flows, security |
| **AI implementation** | [AI-COACH-ARCHITECTURE.md](AI-COACH-ARCHITECTURE.md) | Blocks A–E, schemas, checklists |

```text
Production:
  Browser → https://taqwin.com + https://api.taqwin.com (Hostinger VPS / Docker)
         → Supabase (Postgres + Storage)
         → MongoDB Atlas · Upstash Redis
         → Anthropic / Gemini (server-side)
```

---

## Shared: Supabase (all deployments)

Required for every environment.

1. Create a Supabase project. Copy from **Project Settings → Database** and **API**:
   - `DATABASE_URL` (pooler, port `6543`, append `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` (direct, port `5432`)
   - `SUPABASE_URL` (e.g. `https://YOUR_REF.supabase.co`)
   - `SUPABASE_SERVICE_KEY` (service role — never expose to the frontend)
2. **Storage** → bucket `taqwin-uploads`. Enable public read if needed for media URLs.
   - For story/post video uploads, allow `video/mp4`, `video/webm`, `video/quicktime`, and `application/octet-stream` in bucket MIME settings (or allow all types).

---

## Production quick start (Hostinger)

1. Provision **KVM 2** VPS (Ubuntu 22.04), point DNS to the VPS IP.
2. Follow **[docs/DEPLOY-HOSTINGER.md](docs/DEPLOY-HOSTINGER.md)** — Docker, `deploy/.env`, build frontend, `docker compose up`.
3. Verify `https://api.taqwin.com/health` and SPA at `https://taqwin.com`.

Compose and nginx templates live in [`deploy/`](deploy/).

---

## Legacy: Vercel + Render

Use this path if you are not yet on the VPS or need a quick cloud deploy without Docker.

### Stack

```text
Browser  →  Vercel (SPA)  →  Render (Node API)  →  Supabase Postgres
                                          ↘  Supabase Storage (signed URLs)
                                          ↘  LLM APIs (server proxy)
```

### Render (backend-node)

1. New → **Web Service** → connect this repo.
2. **Root directory**: `backend-node`
3. **Build**: `npm install && npx prisma generate && npx prisma migrate deploy`
4. **Start**: `npm start`
5. Environment variables: copy from `backend-node/.env.example` (see Hostinger example in `deploy/.env.production.example` for the full list).
   - `GOOGLE_CALLBACK_URL=https://<your-render-host>.onrender.com/api/auth/google/callback`
   - `FRONTEND_URL=https://<your-vercel-host>.vercel.app`
6. After first deploy: run `npm run db:seed` as a one-off job if needed.
7. **RAG ingest (one-off):** With `DIRECT_URL` + embedding API key set, run `npm run rag:ingest:l1`, `l2`, `l3`, `l5` from a shell with repo + local book markdown. Not run automatically on deploy.
8. **Health check path**: `/health`.

> `backend-node/Dockerfile` is optional on Render; native Node build/start works.

### Google OAuth (Render)

Authorized redirect URI:

```text
https://<your-render-host>.onrender.com/api/auth/google/callback
```

### Vercel (frontend)

1. Import repo → **Root directory**: `frontend`
2. Framework: **Vite**
3. `VITE_API_URL=https://<your-render-host>.onrender.com`

### Verify (legacy)

- `https://<render>/health` → database connected
- `https://<vercel>` → SPA loads
- Demo (after seed): `demo@taqwin.app` / `Taqwin#2025`

---

## Notes (all environments)

- JWT is stored in `localStorage` (httpOnly cookies are backlog).
- Payments are not fully wired (`createOrder` creates `pending` orders).
- **Coach chat** streams token-by-token over **WebSocket only** (`/ws` → Node → FastAPI `/chat/stream` SSE). The UI does not fall back to blocking `POST /api/ai/chat`. Required: `FEATURE_REALTIME_WS=true`, `FEATURE_AI_VIA_FASTAPI=true`, `AI_SERVICE_URL`, `ANTHROPIC_API_KEY`, proxy WebSocket upgrade on `/ws`.
- Community uses WebSocket push when `FEATURE_REALTIME_WS=true` (REST polling only when WS is down).
- One gym per `gym`-role user in v1.
- Roles are `athlete | gym` only (`trainer` removed; no bookings API).
