#!/usr/bin/env bash
# Phase 0.1–0.2 — smoke checks after deploy + TLS.
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

API="${API_BASE:-https://${API_DOMAIN}}"
SPA="${SPA_BASE:-https://${DOMAIN}}"
FAIL=0

check() {
  local label="$1"
  local url="$2"
  local expect="$3"
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' --max-time 15 "${url}" 2>/dev/null || echo "000")"
  if [[ "${code}" == "${expect}" ]]; then
    echo "OK    ${label} (${code})"
  else
    echo "FAIL  ${label} — ${url} → ${code} (expected ${expect})"
    FAIL=1
  fi
}

echo "=== Taqwin production verify (${DOMAIN}) ==="
echo ""

if curl -sf --max-time 15 "${API}/health" | grep -q '"status"'; then
  echo "OK    API /health JSON"
  curl -sf "${API}/health" | head -c 500
  echo ""
else
  echo "FAIL  API /health — ${API}/health"
  FAIL=1
fi

check "SPA home" "${SPA}/" "200"
check "Internal API blocked" "${API}/api/internal/ai/tools/list" "403"

echo ""
if [[ "${FAIL}" -eq 0 ]]; then
  echo "Phase 0.1–0.2 checks passed."
  exit 0
fi
echo "One or more checks failed — see deploy/CHECKLIST-0.1-0.2.md"
exit 1
