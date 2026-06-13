#!/usr/bin/env bash
# Phase 0.2 — verify DNS A records point at this VPS before TLS.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=lib/domain.sh
source "${SCRIPT_DIR}/lib/domain.sh"

ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  set -a
  source "${ENV_FILE}"
  set +a
  DOMAIN="${TAQWIN_DOMAIN:-${DOMAIN}}"
  API_DOMAIN="api.${DOMAIN}"
fi

EXPECTED="${VPS_IP:-$(curl -sf --max-time 10 ifconfig.me 2>/dev/null || curl -sf --max-time 10 icanhazip.com 2>/dev/null || true)}"
if [[ -z "${EXPECTED}" ]]; then
  echo "Set VPS_IP to your Hostinger public IPv4, e.g.: VPS_IP=1.2.3.4 $0"
  exit 1
fi

HOSTS=("${DOMAIN}" "www.${DOMAIN}" "${API_DOMAIN}")
FAIL=0

echo "Domain: ${DOMAIN}"
echo "Expected VPS IP: ${EXPECTED}"
echo ""

for host in "${HOSTS[@]}"; do
  resolved="$(dig +short "${host}" A 2>/dev/null | grep -E '^[0-9.]+$' | tail -1 || true)"
  if [[ -z "${resolved}" ]]; then
    echo "FAIL  ${host} — no A record (add in Hostinger → Domains → ${DOMAIN} → DNS)"
    FAIL=1
  elif [[ "${resolved}" == "${EXPECTED}" ]]; then
    echo "OK    ${host} → ${resolved}"
  else
    echo "WARN  ${host} → ${resolved} (expected ${EXPECTED})"
    FAIL=1
  fi
done

echo ""
if [[ "${FAIL}" -eq 0 ]]; then
  echo "DNS looks good. Proceed with deploy/scripts/deploy-stack.sh then issue-tls.sh"
  exit 0
fi

echo "Fix DNS in Hostinger (hPanel → Domains → ${DOMAIN} → DNS)."
echo "  Type A  @    → ${EXPECTED}"
echo "  Type A  www  → ${EXPECTED}  (or CNAME www → ${DOMAIN})"
echo "  Type A  api  → ${EXPECTED}"
exit 1
