"""
PostgreSQL full-text search using tsvector.
Searches node title + summary with ts_rank ranking.
"""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


async def fulltext_search(
    session: AsyncSession,
    query: str,
    limit: int = 20,
    offset: int = 0,
) -> list[dict]:
    """
    Run a Postgres full-text search over nodes.
    Returns list of dicts with id, title, summary, rank.
    """
    sql = text("""
        SELECT
            id,
            title,
            summary,
            content_type,
            canonical_url,
            topics,
            confidence,
            ts_rank(
                to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,'')),
                plainto_tsquery('english', :query)
            ) AS rank
        FROM nodes
        WHERE to_tsvector('english', coalesce(title,'') || ' ' || coalesce(summary,''))
              @@ plainto_tsquery('english', :query)
        ORDER BY rank DESC
        LIMIT :limit OFFSET :offset
    """)
    result = await session.execute(sql, {"query": query, "limit": limit, "offset": offset})
    rows = result.mappings().all()
    return [dict(r) for r in rows]
