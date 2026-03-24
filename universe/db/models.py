"""
SQLAlchemy ORM models for the Knowledge Universe.

Design notes:
- `Node.version` is an optimistic-lock counter (incremented on every update)
- `Node.canonical_url` has a unique index — duplicate inserts → upsert
- `Edge` has a unique constraint on (source_node_id, target_node_id, relation_type) — no dup edges
- `node_embedding` uses pgvector's VECTOR type for semantic search
"""
import uuid
from datetime import datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class Node(Base):
    """Core knowledge node — a single piece of human content."""

    __tablename__ = "nodes"
    __table_args__ = (
        UniqueConstraint("canonical_url", name="uq_nodes_canonical_url"),
        UniqueConstraint("source_checksum", name="uq_nodes_source_checksum"),
        Index("ix_nodes_content_type", "content_type"),
        Index("ix_nodes_created_at", "created_at"),
        # Full-text search index (GIN)
        Index(
            "ix_nodes_fts",
            text("to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))"),
            postgresql_using="gin",
        ),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_nodes_confidence"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, default="")
    content_type: Mapped[str] = mapped_column(String(50), default="unknown")
    topics: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list)
    canonical_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_platform: Mapped[str | None] = mapped_column(String(100), nullable=True)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source_checksum: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # pgvector embedding
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536), nullable=True)

    # Scoring / quality
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    review_required: Mapped[bool] = mapped_column(Boolean, default=False)

    # Extra structured data (content blocks, metadata)
    content_blocks: Mapped[list] = mapped_column(JSONB, default=list)
    extra_metadata: Mapped[dict] = mapped_column(JSONB, default=dict)

    # Optimistic locking
    version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    outgoing_edges: Mapped[list["Edge"]] = relationship(
        "Edge", foreign_keys="Edge.source_node_id", back_populates="source_node",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[list["Edge"]] = relationship(
        "Edge", foreign_keys="Edge.target_node_id", back_populates="target_node",
    )

    def __repr__(self) -> str:
        return f"<Node id={self.id} title={self.title!r}>"


class Edge(Base):
    """Directed typed relationship between two nodes."""

    __tablename__ = "edges"
    __table_args__ = (
        UniqueConstraint(
            "source_node_id", "target_node_id", "relation_type",
            name="uq_edges_triple",
        ),
        Index("ix_edges_source", "source_node_id"),
        Index("ix_edges_target", "target_node_id"),
        Index("ix_edges_relation_type", "relation_type"),
        CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_edges_confidence"),
        CheckConstraint("source_node_id != target_node_id", name="ck_edges_no_self_loop"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    source_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    target_node_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    evidence: Mapped[str | None] = mapped_column(Text, nullable=True)
    provenance: Mapped[str | None] = mapped_column(String(100), nullable=True)
    review_required: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    source_node: Mapped["Node"] = relationship(
        "Node", foreign_keys=[source_node_id], back_populates="outgoing_edges"
    )
    target_node: Mapped["Node"] = relationship(
        "Node", foreign_keys=[target_node_id], back_populates="incoming_edges"
    )

    def __repr__(self) -> str:
        return f"<Edge {self.source_node_id} --[{self.relation_type}]--> {self.target_node_id}>"


class EventLog(Base):
    """
    Idempotency log for Redis Streams event consumers.
    Prevents duplicate processing of re-delivered events.
    """

    __tablename__ = "event_log"
    __table_args__ = (
        UniqueConstraint("event_id", name="uq_event_log_event_id"),
        Index("ix_event_log_processed_at", "processed_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    event_id: Mapped[str] = mapped_column(String(36), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    processed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FailedTask(Base):
    """Dead-letter queue: tasks that exhausted all retries."""

    __tablename__ = "failed_tasks"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    task_id: Mapped[str] = mapped_column(String(36), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    error: Mapped[str] = mapped_column(Text, nullable=False)
    attempt: Mapped[int] = mapped_column(Integer, default=1)
    payload: Mapped[dict] = mapped_column(JSONB, default=dict)
    failed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
