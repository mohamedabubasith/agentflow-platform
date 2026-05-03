from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import check_db_connection, get_db
from app.schemas.agent import (
    AgentCreate,
    AgentListResponse,
    AgentResponse,
    AgentUpdate,
    HealthResponse,
)
from app.services.agent_service import AgentService
from app.config import settings

router = APIRouter()


def get_agent_service(db: AsyncSession = Depends(get_db)) -> AgentService:
    return AgentService(db)


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    db_ok = await check_db_connection()
    return HealthResponse(
        status="ok" if db_ok else "degraded",
        db="connected" if db_ok else "unavailable",
        version=settings.APP_VERSION,
    )


@router.post(
    "/agents",
    response_model=AgentResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Agents"],
)
async def create_agent(
    payload: AgentCreate,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    agent = await service.create(payload)
    return AgentResponse.model_validate(agent)


@router.get("/agents", response_model=AgentListResponse, tags=["Agents"])
async def list_agents(
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    service: AgentService = Depends(get_agent_service),
) -> AgentListResponse:
    agents, total = await service.list(skip=skip, limit=limit)
    return AgentListResponse(
        items=[AgentResponse.model_validate(a) for a in agents],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get("/agents/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def get_agent(
    agent_id: uuid.UUID,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    agent = await service.get(agent_id)
    return AgentResponse.model_validate(agent)


@router.put("/agents/{agent_id}", response_model=AgentResponse, tags=["Agents"])
async def update_agent(
    agent_id: uuid.UUID,
    payload: AgentUpdate,
    service: AgentService = Depends(get_agent_service),
) -> AgentResponse:
    agent = await service.update(agent_id, payload)
    return AgentResponse.model_validate(agent)


@router.delete(
    "/agents/{agent_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    tags=["Agents"],
)
async def delete_agent(
    agent_id: uuid.UUID,
    service: AgentService = Depends(get_agent_service),
) -> Response:
    await service.delete(agent_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
