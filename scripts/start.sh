#!/bin/bash
set -euo pipefail

echo "[start] agentflow backend — env=${APP_ENV:-development}"

# ── Wait for PostgreSQL ────────────────────────────────────────────────────
echo "[start] Waiting for PostgreSQL..."
until python -c "
import asyncio, asyncpg, os, sys
async def check():
    try:
        conn = await asyncpg.connect(os.environ['DATABASE_URL'])
        await conn.close()
    except Exception as e:
        sys.exit(1)
asyncio.run(check())
" 2>/dev/null; do
    echo "[start] PostgreSQL not ready — retrying in 2s..."
    sleep 2
done
echo "[start] PostgreSQL ready"

# ── Run Alembic migrations ─────────────────────────────────────────────────
echo "[start] Running database migrations..."
alembic upgrade head
echo "[start] Migrations complete"

# ── Start server ───────────────────────────────────────────────────────────
if [ "${APP_ENV:-development}" = "production" ]; then
    echo "[start] Starting gunicorn (workers=${WORKERS:-4})"
    exec gunicorn app.main:app \
        --workers "${WORKERS:-4}" \
        --worker-class uvicorn.workers.UvicornWorker \
        --bind 0.0.0.0:8000 \
        --timeout 120 \
        --graceful-timeout 30 \
        --keep-alive 5 \
        --max-requests 1000 \
        --max-requests-jitter 100 \
        --access-logfile - \
        --error-logfile - \
        --log-level "${LOG_LEVEL:-info}"
else
    echo "[start] Starting uvicorn in reload mode"
    exec uvicorn app.main:app \
        --host 0.0.0.0 \
        --port 8000 \
        --reload \
        --log-level "${LOG_LEVEL:-debug}"
fi
