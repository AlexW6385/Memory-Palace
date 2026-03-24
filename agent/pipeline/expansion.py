"""
Pipeline Step 6: Expansion
Decides whether to follow outgoing links and spawn new ingestion tasks.

Two expansion modes:
  - reactive: triggered automatically by new content arriving
  - directed: explicit user/agent command with a target topic/direction

Expansion is rate-limited by the expansion fan-out cap.
Uses an expansion Redis lock to prevent duplicate fan-outs per node.
"""
import asyncio
from urllib.parse import urlparse

from shared.config import get_settings
from shared.logging_config import get_logger
from shared.schemas.ingestion import NormalizedDocument
from universe.cache.redis import expansion_lock

log = get_logger(__name__)
settings = get_settings()


async def maybe_expand(
    doc: NormalizedDocument,
    node_id: str,
    depth_remaining: int,
    triggered_by: str = "reactive",
) -> list[str]:
    """
    Enqueue child ingestion tasks for outgoing links if conditions are met.

    Returns list of spawned task IDs.
    """
    if depth_remaining <= 0:
        log.debug("expansion_skipped_depth_zero", node_id=node_id)
        return []

    if not doc.outgoing_links:
        return []

    async with expansion_lock(node_id) as acquired:
        if not acquired:
            log.warning("expansion_lock_not_acquired", node_id=node_id)
            return []

        # Filter and cap links
        candidate_links = _filter_links(doc.outgoing_links)
        candidate_links = candidate_links[:settings.expansion_max_fanout]

        if not candidate_links:
            return []

        # Enqueue child tasks via Arq
        from agent.workers.tasks import ingest_url_task
        from agent.workers.pool import get_arq_pool

        spawned_ids = []
        pool = await get_arq_pool()

        for link in candidate_links:
            try:
                job = await pool.enqueue_job(
                    "ingest_url_task",
                    url=link,
                    depth_remaining=depth_remaining - 1,
                    triggered_by="expansion",
                    parent_node_id=node_id,
                )
                if job:
                    spawned_ids.append(job.job_id)
            except Exception as e:
                log.warning("expansion_enqueue_failed", url=link, error=str(e))

        log.info(
            "expansion_complete",
            node_id=node_id,
            spawned=len(spawned_ids),
            depth_remaining=depth_remaining - 1,
        )
        return spawned_ids


def _filter_links(links: list[str]) -> list[str]:
    """Keep only high-quality expansion targets."""
    _SKIP_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".svg", ".css", ".js", ".ico"}
    _SKIP_PATTERNS = {"javascript:", "mailto:", "#", "tel:"}

    filtered = []
    for link in links:
        try:
            parsed = urlparse(link)
            if parsed.scheme not in ("http", "https"):
                continue
            if any(link.startswith(p) for p in _SKIP_PATTERNS):
                continue
            path = parsed.path.lower()
            if any(path.endswith(ext) for ext in _SKIP_EXTENSIONS):
                continue
            filtered.append(link)
        except Exception:
            continue
    return filtered
