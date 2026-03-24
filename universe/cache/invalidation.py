"""
Cache invalidation handler — fired by the Redis Streams event consumer
whenever a node/edge is created or updated in the universe.
Separates the write path from cache consistency.
"""
from shared.events import (
    AnyEvent,
    EventType,
    NodeCreatedEvent,
    NodeUpdatedEvent,
    EdgeCreatedEvent,
)
from shared.logging_config import get_logger
from universe.cache.redis import invalidate_node_cache, cache_delete

log = get_logger(__name__)


async def handle_cache_invalidation(event: AnyEvent) -> None:
    """
    Called by the event consumer for every incoming event.
    Invalidates affected cache keys so subsequent reads are fresh.
    """
    if event.event_type == EventType.NODE_CREATED:
        # New node → no cache to invalidate yet (it's new)
        log.debug("cache_noop_new_node", node_id=event.node_id)

    elif event.event_type == EventType.NODE_UPDATED:
        await invalidate_node_cache(event.node_id)
        log.info("cache_invalidated_node", node_id=event.node_id)

    elif event.event_type == EventType.EDGE_CREATED:
        # Invalidate neighbor cache for both endpoints
        await invalidate_node_cache(event.source_node_id)
        await invalidate_node_cache(event.target_node_id)
        log.info(
            "cache_invalidated_edge_endpoints",
            src=event.source_node_id,
            tgt=event.target_node_id,
        )
