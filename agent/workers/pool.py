"""
Arq worker pool setup.
Arq is async-native Redis-backed job queue.

Concurrency limits are applied at two levels:
  1. Per-skill semaphores in the Skill Registry (fine-grained)
  2. Global max_jobs in ArqWorker settings (coarse ceiling)
"""
from arq import create_pool
from arq.connections import RedisSettings

from shared.config import get_settings
from shared.logging_config import get_logger

log = get_logger(__name__)
settings = get_settings()

_pool = None


def _redis_settings() -> RedisSettings:
    return RedisSettings(
        host=settings.redis_host,
        port=settings.redis_port,
        database=settings.redis_db,
        password=settings.redis_password,
    )


async def get_arq_pool():
    global _pool
    if _pool is None:
        _pool = await create_pool(_redis_settings())
    return _pool


async def close_arq_pool() -> None:
    global _pool
    if _pool:
        await _pool.aclose()
        _pool = None


def get_worker_settings():
    """
    Return Arq WorkerSettings class for use with `arq worker agent.workers.pool.WorkerSettings`.
    """
    from agent.workers.tasks import ingest_url_task, run_directed_exploration

    class WorkerSettings:
        functions = [ingest_url_task, run_directed_exploration]
        redis_settings = _redis_settings()
        max_jobs = settings.worker_max_jobs
        job_timeout = 600       # 10 min max per job
        keep_result = 3600      # keep results for 1 hour
        retry_jobs = True
        max_tries = settings.retry_max_attempts
        health_check_interval = 30  # heartbeat every 30s

        # Queues: ingestion (normal priority) and expansion (low priority)
        queue_read_limit = 100

    return WorkerSettings
