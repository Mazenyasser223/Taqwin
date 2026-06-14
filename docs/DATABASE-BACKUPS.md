# Database backups and recovery (Taqwin production)

> **Scope:** Managed Postgres, MongoDB, Redis, and Supabase Storage — not VPS application disk.

Taqwin application containers on the Hostinger VPS are **stateless**. All durable data lives in managed services. Rebuilding the VPS from Git + `deploy/.env` is acceptable; rebuilding databases is not.

---

## 1. PostgreSQL (Supabase) — source of truth

**Contains:** users, profiles, official plans (`WorkoutPlan`, `DietPlan`), logs, commerce, community, `AiMemory`, `AiToolExecution`, RAG (`KnowledgeChunk` + pgvector).

| Task | How |
|------|-----|
| Automatic backups | Supabase Dashboard → Project → Database → Backups (plan-dependent) |
| Point-in-time recovery | Supabase Pro+ PITR if enabled |
| Manual export | `pg_dump` via direct connection (`DIRECT_URL`, port 5432) |
| Restore test | Restore to a **staging** Supabase project quarterly |

**Before major migrations:**

```bash
cd backend-node
npx prisma migrate deploy   # production
npm run verify:a0
npm run verify:b1
```

---

## 2. MongoDB Atlas — AI warehouse

**Contains:** chat messages, agent traces, `plan_generation_logs`, `ai_llm_outputs`, `analytics_events`. Legacy `plans` collection (inactive docs TTL 90 days).

| Task | How |
|------|-----|
| Automatic backups | Atlas → Backup (continuous cloud backup on M10+) |
| Export | `mongodump --uri="$MONGO_URI"` |
| Legacy plan migration | `npm run migrate:plans-mongo-to-pg` then verify Postgres active plan |

---

## 3. Redis (Upstash) — ephemeral

**Contains:** CAG cache, dashboard cache, BullMQ queues, rate limits.

| Task | How |
|------|-----|
| Backup | **Not required** — rebuild from Postgres/Mongo on cache miss |
| Failure | Restart worker; re-enqueue crons via `npm run cron:*` or internal cron routes |

---

## 4. Supabase Storage — binary files

**Contains:** avatars, community media, progress photos, food scans.

| Task | How |
|------|-----|
| Bucket policy | Private bucket + signed URLs (`SUPABASE_STORAGE_BUCKET`) |
| Backup | Supabase Storage replication; optional periodic bucket sync to cold storage |

---

## 5. VPS configuration (off-server copy)

Store encrypted copies outside the VPS:

- `deploy/.env` (secrets)
- `deploy/nginx.conf` (TLS paths)
- `deploy/docker-compose.production.yml`

Never commit `.env` to Git.

---

## 6. Recovery runbook (summary)

1. Provision new VPS or redeploy containers.
2. Restore or confirm Supabase + Atlas are unchanged.
3. Copy `deploy/.env`, rebuild frontend, `docker compose up -d --build`.
4. Verify: `node backend-node/scripts/verify-production-readiness.js --url https://api.taqwin.com/health`
5. Smoke: login, dashboard home, AI chat.

---

## Related

- [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md)
- [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md)
- [backend-node/docs/AI_ARCHITECTURE.md](../backend-node/docs/AI_ARCHITECTURE.md)
