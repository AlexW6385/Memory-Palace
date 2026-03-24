"""
Shared Pydantic schemas for Node and its sub-structures.
"""
from datetime import datetime
from enum import StrEnum
from typing import Any
from pydantic import BaseModel, Field
import uuid


class ContentType(StrEnum):
    ARTICLE = "article"
    PAPER = "paper"
    WIKI = "wiki"
    PDF = "pdf"
    NOTE = "note"
    VIDEO_TRANSCRIPT = "video_transcript"
    UNKNOWN = "unknown"


class ContentBlockType(StrEnum):
    PARAGRAPH = "paragraph"
    HEADING = "heading"
    CODE = "code"
    TABLE = "table"
    LIST = "list"
    QUOTE = "quote"


class ContentBlockSchema(BaseModel):
    block_type: ContentBlockType = ContentBlockType.PARAGRAPH
    text: str
    order: int = 0
    metadata: dict[str, Any] = {}


class NodeCreateSchema(BaseModel):
    title: str
    summary: str = ""
    content_type: ContentType = ContentType.UNKNOWN
    topics: list[str] = []
    canonical_url: str | None = None
    source_platform: str | None = None
    author: str | None = None
    published_at: datetime | None = None
    content_blocks: list[ContentBlockSchema] = []
    embedding: list[float] | None = None
    confidence: float = 1.0
    source_checksum: str | None = None
    # concurrency / idempotency
    idempotency_key: str | None = None
    review_required: bool = False


class NodeReadSchema(NodeCreateSchema):
    id: str
    version: int = 1
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class NodeUpdateSchema(BaseModel):
    title: str | None = None
    summary: str | None = None
    topics: list[str] | None = None
    confidence: float | None = None
    review_required: bool | None = None
