"""
/search endpoint — unified full-text + semantic vector search.
Results are cached in Redis.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from universe.db.session import get_session
from universe.search.fulltext import fulltext_search
from universe.search.vector import vector_search
from universe.cache.redis import get_cached_search, set_cached_search

router = APIRouter(prefix="/search", tags=["search"])


async def _db():
    async with get_session() as session:
        yield session


@router.get("")
async def search_nodes(
    q: str = Query(..., min_length=1, description="Search query"),
    mode: str = Query("fulltext", description="'fulltext' | 'vector' | 'hybrid'"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    session: AsyncSession = Depends(_db),
):
    """
    Search knowledge nodes.

    - **fulltext**: Postgres tsvector (keyword-based, fast)
    - **vector**: pgvector cosine similarity (semantic, requires embedding)
    - **hybrid**: run both and merge, deduplicated by node id
    """
    # check cache
    cached = await get_cached_search(q, mode, limit)
    if cached:
        return {"results": cached, "cached": True, "mode": mode}

    if mode == "fulltext":
        results = await fulltext_search(session, q, limit=limit, offset=offset)

    elif mode == "vector":
        embedding = await _embed_query(q)
        results = await vector_search(session, embedding, limit=limit, offset=offset)

    elif mode == "hybrid":
        fts_results = await fulltext_search(session, q, limit=limit, offset=offset)
        embedding = await _embed_query(q)
        vec_results = await vector_search(session, embedding, limit=limit, offset=offset)
        # merge + deduplicate by id
        seen = set()
        results = []
        for r in fts_results + vec_results:
            if r["id"] not in seen:
                seen.add(r["id"])
                results.append(r)
        results = results[:limit]
    else:
        raise HTTPException(status_code=400, detail=f"Unknown search mode: {mode}")

    await set_cached_search(q, mode, limit, results)
    return {"results": results, "cached": False, "mode": mode, "count": len(results)}


async def _embed_query(query: str) -> list[float]:
    """Embed a search query using the configured embedding model."""
    from shared.config import get_settings
    settings = get_settings()

    if not settings.openai_api_key:
        # Return a zero vector as fallback (for dev without API key)
        return [0.0] * settings.embedding_dimensions

    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    resp = await client.embeddings.create(
        model=settings.embedding_model,
        input=query,
    )
    return resp.data[0].embedding
