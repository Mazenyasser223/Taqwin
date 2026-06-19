# Community — shared setup for collaborators

This guide ensures **Feed, Profile, Browse, Groups, Inbox, and Settings** work the same on every machine after `git pull`. Code lives in Git; **data and media live in your shared cloud services** (not in the repo).

## What persists where

| Feature | PostgreSQL tables | Media storage |
|---------|-------------------|---------------|
| Feed (posts, likes, comments, reposts) | `community_posts`, `community_post_*`, `community_comments` | Supabase bucket `taqwin-uploads` (or local `backend-node/uploads/` in dev) |
| Stories | `community_stories`, `community_story_*` | Same bucket |
| Profile (display name, bio, community avatar) | `profiles`, `community_privacy_settings` | Same bucket |
| Browse (search users) | `users`, `profiles` (+ indexes on `display_name`, `role`) | — |
| Groups | `community_groups`, `community_group_members`, group posts | Same bucket |
| Inbox (DMs + group chats) | `community_conversations`, `community_conversation_participants`, `community_messages` | Same bucket |
| Settings (privacy, presence) | `community_privacy_settings`, `users.last_seen_at` | — |
| Follows / blocks | `community_follows`, `community_blocks` | — |
| Notifications | `notifications` | — |

**Important:** If you and your teammate use **different** `DATABASE_URL` values, you will see **different** posts, messages, and profiles. For the same experience, share one Supabase Postgres project.

## Required environment (share securely, never commit `.env`)

Copy `backend-node/.env.example` → `backend-node/.env` and align these with your team (use a password manager or encrypted chat):

```env
# Same database for everyone on the team
DATABASE_URL=postgresql://...pooler...6543/postgres?pgbouncer=true&connection_limit=1
DIRECT_URL=postgresql://...5432/postgres

JWT_SECRET=<same secret if you want shared sessions across machines — optional>

# Same Supabase project → same uploaded images/videos/avatars
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SERVICE_KEY=eyJ...service-role...
SUPABASE_STORAGE_BUCKET=taqwin-uploads

FRONTEND_URL=http://localhost:3000
PORT=4000
```

### Optional but recommended (same speed everywhere)

Redis caches feed, inbox, groups, and browse responses. Without it the app still works but may feel slower:

```env
# Upstash REST (easiest) or local Docker Redis
UPSTASH_REDIS_REST_URL=https://YOUR_DB.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
# or
REDIS_URL=redis://127.0.0.1:6379
```

### Optional moderation (content safety)

```env
OPENAI_API_KEY=sk-...          # text + image moderation
SIGHTENGINE_USER=...             # image nudity/violence (free tier)
SIGHTENGINE_SECRET=...
```

## After every `git pull`

From the **repository root**:

```bash
npm run install:all
npm run setup:community
npm run dev
```

Or step by step:

```bash
cd backend-node
npm install
cp .env.example .env    # first time only — then fill shared values
npm run db:migrate      # applies new Prisma migrations
npm run db:generate     # refresh Prisma client (stop API first on Windows if EPERM)
npm run storage:fix-bucket   # ensures Supabase bucket allows images + videos
cd ..
npm run dev
```

Open **http://localhost:3000** — community routes are under `#/community/*`.

## Migrations included for community (2026-06)

These ship in the repo and run via `npm run db:migrate`:

| Migration | Purpose |
|-----------|---------|
| `20260608160000_profile_community_avatar` | `profiles.community_avatar_url` |
| `20260608200000_community_perf_indexes` | Feed/like/comment query indexes |
| `20260609120000_browse_search_indexes` | Browse search by display name |
| `20260610120000_inbox_group_columns` | Group DM columns on conversations |
| `20260610140000_group_perf_indexes` | Groups list/member count indexes |

Verify migrations applied:

```bash
cd backend-node
npx prisma migrate status
```

## Storage behavior

| Config | Uploads go to | Visible to teammate? |
|--------|---------------|----------------------|
| `SUPABASE_SERVICE_KEY` set | Supabase Storage (`taqwin-uploads`) | Yes, if same Supabase project |
| Keys missing | `backend-node/uploads/` (gitignored) | **No** — files stay on your PC only |

Run once per Supabase project:

```bash
npm run storage:fix-bucket --prefix backend-node
```

## Frontend

No extra env is required for local dev — Vite proxies `/api` and `/uploads` to the backend. For production builds set `VITE_API_URL` in `frontend/.env.local` (see `frontend/.env.example`).

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Empty feed / no messages after pull | Run `npm run db:migrate --prefix backend-node`; confirm `DATABASE_URL` matches teammate |
| Images broken or 404 | Set `SUPABASE_*` keys; run `storage:fix-bucket`; do not rely on local `uploads/` for shared dev |
| Upload fails in production (community) | Ensure `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in `deploy/.env`; run `npm run verify:uploads --prefix backend-node` on VPS; redeploy after code fix for signed-upload auth header |
| Slow inbox/groups vs teammate | Add shared `UPSTASH_REDIS_*` or `REDIS_URL` |
| `prisma generate` EPERM on Windows | Stop `npm run dev` backend, then retry |
| Schema drift warning | Pull latest, run migrate; do not edit applied migration SQL |
| Group shows "0 members" briefly | Normal on first paint — detail fetch fills count; clear Redis cache or wait ~12s |

## Checklist before pushing to GitHub

- [ ] All community backend files under `backend-node/src/routes/community/` and `backend-node/src/services/community/`
- [ ] All 5 migrations above present under `backend-node/prisma/migrations/`
- [ ] `backend-node/prisma/schema.prisma` matches migrations
- [ ] **Do not** commit `backend-node/.env`, `backend-node/uploads/`, or `node_modules/`
- [ ] Share `.env` values with teammate out-of-band (not in Git)

## Architecture (quick reference)

```text
React SPA  →  /api/community/*  →  Express router (routes/community/)
                                 →  Services (feed, inbox, groups, browse, profile, …)
                                 →  PostgreSQL (Prisma)
                                 →  Redis cache (optional, recommended)
                                 →  Supabase Storage (media)
```

For Git workflow see [GITHUB.md](./GITHUB.md).
