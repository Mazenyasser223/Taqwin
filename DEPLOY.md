# Taqwin — Deploy Guide

Stack: **Supabase** (Postgres + Storage), **Render** (Express API), **Vercel** (Vite SPA).

```
Browser  →  Vercel (SPA)  →  Render (Node API)  →  Supabase Postgres
                                          ↘  Supabase Storage (signed URLs)
                                          ↘  Google Gemini (server proxy)
```

## 1. Supabase

1. Create a Supabase project. Copy these values from **Project Settings → Database** and **Project Settings → API**:
   - `DATABASE_URL` (pooler, port `6543`, append `?pgbouncer=true&connection_limit=1`)
   - `DIRECT_URL` (direct, port `5432`)
   - `SUPABASE_URL` (e.g. `https://YOUR_REF.supabase.co`)
   - `SUPABASE_SERVICE_KEY` (service role key — never ship to the frontend)
2. **Storage** → create a bucket called `taqwin-uploads`. Toggle **Public** read on. The API issues signed-URL writes via the service key.

## 2. Render (backend-node)

1. New → **Web Service** → connect this repo.
2. **Root directory**: `backend-node`
3. **Build**: `npm install && npx prisma generate && npx prisma migrate deploy`
4. **Start**: `npm start`
5. Environment variables (copy from `backend-node/.env.example`):
   - `NODE_ENV=production`
   - `PORT=4000`
   - `DATABASE_URL`, `DIRECT_URL`
   - `JWT_SECRET`, `JWT_EXPIRES_IN=7d`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_CALLBACK_URL=https://<your-render-host>.onrender.com/api/auth/google/callback` (do **not** leave localhost here in production)
   - `FRONTEND_URL=https://<your-vercel-host>.vercel.app` (recommended; OAuth redirects use the first origin)
   - On Render, `RENDER_EXTERNAL_URL` is set automatically; if `GOOGLE_CALLBACK_URL` is still localhost, the API uses the Render URL for Google OAuth anyway.
   - Optional: `CORS_ALLOWED_ORIGINS` for extra domains; `CORS_ALLOW_VERCEL=false` to block `*.vercel.app`
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD`
   - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET=taqwin-uploads`
   - `GEMINI_API_KEY`
6. After the first deploy, **Run Job** with command `npm run db:seed` (or use `db:seed:force` to re-seed).
7. **Health check path**: `/health`.

> The provided `Dockerfile` is optional — Render's native Node runtime works directly with the build/start commands above.

## 3. Google OAuth

In the Google Cloud Console → OAuth 2.0 Client → **Authorized redirect URIs**:

- `https://<your-render-host>.onrender.com/api/auth/google/callback`

The frontend never calls Google directly — Render handles the callback and redirects to the SPA hash route `/oauth/callback?token=...`.

## 4. Vercel (frontend)

1. New project → import this repo.
2. **Root directory**: `frontend`
3. Framework preset: **Vite**
4. Environment variables:
   - `VITE_API_URL=https://<your-render-host>.onrender.com` (or use `frontend/vercel.json` `build.env`, which sets `https://taqwin.onrender.com` for this project)
5. Deploy. Vercel handles HTTPS automatically.

## 5. Verify

- `https://<render>/health` → `{ "status": "ok", "database": "connected" }`
- `https://<vercel>` → SPA loads
- Sign up with email → verification email arrives → land in onboarding
- Demo accounts (created by seed): `demo@taqwin.app` / `Taqwin#2025`

## 6. Notes & known limits

- JWT is stored in `localStorage`. httpOnly-cookie refactor is on the backlog.
- Real payments aren't wired (`createOrder` writes a `pending` order).
- Community is REST-polled (no WebSockets).
- One gym per `gym`-role user for v1.
