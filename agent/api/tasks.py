"""
/tasks REST endpoints for submitting ingestion tasks.
"""
import uuid
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, HttpUrl

from shared.logging_config import get_logger
from agent.workers.pool import get_arq_pool
from agent.workers.tasks import get_task_status
from shared.config import get_settings

log = get_logger(__name__)
settings = get_settings()
router = APIRouter(prefix="/tasks", tags=["tasks"])


class IngestRequest(BaseModel):
    url: HttpUrl
    depth: int = Query(0, ge=0, le=3, description="Expansion depth allowed")
    idempotency_key: str | None = None

class DirectIngestRequest(BaseModel):
    text: str
    idempotency_key: str | None = None


class DirectedExplorationRequest(BaseModel):
    topic: str
    depth: int = Query(2, ge=1, le=5)
    max_nodes: int = Query(20, ge=1, le=100)


@router.post("/ingest", status_code=202)
async def submit_ingestion(req: IngestRequest):
    """
    Submit a URL for processing via the Knowledge Integration pipeline.
    Returns the task ID immediately.
    """
    pool = await get_arq_pool()

    url_str = str(req.url)
    task_id = str(uuid.uuid4())

    try:
        job = await pool.enqueue_job(
            "ingest_url_task",
            url=url_str,
            task_id=task_id,
            depth_remaining=req.depth,
            triggered_by="user",
            idempotency_key=req.idempotency_key,
        )
        if job is None:
            raise HTTPException(status_code=503, detail="Worker queue full or unavailable.")

        log.info("ingestion_task_submitted", task_id=job.job_id, url=url_str)
        return {"task_id": job.job_id, "status": "enqueued", "url": url_str}
    except Exception as e:
        log.error("ingestion_submit_error", error=str(e), url=url_str)
        raise HTTPException(status_code=500, detail="Failed to enqueue task.")


@router.post("/ingest/direct", status_code=202)
async def submit_direct_ingestion(req: DirectIngestRequest):
    """
    Directly ingest user-submitted raw text (skips acquisition download).
    """
    from universe.cache.redis import get_redis
    pool = await get_arq_pool()
    r = await get_redis()
    
    task_id = str(uuid.uuid4())
    virtual_url = f"text://{task_id}"
    
    # Store text in Redis temporarily for the skill to pick up (expires in 10 mins)
    await r.setex(virtual_url, 600, req.text)

    try:
        job = await pool.enqueue_job(
            "ingest_url_task",
            url=virtual_url,
            task_id=task_id,
            depth_remaining=0,  # Explicit direct notes don't expand links implicitly
            triggered_by="user_direct",
            idempotency_key=req.idempotency_key,
        )
        if job is None:
            raise HTTPException(status_code=503, detail="Worker queue full.")
        return {"task_id": job.job_id, "status": "enqueued", "url": virtual_url}
    except Exception as e:
        log.error("direct_ingest_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to enqueue direct ingestion.")

@router.get("/{task_id}")
async def get_task(task_id: str):
    """
    Check the current status of an ingestion task.
    """
    status = get_task_status(task_id)
    if status is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return status


@router.post("/explore", status_code=202)
async def submit_directed_exploration(req: DirectedExplorationRequest):
    """
    Start an agent-driven directed exploration on a topic.
    """
    pool = await get_arq_pool()
    try:
        job = await pool.enqueue_job(
            "run_directed_exploration",
            topic=req.topic,
            depth=req.depth,
            max_nodes=req.max_nodes,
        )
        if job is None:
            raise HTTPException(status_code=503, detail="Worker queue full.")
        return {"task_id": job.job_id, "status": "exploration_enqueued", "topic": req.topic}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to enqueue exploration task.")
