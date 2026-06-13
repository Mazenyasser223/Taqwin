#!/usr/bin/env bash
# Source from deploy/scripts/*.sh — sets DOMAIN from deploy/.env or default.
DOMAIN="${TAQWIN_DOMAIN:-taqwin.online}"
API_DOMAIN="api.${DOMAIN}"
