from __future__ import annotations

import logging
import logging.config
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse, Response
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.core.agent_engine import agent_engine, _setup_sigterm_handler
from app.core.exceptions import (
    AgentFlowException,
    agentflow_exception_handler,
    sqlalchemy_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.middleware import RequestIDMiddleware, RequestLoggingMiddleware
from app.core.websocket_manager import ws_manager
from app.database import check_db_connection, close_db
from app.routers.agents import router as agents_router
from app.routers.mcp import router as mcp_router
from app.routers.runs import router as runs_router
from app.routers.ws import router as ws_router
from app.schemas.agent import InfoResponse


class _DefaultRequestIDFilter(logging.Filter):
    """Inject request_id='-' on any record that doesn't already have one."""

    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "request_id"):
            record.request_id = "-"
        return True


def configure_logging() -> None:
    if settings.is_production:
        import json

        class JsonFormatter(logging.Formatter):
            def format(self, record: logging.LogRecord) -> str:
                payload = {
                    "ts": self.formatTime(record),
                    "level": record.levelname,
                    "logger": record.name,
                    "msg": record.getMessage(),
                    "request_id": getattr(record, "request_id", "-"),
                }
                if record.exc_info:
                    payload["exc"] = self.formatException(record.exc_info)
                for key in ("method", "path", "status_code", "duration_ms", "errors"):
                    if hasattr(record, key):
                        payload[key] = getattr(record, key)
                return json.dumps(payload)

        formatter: logging.Formatter = JsonFormatter()
    else:
        log_format = "%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s"
        formatter = logging.Formatter(log_format)

    rid_filter = _DefaultRequestIDFilter()

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)
    handler.addFilter(rid_filter)

    error_handler = logging.StreamHandler(sys.stderr)
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)
    error_handler.addFilter(rid_filter)

    root = logging.getLogger()
    root.setLevel(getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO))
    root.handlers = [handler, error_handler]

    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if not settings.is_production else logging.WARNING
    )
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)


configure_logging()
logger = logging.getLogger(__name__)


def _providers_configured() -> list[str]:
    configured = []
    if settings.OPENAI_API_KEY:
        configured.append("openai")
    if settings.ANTHROPIC_API_KEY:
        configured.append("anthropic")
    if settings.GOOGLE_API_KEY:
        configured.append("google")
    return configured or ["none"]


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    from sqlalchemy import func, select
    from app.database import AsyncSessionLocal
    from app.models.agent import Agent

    _setup_sigterm_handler()

    db_ok = await check_db_connection()
    agent_count = 0
    if db_ok:
        try:
            async with AsyncSessionLocal() as session:
                result = await session.execute(select(func.count()).select_from(Agent))
                agent_count = result.scalar_one()
        except Exception:
            pass

    providers = _providers_configured()
    logger.info(
        "agentflow-platform v%s (%s) started | db=%s | agents=%d | providers=%s | cache_maxsize=%d",
        settings.APP_VERSION,
        settings.APP_ENV,
        "ok" if db_ok else "unavailable",
        agent_count,
        ",".join(providers),
        agent_engine.cache_stats()["maxsize"],
    )

    yield

    logger.info("Shutting down — notifying WebSocket clients and cancelling agent tasks")
    await ws_manager.notify_server_restart()
    await agent_engine.shutdown()
    await close_db()
    logger.info("Shutdown complete")


# ── Prometheus metrics setup ───────────────────────────────────────────────

try:
    from prometheus_client import Counter, Gauge, Histogram, generate_latest, CONTENT_TYPE_LATEST

    _prom_requests = Counter(
        "agentflow_total_requests_total",
        "Total HTTP requests",
        ["method", "path", "status"],
    )
    _prom_active_ws = Gauge("agentflow_active_websockets", "Active WebSocket connections")
    _prom_agent_runs = Counter(
        "agentflow_agent_runs_total",
        "Total agent runs",
        ["agent_id", "status"],
    )
    _prom_run_duration = Histogram(
        "agentflow_agent_run_duration_seconds",
        "Agent run duration in seconds",
        buckets=[0.5, 1, 2, 5, 10, 30, 60, 120, 300],
    )
    _prom_mcp_conns = Gauge("agentflow_mcp_connections_active", "Active MCP connections")
    _PROMETHEUS_AVAILABLE = True
except ImportError:
    _PROMETHEUS_AVAILABLE = False


# ── App factory ────────────────────────────────────────────────────────────

app = FastAPI(
    title="AgentFlow Platform API",
    description="Production-ready multi-agent AI platform.",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/api/v1/openapi.json",
    lifespan=lifespan,
)

# --- Middleware (order matters: first added = outermost) ---
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIDMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 10 MB request body limit
@app.middleware("http")
async def _limit_body_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > 10 * 1024 * 1024:
        return JSONResponse(status_code=413, content={"detail": "Request body too large (max 10 MB)"})
    return await call_next(request)


# Prometheus request counter middleware
if _PROMETHEUS_AVAILABLE:
    @app.middleware("http")
    async def _track_metrics(request: Request, call_next):
        response = await call_next(request)
        path = request.url.path
        # Collapse agent_id path params to avoid high-cardinality labels
        import re
        path_label = re.sub(
            r"/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            "/{id}",
            path,
        )
        _prom_requests.labels(
            method=request.method,
            path=path_label,
            status=str(response.status_code),
        ).inc()
        return response


# --- Exception handlers ---
app.add_exception_handler(AgentFlowException, agentflow_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_exception_handler)

# --- Routers ---
app.include_router(agents_router, prefix="/api/v1")
app.include_router(runs_router, prefix="/api/v1")
app.include_router(mcp_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")


# ── Built-in endpoints ─────────────────────────────────────────────────────

@app.get("/api/v1/info", response_model=InfoResponse, tags=["System"])
async def get_info() -> InfoResponse:
    from sqlalchemy import func, select
    from app.database import AsyncSessionLocal
    from app.models.agent import Agent

    agent_count = 0
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(func.count()).select_from(Agent))
            agent_count = result.scalar_one()
    except Exception:
        pass

    cache = agent_engine.cache_stats()
    return InfoResponse(
        name="agentflow-platform",
        version=settings.APP_VERSION,
        env=settings.APP_ENV,
        providers_configured=_providers_configured(),
        agent_count=agent_count,
        active_websockets=ws_manager.active_count(),
        cache_size=cache["size"],
        cache_maxsize=cache["maxsize"],
    )


@app.get("/metrics", tags=["System"], include_in_schema=False)
async def prometheus_metrics() -> Response:
    if not _PROMETHEUS_AVAILABLE:
        return Response(status_code=503, content="Prometheus client not installed")
    # Update gauge for active WebSockets
    _prom_active_ws.set(ws_manager.active_count())
    return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)
