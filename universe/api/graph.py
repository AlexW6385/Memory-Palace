"""
/graph endpoint — neighborhood traversal and graph queries.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from universe.db.session import get_session
from universe.services.graph_service import get_neighbors
from universe.services.edge_service import get_edges_for_node

router = APIRouter(prefix="/graph", tags=["graph"])


async def _db():
    async with get_session() as session:
        yield session


@router.get("/{node_id}/neighbors")
async def neighbors(
    node_id: str,
    depth: int = Query(1, ge=1, le=3),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(_db),
):
    """Return the neighborhood graph for a node (nodes + edges)."""
    return await get_neighbors(session, node_id, max_depth=depth, limit=limit)


@router.get("/{node_id}/edges")
async def node_edges(
    node_id: str,
    direction: str = Query("both", description="'outgoing' | 'incoming' | 'both'"),
    session: AsyncSession = Depends(_db),
):
    """Return all edges connected to a node."""
    edges = await get_edges_for_node(session, node_id, direction=direction)
    return {"node_id": node_id, "edges": [e.model_dump() for e in edges]}
