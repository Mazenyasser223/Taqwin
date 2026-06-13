# Taqwin — Production deployment (Hostinger VPS + Docker)

> **Target server:** Hostinger **KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe)  
> **Orchestration:** Docker Compose  
> **Related:** [Master plan](./TAQWIN-MASTER-PLAN.md) · [System architecture](./SYSTEM-ARCHITECTURE.md) · [AI Coach blueprint](../AI-COACH-ARCHITECTURE.md)

This runbook deploys the **frontend and API on one VPS**. Managed databases and Redis stay on **Supabase**, **MongoDB Atlas**, and **Upstash** respectively.

---

## 1. Architecture summary

```text
                    Internet
                        │
                        ▼
              ┌─────────────────┐
              │  nginx :443     │
              │  taqwin.online     │──► SPA (frontend/dist)
              │  api.taqwin.online │──► taqwin-api :4000
              └────────┬────────┘
                       │
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
   taqwin-api    taqwin-ai      taqwin-worker
   (Node)        (FastAPI)*     (optional)*
         │             │
         └──────┬──────┘
                ▼
    Supabase · Atlas · Upstash · Anthropic API

* taqwin-ai and worker: enable when ai-service/ exists (Block A2+).
```

---

## 2. Prerequisites

| Item | Notes |
|------|--------|
| Domain | `taqwin.online` and `api.taqwin.online` A records → VPS IP |
| Hostinger VPS | **KVM 2**, Ubuntu 22.04 LTS (or Hostinger Docker template) |
| Supabase | Postgres `DATABASE_URL` + `DIRECT_URL`, Storage bucket `taqwin-uploads` |
| MongoDB Atlas | `MONGODB_URI` — allow VPS outbound IP if IP access list enabled |
| Upstash Redis | `REDIS_URL` for cache and BullMQ |
| Anthropic (or Gemini/Ollama) | Server-side only; see `backend-node/.env.example` |

---

## 3. VPS initial setup

### 3.1 OS packages

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw certbot dnsutils

# Ubuntu 24.04: docker-compose-plugin is not in default apt — use Docker’s official repo
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker compose version
usermod -aG docker $USER
# Log out and back in so docker group applies (skip if using root)
```

### 3.2 Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do **not** open port `8000` (FastAPI stays on the Docker internal network).

### 3.3 Clone repository

```bash
sudo mkdir -p /opt/taqwin
sudo chown $USER:$USER /opt/taqwin
git clone https://github.com/Mazenyasser223/Taqwin.git /opt/taqwin
cd /opt/taqwin
```

---

## 4. Environment file

Create `/opt/taqwin/deploy/.env` (never commit secrets):

```bash
cp deploy/.env.production.example deploy/.env
nano deploy/.env
```

Required variables are listed in [deploy/.env.production.example](../deploy/.env.production.example). Minimum set for API-only deploy (before FastAPI):

- `DATABASE_URL`, `DIRECT_URL`
- `JWT_SECRET`, `FRONTEND_URL=https://taqwin.online`
- `GOOGLE_*` if using OAuth
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `MONGODB_URI`, `REDIS_URL`
- `ANTHROPIC_API_KEY` (ai-service coach + plan generation; Node uses same for plan/memory jobs)

When `ai-service` is deployed, also set:

- `AI_SERVICE_URL=http://ai:8000`
- `AI_INTERNAL_KEY=<long-random-secret>`
- `FEATURE_AI_VIA_FASTAPI=true`

---

## 5. Build frontend

Build on the VPS or in CI and copy `frontend/dist`:

```bash
cd /opt/taqwin/frontend
npm ci
VITE_API_URL=https://api.taqwin.online npm run build
```

The Compose file mounts `../frontend/dist` into nginx.

---

## 6. TLS certificates (Phase 0.2)

**Quick path:** [deploy/CHECKLIST-0.1-0.2.md](../deploy/CHECKLIST-0.1-0.2.md) and `deploy/scripts/issue-tls.sh`.

1. Start the stack with HTTP bootstrap (`deploy/nginx.conf` — includes ACME webroot).
2. Issue certs with Certbot **webroot** (nginx stays up):

```bash
sudo mkdir -p /var/www/certbot
bash deploy/scripts/issue-tls.sh
```

Or manually:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d taqwin.online -d www.taqwin.online -d api.taqwin.online \
  --email you@example.com --agree-tos --no-eff-email
```

3. Set in `deploy/.env`:

```text
NGINX_CONF_FILE=./nginx.https.conf
```

4. Recreate nginx:

```bash
docker compose -f docker-compose.production.yml --env-file .env up -d nginx
docker compose -f docker-compose.production.yml exec nginx nginx -t
docker compose -f docker-compose.production.yml exec nginx nginx -s reload
```

Certs live on the host at `/etc/letsencrypt/live/taqwin.online/` and are mounted read-only into the nginx container.

**Renewal** (crontab on VPS):

```bash
0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/taqwin/deploy && docker compose -f docker-compose.production.yml exec nginx nginx -s reload"
```

### 6.1 Block public access to `/api/internal/*`

`deploy/nginx.conf` denies `/api/internal/*` at the nginx edge (HTTP 403). This is defense in depth on top of `X-Internal-Key` in Express.

| Caller | How it reaches Node internal routes |
|--------|-------------------------------------|
| `taqwin-ai` container | Docker network `http://api:4000` — **not** through nginx |
| Host cron scripts | In-process (`node scripts/cron-enqueue-*.js`) — no HTTP |
| Public Internet | **Blocked** at nginx |

After editing nginx config:

```bash
docker compose -f docker-compose.production.yml exec nginx nginx -t
docker compose -f docker-compose.production.yml exec nginx nginx -s reload
```

Verify from any machine outside the VPS:

```bash
curl -s -o /dev/null -w "%{http_code}" https://api.taqwin.online/api/internal/ai/tools/list
# Expected: 403
```

Coach chat should still work — ai-service calls `http://api:4000/api/internal/...` inside Compose.

If you must trigger internal cron routes over HTTPS from the VPS itself, add `allow 127.0.0.1;` (and proxy) in the `/api/internal/` block instead of `deny all`; the default template keeps them fully off the public edge.

---

## 7. Start stack

```bash
cd /opt/taqwin/deploy
docker compose -f docker-compose.production.yml --env-file .env up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f api
```

### 7.1 Services (full stack — default)

| Service | Description |
|---------|-------------|
| `nginx` | SPA + API reverse proxy |
| `api` | Express API (`backend-node`) |
| `ai` | FastAPI coach microservice |
| `worker` | BullMQ consumers + crons |

```bash
docker compose -f docker-compose.production.yml --env-file .env up -d --build
```

API-only (emergency: API without worker/ai-service — chat returns 502; plans may queue):

```bash
docker compose -f docker-compose.production.yml --env-file .env up -d --build nginx api
```

---

## 8. Database migrations and seed

Migrations run on API container start (`prisma migrate deploy` in Dockerfile CMD).

One-time seed (optional):

```bash
docker compose -f docker-compose.production.yml --env-file .env exec api npm run db:seed
```

### 8.1 RAG knowledge ingest (one-time per environment)

Requires `OPENAI_API_KEY` or `VOYAGE_API_KEY` (1536-dim) and `DIRECT_URL` in `deploy/.env`.

L5 book chapters live at `backend-node/data/books/bigger-leaner-stronger/*.md` on the host (gitignored — copy licensed markdown onto the VPS before ingest).

```bash
docker compose -f docker-compose.production.yml --env-file .env exec api npm run rag:ingest:l1
docker compose -f docker-compose.production.yml --env-file .env exec api npm run rag:ingest:l2
docker compose -f docker-compose.production.yml --env-file .env exec api npm run rag:ingest:l3
docker compose -f docker-compose.production.yml --env-file .env exec api npm run rag:ingest:l5
docker compose -f docker-compose.production.yml --env-file .env exec api npm run verify:b5
```

Re-run after editing `data/knowledge/l1/` or book markdown. L2/L3 ingest from Postgres exercise/food catalogs (seed first).

---

## 9. Google OAuth

In Google Cloud Console → **Authorized redirect URIs**:

```text
https://api.taqwin.online/api/auth/google/callback
```

Set in `deploy/.env`:

```text
GOOGLE_CALLBACK_URL=https://api.taqwin.online/api/auth/google/callback
FRONTEND_URL=https://taqwin.online
```

---

## 10. Verification

| Check | Expected |
|-------|----------|
| `curl -s https://api.taqwin.online/health` | `"status":"ok"`, `stores.pgvector`, `features` |
| `curl -s -o /dev/null -w "%{http_code}" https://api.taqwin.online/api/internal/ai/tools/list` | **403** (nginx blocks public internal API) |
| `https://taqwin.online` | SPA loads |
| `curl -s http://<VPS_IP>:8000/health` | **Connection refused** (FastAPI not public) |
| Sign up / login | Email or OAuth → onboarding |
| Demo (if seeded) | `demo@taqwin.app` / `Taqwin#2025` |
| AI memory (E4) | `docker compose exec api npm run verify:e4-memory -- --live` |

### 10.1 AI memory pipeline (Block E4)

Long-term coach memory needs **all three** in production:

| Requirement | Variable / process |
|-------------|-------------------|
| BullMQ Redis (TCP) | `REDIS_URL=rediss://...` — Upstash REST alone is **not** enough |
| Queue enabled | `FEATURE_PLAN_QUEUE=true` |
| Chat persistence | `MONGO_URI` or `MONGODB_URI` |
| Job consumer | `worker` Docker service (`npm run worker`) — **not** `FEATURE_PLAN_INLINE_WORKER` |

Recommended flags (see [deploy/.env.production.example](../deploy/.env.production.example)):

- `FEATURE_AI_MEMORY_SESSION=true` — summarize after every 5 user turns (default on)
- `FEATURE_AI_MEMORY_CRON=true` — nightly batch 02:00–04:59 athlete local time (auto-on when `NODE_ENV=production`)

Verify:

```bash
cd backend-node
npm run verify:e4-memory              # wiring + env checklist
npm run verify:e4-memory -- --live    # Redis ping, Mongo connect, enqueue smoke job
```

If the smoke job stays `waiting`, the worker is not running — start `taqwin-worker` or `npm run worker`.


---

## 11. Operations

### 11.1 Deploy updates

```bash
cd /opt/taqwin
git pull
cd frontend && npm ci && VITE_API_URL=https://api.taqwin.online npm run build
cd ../deploy
docker compose -f docker-compose.production.yml --env-file .env up -d --build
```

### 11.2 Logs

```bash
docker compose -f docker-compose.production.yml logs -f api
docker compose -f docker-compose.production.yml logs -f nginx
```

### 11.3 Restart

```bash
docker compose -f docker-compose.production.yml --env-file .env restart api
```

### 11.4 Backups

| Asset | Method |
|-------|--------|
| Postgres | Supabase dashboard backups |
| MongoDB | Atlas backups |
| VPS config | Copy `deploy/.env`, `nginx.conf`, Compose file off-server |
| User uploads | Supabase Storage |

Application containers are stateless; rebuilding from Git is acceptable.

---

## 12. Resource expectations (KVM 2)

| Container | Typical RAM |
|-----------|-------------|
| nginx | &lt; 50 MB |
| taqwin-api | 300–800 MB |
| taqwin-ai | 200–500 MB |
| taqwin-worker | 200–400 MB |
| OS + Docker | ~1 GB |

Leave headroom for traffic spikes; monitor with `docker stats`.

---

## 13. Troubleshooting

| Symptom | Action |
|---------|--------|
| 502 from nginx | `docker compose logs api` — API not listening on 4000 |
| DB connection errors | Verify `DATABASE_URL` pooler URL and Supabase IP allowlist |
| OAuth redirect mismatch | Exact match on `GOOGLE_CALLBACK_URL` |
| CORS errors | Set `FRONTEND_URL` and optional `CORS_ALLOWED_ORIGINS` |
| AI chat 503/502 | Check `FEATURE_AI_VIA_FASTAPI=true`, `AI_SERVICE_URL`, and ai-service logs — no Node chat fallback |
| Internal API 403 from ops curl | Expected for public URL; use `docker compose exec api …` or Docker `http://api:4000` with `X-Internal-Key` |
| Out of memory | `docker stats`; upgrade to KVM 4 or disable worker until optimized |

---

## 14. Related documents

- [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md) — diagrams and data flow
- [DEPLOY.md](../DEPLOY.md) — Supabase setup and legacy Vercel/Render
- [AI-COACH-ARCHITECTURE.md](../AI-COACH-ARCHITECTURE.md) — AI feature implementation blocks
