"""
pgvector semantic similarity search.
Uses cosine distance (<=> operator) over Node.embedding.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def vector_search(
    session: AsyncSession,
    embedding: list[float],
    limit: int = 20,
    offset: int = 0,
    min_similarity: float = 0.5,
) -> list[dict]:
    """
    Find the most semantically similar nodes using cosine similarity.

    Args:
        embedding: Query embedding vector (must match DB dimensions)
        min_similarity: Minimum cosine similarity threshold (0–1)
    """
    # pgvector stores as <=> cosine distance (0 = identical, 2 = opposite)
    # similarity = 1 - distance
    max_distance = 1 - min_similarity
    sql = text("""
        SELECT
            id,
            title,
            summary,
            content_type,
            canonical_url,
            topics,
            confidence,
            1 - (embedding <=> CAST(:embedding AS vector)) AS similarity
        FROM nodes
        WHERE embedding IS NOT NULL
          AND (embedding <=> CAST(:embedding AS vector)) <= :max_distance
        ORDER BY embedding <=> CAST(:embedding AS vector)
        LIMIT :limit OFFSET :offset
    """)
    # Format embedding as Postgres vector literal string
    vec_str = "[" + ",".join(str(x) for x in embedding) + "]"
    result = await session.execute(
        sql,
        {
            "embedding": vec_str,
            "max_distance": max_distance,
            "limit": limit,
            "offset": offset,
        },
    )
    rows = result.mappings().all()
    return [dict(r) for r in rows]


async def find_near_duplicates(
    session: AsyncSession,
    embedding: list[float],
    threshold: float = 0.97,
    limit: int = 5,
) -> list[dict]:
    """
    Detect near-duplicate nodes before insertion.
    If similarity > threshold, caller should merge instead of insert.
    """
    return await vector_search(session, embedding, limit=limit, min_similarity=threshold)
