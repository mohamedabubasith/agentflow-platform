from __future__ import annotations

import asyncio
import json
import logging
from typing import Dict

from fastapi import WebSocket

logger = logging.getLogger(__name__)

_MAX_CONNECTIONS = 100
_HEARTBEAT_INTERVAL = 30


class WebSocketManager:
    """Singleton manager for all active WebSocket connections."""

    def __init__(self) -> None:
        self._connections: Dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()
        self._heartbeat_task: asyncio.Task | None = None

    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        async with self._lock:
            if len(self._connections) >= _MAX_CONNECTIONS:
                logger.warning("rid=- WebSocket connection limit reached (%d)", _MAX_CONNECTIONS)
                await websocket.close(code=1013, reason="Server at capacity")
                return False
            await websocket.accept()
            self._connections[client_id] = websocket
            logger.info("rid=- WebSocket connected client_id=%s total=%d", client_id, len(self._connections))

        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        return True

    async def disconnect(self, client_id: str) -> None:
        async with self._lock:
            self._connections.pop(client_id, None)
        logger.info("rid=- WebSocket disconnected client_id=%s total=%d", client_id, len(self._connections))

    async def send_event(self, client_id: str, event: dict) -> bool:
        ws = self._connections.get(client_id)
        if ws is None:
            return False
        try:
            await ws.send_text(json.dumps(event))
            return True
        except Exception as exc:
            logger.warning("rid=- Failed to send event to client_id=%s: %s", client_id, exc)
            await self.disconnect(client_id)
            return False

    async def broadcast(self, event: dict) -> None:
        client_ids = list(self._connections.keys())
        await asyncio.gather(*[self.send_event(cid, event) for cid in client_ids])

    def is_connected(self, client_id: str) -> bool:
        return client_id in self._connections

    async def _heartbeat_loop(self) -> None:
        while self._connections:
            await asyncio.sleep(_HEARTBEAT_INTERVAL)
            stale: list[str] = []
            for client_id, ws in list(self._connections.items()):
                try:
                    await ws.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    stale.append(client_id)
            for client_id in stale:
                await self.disconnect(client_id)


ws_manager = WebSocketManager()
