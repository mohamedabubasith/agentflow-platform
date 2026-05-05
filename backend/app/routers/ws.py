from __future__ import annotations

import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from starlette.websockets import WebSocketState

from app.core.websocket_manager import ws_manager
from app.database import AsyncSessionLocal
from app.models.agent import Agent

logger = logging.getLogger(__name__)
router = APIRouter()


async def _get_agent(agent_id: uuid.UUID) -> Agent | None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Agent).where(Agent.id == agent_id))
        return result.scalar_one_or_none()


@router.websocket("/ws/{agent_id}/{conversation_id}")
async def agent_websocket(
    websocket: WebSocket,
    agent_id: uuid.UUID,
    conversation_id: str,
) -> None:
    from app.services.run_service import RunService

    client_id = f"{agent_id}:{conversation_id}:{uuid.uuid4().hex[:8]}"

    agent = await _get_agent(agent_id)
    if agent is None:
        await websocket.accept()
        await websocket.send_text(
            json.dumps({"type": "error", "code": "AGENT_NOT_FOUND", "message": f"Agent {agent_id} not found."})
        )
        await websocket.close()
        return

    connected = await ws_manager.connect(websocket, client_id)
    if not connected:
        return

    try:
        await ws_manager.send_event(
            client_id,
            {"type": "connected", "agent_id": str(agent_id), "conversation_id": conversation_id},
        )

        run_service = RunService()

        while True:
            try:
                raw = await websocket.receive_text()
            except WebSocketDisconnect:
                break

            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await ws_manager.send_event(
                    client_id,
                    {"type": "error", "code": "invalid_input", "message": "Message must be valid JSON."},
                )
                continue

            # Client-side ping for latency measurement — echo it back
            if payload.get("type") == "ping":
                await ws_manager.send_event(client_id, {"type": "ping"})
                continue

            message = payload.get("message", "").strip()
            if not message:
                await ws_manager.send_event(
                    client_id,
                    {"type": "error", "code": "invalid_input", "message": "Field 'message' is required."},
                )
                continue

            mcp_override = payload.get("mcp_override")

            await run_service.run_agent(
                agent_id=agent_id,
                conversation_id=conversation_id,
                message=message,
                mcp_override=mcp_override,
                ws_client_id=client_id,
            )

    except Exception as exc:
        logger.error("rid=- Unexpected WebSocket error client_id=%s: %s", client_id, exc, exc_info=True)
        if websocket.client_state != WebSocketState.DISCONNECTED:
            await ws_manager.send_event(
                client_id,
                {"type": "error", "code": "internal_error", "message": "An internal error occurred."},
            )
    finally:
        await ws_manager.disconnect(client_id)
