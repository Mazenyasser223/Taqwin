#!/usr/bin/env bash
# Strip Windows CRLF from deploy/.env before sourcing (scp from Windows).
normalize_env_file() {
  local f="$1"
  [[ -f "$f" ]] || return 0
  if grep -q $'\r' "$f" 2>/dev/null; then
    sed -i 's/\r$//' "$f"
  fi
}

load_deploy_env() {
  local f="$1"
  normalize_env_file "$f"
  # shellcheck disable=SC1090
  set -a
  source "$f"
  set +a
}
