from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Dict, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)

_MAX_CONNECTIONS = 100
_HEARTBEAT_INTERVAL = 30
_RATE_LIMIT_MSG_PER_MIN = 60


@dataclass
class _ConnMeta:
    websocket: WebSocket
    connected_at: float = field(default_factory=time.monotonic)
    last_message_at: float = field(default_factory=time.monotonic)
    message_count: int = 0
    # Sliding-window: list of monotonic timestamps for last minute
    _window: list = field(default_factory=list)

    def record_message(self) -> bool:
        """Return True if allowed, False if rate-limited."""
        now = time.monotonic()
        self._window = [t for t in self._window if now - t < 60]
        if len(self._window) >= _RATE_LIMIT_MSG_PER_MIN:
            return False
        self._window.append(now)
        self.last_message_at = now
        self.message_count += 1
        return True


class WebSocketManager:
    """Singleton manager for all active WebSocket connections."""

    def __init__(self) -> None:
        self._conns: Dict[str, _ConnMeta] = {}
        self._lock = asyncio.Lock()
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, client_id: str) -> bool:
        async with self._lock:
            if len(self._conns) >= _MAX_CONNECTIONS:
                logger.warning("WebSocket connection limit reached (%d)", _MAX_CONNECTIONS)
                await websocket.close(code=1013, reason="Server at capacity")
                return False
            await websocket.accept()
            self._conns[client_id] = _ConnMeta(websocket=websocket)
            logger.info("WebSocket connected client_id=%s total=%d", client_id, len(self._conns))

        if self._heartbeat_task is None or self._heartbeat_task.done():
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())

        return True

    async def disconnect(self, client_id: str) -> None:
        async with self._lock:
            self._conns.pop(client_id, None)
        logger.info("WebSocket disconnected client_id=%s total=%d", client_id, len(self._conns))

    def check_rate_limit(self, client_id: str) -> bool:
        """Record an incoming message. Returns False if the connection is over rate limit."""
        meta = self._conns.get(client_id)
        if meta is None:
            return False
        return meta.record_message()

    def get_metadata(self, client_id: str) -> Optional[dict]:
        meta = self._conns.get(client_id)
        if meta is None:
            return None
        return {
            "connected_at": meta.connected_at,
            "last_message_at": meta.last_message_at,
            "message_count": meta.message_count,
        }

    async def send_event(self, client_id: str, event: dict) -> bool:
        meta = self._conns.get(client_id)
        if meta is None:
            return False
        try:
            await meta.websocket.send_text(json.dumps(event))
            return True
        except Exception as exc:
            logger.warning("Failed to send event to client_id=%s: %s", client_id, exc)
            await self.disconnect(client_id)
            return False

    async def broadcast(self, event: dict) -> None:
        client_ids = list(self._conns.keys())
        await asyncio.gather(*[self.send_event(cid, event) for cid in client_ids])

    async def notify_server_restart(self) -> None:
        await self.broadcast({"type": "server_restart", "message": "Server is restarting. Please reconnect."})

    def is_connected(self, client_id: str) -> bool:
        return client_id in self._conns

    def active_count(self) -> int:
        return len(self._conns)

    async def _heartbeat_loop(self) -> None:
        while self._conns:
            await asyncio.sleep(_HEARTBEAT_INTERVAL)
            stale: list[str] = []
            for client_id, meta in list(self._conns.items()):
                try:
                    await meta.websocket.send_text(json.dumps({"type": "ping"}))
                except Exception:
                    stale.append(client_id)
            for client_id in stale:
                await self.disconnect(client_id)


ws_manager = WebSocketManager()
