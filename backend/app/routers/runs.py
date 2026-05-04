from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.agent import Agent, RunHistory
from app.schemas.agent import RunHistoryListResponse, RunHistoryResponse, RunStatsResponse
from app.core.exceptions import AgentFlowException

router = APIRouter()


def _require_agent_exists(agent_id: uuid.UUID):
    async def _check(db: AsyncSession = Depends(get_db)) -> AsyncSession:
        result = await db.execute(select(Agent.id).where(Agent.id == agent_id))
        if result.scalar_one_or_none() is None:
            raise AgentFlowException(status_code=404, detail=f"Agent {agent_id} not found")
        return db
    return _check


@router.get(
    "/agents/{agent_id}/runs",
    response_model=RunHistoryListResponse,
    tags=["Runs"],
)
async def list_runs(
    agent_id: uuid.UUID,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    db: AsyncSession = Depends(get_db),
) -> RunHistoryListResponse:
    # Verify agent exists
    agent_result = await db.execute(select(Agent.id).where(Agent.id == agent_id))
    if agent_result.scalar_one_or_none() is None:
        raise AgentFlowException(status_code=404, detail=f"Agent {agent_id} not found")

    count_result = await db.execute(
        select(func.count()).where(RunHistory.agent_id == agent_id)
    )
    total = count_result.scalar_one()

    rows_result = await db.execute(
        select(RunHistory)
        .where(RunHistory.agent_id == agent_id)
        .order_by(RunHistory.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    rows = list(rows_result.scalars().all())

    return RunHistoryListResponse(
        items=[RunHistoryResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


@router.get(
    "/agents/{agent_id}/runs/stats",
    response_model=RunStatsResponse,
    tags=["Runs"],
)
async def get_run_stats(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> RunStatsResponse:
    from datetime import datetime, timedelta, timezone

    agent_result = await db.execute(select(Agent.id).where(Agent.id == agent_id))
    if agent_result.scalar_one_or_none() is None:
        raise AgentFlowException(status_code=404, detail=f"Agent {agent_id} not found")

    agg_result = await db.execute(
        select(
            func.count().label("total_runs"),
            func.coalesce(func.sum(RunHistory.total_tokens), 0).label("total_tokens"),
            func.coalesce(func.avg(RunHistory.duration_ms), 0.0).label("avg_duration_ms"),
        ).where(RunHistory.agent_id == agent_id)
    )
    row = agg_result.one()

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_result = await db.execute(
        select(func.count()).where(
            RunHistory.agent_id == agent_id,
            RunHistory.created_at >= cutoff,
        )
    )
    runs_last_7_days = recent_result.scalar_one()

    # Most-used tools: aggregate tool names from mcp_servers_used JSONB arrays
    # Each row stores a list of {name, url} objects — extract the "name" field
    tools_result = await db.execute(
        select(
            func.jsonb_array_elements(RunHistory.mcp_servers_used).op("->>")(  # type: ignore[operator]
                "name"
            ).label("tool_name"),
            func.count().label("cnt"),
        )
        .where(RunHistory.agent_id == agent_id)
        .group_by("tool_name")
        .order_by(func.count().desc())
        .limit(5)
    )
    most_used_tools = [{"name": r.tool_name, "count": r.cnt} for r in tools_result if r.tool_name]

    return RunStatsResponse(
        total_runs=row.total_runs,
        total_tokens=int(row.total_tokens),
        avg_duration_ms=float(row.avg_duration_ms),
        runs_last_7_days=runs_last_7_days,
        most_used_tools=most_used_tools,
    )


@router.delete(
    "/agents/{agent_id}/runs",
    status_code=status.HTTP_204_NO_CONTENT,
    response_model=None,
    tags=["Runs"],
)
async def delete_runs(
    agent_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    agent_result = await db.execute(select(Agent.id).where(Agent.id == agent_id))
    if agent_result.scalar_one_or_none() is None:
        raise AgentFlowException(status_code=404, detail=f"Agent {agent_id} not found")

    await db.execute(delete(RunHistory).where(RunHistory.agent_id == agent_id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
