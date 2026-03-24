"""
Shared Pydantic schemas for Edge.
"""
from datetime import datetime
from enum import StrEnum
from pydantic import BaseModel, Field
import uuid


class RelationType(StrEnum):
    RELATES_TO = "relates_to"
    MENTIONS = "mentions"
    EXPLAINS = "explains"
    SUPPORTS = "supports"
    CONTRADICTS = "contradicts"
    DERIVED_FROM = "derived_from"
    EXAMPLE_OF = "example_of"
    PART_OF = "part_of"
    REFERENCES = "references"


class EdgeCreateSchema(BaseModel):
    source_node_id: str
    target_node_id: str
    relation_type: RelationType
    confidence: float = 1.0
    evidence: str | None = None          # snippet / source of inference
    provenance: str | None = None        # which pipeline step created it
    review_required: bool = False
    idempotency_key: str | None = None


class EdgeReadSchema(EdgeCreateSchema):
    id: str
    created_at: datetime

    model_config = {"from_attributes": True}
