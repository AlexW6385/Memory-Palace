"""
Initial migration: enable pgvector, create nodes, edges, event_log, failed_tasks tables.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "nodes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("title", sa.Text, nullable=False),
        sa.Column("summary", sa.Text, default=""),
        sa.Column("content_type", sa.String(50), default="unknown"),
        sa.Column("topics", postgresql.ARRAY(sa.Text), default=[]),
        sa.Column("canonical_url", sa.Text, nullable=True),
        sa.Column("source_platform", sa.String(100), nullable=True),
        sa.Column("author", sa.Text, nullable=True),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_checksum", sa.String(64), nullable=True),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("confidence", sa.Float, default=1.0),
        sa.Column("review_required", sa.Boolean, default=False),
        sa.Column("content_blocks", postgresql.JSONB, default=[]),
        sa.Column("extra_metadata", postgresql.JSONB, default={}),
        sa.Column("version", sa.Integer, default=1, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_nodes_confidence"),
    )
    op.create_unique_constraint("uq_nodes_canonical_url", "nodes", ["canonical_url"])
    op.create_unique_constraint("uq_nodes_source_checksum", "nodes", ["source_checksum"])
    op.create_index("ix_nodes_content_type", "nodes", ["content_type"])
    op.create_index("ix_nodes_created_at", "nodes", ["created_at"])
    # Full-text search GIN index
    op.execute("""
        CREATE INDEX ix_nodes_fts ON nodes
        USING gin(to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'')))
    """)
    # pgvector IVFFlat index for ANN search (created after data load in prod)
    op.execute("""
        CREATE INDEX ix_nodes_embedding ON nodes
        USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)
    """)

    op.create_table(
        "edges",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_node_id", sa.String(36), sa.ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_node_id", sa.String(36), sa.ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("relation_type", sa.String(50), nullable=False),
        sa.Column("confidence", sa.Float, default=1.0),
        sa.Column("evidence", sa.Text, nullable=True),
        sa.Column("provenance", sa.String(100), nullable=True),
        sa.Column("review_required", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_edges_confidence"),
        sa.CheckConstraint("source_node_id != target_node_id", name="ck_edges_no_self_loop"),
    )
    op.create_unique_constraint("uq_edges_triple", "edges", ["source_node_id", "target_node_id", "relation_type"])
    op.create_index("ix_edges_source", "edges", ["source_node_id"])
    op.create_index("ix_edges_target", "edges", ["target_node_id"])
    op.create_index("ix_edges_relation_type", "edges", ["relation_type"])

    op.create_table(
        "event_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_id", sa.String(36), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_unique_constraint("uq_event_log_event_id", "event_log", ["event_id"])
    op.create_index("ix_event_log_processed_at", "event_log", ["processed_at"])

    op.create_table(
        "failed_tasks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("task_id", sa.String(36), nullable=False),
        sa.Column("url", sa.Text, nullable=False),
        sa.Column("error", sa.Text, nullable=False),
        sa.Column("attempt", sa.Integer, default=1),
        sa.Column("payload", postgresql.JSONB, default={}),
        sa.Column("failed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("failed_tasks")
    op.drop_table("event_log")
    op.drop_table("edges")
    op.drop_table("nodes")
    op.execute("DROP EXTENSION IF EXISTS vector")
