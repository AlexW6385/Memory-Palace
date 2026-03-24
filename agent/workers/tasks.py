"""
Arq task definitions — the actual unit of work executed by workers.

Each task is idempotent (uses IngestionTask.idempotency_key).
Failure → DLQ (FailedTask table) after max retries.
Each step logs its completion to task.last_completed_step for crash recovery.
"""
import asyncio
from datetime import datetime

from arq import ArqRedis

from shared.config import get_settings
from shared.logging_config import get_logger
from shared.schemas.ingestion import IngestionTask, IngestionTaskStatus

log = get_logger(__name__)
settings = get_settings()

# ── In-memory task store (replace with Redis hash or DB table in production) ──
_task_store: dict[str, dict] = {}


async def ingest_url_task(
    ctx: dict,
    url: str,
    task_id: str | None = None,
    depth_remaining: int = 0,
    triggered_by: str = "user",
    parent_node_id: str | None = None,
    idempotency_key: str | None = None,
) -> dict:
    """
    Full 6-step ingestion pipeline for a single URL.
    At-least-once: function is idempotent via source_checksum and canonical_url uniqueness.
    """
    import uuid
    task = IngestionTask(
        id=task_id or str(uuid.uuid4()),
        url=url,
        idempotency_key=idempotency_key,
        depth_remaining=depth_remaining,
        triggered_by=triggered_by,
        parent_task_id=parent_node_id,
    )
    _update_task(task.id, {"status": IngestionTaskStatus.ACQUIRING, "url": url})

    try:
        # Step 1: Acquisition
        from agent.pipeline.acquisition import acquire
        task.status = IngestionTaskStatus.ACQUIRING
        doc = await acquire(task)
        task.last_completed_step = "acquisition"

        # Step 2: Normalization
        task.status = IngestionTaskStatus.NORMALIZING
        _update_task(task.id, {"status": task.status})
        from agent.pipeline.normalization import normalize
        doc = normalize(doc)
        task.normalized_doc = doc
        task.last_completed_step = "normalization"

        # Step 3: Understanding
        task.status = IngestionTaskStatus.UNDERSTANDING
        _update_task(task.id, {"status": task.status})
        from agent.pipeline.understanding import understand
        understanding = await understand(doc)
        task.last_completed_step = "understanding"

        # Compute embedding
        embedding = await _compute_embedding(
            f"{doc.title}\n{understanding.get('summary', '')}"
        )

        # Step 4: Placement
        task.status = IngestionTaskStatus.PLACING
        _update_task(task.id, {"status": task.status})
        from agent.pipeline.placement import place
        placement = await place(doc, understanding, embedding)
        task.last_completed_step = "placement"

        # Step 5: Integration
        task.status = IngestionTaskStatus.INTEGRATING
        _update_task(task.id, {"status": task.status})
        from agent.pipeline.integration import integrate
        result = await integrate(doc, understanding, placement, embedding, task.id)
        task.node_id = result["node_id"]
        task.last_completed_step = "integration"

        # Step 6: Expansion
        if depth_remaining > 0 and triggered_by != "expansion":
            task.status = IngestionTaskStatus.EXPANDING
            _update_task(task.id, {"status": task.status})
            from agent.pipeline.expansion import maybe_expand
            await maybe_expand(doc, result["node_id"], depth_remaining, triggered_by)
            task.last_completed_step = "expansion"

        # Complete
        task.status = IngestionTaskStatus.COMPLETED
        _update_task(task.id, {
            "status": task.status,
            "node_id": task.node_id,
            "completed_at": datetime.utcnow().isoformat(),
        })

        # Publish completion event
        from agent.events.publisher import publish_ingestion_completed
        await publish_ingestion_completed(
            task_id=task.id,
            url=url,
            node_id=result["node_id"],
            edges_created=result["edges_created"],
            was_duplicate=not result["was_new"],
        )

        log.info("ingestion_task_completed", task_id=task.id, node_id=task.node_id)
        return {"task_id": task.id, "node_id": task.node_id, "status": "completed"}

    except Exception as e:
        log.error("ingestion_task_failed", task_id=task.id, url=url, error=str(e))
        attempt = ctx.get("job_try", 1)
        _update_task(task.id, {
            "status": IngestionTaskStatus.FAILED,
            "error": str(e),
            "attempt": attempt,
        })

        # Move to DLQ after max retries
        if attempt >= settings.retry_max_attempts:
            await _send_to_dlq(task.id, url, str(e), attempt)

        from agent.events.publisher import publish_ingestion_failed
        await publish_ingestion_failed(task.id, url, str(e), attempt)

        raise  # re-raise so Arq can retry with backoff


async def run_directed_exploration(
    ctx: dict,
    topic: str,
    depth: int = 2,
    max_nodes: int = 20,
) -> dict:
    """
    Agent-directed exploration task.
    Searches for URLs related to a topic and enqueues ingestion tasks.
    """
    log.info("directed_exploration_start", topic=topic, depth=depth)
    # In a full implementation this would call a search API or LLM to find URLs
    # For now, return a placeholder
    return {"status": "directed_exploration_enqueued", "topic": topic}


def _update_task(task_id: str, updates: dict) -> None:
    if task_id not in _task_store:
        _task_store[task_id] = {"task_id": task_id}
    _task_store[task_id].update(updates)


def get_task_status(task_id: str) -> dict | None:
    return _task_store.get(task_id)


async def _compute_embedding(text: str) -> list[float] | None:
    if not settings.openai_api_key:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.embeddings.create(
            model=settings.embedding_model,
            input=text[:8000],  # token limit
        )
        return resp.data[0].embedding
    except Exception as e:
        log.warning("embedding_failed", error=str(e))
        return None


async def _send_to_dlq(task_id: str, url: str, error: str, attempt: int) -> None:
    """Write failed task to the FailedTask DLQ table."""
    try:
        from universe.db.session import get_write_session
        from universe.db.models import FailedTask
        async with get_write_session() as session:
            ft = FailedTask(
                task_id=task_id,
                url=url,
                error=error,
                attempt=attempt,
                payload={"url": url},
            )
            session.add(ft)
        log.warning("task_sent_to_dlq", task_id=task_id)
    except Exception as e:
        log.error("dlq_write_failed", error=str(e))
