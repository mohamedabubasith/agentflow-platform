from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import signal
import time
import uuid
from collections import OrderedDict
from typing import TYPE_CHECKING, Any, Dict, List, Optional, Set

if TYPE_CHECKING:
    from app.models.agent import Agent

logger = logging.getLogger(__name__)

_CACHE_TTL = 60        # seconds — reuse compiled graph if config unchanged
_CACHE_MAXSIZE = 50    # LRU eviction when limit reached
_RUN_SEMAPHORE = asyncio.Semaphore(50)
_RUN_TIMEOUT = 300     # 5 minutes hard limit per run


# ── LRU cache entry ────────────────────────────────────────────────────────
class _CacheEntry:
    __slots__ = ("graph", "ts")

    def __init__(self, graph: Any) -> None:
        self.graph = graph
        self.ts = time.monotonic()

    def is_fresh(self) -> bool:
        return (time.monotonic() - self.ts) < _CACHE_TTL


class AgentEngine:
    """
    Builds and LRU-caches compiled LangGraph agents.

    Cache key = SHA-256 of (agent_id, updated_at, llm config, mcp_servers).
    Cache is invalidated on agent update/delete via invalidate().
    Tracks active run tasks for graceful SIGTERM shutdown.
    """

    def __init__(self) -> None:
        # OrderedDict gives us O(1) LRU by moving accessed keys to end
        self._cache: OrderedDict[str, _CacheEntry] = OrderedDict()
        self._lock = asyncio.Lock()
        self._active_tasks: Set[asyncio.Task[Any]] = set()

    # ── Cache key ──────────────────────────────────────────────────────────
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

    # ── Public build API ───────────────────────────────────────────────────
    async def build_agent(
        self,
        agent: "Agent",
        tools_override: Optional[List[Any]] = None,
    ) -> Any:
        key = self._cache_key(agent)

        async with self._lock:
            entry = self._cache.get(key)
            if entry and entry.is_fresh():
                # Move to end (most recently used)
                self._cache.move_to_end(key)
                logger.debug("AgentEngine cache HIT agent_id=%s key=%.8s", agent.id, key)
                return entry.graph
            logger.debug("AgentEngine cache MISS agent_id=%s key=%.8s", agent.id, key)

        graph = await self._compile_agent(agent, tools_override)

        async with self._lock:
            self._cache[key] = _CacheEntry(graph)
            self._cache.move_to_end(key)
            self._register_key(key, str(agent.id))
            # Evict LRU entries over the size limit
            while len(self._cache) > _CACHE_MAXSIZE:
                evicted_key, _ = self._cache.popitem(last=False)
                self._agent_id_map.pop(evicted_key, None)
                logger.debug("AgentEngine cache EVICT key=%.8s", evicted_key)

        return graph

    async def build_supervisor(
        self,
        supervisor: "Agent",
        workers: List["Agent"],
    ) -> Any:
        from langgraph_supervisor import create_supervisor
        from app.core.llm_factory import build_llm

        supervisor_llm = build_llm(supervisor)
        worker_graphs = [await self.build_agent(w) for w in workers]

        compiled = create_supervisor(
            agents=worker_graphs,
            model=supervisor_llm,
            prompt=supervisor.system_prompt or None,
            full_history=True,
        )
        return compiled

    # ── Internal compile ───────────────────────────────────────────────────
    async def _compile_agent(
        self,
        agent: "Agent",
        tools_override: Optional[List[Any]],
    ) -> Any:
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

    # ── Run tracking ───────────────────────────────────────────────────────
    def register_task(self, task: "asyncio.Task[Any]") -> None:
        self._active_tasks.add(task)
        task.add_done_callback(self._active_tasks.discard)

    async def shutdown(self) -> None:
        """Cancel all running agent tasks — called on SIGTERM."""
        if not self._active_tasks:
            return
        logger.info("AgentEngine shutdown: cancelling %d active run(s)", len(self._active_tasks))
        for task in list(self._active_tasks):
            task.cancel()
        await asyncio.gather(*self._active_tasks, return_exceptions=True)
        logger.info("AgentEngine shutdown complete")

    # ── Cache invalidation ─────────────────────────────────────────────────
    def invalidate(self, agent_id: str) -> None:
        dropped = [k for k in list(self._cache) if self._agent_id_map.get(k) == agent_id]
        for k in dropped:
            del self._cache[k]
            self._agent_id_map.pop(k, None)
        logger.debug("AgentEngine invalidated %d cache entries for agent_id=%s", len(dropped), agent_id)

    # side map: cache_key -> str(agent_id)
    @property
    def _agent_id_map(self) -> Dict[str, str]:
        if not hasattr(self, "__agent_id_map"):
            object.__setattr__(self, "__agent_id_map", {})
        return getattr(self, "__agent_id_map")

    def _register_key(self, key: str, agent_id: str) -> None:
        self._agent_id_map[key] = agent_id

    def cache_stats(self) -> Dict[str, int]:
        return {"size": len(self._cache), "maxsize": _CACHE_MAXSIZE}


agent_engine = AgentEngine()


# ── SIGTERM handler ────────────────────────────────────────────────────────
def _setup_sigterm_handler() -> None:
    loop = asyncio.get_event_loop()

    def _on_sigterm() -> None:
        logger.warning("SIGTERM received — initiating graceful shutdown")
        loop.create_task(agent_engine.shutdown())

    try:
        loop.add_signal_handler(signal.SIGTERM, _on_sigterm)
    except (NotImplementedError, RuntimeError):
        pass  # Windows / non-main-thread environments


asyncio.get_event_loop_policy()  # ensure event loop exists before signal setup
