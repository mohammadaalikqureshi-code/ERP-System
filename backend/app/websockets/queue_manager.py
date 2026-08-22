"""WebSocket fan-out for live updates.

Browsers connect to one API process, but the change they need to hear about may
happen in a different process (another worker, or a Celery task). So every
broadcast goes out over a Redis pub/sub channel, and each process relays what
it receives to its own connected sockets.

    service  --publish-->  Redis  -->  every API process  -->  its sockets
"""

import asyncio
import json
import logging
from typing import Dict, Set

from fastapi import WebSocket

from app.core.redis import get_redis

logger = logging.getLogger(__name__)

CHANNEL = "realtime_events"


class ConnectionManager:
    def __init__(self) -> None:
        # room name -> the sockets in this process that joined it
        self.active_connections: Dict[str, Set[WebSocket]] = {}
        self._listener: asyncio.Task | None = None
        self._lock = asyncio.Lock()

    async def connect(self, room: str, websocket: WebSocket) -> None:
        """Accept a socket and put it in a room. Starts the relay if needed."""
        await websocket.accept()
        async with self._lock:
            self.active_connections.setdefault(room, set()).add(websocket)
            if self._listener is None or self._listener.done():
                self._listener = asyncio.create_task(self._relay_from_redis())

    async def disconnect(self, room: str, websocket: WebSocket) -> None:
        async with self._lock:
            sockets = self.active_connections.get(room)
            if not sockets:
                return
            sockets.discard(websocket)
            if not sockets:
                self.active_connections.pop(room, None)

    async def broadcast(self, room: str, message: dict) -> None:
        """Send a message to a room across every API process."""
        try:
            await get_redis().publish(CHANNEL, json.dumps({"room": room, "message": message}))
        except Exception:
            # Never let a realtime failure break the request that triggered it:
            # the browser also polls, so a missed event self-corrects.
            logger.warning("Could not publish realtime event", exc_info=True)

    async def _send_local(self, room: str, message: dict) -> None:
        sockets = list(self.active_connections.get(room, ()))
        if not sockets:
            return

        payload = json.dumps(message)
        for socket in sockets:
            try:
                await socket.send_text(payload)
            except Exception:
                await self.disconnect(room, socket)

    async def _relay_from_redis(self) -> None:
        """Long-running task: forward published events to local sockets."""
        pubsub = get_redis().pubsub()
        try:
            await pubsub.subscribe(CHANNEL)
            async for raw in pubsub.listen():
                if raw["type"] != "message":
                    continue
                try:
                    payload = json.loads(raw["data"])
                except json.JSONDecodeError:
                    logger.warning("Ignoring malformed realtime payload")
                    continue

                room, message = payload.get("room"), payload.get("message")
                if room and message:
                    await self._send_local(room, message)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.error("Realtime relay stopped unexpectedly", exc_info=True)
        finally:
            try:
                await pubsub.unsubscribe(CHANNEL)
                await pubsub.aclose()
            except Exception:
                pass

    async def shutdown(self) -> None:
        if self._listener and not self._listener.done():
            self._listener.cancel()
            try:
                await self._listener
            except asyncio.CancelledError:
                pass


manager = ConnectionManager()
