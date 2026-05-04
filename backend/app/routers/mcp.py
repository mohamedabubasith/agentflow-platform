from __future__ import annotations

from fastapi import APIRouter, Query

from app.core.mcp_manager import test_mcp_server
from app.schemas.agent import MCPTestRequest, MCPTestResponse, MCPToolInfo

router = APIRouter()


@router.post("/mcp/test", response_model=MCPTestResponse, tags=["MCP"])
async def test_mcp(payload: MCPTestRequest) -> MCPTestResponse:
    result = await test_mcp_server(payload.url, payload.transport)
    return MCPTestResponse(**result)


@router.get("/mcp/tools", response_model=list[MCPToolInfo], tags=["MCP"])
async def list_mcp_tools(
    url: str = Query(..., min_length=1),
    transport: str = Query(default="sse"),
) -> list[MCPToolInfo]:
    from langchain_mcp_adapters.client import MultiServerMCPClient
    import asyncio

    _CONNECT_TIMEOUT = 10
    try:
        client = MultiServerMCPClient({"probe": {"url": url, "transport": transport}})
        tools = await asyncio.wait_for(client.get_tools(), timeout=_CONNECT_TIMEOUT)
        return [MCPToolInfo(name=t.name, description=getattr(t, "description", None)) for t in tools]
    except Exception:
        return []
