"""
Redis Streams event consumer for the Universe service.
Responsibilities:
1. Consume events published by the Agent service
2. Idempotency check (EventLog table) — skip already-processed events
3. Cache invalidation
4. Trigger expansion tasks if EXPANSION_REQUESTED
"""
import asyncio
import json
from typing import Any

import redis.asyncio as aioredis

from shared.config import get_settings
from shared.events import parse_event, EventType
from shared.logging_config import get_logger
from universe.cache.invalidation import handle_cache_invalidation
from universe.db.session import get_write_session
from universe.db.idempotency import is_event_processed, mark_event_processed

log = get_logger(__name__)
settings = get_settings()

CONSUMER_NAME = "universe-core-consumer"


async def run_consumer() -> None:
    """
    Long-lived async task. Reads from Redis Streams consumer group,
    processes events with idempotency checks.
    """
    r = aioredis.from_url(settings.redis_url, decode_responses=True)

    try:
        await r.xgroup_create(
            settings.stream_name,
            settings.stream_consumer_group,
            id="0",
            mkstream=True,
        )
    except Exception:
        pass  # group already exists — fine

    log.info("event_consumer_started", stream=settings.stream_name)

    while True:
        try:
            messages = await r.xreadgroup(
                groupname=settings.stream_consumer_group,
                consumername=CONSUMER_NAME,
                streams={settings.stream_name: ">"},
                count=100,
                block=1000,
            )

            for _stream, entries in (messages or []):
                for entry_id, raw in entries:
                    await _process_entry(r, entry_id, raw)

            # Also reclaim abandoned messages (PEL cleanup — at-least-once)
            await _reclaim_pending(r)

        except asyncio.CancelledError:
            log.info("event_consumer_stopped")
            await r.aclose()
            break
        except Exception as e:
            log.error("event_consumer_error", error=str(e))
            await asyncio.sleep(2)


async def _process_entry(r: aioredis.Redis, entry_id: str, raw: dict[str, Any]) -> None:
    try:
        event = parse_event(raw)
    except Exception as e:
        log.error("event_parse_error", entry_id=entry_id, error=str(e))
        await r.xack(settings.stream_name, settings.stream_consumer_group, entry_id)
        return

    # ── Idempotency: skip already-processed events ────────────────────────
    async with get_write_session() as session:
        already_done = await is_event_processed(session, event.event_id)
        if already_done:
            log.debug("event_skipped_duplicate", event_id=event.event_id)
            await r.xack(settings.stream_name, settings.stream_consumer_group, entry_id)
            return

        await mark_event_processed(session, event.event_id, event.event_type)

    # ── Cache invalidation ────────────────────────────────────────────────
    try:
        await handle_cache_invalidation(event)
    except Exception as e:
        log.error("cache_invalidation_error", event_id=event.event_id, error=str(e))

    await r.xack(settings.stream_name, settings.stream_consumer_group, entry_id)
    log.info("event_processed", event_type=event.event_type, event_id=event.event_id)


async def _reclaim_pending(r: aioredis.Redis) -> None:
    """
    Reclaim messages idle for > 60s (worker crash recovery — at-least-once).
    """
    try:
        pending = await r.xpending_range(
            settings.stream_name,
            settings.stream_consumer_group,
            min="-", max="+",
            count=10,
            idle=60_000,  # ms
        )
        for msg in pending:
            msg_id = msg["message_id"]
            claimed = await r.xclaim(
                settings.stream_name,
                settings.stream_consumer_group,
                CONSUMER_NAME,
                min_idle_time=60_000,
                message_ids=[msg_id],
            )
            if claimed:
                log.warning("event_reclaimed", message_id=msg_id)
    except Exception as e:
        log.debug("reclaim_error", error=str(e))
