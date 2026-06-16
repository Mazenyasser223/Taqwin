#!/usr/bin/env bash
# One-shot: pull, DNS check, build, compose up, TLS, verify.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${ROOT}"

VPS_IP="${VPS_IP:-31.187.76.149}"
export VPS_IP

echo "=== Taqwin VPS full deploy ==="

git pull origin main

sed -i 's/\r$//' deploy/scripts/*.sh deploy/scripts/lib/*.sh 2>/dev/null || true
chmod +x deploy/scripts/*.sh

if [[ ! -f deploy/.env ]]; then
  echo "ERROR: deploy/.env missing. Copy from .env.production.example and fill secrets."
  exit 1
fi

# Node for frontend build
if ! command -v npm >/dev/null 2>&1; then
  echo "Installing Node 20 ..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi

bash deploy/scripts/dns-check.sh
bash deploy/scripts/hostinger-deploy.sh
bash deploy/scripts/issue-tls.sh

echo "=== Done ==="
