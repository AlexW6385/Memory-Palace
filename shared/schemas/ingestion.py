"""
Shared ingestion schemas — the contract between the Skill layer and the
Knowledge Integration Engine pipeline.
"""
from datetime import datetime
from enum import StrEnum
from typing import Any
from pydantic import BaseModel, Field
import uuid


class IngestionSource(StrEnum):
    URL = "url"
    PDF = "pdf"
    TEXT = "text"
    API = "api"


class RawResponse(BaseModel):
    """Output of Connector skill step."""
    url: str
    content_type: str           # MIME type
    raw_content: bytes | str
    headers: dict[str, str] = {}
    fetched_at: datetime = Field(default_factory=datetime.utcnow)
    status_code: int = 200


class ExtractedContent(BaseModel):
    """Output of Extractor skill step."""
    title: str
    author: str | None = None
    published_at: datetime | None = None
    language: str | None = None
    plain_text: str
    sections: list[dict[str, Any]] = []  # [{heading, text}]
    outgoing_links: list[str] = []
    tags: list[str] = []
    extra_metadata: dict[str, Any] = {}


class NormalizedDocument(BaseModel):
    """
    Unified output of the full Skill pipeline (all 3 layers).
    This is the INPUT to the Knowledge Integration Engine.
    """
    source_type: str                    # maps to ContentType
    platform: str
    title: str
    author: str | None = None
    published_at: datetime | None = None
    language: str = "en"
    content_blocks: list[dict[str, Any]] = []   # [{block_type, text, order}]
    outgoing_links: list[str] = []
    tags: list[str] = []
    raw_url: str
    canonical_url: str | None = None
    source_checksum: str | None = None          # SHA-256 for dedup
    extra_metadata: dict[str, Any] = {}
    skill_name: str = ""


class IngestionTaskStatus(StrEnum):
    PENDING = "pending"
    ACQUIRING = "acquiring"
    NORMALIZING = "normalizing"
    UNDERSTANDING = "understanding"
    PLACING = "placing"
    INTEGRATING = "integrating"
    EXPANDING = "expanding"
    COMPLETED = "completed"
    FAILED = "failed"
    DUPLICATE = "duplicate"


class IngestionTask(BaseModel):
    """Tracks a single ingestion request through the pipeline."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    url: str
    idempotency_key: str | None = None
    status: IngestionTaskStatus = IngestionTaskStatus.PENDING
    depth_remaining: int = 0            # 0 = no further expansion
    triggered_by: str = "user"          # "user" | "expansion" | "directed"
    parent_task_id: str | None = None
    error: str | None = None
    attempt: int = 1
    node_id: str | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    # checkpoint: resume from last completed pipeline step
    last_completed_step: str | None = None
    normalized_doc: NormalizedDocument | None = None
