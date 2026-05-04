# Build context: project root (docker-compose sets context: .)
# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

COPY backend/requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# curl needed for HEALTHCHECK
RUN apt-get update && apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Security: non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

WORKDIR /app

# Python packages
COPY --from=builder /install /usr/local

# Application source (paths relative to project-root build context)
COPY backend/alembic.ini .
COPY backend/alembic/ alembic/
COPY backend/app/ app/

# Entrypoint scripts
COPY scripts/start.sh       scripts/start.sh
COPY scripts/migrate.sh     scripts/migrate.sh
COPY scripts/healthcheck.sh scripts/healthcheck.sh
RUN chmod +x scripts/start.sh scripts/migrate.sh scripts/healthcheck.sh

# Fix ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD ["/app/scripts/healthcheck.sh"]

CMD ["/app/scripts/start.sh"]
