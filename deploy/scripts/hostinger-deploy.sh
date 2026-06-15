#!/usr/bin/env bash
# One-shot Hostinger update: git pull + frontend build + api + ai + worker + nginx.
# Usage (on VPS): bash deploy/scripts/hostinger-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"

echo "=== Taqwin Hostinger — full stack deploy ==="
echo "    frontend (SPA) + backend (api) + AI (FastAPI) + worker + nginx"
echo ""

git fetch origin "${DEPLOY_BRANCH}"
git checkout "${DEPLOY_BRANCH}"
git pull origin "${DEPLOY_BRANCH}"

sed -i 's/\r$//' deploy/scripts/*.sh deploy/scripts/lib/*.sh 2>/dev/null || true
chmod +x deploy/scripts/*.sh

if [[ ! -f deploy/.env ]]; then
  echo "ERROR: deploy/.env missing — cp deploy/.env.production.example deploy/.env && nano deploy/.env"
  exit 1
fi

bash deploy/scripts/deploy-stack.sh
bash deploy/scripts/verify-production.sh

echo ""
echo "=== AI (internal Docker network) ==="
cd "${ROOT}/deploy"
if docker compose -f docker-compose.production.yml exec -T api wget -qO- http://ai:8000/health 2>/dev/null; then
  echo ""
  echo "OK    ai-service /health"
else
  echo "WARN  ai-service health failed — run: docker compose -f docker-compose.production.yml logs ai"
fi

echo ""
echo "=== Stack status ==="
docker compose -f docker-compose.production.yml ps

echo ""
echo "Done. All services deployed from branch: ${DEPLOY_BRANCH}"
