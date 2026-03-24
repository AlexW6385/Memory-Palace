"""
Shared Pydantic event schemas for the Redis Streams event bus.
Both services share these definitions — publisher (agent) and consumer (universe).
"""
from datetime import datetime
from enum import StrEnum
from typing import Any
from pydantic import BaseModel, Field
import uuid


class EventType(StrEnum):
    NODE_CREATED = "node.created"
    NODE_UPDATED = "node.updated"
    EDGE_CREATED = "edge.created"
    EXPANSION_REQUESTED = "expansion.requested"
    INGESTION_FAILED = "ingestion.failed"
    INGESTION_COMPLETED = "ingestion.completed"


class BaseEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    event_type: EventType
    occurred_at: datetime = Field(default_factory=datetime.utcnow)
    source_service: str = "agent"
    idempotency_key: str | None = None  # consumer dedup


class NodeCreatedEvent(BaseEvent):
    event_type: EventType = EventType.NODE_CREATED
    node_id: str
    title: str
    content_type: str
    canonical_url: str | None = None
    topics: list[str] = []


class NodeUpdatedEvent(BaseEvent):
    event_type: EventType = EventType.NODE_UPDATED
    node_id: str
    changed_fields: list[str] = []


class EdgeCreatedEvent(BaseEvent):
    event_type: EventType = EventType.EDGE_CREATED
    edge_id: str
    source_node_id: str
    target_node_id: str
    relation_type: str
    confidence: float


class ExpansionRequestedEvent(BaseEvent):
    event_type: EventType = EventType.EXPANSION_REQUESTED
    parent_node_id: str
    expansion_urls: list[str] = []
    depth_remaining: int = 1
    triggered_by: str = "reactive"  # "reactive" | "directed"


class IngestionFailedEvent(BaseEvent):
    event_type: EventType = EventType.INGESTION_FAILED
    task_id: str
    url: str
    error: str
    attempt: int = 1


class IngestionCompletedEvent(BaseEvent):
    event_type: EventType = EventType.INGESTION_COMPLETED
    task_id: str
    url: str
    node_id: str | None = None
    edges_created: int = 0
    was_duplicate: bool = False


# discriminator union for deserialization
AnyEvent = (
    NodeCreatedEvent
    | NodeUpdatedEvent
    | EdgeCreatedEvent
    | ExpansionRequestedEvent
    | IngestionFailedEvent
    | IngestionCompletedEvent
)


def parse_event(data: dict[str, Any]) -> AnyEvent:
    """Deserialize a raw dict from Redis Streams into a typed event."""
    event_type = data.get("event_type")
    _map = {
        EventType.NODE_CREATED: NodeCreatedEvent,
        EventType.NODE_UPDATED: NodeUpdatedEvent,
        EventType.EDGE_CREATED: EdgeCreatedEvent,
        EventType.EXPANSION_REQUESTED: ExpansionRequestedEvent,
        EventType.INGESTION_FAILED: IngestionFailedEvent,
        EventType.INGESTION_COMPLETED: IngestionCompletedEvent,
    }
    cls = _map.get(event_type)
    if cls is None:
        raise ValueError(f"Unknown event_type: {event_type}")
    return cls.model_validate(data)
