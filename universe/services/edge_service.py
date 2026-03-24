"""
Edge service — create edges with dedup and confidence tracking.
"""
import uuid
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from shared.logging_config import get_logger
from shared.schemas.edge import EdgeCreateSchema, EdgeReadSchema
from universe.db.models import Edge

log = get_logger(__name__)


async def create_edge(
    session: AsyncSession, data: EdgeCreateSchema
) -> tuple[EdgeReadSchema, bool]:
    """
    Idempotent edge creation using ON CONFLICT DO NOTHING on the triple
    (source_node_id, target_node_id, relation_type).

    Returns (edge, was_new).
    """
    edge_id = str(uuid.uuid4())
    stmt = (
        pg_insert(Edge)
        .values(
            id=edge_id,
            source_node_id=data.source_node_id,
            target_node_id=data.target_node_id,
            relation_type=data.relation_type,
            confidence=data.confidence,
            evidence=data.evidence,
            provenance=data.provenance,
            review_required=data.review_required,
        )
        .on_conflict_do_nothing(constraint="uq_edges_triple")
        .returning(Edge)
    )
    result = await session.execute(stmt)
    edge = result.scalar_one_or_none()
    if edge is None:
        # conflict — fetch existing
        existing = await session.execute(
            select(Edge).where(
                Edge.source_node_id == data.source_node_id,
                Edge.target_node_id == data.target_node_id,
                Edge.relation_type == data.relation_type,
            )
        )
        edge = existing.scalar_one()
        was_new = False
        log.debug("edge_already_exists", edge_id=edge.id)
    else:
        was_new = True
        log.info(
            "edge_created",
            edge_id=edge.id,
            relation=data.relation_type,
            src=data.source_node_id,
            tgt=data.target_node_id,
        )

    await session.flush()
    return EdgeReadSchema.model_validate(edge), was_new


async def get_edges_for_node(
    session: AsyncSession,
    node_id: str,
    direction: str = "both",
) -> list[EdgeReadSchema]:
    """Fetch edges for a node. direction: 'outgoing' | 'incoming' | 'both'"""
    if direction == "outgoing":
        stmt = select(Edge).where(Edge.source_node_id == node_id)
    elif direction == "incoming":
        stmt = select(Edge).where(Edge.target_node_id == node_id)
    else:
        from sqlalchemy import or_
        stmt = select(Edge).where(
            or_(Edge.source_node_id == node_id, Edge.target_node_id == node_id)
        )
    result = await session.execute(stmt)
    return [EdgeReadSchema.model_validate(e) for e in result.scalars().all()]
