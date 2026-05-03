from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from langchain_core.tools import BaseTool
from tenacity import retry, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)

_CONNECT_TIMEOUT = 10
_MAX_RETRIES = 3


class MCPManager:
    """Manages dynamic MCP server connections for a single agent run."""

    def __init__(self) -> None:
        self._sessions: List[Any] = []
        self._tools: List[BaseTool] = []

    async def connect(self, mcp_servers: List[Dict[str, str]]) -> List[BaseTool]:
        results = await asyncio.gather(
            *[self._connect_one(srv) for srv in mcp_servers],
            return_exceptions=True,
        )

        seen_names: set[str] = set()
        for result in results:
            if isinstance(result, Exception):
                continue
            tools, session = result
            self._sessions.append(session)
            for tool in tools:
                if tool.name not in seen_names:
                    seen_names.add(tool.name)
                    self._tools.append(tool)

        return self._tools

    @retry(
        stop=stop_after_attempt(_MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=1, max=8),
        reraise=True,
    )
    async def _connect_one_attempt(self, server: Dict[str, str]):
        from langchain_mcp_adapters.client import MultiServerMCPClient

        name = server.get("name", server.get("url", "unknown"))
        transport = server.get("transport", "sse")
        url = server["url"]

        client = MultiServerMCPClient({name: {"url": url, "transport": transport}})
        tools = await asyncio.wait_for(client.get_tools(), timeout=_CONNECT_TIMEOUT)
        return tools, client

    async def _connect_one(self, server: Dict[str, str]):
        name = server.get("name", server.get("url", "unknown"))
        try:
            return await self._connect_one_attempt(server)
        except Exception as exc:
            logger.warning("rid=- MCP server '%s' failed to connect after retries: %s", name, exc)
            raise

    async def disconnect(self) -> None:
        for session in self._sessions:
            try:
                if hasattr(session, "aclose"):
                    await session.aclose()
                elif hasattr(session, "__aexit__"):
                    await session.__aexit__(None, None, None)
            except Exception as exc:
                logger.warning("rid=- Error closing MCP session: %s", exc)
        self._sessions.clear()
        self._tools.clear()

    async def __aenter__(self) -> MCPManager:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.disconnect()
