#!/bin/bash
# Container health check — exits 0 if the API returns HTTP 200, 1 otherwise.
HOST="${HEALTH_HOST:-localhost}"
PORT="${HEALTH_PORT:-8000}"
TIMEOUT="${HEALTH_TIMEOUT:-5}"

curl -sf --max-time "$TIMEOUT" "http://${HOST}:${PORT}/api/v1/health" >/dev/null 2>&1
