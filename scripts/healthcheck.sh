#!/bin/bash
# Container health check — called by Docker HEALTHCHECK instruction.
# Exits 0 if healthy, 1 if unhealthy.

HOST="${HEALTH_HOST:-localhost}"
PORT="${HEALTH_PORT:-8000}"
TIMEOUT="${HEALTH_TIMEOUT:-5}"
ENDPOINT="http://${HOST}:${PORT}/api/v1/health"

response=$(curl -sf --max-time "$TIMEOUT" "$ENDPOINT" 2>/dev/null)
exit_code=$?

if [ $exit_code -ne 0 ]; then
    echo "[healthcheck] FAIL: curl returned $exit_code for $ENDPOINT"
    exit 1
fi

# Parse the status field from JSON response
status=$(echo "$response" | python -c "
import json, sys
try:
    data = json.load(sys.stdin)
    print(data.get('status', 'unknown'))
except Exception:
    print('parse_error')
" 2>/dev/null)

if [ "$status" = "ok" ] || [ "$status" = "degraded" ]; then
    echo "[healthcheck] OK: status=${status}"
    exit 0
else
    echo "[healthcheck] FAIL: unexpected status='${status}' from $ENDPOINT"
    exit 1
fi
