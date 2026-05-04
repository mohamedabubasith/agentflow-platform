#!/bin/bash
set -euo pipefail

# Standalone migration runner — useful for CI/CD or manual runs.
# Usage:
#   ./scripts/migrate.sh                 # upgrade to head
#   ./scripts/migrate.sh downgrade -1    # one step back
#   ./scripts/migrate.sh history         # show migration history
#   ./scripts/migrate.sh current         # show current revision

COMMAND="${1:-upgrade}"
ARG="${2:-head}"

echo "[migrate] Running: alembic ${COMMAND} ${ARG}"

cd /app 2>/dev/null || cd "$(dirname "$0")/../backend"

case "$COMMAND" in
    upgrade)
        alembic upgrade "$ARG"
        echo "[migrate] Upgrade complete"
        ;;
    downgrade)
        alembic downgrade "$ARG"
        echo "[migrate] Downgrade complete"
        ;;
    history)
        alembic history --verbose
        ;;
    current)
        alembic current
        ;;
    heads)
        alembic heads
        ;;
    revision)
        # Generate a new migration: ./scripts/migrate.sh revision "add_user_table"
        alembic revision --autogenerate -m "${2:-auto_migration}"
        echo "[migrate] Revision created"
        ;;
    *)
        echo "Usage: $0 {upgrade|downgrade|history|current|heads|revision} [arg]"
        exit 1
        ;;
esac
