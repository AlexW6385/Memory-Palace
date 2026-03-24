"""
Pipeline Step 1: Acquisition
Drives the skill system to fetch and return a NormalizedDocument.
Also handles Redis source lock to prevent duplicate concurrent ingestion.
"""
from shared.logging_config import get_logger
from shared.schemas.ingestion import IngestionTask, IngestionTaskStatus, NormalizedDocument
from universe.cache.redis import source_lock

log = get_logger(__name__)


async def acquire(task: IngestionTask) -> NormalizedDocument:
    """
    Fetch the raw content via the skill registry.
    Uses a Redis distributed lock to prevent two workers ingesting the same URL.
    """
    from agent.skills.registry import registry

    canonical_url = task.url

    async with source_lock(canonical_url) as acquired:
        if not acquired:
            log.warning("acquisition_lock_not_acquired", url=canonical_url, task_id=task.id)
            raise RuntimeError(f"Another worker is already ingesting: {canonical_url}")

        log.info("acquisition_start", url=canonical_url, task_id=task.id)
        doc = await registry.run(canonical_url)
        log.info("acquisition_complete", url=canonical_url, skill=doc.skill_name)
        return doc
