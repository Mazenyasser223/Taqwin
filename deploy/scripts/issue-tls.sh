#!/usr/bin/env bash
# Phase 0.2 — issue Let's Encrypt cert (webroot) and switch nginx to HTTPS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY="${SCRIPT_DIR}/.."
ENV_FILE="${DEPLOY}/.env"
cd "${DEPLOY}"

# shellcheck source=lib/domain.sh
source "${SCRIPT_DIR}/lib/domain.sh"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}"
  exit 1
fi

# shellcheck source=lib/load-env.sh
source "${SCRIPT_DIR}/lib/load-env.sh"
load_deploy_env "${ENV_FILE}"

DOMAIN="${TAQWIN_DOMAIN:-${DOMAIN}}"
API_DOMAIN="api.${DOMAIN}"

EMAIL="${CERTBOT_EMAIL:-}"
if [[ -z "${EMAIL}" ]]; then
  echo "Set CERTBOT_EMAIL in deploy/.env (used for Let's Encrypt expiry notices)"
  exit 1
fi

sudo mkdir -p /var/www/certbot
sudo chmod 755 /var/www/certbot

echo "Requesting certificate for ${DOMAIN} (nginx must be serving HTTP on port 80) ..."
sudo certbot certonly --webroot \
  -w /var/www/certbot \
  -d "${DOMAIN}" \
  -d "www.${DOMAIN}" \
  -d "${API_DOMAIN}" \
  --email "${EMAIL}" \
  --agree-tos \
  --no-eff-email \
  --non-interactive

if grep -q '^NGINX_CONF_FILE=' "${ENV_FILE}"; then
  sed -i.bak 's|^NGINX_CONF_FILE=.*|NGINX_CONF_FILE=./nginx.https.conf|' "${ENV_FILE}"
else
  echo 'NGINX_CONF_FILE=./nginx.https.conf' >> "${ENV_FILE}"
fi

echo "Recreating nginx with HTTPS config ..."
docker compose -f docker-compose.production.yml --env-file .env up -d nginx
docker compose -f docker-compose.production.yml exec nginx nginx -t
docker compose -f docker-compose.production.yml exec nginx nginx -s reload

echo ""
echo "TLS enabled for ${DOMAIN}. Run: bash deploy/scripts/verify-production.sh"
echo ""
echo "Renewal (add to crontab on VPS):"
echo '  0 3 * * * certbot renew --quiet --deploy-hook "cd /opt/taqwin/deploy && docker compose -f docker-compose.production.yml exec nginx nginx -s reload"'
