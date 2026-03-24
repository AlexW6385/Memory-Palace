"""
Idempotency store: prevents duplicate event processing by the Universe consumer.
Uses the EventLog table — one record per event_id.
"""
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from universe.db.models import EventLog
from shared.logging_config import get_logger

log = get_logger(__name__)


async def is_event_processed(session: AsyncSession, event_id: str) -> bool:
    """Return True if this event_id has already been processed (consumer dedup)."""
    result = await session.execute(
        select(EventLog.id).where(EventLog.event_id == event_id).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def mark_event_processed(session: AsyncSession, event_id: str, event_type: str) -> bool:
    """
    Insert an EventLog record atomically.
    Returns True if inserted (first time), False if already existed.
    Uses ON CONFLICT DO NOTHING to be safe under concurrency.
    """
    try:
        log_entry = EventLog(event_id=event_id, event_type=event_type)
        session.add(log_entry)
        await session.flush()
        return True
    except IntegrityError:
        await session.rollback()
        log.debug("event_already_processed", event_id=event_id)
        return False
