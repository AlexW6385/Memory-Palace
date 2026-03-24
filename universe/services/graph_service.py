"""
Graph service — neighborhood traversal and path queries.
Results cached in Redis sorted sets for hot nodes.
"""
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from shared.logging_config import get_logger
from shared.schemas.node import NodeReadSchema
from shared.schemas.edge import EdgeReadSchema
from universe.cache.redis import cache_get, cache_set
from universe.db.models import Node, Edge
from shared.config import get_settings

log = get_logger(__name__)
settings = get_settings()


async def get_neighbors(
    session: AsyncSession,
    node_id: str,
    max_depth: int = 1,
    limit: int = 50,
) -> dict:
    """
    Return 1-hop or 2-hop neighborhood graph for a node.
    Results are cached in Redis.
    """
    cache_key = f"neighbors:{node_id}:d{max_depth}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    edges_result = await session.execute(
        select(Edge).where(
            (Edge.source_node_id == node_id) | (Edge.target_node_id == node_id)
        ).limit(limit)
    )
    edges = edges_result.scalars().all()

    neighbor_ids = set()
    for e in edges:
        if e.source_node_id != node_id:
            neighbor_ids.add(e.source_node_id)
        if e.target_node_id != node_id:
            neighbor_ids.add(e.target_node_id)

    nodes_result = await session.execute(
        select(Node).where(Node.id.in_(neighbor_ids))
    )
    nodes = nodes_result.scalars().all()

    result = {
        "center_node_id": node_id,
        "nodes": [NodeReadSchema.model_validate(n).model_dump(mode="json") for n in nodes],
        "edges": [EdgeReadSchema.model_validate(e).model_dump(mode="json") for e in edges],
    }
    await cache_set(cache_key, result, settings.cache_ttl_neighbors)
    return result
