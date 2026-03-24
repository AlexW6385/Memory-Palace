"""
Node service — business logic for creating, reading, updating, and merging nodes.

Key concurrency patterns:
- Upsert by canonical_url (ON CONFLICT DO UPDATE) for idempotent writes
- Near-duplicate check via pgvector before insert
- Optimistic locking (version column) on updates
- Node-merge lock (Redis) before merging two nodes
"""
import hashlib
from datetime import datetime

from sqlalchemy import select, update, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from shared.logging_config import get_logger
from shared.schemas.node import NodeCreateSchema, NodeReadSchema, NodeUpdateSchema
from universe.cache.redis import (
    get_cached_node,
    invalidate_node_cache,
    node_merge_lock,
    set_cached_node,
)
from universe.db.models import Node
from universe.search.vector import find_near_duplicates

log = get_logger(__name__)


async def get_node(session: AsyncSession, node_id: str) -> NodeReadSchema | None:
    """Fetch a single node — checks Redis cache first."""
    cached = await get_cached_node(node_id)
    if cached:
        return NodeReadSchema.model_validate(cached)

    result = await session.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if node is None:
        return None

    schema = NodeReadSchema.model_validate(node)
    await set_cached_node(node_id, schema.model_dump(mode="json"))
    return schema


async def create_or_merge_node(
    session: AsyncSession, data: NodeCreateSchema
) -> tuple[NodeReadSchema, bool]:
    """
    Idempotent node creation.

    Strategy:
    1. If canonical_url exists → upsert (return existing node, was_new=False)
    2. If embedding provided → check for near-duplicates → merge if found
    3. Otherwise → create new node

    Returns (node, was_new).
    """
    # ── Step 1: checksum dedup ────────────────────────────────────────────
    if data.source_checksum:
        existing = await session.execute(
            select(Node).where(Node.source_checksum == data.source_checksum)
        )
        existing_node = existing.scalar_one_or_none()
        if existing_node:
            log.info("node_dedup_by_checksum", checksum=data.source_checksum)
            schema = NodeReadSchema.model_validate(existing_node)
            return schema, False

    # ── Step 2: vector near-duplicate check ───────────────────────────────
    if data.embedding:
        near_dups = await find_near_duplicates(session, data.embedding, threshold=0.97)
        if near_dups:
            dup_id = near_dups[0]["id"]
            log.info("node_near_duplicate_found", dup_id=dup_id, similarity=near_dups[0].get("similarity"))
            return await _merge_into_existing(session, dup_id, data)

    # ── Step 3: upsert by canonical_url ───────────────────────────────────
    node_data = data.model_dump(exclude={"idempotency_key", "embedding"})
    node_data["embedding"] = data.embedding

    if data.canonical_url:
        stmt = (
            pg_insert(Node)
            .values(id=_new_id(), **node_data)
            .on_conflict_do_nothing(constraint="uq_nodes_canonical_url")
            .returning(Node)
        )
        try:
            result = await session.execute(stmt)
            node = result.scalar_one_or_none()
            if node is None:
                # conflict → fetch existing
                existing = await session.execute(
                    select(Node).where(Node.canonical_url == data.canonical_url)
                )
                node = existing.scalar_one()
                was_new = False
            else:
                was_new = True
        except IntegrityError:
            await session.rollback()
            existing = await session.execute(
                select(Node).where(Node.canonical_url == data.canonical_url)
            )
            node = existing.scalar_one()
            was_new = False
    else:
        node = Node(id=_new_id(), **node_data)
        session.add(node)
        await session.flush()
        was_new = True

    await session.refresh(node)
    if was_new:
        log.info("node_created", node_id=node.id, title=node.title)
    schema = NodeReadSchema.model_validate(node)
    return schema, was_new


async def update_node(
    session: AsyncSession,
    node_id: str,
    data: NodeUpdateSchema,
    expected_version: int | None = None,
) -> NodeReadSchema | None:
    """
    Update a node with optimistic locking.
    If expected_version is provided and doesn't match current version → raises ValueError.
    """
    result = await session.execute(
        select(Node).where(Node.id == node_id).with_for_update()
    )
    node = result.scalar_one_or_none()
    if node is None:
        return None

    if expected_version is not None and node.version != expected_version:
        raise ValueError(
            f"Optimistic lock conflict: expected version {expected_version}, "
            f"got {node.version}"
        )

    update_data = data.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(node, field, value)
    node.version += 1
    node.updated_at = datetime.utcnow()

    await session.flush()
    await invalidate_node_cache(node_id)
    schema = NodeReadSchema.model_validate(node)
    log.info("node_updated", node_id=node_id, version=node.version)
    return schema


async def _merge_into_existing(
    session: AsyncSession, target_id: str, data: NodeCreateSchema
) -> tuple[NodeReadSchema, bool]:
    """Merge new data into an existing near-duplicate node."""
    async with node_merge_lock(target_id) as acquired:
        if not acquired:
            log.warning("node_merge_lock_not_acquired", target_id=target_id)
            # Fall back to fetching the existing node without merge
            result = await session.execute(select(Node).where(Node.id == target_id))
            node = result.scalar_one()
            return NodeReadSchema.model_validate(node), False

        result = await session.execute(
            select(Node).where(Node.id == target_id).with_for_update()
        )
        node = result.scalar_one_or_none()
        if node is None:
            return await create_or_merge_node(session, data)

        # Merge topics
        existing_topics = set(node.topics or [])
        new_topics = set(data.topics or [])
        node.topics = list(existing_topics | new_topics)
        node.version += 1
        node.updated_at = datetime.utcnow()

        await session.flush()
        await invalidate_node_cache(target_id)
        log.info("node_merged", target_id=target_id)
        return NodeReadSchema.model_validate(node), False


def _new_id() -> str:
    import uuid
    return str(uuid.uuid4())
