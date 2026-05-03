from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Tuple

if TYPE_CHECKING:
    from app.models.agent import Agent

logger = logging.getLogger(__name__)

_CACHE_TTL = 60  # seconds
_MAX_ITERATIONS = 25
_RUN_SEMAPHORE = asyncio.Semaphore(50)


class _CacheEntry:
    def __init__(self, graph: Any) -> None:
        self.graph = graph
        self.ts = time.monotonic()

    def is_fresh(self) -> bool:
        return (time.monotonic() - self.ts) < _CACHE_TTL


class AgentEngine:
    """Builds and caches compiled LangGraph agents."""

    def __init__(self) -> None:
        self._cache: Dict[str, _CacheEntry] = {}
        self._lock = asyncio.Lock()

    def _cache_key(self, agent: "Agent") -> str:
        payload = json.dumps(
            {
                "id": str(agent.id),
                "updated_at": agent.updated_at.isoformat(),
                "llm_provider": agent.llm_provider,
                "llm_model": agent.llm_model,
                "llm_temperature": agent.llm_temperature,
                "llm_max_tokens": agent.llm_max_tokens,
                "mcp_servers": agent.mcp_servers,
            },
            sort_keys=True,
        )
        return hashlib.sha256(payload.encode()).hexdigest()

    async def build_agent(
        self,
        agent: "Agent",
        tools_override: Optional[List[Any]] = None,
    ) -> Any:
        key = self._cache_key(agent)
        async with self._lock:
            entry = self._cache.get(key)
            if entry and entry.is_fresh():
                logger.debug("rid=- Agent cache HIT for agent_id=%s", agent.id)
                return entry.graph

        graph = await self._compile_agent(agent, tools_override)

        async with self._lock:
            self._cache[key] = _CacheEntry(graph)

        return graph

    async def _compile_agent(self, agent: "Agent", tools_override: Optional[List[Any]]) -> Any:
        from langgraph.prebuilt import create_react_agent
        from app.core.llm_factory import build_llm
        from app.core.mcp_manager import MCPManager

        llm = build_llm(agent)

        if tools_override is not None:
            tools = tools_override
        else:
            async with MCPManager() as mcp:
                tools = await mcp.connect(agent.mcp_servers or [])

        graph = create_react_agent(
            model=llm,
            tools=tools,
            state_modifier=agent.system_prompt or None,
        )
        return graph

    async def build_supervisor(
        self,
        supervisor: "Agent",
        workers: List["Agent"],
    ) -> Any:
        from langgraph_supervisor import create_supervisor
        from app.core.llm_factory import build_llm

        supervisor_llm = build_llm(supervisor)
        worker_graphs = []

        for w in workers:
            graph = await self.build_agent(w)
            worker_graphs.append((w.name, graph))

        compiled = create_supervisor(
            agents=[g for _, g in worker_graphs],
            model=supervisor_llm,
            prompt=supervisor.system_prompt or None,
            full_history=True,
        )
        return compiled

    def invalidate(self, agent_id: str) -> None:
        self._cache = {k: v for k, v in self._cache.items() if agent_id not in k}


agent_engine = AgentEngine()
