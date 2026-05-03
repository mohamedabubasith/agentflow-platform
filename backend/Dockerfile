# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Security: non-root user
RUN groupadd -r appgroup && useradd -r -g appgroup -d /app -s /sbin/nologin appuser

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY alembic.ini .
COPY alembic/ alembic/
COPY app/ app/

# Fix ownership
RUN chown -R appuser:appgroup /app

USER appuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health')" || exit 1

# (2 × CPU_COUNT) + 1 workers; default assumes 2 CPUs → 5 workers
# Override with GUNICORN_WORKERS env var at runtime
CMD ["sh", "-c", \
     "gunicorn app.main:app \
      --workers ${GUNICORN_WORKERS:-5} \
      --worker-class uvicorn.workers.UvicornWorker \
      --bind 0.0.0.0:8000 \
      --timeout 120 \
      --graceful-timeout 30 \
      --keep-alive 5 \
      --access-logfile - \
      --error-logfile -"]
