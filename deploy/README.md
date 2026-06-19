# Deploy

Production deployment assets for **Hostinger VPS KVM 2** using **Docker Compose**.

## Files

| File | Purpose |
|------|---------|
| [docker-compose.production.yml](./docker-compose.production.yml) | Full production stack: `nginx`, `api`, `ai`, `worker` |
| [nginx.conf](./nginx.conf) | HTTP bootstrap (ACME webroot + SPA/API proxy) |
| [nginx.https.conf](./nginx.https.conf) | Production HTTPS (set `NGINX_CONF_FILE` in `.env`) |
| [nginx.conf.example](./nginx.conf.example) | Legacy reference — prefer `nginx.https.conf` |
| [.env.production.example](./.env.production.example) | Environment variable template for VPS |
| [CHECKLIST-0.1-0.2.md](./CHECKLIST-0.1-0.2.md) | Phase 0 deploy + DNS + TLS steps |
| [scripts/](./scripts/) | `dns-check`, `deploy-stack`, `issue-tls`, `verify-production` |

## Production stack

```text
deploy/
├── README.md
├── docker-compose.production.yml
├── nginx.conf
├── nginx.conf.example
└── .env.production.example

Services (Docker Compose):
  nginx   → serves frontend/dist + reverse-proxies /api to api:4000
  api     → backend-node (Express, port 4000)
  ai      → ai-service (FastAPI, port 8000)
  worker  → backend-node BullMQ workers
```

External services (not in Compose):

- **PostgreSQL** — Supabase (primary database + pgvector)
- **MongoDB** — Atlas (chat, traces, audit)
- **Redis** — Upstash (CAG cache, BullMQ)
- **Storage** — Supabase Storage (uploads)

## Deploy workflow

```bash
# On VPS — see CHECKLIST-0.1-0.2.md
cp .env.production.example .env   # fill secrets + CERTBOT_EMAIL
bash scripts/dns-check.sh
bash scripts/deploy-stack.sh      # 0.1
bash scripts/issue-tls.sh         # 0.2
bash scripts/verify-production.sh
```

Manual equivalent:

```bash
# 1. Build frontend with production API URL
cd frontend
npm ci
VITE_API_URL=https://api.taqwin.online npm run build

# 2. Configure environment on VPS
cd ../deploy
cp .env.production.example .env
# Fill secrets: DATABASE_URL, JWT_SECRET, AI keys, etc.

# 3. Start stack
docker compose -f docker-compose.production.yml --env-file .env up -d --build
```

## nginx

- Serves static frontend from `../frontend/dist`
- Proxies `/api/*` to the Node API container
- Denies `/api/internal/*` at the edge (internal routes are container-to-container only)
- HTTPS: set `NGINX_CONF_FILE=./nginx.https.conf` after Certbot (see `scripts/issue-tls.sh`)

## Environment

Copy `.env.production.example` to `.env` on the VPS. Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | Supabase PostgreSQL (pooler) |
| `DIRECT_URL` | Direct Postgres for migrations |
| `MONGO_URI` | MongoDB Atlas |
| `REDIS_URL` | Upstash Redis |
| `JWT_SECRET` | Auth signing key |
| `AI_INTERNAL_KEY` | FastAPI ↔ Node shared secret |
| `ANTHROPIC_API_KEY` | LLM provider |
| `FEATURE_AI_VIA_FASTAPI` | Route chat through ai-service (default `true`) |
| `AI_SERVICE_URL` | Internal URL (`http://ai:8000` in Compose) |
| `GMAIL_USER` | Outbound mail sender (`Taqwinfcds.2026@gmail.com`) |
| `GMAIL_APP_PASSWORD` | Gmail app password (16 chars, no spaces) |
| `SUPPORT_EMAIL` | Inbox for support form tickets (`taqwinfcds.2026@gmail.com`; defaults to this if unset) |
| `REQUIRE_EMAIL_VERIFICATION` | `true` when email is configured |

### Email on Hostinger

Production reads **`deploy/.env`** (not `backend-node/.env`). After every deploy:

1. Set `GMAIL_USER=Taqwinfcds.2026@gmail.com`, `GMAIL_APP_PASSWORD`, and `SUPPORT_EMAIL=taqwinfcds.2026@gmail.com` in `deploy/.env` on the VPS.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `SUPABASE_STORAGE_BUCKET=taqwin-uploads` for community media.
3. Recreate API containers so env is picked up:
   ```bash
   cd /opt/taqwin/deploy
   docker compose -f docker-compose.production.yml --env-file .env up -d --force-recreate api worker
   ```
3. Smoke-test SMTP from the VPS:
   ```bash
   docker compose -f docker-compose.production.yml exec api node scripts/verify-email-smtp.js --send your@email.com
   ```
4. Verify media storage (community photos/videos):
   ```bash
   docker compose -f docker-compose.production.yml exec api node scripts/verify-uploads-production.js
   docker compose -f docker-compose.production.yml exec api node scripts/fix-supabase-upload-bucket.js
   ```

## Local development database

For local dev (not production), use the root `docker-compose.yml`:

```bash
# From repo root
npm run db:up
```

This starts a local PostgreSQL container only.

## Related documentation

- [../docs/DEPLOY-HOSTINGER.md](../docs/DEPLOY-HOSTINGER.md) — Full VPS runbook
- [../docs/SYSTEM-ARCHITECTURE.md](../docs/SYSTEM-ARCHITECTURE.md) — Production topology
- [../docs/DATABASE-BACKUPS.md](../docs/DATABASE-BACKUPS.md) — Backup procedures
- [../DEPLOY.md](../DEPLOY.md) — Deployment index (Hostinger + legacy)
- [../README.md](../README.md) — Monorepo quick start
