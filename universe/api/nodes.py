"""
/nodes REST endpoints — CRUD for knowledge nodes.
Online read path uses Redis cache; write path uses write session.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from shared.schemas.node import NodeCreateSchema, NodeReadSchema, NodeUpdateSchema
from universe.db.session import get_session, get_write_session
from universe.services.node_service import create_or_merge_node, get_node, update_node
from universe.db.models import Node
from sqlalchemy import select, func

router = APIRouter(prefix="/nodes", tags=["nodes"])


async def _db():
    async with get_session() as session:
        yield session


async def _write_db():
    async with get_write_session() as session:
        yield session


@router.get("", response_model=list[NodeReadSchema])
async def list_nodes(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(_db),
):
    result = await session.execute(
        select(Node).order_by(Node.created_at.desc()).limit(limit).offset(offset)
    )
    return [NodeReadSchema.model_validate(n) for n in result.scalars().all()]


@router.get("/count")
async def count_nodes(session: AsyncSession = Depends(_db)):
    result = await session.execute(select(func.count(Node.id)))
    return {"count": result.scalar_one()}


@router.get("/{node_id}", response_model=NodeReadSchema)
async def read_node(node_id: str, session: AsyncSession = Depends(_db)):
    node = await get_node(session, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.post("", response_model=NodeReadSchema, status_code=201)
async def create_node(
    data: NodeCreateSchema,
    session: AsyncSession = Depends(_write_db),
):
    node, was_new = await create_or_merge_node(session, data)
    return node


@router.patch("/{node_id}", response_model=NodeReadSchema)
async def patch_node(
    node_id: str,
    data: NodeUpdateSchema,
    expected_version: int | None = Query(None),
    session: AsyncSession = Depends(_write_db),
):
    try:
        node = await update_node(session, node_id, data, expected_version)
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    return node


@router.delete("/{node_id}", status_code=204)
async def delete_node(node_id: str, session: AsyncSession = Depends(_write_db)):
    from sqlalchemy import delete
    from universe.cache.redis import invalidate_node_cache
    result = await session.execute(select(Node).where(Node.id == node_id))
    node = result.scalar_one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="Node not found")
    await session.delete(node)
    await invalidate_node_cache(node_id)
