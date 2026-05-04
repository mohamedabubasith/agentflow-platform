from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from langchain_core.tools import BaseTool
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

_CONNECT_TIMEOUT = 10
_MAX_RETRIES = 3
_POOL_MAX_PER_URL = 10
_POOL_TTL = 300  # 5 minutes


# ── Pool entry ─────────────────────────────────────────────────────────────

@dataclass
class _PoolEntry:
    client: Any
    tools: List[BaseTool]
    created_at: float = field(default_factory=time.monotonic)

    def is_fresh(self) -> bool:
        return (time.monotonic() - self.created_at) < _POOL_TTL


class _ConnectionPool:
    """LRU pool of MCP connections keyed by (url, transport)."""

    def __init__(self) -> None:
        self._entries: Dict[str, List[_PoolEntry]] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, url: str, transport: str) -> Optional[_PoolEntry]:
        key = f"{transport}:{url}"
        async with self._lock:
            entries = self._entries.get(key, [])
            while entries:
                entry = entries.pop()
                if entry.is_fresh():
                    logger.debug("MCP pool HIT url=%s", url)
                    return entry
                logger.debug("MCP pool STALE url=%s", url)
            return None

    async def release(self, url: str, transport: str, entry: _PoolEntry) -> None:
        key = f"{transport}:{url}"
        async with self._lock:
            bucket = self._entries.setdefault(key, [])
            if len(bucket) < _POOL_MAX_PER_URL and entry.is_fresh():
                bucket.append(entry)
            else:
                await _close_client(entry.client)

    async def clear(self) -> None:
        async with self._lock:
            for entries in self._entries.values():
                for entry in entries:
                    await _close_client(entry.client)
            self._entries.clear()


_pool = _ConnectionPool()


async def _close_client(client: Any) -> None:
    try:
        if hasattr(client, "aclose"):
            await client.aclose()
        elif hasattr(client, "__aexit__"):
            await client.__aexit__(None, None, None)
    except Exception as exc:
        logger.debug("MCP client close error: %s", exc)


# ── Timing wrapper for tools ───────────────────────────────────────────────

def _wrap_tools_with_timing(tools: List[BaseTool], url: str) -> List[BaseTool]:
    """Monkey-patch each tool's ainvoke to log call duration."""
    for tool in tools:
        original_ainvoke = tool.ainvoke

        async def _timed_ainvoke(input: Any, _tool=tool, _url=url, _orig=original_ainvoke, **kwargs: Any) -> Any:
            t0 = time.monotonic()
            try:
                result = await _orig(input, **kwargs)
                return result
            finally:
                ms = round((time.monotonic() - t0) * 1000)
                logger.debug("MCP tool_call tool=%s url=%s duration_ms=%d", _tool.name, _url, ms)

        tool.ainvoke = _timed_ainvoke  # type: ignore[method-assign]

    return tools


# ── MCPManager ─────────────────────────────────────────────────────────────

class MCPManager:
    """Manages MCP server connections for a single agent run.

    Tries to reuse pooled connections first; on miss, connects with retries.
    """

    def __init__(self) -> None:
        self._acquired: List[tuple[str, str, _PoolEntry]] = []
        self._tools: List[BaseTool] = []

    async def connect(self, mcp_servers: List[Dict[str, str]]) -> List[BaseTool]:
        if not mcp_servers:
            return []

        results = await asyncio.gather(
            *[self._connect_one(srv) for srv in mcp_servers],
            return_exceptions=True,
        )

        seen_names: set[str] = set()
        for result in results:
            if isinstance(result, Exception):
                logger.warning("MCP server skipped due to error: %s", result)
                continue
            tools = result
            for tool in tools:
                if tool.name not in seen_names:
                    seen_names.add(tool.name)
                    self._tools.append(tool)

        logger.info("MCP connected: %d tools from %d server(s)", len(self._tools), len(mcp_servers))
        return self._tools

    async def _connect_one(self, server: Dict[str, str]) -> List[BaseTool]:
        url = server["url"]
        transport = server.get("transport", "sse")
        name = server.get("name", url)

        entry = await _pool.acquire(url, transport)
        if entry is not None:
            self._acquired.append((url, transport, entry))
            return list(entry.tools)

        logger.debug("MCP pool MISS url=%s — connecting", url)
        entry = await self._connect_with_retry(url, transport, name)
        self._acquired.append((url, transport, entry))
        return list(entry.tools)

    @retry(
        stop=stop_after_attempt(_MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def _connect_with_retry(self, url: str, transport: str, name: str) -> _PoolEntry:
        from langchain_mcp_adapters.client import MultiServerMCPClient

        client = MultiServerMCPClient({name: {"url": url, "transport": transport}})
        tools = await asyncio.wait_for(client.get_tools(), timeout=_CONNECT_TIMEOUT)
        tools = _wrap_tools_with_timing(tools, url)
        return _PoolEntry(client=client, tools=tools)

    async def disconnect(self) -> None:
        for url, transport, entry in self._acquired:
            await _pool.release(url, transport, entry)
        self._acquired.clear()
        self._tools.clear()

    async def __aenter__(self) -> MCPManager:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.disconnect()


async def test_mcp_server(url: str, transport: str = "sse") -> Dict[str, Any]:
    """Health-check a single MCP server. Returns {healthy, tools_count, error}."""
    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient

        client = MultiServerMCPClient({"probe": {"url": url, "transport": transport}})
        tools = await asyncio.wait_for(client.get_tools(), timeout=_CONNECT_TIMEOUT)
        await _close_client(client)
        return {"healthy": True, "tools_count": len(tools), "error": None}
    except Exception as exc:
        return {"healthy": False, "tools_count": 0, "error": str(exc)}
