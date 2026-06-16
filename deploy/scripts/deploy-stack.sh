#!/usr/bin/env bash
# Phase 0.1 — build frontend + start Docker stack (HTTP bootstrap).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
DEPLOY="${ROOT}/deploy"
ENV_FILE="${DEPLOY}/.env"

# shellcheck source=lib/domain.sh
source "${SCRIPT_DIR}/lib/domain.sh"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=lib/load-env.sh
  source "${SCRIPT_DIR}/lib/load-env.sh"
  load_deploy_env "${ENV_FILE}"
  DOMAIN="${TAQWIN_DOMAIN:-${DOMAIN}}"
  API_DOMAIN="api.${DOMAIN}"
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE} — run: cp deploy/.env.production.example deploy/.env && nano deploy/.env"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm not found — install Node 20 on the VPS, then re-run:"
  echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -"
  echo "  apt install -y nodejs"
  echo "Or build on your PC: cd frontend && VITE_API_URL=https://${API_DOMAIN} npm run build"
  echo "Then scp -r frontend/dist root@<VPS_IP>:/opt/taqwin/frontend/"
  exit 1
fi

API_URL="${VITE_API_URL:-https://${API_DOMAIN}}"
echo "Building frontend with VITE_API_URL=${API_URL} ..."
cd "${ROOT}/frontend"
# deploy/.env sets NODE_ENV=production — must include devDeps (vite) for the build
npm ci --include=dev
VITE_API_URL="${API_URL}" npm run build

echo "Starting full Docker stack (api + ai + worker + nginx) ..."
cd "${DEPLOY}"
docker compose -f docker-compose.production.yml --env-file .env up -d --build

echo ""
docker compose -f docker-compose.production.yml ps
echo ""
echo "Deployed: frontend/dist → nginx | backend-node → api + worker | ai-service → ai"
echo ""
echo "Checks:"
echo "  curl -s https://${API_DOMAIN}/health"
echo "  curl -s -o /dev/null -w '%{http_code}' https://${DOMAIN}/"
echo ""
echo "First-time TLS only: bash deploy/scripts/issue-tls.sh"
echo "Routine updates:       bash deploy/scripts/hostinger-deploy.sh"
