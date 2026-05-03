from __future__ import annotations

import uuid
from typing import List, Optional, Tuple

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import AgentNameConflictError, AgentNotFoundError
from app.models.agent import Agent
from app.schemas.agent import AgentCreate, AgentUpdate


class AgentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, data: AgentCreate) -> Agent:
        agent = Agent(
            name=data.name,
            description=data.description,
            system_prompt=data.system_prompt,
            llm_model=data.llm_model,
            mcp_servers=[s.model_dump() for s in data.mcp_servers],
            is_supervisor=data.is_supervisor,
            worker_agent_ids=[str(wid) for wid in data.worker_agent_ids],
        )
        self.db.add(agent)
        try:
            await self.db.flush()
            await self.db.refresh(agent)
        except IntegrityError:
            await self.db.rollback()
            raise AgentNameConflictError(data.name)
        return agent

    async def get(self, agent_id: uuid.UUID) -> Agent:
        result = await self.db.execute(select(Agent).where(Agent.id == agent_id))
        agent = result.scalar_one_or_none()
        if agent is None:
            raise AgentNotFoundError(str(agent_id))
        return agent

    async def list(self, skip: int = 0, limit: int = 20) -> Tuple[List[Agent], int]:
        count_result = await self.db.execute(select(func.count()).select_from(Agent))
        total = count_result.scalar_one()

        result = await self.db.execute(
            select(Agent).order_by(Agent.created_at.desc()).offset(skip).limit(limit)
        )
        agents = list(result.scalars().all())
        return agents, total

    async def update(self, agent_id: uuid.UUID, data: AgentUpdate) -> Agent:
        agent = await self.get(agent_id)
        update_data = data.model_dump(exclude_unset=True)

        if "mcp_servers" in update_data and update_data["mcp_servers"] is not None:
            update_data["mcp_servers"] = [
                s.model_dump() if hasattr(s, "model_dump") else s
                for s in data.mcp_servers  # type: ignore[union-attr]
            ]

        if "worker_agent_ids" in update_data and update_data["worker_agent_ids"] is not None:
            update_data["worker_agent_ids"] = [str(wid) for wid in data.worker_agent_ids]  # type: ignore[union-attr]

        for field, value in update_data.items():
            setattr(agent, field, value)

        try:
            await self.db.flush()
            await self.db.refresh(agent)
        except IntegrityError:
            await self.db.rollback()
            raise AgentNameConflictError(data.name or "")

        return agent

    async def delete(self, agent_id: uuid.UUID) -> None:
        agent = await self.get(agent_id)
        await self.db.delete(agent)
        await self.db.flush()
