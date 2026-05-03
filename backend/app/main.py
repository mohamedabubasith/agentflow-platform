from __future__ import annotations

import logging
import logging.config
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.core.exceptions import (
    AgentFlowException,
    agentflow_exception_handler,
    sqlalchemy_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
from app.core.middleware import RequestIDMiddleware, RequestLoggingMiddleware
from app.database import check_db_connection, close_db
from app.routers.agents import router as agents_router


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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Starting agentflow-platform v%s (%s)", settings.APP_VERSION, settings.APP_ENV)

    db_ok = await check_db_connection()
    if db_ok:
        logger.info("Database connection: OK")
    else:
        logger.warning("Database connection: UNAVAILABLE — starting in degraded mode")

    yield

    logger.info("Shutting down — closing database pool")
    await close_db()
    logger.info("Shutdown complete")


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

# --- Exception handlers ---
app.add_exception_handler(AgentFlowException, agentflow_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_exception_handler)

# --- Routers ---
app.include_router(agents_router, prefix="/api/v1")
