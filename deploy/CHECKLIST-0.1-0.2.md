# Phase 0.1–0.2 — Deploy + DNS + TLS

Runbook for **Hostinger KVM 2**. Master plan tasks **0.1** and **0.2**.

| Task | Done when |
|------|-----------|
| **0.1** Deploy Docker stack | `docker compose ps` shows nginx, api, ai, worker healthy |
| **0.2** DNS + TLS | `https://api.taqwin.online/health` 200, SPA on `https://taqwin.online` |

Full reference: [docs/DEPLOY-HOSTINGER.md](../docs/DEPLOY-HOSTINGER.md)

---

## Prerequisites

- Hostinger **KVM 2** VPS (Ubuntu **22.04** or **24.04**), public IPv4 noted as `VPS_IP`
- Domain **taqwin.online** on Hostinger (or DNS you control)
- Supabase, MongoDB Atlas, Upstash Redis credentials ready
- SSH access: `ssh root@<VPS_IP>` or your sudo user

---

## Step 1 — VPS packages (once)

```bash
apt update && apt upgrade -y
apt install -y ca-certificates curl git ufw certbot dnsutils

# Docker Engine + Compose v2 (Ubuntu 24.04 default repos do NOT ship docker-compose-plugin)
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

docker compose version   # must print v2.x

# Node 20 — required to build frontend/dist on the VPS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node -v && npm -v

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

---

## Step 2 — DNS (Hostinger hPanel)

**Domains → taqwin.online → DNS zone** — add A records pointing to `VPS_IP`:

| Type | Name | Value |
|------|------|-------|
| A | `@` | `<VPS_IP>` |
| A | `www` | `<VPS_IP>` |
| A | `api` | `<VPS_IP>` |

**Important:** If `@` or `www` already point elsewhere (e.g. `76.x.x.x` parking page), **edit** those records — do not add duplicates. Remove conflicting A/CNAME rows for `@`, `www`, and `api` first.

Wait 5–30 minutes for propagation, then on the VPS:

```bash
cd /opt/taqwin
VPS_IP=<your-vps-ip> bash deploy/scripts/dns-check.sh
```

---

## Step 3 — Clone + env

```bash
sudo mkdir -p /opt/taqwin && sudo chown $USER:$USER /opt/taqwin
git clone https://github.com/Mazenyasser223/Taqwin.git /opt/taqwin
cd /opt/taqwin

cp deploy/.env.production.example deploy/.env
nano deploy/.env   # fill DATABASE_URL, JWT_SECRET, AI keys, CERTBOT_EMAIL, etc.
```

Minimum before first boot:

- `DATABASE_URL`, `DIRECT_URL`, `MONGO_URI`, `REDIS_URL`
- `JWT_SECRET`, `AI_INTERNAL_KEY`, `ANTHROPIC_API_KEY`
- `FRONTEND_URL=https://taqwin.online`
- `GOOGLE_CALLBACK_URL=https://api.taqwin.online/api/auth/google/callback` (if OAuth)
- `CERTBOT_EMAIL=you@example.com`

---

## Step 4 — Deploy stack (0.1)

```bash
bash deploy/scripts/deploy-stack.sh
```

Or manually:

```bash
cd frontend && npm ci && VITE_API_URL=https://api.taqwin.online npm run build
cd ../deploy
docker compose -f docker-compose.production.yml --env-file .env up -d --build
```

Verify HTTP (before TLS):

```bash
curl -s http://api.taqwin.online/health
curl -s -o /dev/null -w "%{http_code}\n" http://taqwin.online
```

---

## Step 5 — TLS (0.2)

Ensure port **80** is reachable (Certbot webroot). Then:

```bash
bash deploy/scripts/issue-tls.sh
```

This:

1. Issues a cert for `taqwin.online`, `www.taqwin.online`, `api.taqwin.online`
2. Sets `NGINX_CONF_FILE=./nginx.https.conf` in `deploy/.env`
3. Reloads nginx with HTTPS + HTTP→HTTPS redirect

Verify:

```bash
bash deploy/scripts/verify-production.sh
```

Expected:

- `https://api.taqwin.online/health` → `"status":"ok"`
- `https://api.taqwin.online/api/internal/...` → **403**
- `https://taqwin.online` → SPA loads

---

## Step 6 — Google OAuth (if used)

Google Cloud Console → **Authorized redirect URIs**:

```text
https://api.taqwin.online/api/auth/google/callback
```

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `dns-check` fails | Wait for DNS; confirm A records in hPanel |
| Certbot fails | Port 80 blocked — check UFW, Hostinger firewall |
| nginx SSL error | Cert path must be `/etc/letsencrypt/live/taqwin.online/` |
| API 502 | `docker compose logs api ai` — DB/Redis/Mongo connectivity |
| Chat 502 | Ensure `ai` service healthy; `AI_INTERNAL_KEY` matches in `.env` |
| SPA blank | Rebuild frontend: `VITE_API_URL=https://api.taqwin.online npm run build` |

---

## Next (Phase 0.3+)

After 0.1–0.2: prod migrations (auto on API start), RAG ingest, worker crons, Sentry, legal pages — see [TAQWIN-MASTER-PLAN.md §11](../docs/TAQWIN-MASTER-PLAN.md).
