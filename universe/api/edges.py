"""
/edges REST endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from shared.schemas.edge import EdgeCreateSchema, EdgeReadSchema
from universe.db.session import get_session, get_write_session
from universe.services.edge_service import create_edge, get_edges_for_node
from universe.db.models import Edge

router = APIRouter(prefix="/edges", tags=["edges"])


async def _db():
    async with get_session() as session:
        yield session


async def _write_db():
    async with get_write_session() as session:
        yield session


@router.get("", response_model=list[EdgeReadSchema])
async def list_edges(
    source_node_id: str | None = Query(None),
    target_node_id: str | None = Query(None),
    relation_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    session: AsyncSession = Depends(_db),
):
    stmt = select(Edge)
    if source_node_id:
        stmt = stmt.where(Edge.source_node_id == source_node_id)
    if target_node_id:
        stmt = stmt.where(Edge.target_node_id == target_node_id)
    if relation_type:
        stmt = stmt.where(Edge.relation_type == relation_type)
    stmt = stmt.limit(limit)
    result = await session.execute(stmt)
    return [EdgeReadSchema.model_validate(e) for e in result.scalars().all()]


@router.post("", response_model=EdgeReadSchema, status_code=201)
async def create_edge_endpoint(
    data: EdgeCreateSchema,
    session: AsyncSession = Depends(_write_db),
):
    edge, _ = await create_edge(session, data)
    return edge


@router.delete("/{edge_id}", status_code=204)
async def delete_edge(edge_id: str, session: AsyncSession = Depends(_write_db)):
    result = await session.execute(select(Edge).where(Edge.id == edge_id))
    edge = result.scalar_one_or_none()
    if edge is None:
        raise HTTPException(status_code=404, detail="Edge not found")
    await session.delete(edge)
