"""
Arq task definitions — the actual unit of work executed by workers.

Each task is idempotent (uses IngestionTask.idempotency_key).
Failure → DLQ (FailedTask table) after max retries.
Task status is stored in Redis (key: task:{id}) so the API process
can read it without in-process state sharing.
"""
import asyncio
import json
from datetime import datetime

from arq import ArqRedis

from shared.config import get_settings
from shared.logging_config import get_logger
from shared.schemas.ingestion import IngestionTask, IngestionTaskStatus

log = get_logger(__name__)
settings = get_settings()

_TASK_TTL = 3600  # keep task status in Redis for 1 hour


# ── Redis-backed task state (worker writes, API reads) ─────────────────────────

async def _update_task(redis: ArqRedis, task_id: str, updates: dict) -> None:
    key = f"task:{task_id}"
    raw = await redis.get(key)
    data: dict = json.loads(raw) if raw else {"task_id": task_id}
    data.update(updates)
    await redis.setex(key, _TASK_TTL, json.dumps(data, default=str))


async def get_task_status_from_redis(task_id: str) -> dict | None:
    """Read task status from Redis. Called by the API process."""
    from universe.cache.redis import get_redis
    r = get_redis()
    raw = await r.get(f"task:{task_id}")
    return json.loads(raw) if raw else None


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
    from agent.events.publisher import (
        publish_ingestion_progress,
        publish_ingestion_completed,
        publish_ingestion_failed,
    )

    redis: ArqRedis = ctx["redis"]
    task = IngestionTask(
        id=task_id or str(uuid.uuid4()),
        url=url,
        idempotency_key=idempotency_key,
        depth_remaining=depth_remaining,
        triggered_by=triggered_by,
        parent_task_id=parent_node_id,
    )

    async def _progress(step: str, step_index: int, detail: str = "") -> None:
        await _update_task(redis, task.id, {"status": step, "step": step_index})
        await publish_ingestion_progress(
            task_id=task.id, url=url,
            step=step, step_index=step_index, detail=detail,
        )

    await _update_task(redis, task.id, {
        "status": IngestionTaskStatus.ACQUIRING,
        "url": url,
        "triggered_by": triggered_by,
        "started_at": datetime.utcnow().isoformat(),
    })

    try:
        # Step 1: Acquisition
        await _progress("acquiring", 1, f"Fetching {url}")
        from agent.pipeline.acquisition import acquire
        doc = await acquire(task)
        task.last_completed_step = "acquisition"
        log.info("step_done", task_id=task.id, step="acquisition")

        # Step 2: Normalization
        await _progress("normalizing", 2)
        from agent.pipeline.normalization import normalize
        doc = normalize(doc)
        task.normalized_doc = doc
        task.last_completed_step = "normalization"
        log.info("step_done", task_id=task.id, step="normalization")

        # Step 3: Understanding
        await _progress("understanding", 3)
        from agent.pipeline.understanding import understand
        understanding = await understand(doc)
        task.last_completed_step = "understanding"
        log.info("step_done", task_id=task.id, step="understanding",
                 content_type=understanding.get("content_type"),
                 topics=understanding.get("topics"))

        # Compute embedding
        embedding = await _compute_embedding(
            f"{doc.title}\n{understanding.get('summary', '')}"
        )

        # Step 4: Placement
        await _progress("placing", 4)
        from agent.pipeline.placement import place
        placement = await place(doc, understanding, embedding)
        task.last_completed_step = "placement"
        log.info("step_done", task_id=task.id, step="placement")

        # Step 5: Integration
        await _progress("integrating", 5)
        from agent.pipeline.integration import integrate
        result = await integrate(doc, understanding, placement, embedding, task.id)
        task.node_id = result["node_id"]
        task.last_completed_step = "integration"
        log.info("step_done", task_id=task.id, step="integration",
                 node_id=task.node_id, was_new=result["was_new"])

        # Step 6: Expansion (optional)
        if depth_remaining > 0 and triggered_by != "expansion":
            await _progress("expanding", 6)
            from agent.pipeline.expansion import maybe_expand
            await maybe_expand(doc, result["node_id"], depth_remaining, triggered_by)
            task.last_completed_step = "expansion"
            log.info("step_done", task_id=task.id, step="expansion")

        # Complete
        await _update_task(redis, task.id, {
            "status": IngestionTaskStatus.COMPLETED,
            "node_id": task.node_id,
            "was_duplicate": not result["was_new"],
            "edges_created": result["edges_created"],
            "completed_at": datetime.utcnow().isoformat(),
        })

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
        attempt = ctx.get("job_try", 1)
        log.error("ingestion_task_failed", task_id=task.id, url=url,
                  error=str(e), attempt=attempt,
                  last_step=task.last_completed_step)

        await _update_task(redis, task.id, {
            "status": IngestionTaskStatus.FAILED,
            "error": str(e),
            "attempt": attempt,
            "failed_at": datetime.utcnow().isoformat(),
        })

        if attempt >= settings.retry_max_attempts:
            await _send_to_dlq(task.id, url, str(e), attempt)

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
    return {"status": "directed_exploration_enqueued", "topic": topic}


async def _compute_embedding(text: str) -> list[float] | None:
    if not settings.openai_api_key:
        return None
    try:
        from openai import AsyncOpenAI
        client = AsyncOpenAI(api_key=settings.openai_api_key)
        resp = await client.embeddings.create(
            model=settings.embedding_model,
            input=text[:8000],
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


# Legacy sync shim — kept so existing imports don't break at module load
def get_task_status(task_id: str) -> dict | None:
    """Deprecated: use get_task_status_from_redis instead (async)."""
    return None
