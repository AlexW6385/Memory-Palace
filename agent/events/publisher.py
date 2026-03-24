"""
Redis Streams event publisher for the Agent service.
Publishes typed events after each successful pipeline step.
"""
import json
import redis.asyncio as aioredis

from shared.config import get_settings
from shared.events import (
    NodeCreatedEvent,
    NodeUpdatedEvent,
    EdgeCreatedEvent,
    IngestionCompletedEvent,
    IngestionFailedEvent,
    IngestionProgressEvent,
)
from shared.logging_config import get_logger

log = get_logger(__name__)
settings = get_settings()

_redis: aioredis.Redis | None = None


def _get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def _publish(event_dict: dict) -> None:
    r = _get_redis()
    # Redis Streams XADD — all field values must be str.
    # Lists/dicts are JSON-encoded so the frontend can parse them back.
    fields: dict[str, str] = {}
    for k, v in event_dict.items():
        if v is None:
            continue
        if isinstance(v, (list, dict)):
            fields[k] = json.dumps(v)
        elif isinstance(v, bool):
            fields[k] = str(v).lower()
        else:
            fields[k] = str(v)
    await r.xadd(settings.stream_name, fields, maxlen=10_000, approximate=True)


async def publish_node_created(node) -> None:
    event = NodeCreatedEvent(
        node_id=node.id,
        title=node.title,
        content_type=node.content_type,
        canonical_url=node.canonical_url,
        topics=list(node.topics or []),
    )
    await _publish(event.model_dump(mode="json"))
    log.debug("event_published", event_type=event.event_type, node_id=node.id)


async def publish_node_updated(node_id: str, changed_fields: list[str]) -> None:
    event = NodeUpdatedEvent(node_id=node_id, changed_fields=changed_fields)
    await _publish(event.model_dump(mode="json"))


async def publish_edge_created(edge) -> None:
    event = EdgeCreatedEvent(
        edge_id=edge.id,
        source_node_id=edge.source_node_id,
        target_node_id=edge.target_node_id,
        relation_type=edge.relation_type,
        confidence=edge.confidence,
    )
    await _publish(event.model_dump(mode="json"))


async def publish_ingestion_completed(task_id: str, url: str, node_id: str, edges_created: int, was_duplicate: bool) -> None:
    event = IngestionCompletedEvent(
        task_id=task_id,
        url=url,
        node_id=node_id,
        edges_created=edges_created,
        was_duplicate=was_duplicate,
    )
    await _publish(event.model_dump(mode="json"))


async def publish_ingestion_failed(task_id: str, url: str, error: str, attempt: int) -> None:
    event = IngestionFailedEvent(task_id=task_id, url=url, error=error, attempt=attempt)
    await _publish(event.model_dump(mode="json"))


async def publish_ingestion_progress(
    task_id: str,
    url: str,
    step: str,
    step_index: int,
    detail: str = "",
) -> None:
    event = IngestionProgressEvent(
        task_id=task_id,
        url=url,
        step=step,
        step_index=step_index,
        detail=detail,
    )
    await _publish(event.model_dump(mode="json"))
    log.debug("progress_published", task_id=task_id, step=step, step_index=step_index)
