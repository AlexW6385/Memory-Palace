"""
WebSocket endpoint for real-time universe event streaming.

Clients connect to /ws and receive JSON frames whenever nodes or edges
are created/updated. The server reads from Redis Streams and fan-outs
to all connected WebSocket clients.

Connection management:
- All active connections stored in a module-level ConnectionManager
- Background task per-app reads Redis Streams and broadcasts
"""
import asyncio
import json
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from shared.logging_config import get_logger

log = get_logger(__name__)
router = APIRouter(tags=["websocket"])


class ConnectionManager:
    def __init__(self):
        self._connections: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.add(ws)
        log.info("ws_client_connected", total=len(self._connections))

    def disconnect(self, ws: WebSocket) -> None:
        self._connections.discard(ws)
        log.info("ws_client_disconnected", total=len(self._connections))

    async def broadcast(self, message: dict[str, Any]) -> None:
        dead = set()
        for ws in self._connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections.discard(ws)

    @property
    def connection_count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        # Immediate welcome to confirm handshake
        await ws.send_json({"type": "info", "message": "Connected to stream"})
        
        while True:
            # Wait for client message or timeout for ping
            try:
                # We don't expect messages, but receiving is required to detect disconnects
                # across all proxy layers.
                await asyncio.wait_for(ws.receive_text(), timeout=20.0)
            except asyncio.TimeoutError:
                # Send heartbeat
                await ws.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        log.error("ws_error", error=str(e))
        manager.disconnect(ws)


async def start_stream_broadcaster(redis_url: str, stream_name: str, group_name: str) -> None:
    """
    Background task: reads Redis Streams events and broadcasts to WS clients.
    Runs as a long-lived asyncio task started at app startup.
    """
    import redis.asyncio as aioredis

    r = aioredis.from_url(redis_url, decode_responses=True)

    # Ensure consumer group exists
    try:
        await r.xgroup_create(stream_name, group_name, id="$", mkstream=True)
    except Exception:
        pass  # group already exists

    consumer_name = "universe-ws-broadcaster"
    log.info("stream_broadcaster_started", stream=stream_name)

    while True:
        try:
            messages = await r.xreadgroup(
                groupname=group_name,
                consumername=consumer_name,
                streams={stream_name: ">"},
                count=50,
                block=1000,  # 1s blocking read
            )
            for _stream, entries in (messages or []):
                for entry_id, data in entries:
                    try:
                        payload = {k: v for k, v in data.items()}
                        await manager.broadcast(payload)
                        # Acknowledge
                        await r.xack(stream_name, group_name, entry_id)
                    except Exception as e:
                        log.error("stream_broadcast_error", error=str(e), entry_id=entry_id)
        except asyncio.CancelledError:
            log.info("stream_broadcaster_stopped")
            await r.aclose()
            break
        except Exception as e:
            log.error("stream_broadcaster_exception", error=str(e))
            await asyncio.sleep(2)
