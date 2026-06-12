# Deploy

Production deployment assets for **Hostinger VPS KVM 2** using **Docker Compose**.

## Files

| File | Purpose |
|------|---------|
| [docker-compose.production.yml](./docker-compose.production.yml) | Full production stack: `nginx`, `api`, `ai`, `worker` |
| [nginx.conf](./nginx.conf) | Active HTTP config mounted into nginx (`/api/internal/*` denied at edge) |
| [nginx.conf.example](./nginx.conf.example) | HTTPS template (Certbot paths; same internal-route deny) |
| [.env.production.example](./.env.production.example) | Environment variable template for VPS |

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
# 1. Build frontend with production API URL
cd frontend
npm ci
VITE_API_URL=https://api.taqwin.com npm run build

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
- HTTPS: use `nginx.conf.example` as a starting point with Certbot

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
