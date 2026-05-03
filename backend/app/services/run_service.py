from __future__ import annotations

import asyncio
import logging
import time
import uuid
from typing import Any, Dict, List, Optional

from sqlalchemy import select

from app.core.agent_engine import _RUN_SEMAPHORE, agent_engine
from app.core.mcp_manager import MCPManager
from app.core.websocket_manager import ws_manager
from app.database import AsyncSessionLocal
from app.models.agent import Agent

logger = logging.getLogger(__name__)

_RUN_TIMEOUT = 300  # 5 minutes


class RunService:
    async def run_agent(
        self,
        agent_id: uuid.UUID,
        conversation_id: str,
        message: str,
        mcp_override: Optional[Dict[str, Any]],
        ws_client_id: str,
    ) -> None:
        run_id = uuid.uuid4().hex[:12]
        logger.info(
            "rid=- run_id=%s agent_id=%s conversation_id=%s Starting run",
            run_id, agent_id, conversation_id,
        )

        try:
            async with asyncio.timeout(_RUN_TIMEOUT):
                async with _RUN_SEMAPHORE:
                    await self._execute(
                        run_id=run_id,
                        agent_id=agent_id,
                        conversation_id=conversation_id,
                        message=message,
                        mcp_override=mcp_override,
                        ws_client_id=ws_client_id,
                    )
        except TimeoutError:
            logger.warning("rid=- run_id=%s TIMEOUT", run_id)
            await ws_manager.send_event(
                ws_client_id,
                {"type": "error", "code": "timeout", "message": "Agent run exceeded 5 minute limit."},
            )
        except asyncio.CancelledError:
            logger.info("rid=- run_id=%s CANCELLED (client disconnected)", run_id)
        except Exception as exc:
            logger.error("rid=- run_id=%s ERROR: %s", run_id, exc, exc_info=True)
            await ws_manager.send_event(
                ws_client_id,
                {"type": "error", "code": "run_error", "message": str(exc)},
            )

    async def _execute(
        self,
        run_id: str,
        agent_id: uuid.UUID,
        conversation_id: str,
        message: str,
        mcp_override: Optional[Dict[str, Any]],
        ws_client_id: str,
    ) -> None:
        agent, workers = await self._load_agent_configs(agent_id)

        # Build overridden MCP servers list if provided
        mcp_servers = list(agent.mcp_servers or [])
        if mcp_override:
            mcp_servers = [
                {"name": name, "url": cfg["url"], "transport": cfg.get("transport", "sse")}
                for name, cfg in mcp_override.items()
            ] + [s for s in mcp_servers if s.get("name") not in mcp_override]

        start_ts = time.time()

        # Notify run start
        await ws_manager.send_event(
            ws_client_id,
            {"type": "agent_start", "agent_name": agent.name, "timestamp": _iso()},
        )

        async with MCPManager() as mcp:
            tools = await mcp.connect(mcp_servers)

            if agent.is_supervisor and workers:
                graph = await agent_engine.build_supervisor(agent, workers)
            else:
                graph = await agent_engine.build_agent(agent, tools_override=tools)

            full_response, tokens_used = await self._stream_graph(
                graph=graph,
                agent=agent,
                conversation_id=conversation_id,
                message=message,
                ws_client_id=ws_client_id,
                run_id=run_id,
            )

        total_ms = round((time.time() - start_ts) * 1000)
        await ws_manager.send_event(
            ws_client_id,
            {
                "type": "done",
                "full_response": full_response,
                "total_duration_ms": total_ms,
                "tokens_used": tokens_used,
            },
        )

    async def _stream_graph(
        self,
        graph: Any,
        agent: Agent,
        conversation_id: str,
        message: str,
        ws_client_id: str,
        run_id: str,
    ) -> tuple[str, int]:
        from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

        thread_config = {"configurable": {"thread_id": conversation_id}}
        input_state = {"messages": [HumanMessage(content=message)]}

        full_tokens = 0
        response_parts: list[str] = []

        async for event in graph.astream_events(
            input_state,
            config=thread_config,
            version="v2",
        ):
            if not ws_manager.is_connected(ws_client_id):
                raise asyncio.CancelledError("Client disconnected")

            kind = event.get("event", "")
            name = event.get("name", "")
            data = event.get("data", {})

            if kind == "on_chat_model_stream":
                chunk = data.get("chunk")
                if chunk and hasattr(chunk, "content") and chunk.content:
                    text = chunk.content if isinstance(chunk.content, str) else str(chunk.content)
                    response_parts.append(text)
                    await ws_manager.send_event(ws_client_id, {"type": "token", "content": text})

            elif kind == "on_chat_model_end":
                output = data.get("output")
                if output and hasattr(output, "usage_metadata") and output.usage_metadata:
                    full_tokens += output.usage_metadata.get("total_tokens", 0)

            elif kind == "on_tool_start":
                tool_input = data.get("input", {})
                await ws_manager.send_event(
                    ws_client_id,
                    {"type": "tool_call", "agent_name": name, "tool_name": event.get("name", ""), "tool_input": tool_input},
                )

            elif kind == "on_tool_end":
                tool_result = data.get("output", "")
                await ws_manager.send_event(
                    ws_client_id,
                    {
                        "type": "tool_result",
                        "agent_name": name,
                        "tool_name": event.get("name", ""),
                        "result": str(tool_result)[:2000],
                    },
                )

            elif kind == "on_chain_start" and name not in ("LangGraph", "__start__"):
                await ws_manager.send_event(
                    ws_client_id,
                    {"type": "thinking", "agent_name": name, "content": f"Processing step: {name}"},
                )

        await ws_manager.send_event(
            ws_client_id,
            {"type": "agent_end", "agent_name": agent.name, "timestamp": _iso()},
        )

        return "".join(response_parts), full_tokens

    async def _load_agent_configs(self, agent_id: uuid.UUID) -> tuple[Agent, list[Agent]]:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Agent).where(Agent.id == agent_id))
            agent = result.scalar_one_or_none()
            if agent is None:
                raise ValueError(f"Agent {agent_id} not found")

            workers: list[Agent] = []
            if agent.is_supervisor and agent.worker_agent_ids:
                worker_uuids = [uuid.UUID(str(wid)) for wid in agent.worker_agent_ids]
                res = await session.execute(select(Agent).where(Agent.id.in_(worker_uuids)))
                workers = list(res.scalars().all())

            return agent, workers


def _iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).isoformat()
