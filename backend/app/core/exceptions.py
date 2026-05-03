from __future__ import annotations

import traceback as tb_module

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import logging

logger = logging.getLogger(__name__)


class AgentFlowException(HTTPException):
    def __init__(self, status_code: int, error_code: str, message: str) -> None:
        super().__init__(status_code=status_code, detail={"error_code": error_code, "message": message})


class AgentNotFoundError(AgentFlowException):
    def __init__(self, agent_id: str) -> None:
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="AGENT_NOT_FOUND",
            message=f"Agent with id '{agent_id}' not found.",
        )


class AgentNameConflictError(AgentFlowException):
    def __init__(self, name: str) -> None:
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            error_code="AGENT_NAME_CONFLICT",
            message=f"An agent with name '{name}' already exists.",
        )


class DatabaseUnavailableError(AgentFlowException):
    def __init__(self) -> None:
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="DATABASE_UNAVAILABLE",
            message="Database is temporarily unavailable. Please try again later.",
        )


def _rid(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


async def agentflow_exception_handler(request: Request, exc: AgentFlowException) -> JSONResponse:
    logger.warning(
        "AgentFlowException rid=%s path=%s status=%s detail=%s",
        _rid(request), request.url.path, exc.status_code, exc.detail,
    )
    return JSONResponse(status_code=exc.status_code, content=exc.detail)


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    errors = [
        {
            "field": ".".join(str(loc) for loc in e["loc"]),
            "message": e["msg"],
            "type": e["type"],
        }
        for e in exc.errors()
    ]
    logger.warning(
        "Validation error rid=%s path=%s errors=%s",
        _rid(request), request.url.path, errors,
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"error_code": "VALIDATION_ERROR", "message": "Request validation failed.", "errors": errors},
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.error(
        "Database error rid=%s path=%s",
        _rid(request), request.url.path,
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"error_code": "DATABASE_ERROR", "message": "A database error occurred."},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception rid=%s path=%s\n%s",
        _rid(request), request.url.path, tb_module.format_exc(),
        exc_info=True,
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error_code": "INTERNAL_ERROR", "message": "An internal server error occurred."},
    )
