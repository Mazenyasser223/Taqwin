# Taqwin — Production deployment (Hostinger VPS + Docker)

> **Target server:** Hostinger **KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe)  
> **Orchestration:** Docker Compose  
> **Related:** [System architecture](./SYSTEM-ARCHITECTURE.md) · [AI Coach blueprint](../AI-COACH-ARCHITECTURE.md)

This runbook deploys the **frontend and API on one VPS**. Managed databases and Redis stay on **Supabase**, **MongoDB Atlas**, and **Upstash** respectively.

---

## 1. Architecture summary

```text
                    Internet
                        │
                        ▼
              ┌─────────────────┐
              │  nginx :443     │
              │  taqwin.com     │──► SPA (frontend/dist)
              │  api.taqwin.com │──► taqwin-api :4000
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
| Domain | `taqwin.com` and `api.taqwin.com` A records → VPS IP |
| Hostinger VPS | **KVM 2**, Ubuntu 22.04 LTS (or Hostinger Docker template) |
| Supabase | Postgres `DATABASE_URL` + `DIRECT_URL`, Storage bucket `taqwin-uploads` |
| MongoDB Atlas | `MONGODB_URI` — allow VPS outbound IP if IP access list enabled |
| Upstash Redis | `REDIS_URL` for cache and BullMQ |
| Anthropic (or Gemini/Ollama) | Server-side only; see `backend-node/.env.example` |

---

## 3. VPS initial setup

### 3.1 OS packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin git ufw certbot
sudo usermod -aG docker $USER
# Log out and back in so docker group applies
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
- `JWT_SECRET`, `FRONTEND_URL=https://taqwin.com`
- `GOOGLE_*` if using OAuth
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- `MONGODB_URI`, `REDIS_URL`
- `ANTHROPIC_API_KEY` (or `GEMINI_API_KEY` / Ollama for fallback)

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
VITE_API_URL=https://api.taqwin.com npm run build
```

The Compose file mounts `../frontend/dist` into nginx.

---

## 6. TLS certificates

Use Certbot on the host (simplest with nginx in Docker — mount certs from `/etc/letsencrypt`):

```bash
sudo certbot certonly --standalone -d taqwin.com -d www.taqwin.com -d api.taqwin.com
```

Update `deploy/nginx.conf` `ssl_certificate` paths to match your certificate files, or use a host-level nginx cert sync script.

For first boot without TLS, use the HTTP-only server block in comments inside `deploy/nginx.conf.example` and terminate TLS at Hostinger CDN if applicable.

---

## 7. Start stack

```bash
cd /opt/taqwin/deploy
docker compose -f docker-compose.production.yml --env-file .env up -d --build
docker compose -f docker-compose.production.yml ps
docker compose -f docker-compose.production.yml logs -f api
```

### 7.1 Services

| Service | Profile | Description |
|---------|---------|-------------|
| `nginx` | default | SPA + API reverse proxy |
| `api` | default | Express API (`backend-node`) |
| `ai` | `ai` | FastAPI — enable when `ai-service/` exists |
| `worker` | `worker` | BullMQ — enable when worker entry exists |

API-only (current repo):

```bash
docker compose -f docker-compose.production.yml --env-file .env up -d --build nginx api
```

With AI microservice (after Block A2):

```bash
docker compose -f docker-compose.production.yml --env-file .env --profile ai up -d --build
```

---

## 8. Database migrations and seed

Migrations run on API container start (`prisma migrate deploy` in Dockerfile CMD).

One-time seed (optional):

```bash
docker compose -f docker-compose.production.yml --env-file .env exec api npm run db:seed
```

---

## 9. Google OAuth

In Google Cloud Console → **Authorized redirect URIs**:

```text
https://api.taqwin.com/api/auth/google/callback
```

Set in `deploy/.env`:

```text
GOOGLE_CALLBACK_URL=https://api.taqwin.com/api/auth/google/callback
FRONTEND_URL=https://taqwin.com
```

---

## 10. Verification

| Check | Expected |
|-------|----------|
| `curl -s https://api.taqwin.com/health` | `"status":"ok"`, `"database":"connected"` |
| `https://taqwin.com` | SPA loads |
| `curl -s http://<VPS_IP>:8000/health` | **Connection refused** (FastAPI not public) |
| Sign up / login | Email or OAuth → onboarding |
| Demo (if seeded) | `demo@taqwin.app` / `Taqwin#2025` |

---

## 11. Operations

### 11.1 Deploy updates

```bash
cd /opt/taqwin
git pull
cd frontend && npm ci && VITE_API_URL=https://api.taqwin.com npm run build
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
| AI chat 503 | Check `ANTHROPIC_API_KEY` or FastAPI logs; fallback uses Node provider |
| Out of memory | `docker stats`; upgrade to KVM 4 or disable worker until optimized |

---

## 14. Related documents

- [SYSTEM-ARCHITECTURE.md](./SYSTEM-ARCHITECTURE.md) — diagrams and data flow
- [DEPLOY.md](../DEPLOY.md) — Supabase setup and legacy Vercel/Render
- [AI-COACH-ARCHITECTURE.md](../AI-COACH-ARCHITECTURE.md) — AI feature implementation blocks
