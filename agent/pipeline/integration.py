"""
Pipeline Step 5: Integration
The transactional write step — atomically writes the node + edges to the
Universe DB, publishes events, and updates caches.

Uses write session + explicit transaction for atomicity.
"""
from shared.config import get_settings
from shared.logging_config import get_logger
from shared.schemas.ingestion import NormalizedDocument
from shared.schemas.node import NodeCreateSchema
from shared.schemas.edge import EdgeCreateSchema

log = get_logger(__name__)
settings = get_settings()


async def integrate(
    doc: NormalizedDocument,
    understanding: dict,
    placement: dict,
    embedding: list[float] | None,
    task_id: str,
) -> dict:
    """
    Write the document into the Universe.

    Returns:
    {
        node_id: str,
        was_new: bool,
        edges_created: int,
    }
    """
    from universe.db.session import get_write_session
    from universe.services.node_service import create_or_merge_node
    from universe.services.edge_service import create_edge
    from agent.events.publisher import publish_node_created, publish_edge_created

    node_data = NodeCreateSchema(
        title=doc.title,
        summary=understanding.get("summary", "")[:1000],
        content_type=understanding.get("content_type", doc.source_type),
        topics=understanding.get("topics", doc.tags),
        canonical_url=doc.canonical_url,
        source_platform=doc.platform,
        author=doc.author,
        published_at=doc.published_at,
        content_blocks=doc.content_blocks,
        embedding=embedding,
        confidence=placement.get("confidence", 1.0),
        source_checksum=doc.source_checksum,
        review_required=understanding.get("requires_review", False),
    )

    edges_created = 0
    node_id: str | None = None

    # ── Atomic transaction: node + edges ──────────────────────────────────
    async with get_write_session() as session:
        # Step 5a: Create or merge node
        node, was_new = await create_or_merge_node(session, node_data)
        node_id = node.id

        # Step 5b: Create placement edges
        for edge_spec in placement.get("edges_to_create", []):
            try:
                edge_data = EdgeCreateSchema(
                    source_node_id=node_id,
                    target_node_id=edge_spec["target_node_id"],
                    relation_type=edge_spec["relation_type"],
                    confidence=edge_spec.get("confidence", 0.8),
                    provenance="pipeline:placement",
                )
                edge, edge_new = await create_edge(session, edge_data)
                if edge_new:
                    edges_created += 1
                    await publish_edge_created(edge)
            except Exception as e:
                log.warning("edge_creation_failed", error=str(e), spec=edge_spec)
                # Non-fatal: continue without this edge

        # Transaction commits automatically at end of context manager

    # ── Publish events ─────────────────────────────────────────────────────
    if was_new:
        await publish_node_created(node)
    else:
        from agent.events.publisher import publish_node_updated
        await publish_node_updated(node_id, ["embedding", "topics"])

    log.info(
        "integration_complete",
        node_id=node_id,
        was_new=was_new,
        edges_created=edges_created,
        task_id=task_id,
    )

    return {
        "node_id": node_id,
        "was_new": was_new,
        "edges_created": edges_created,
    }
