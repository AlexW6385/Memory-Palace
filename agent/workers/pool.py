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


from agent.workers.tasks import ingest_url_task, run_directed_exploration


async def startup(ctx: dict) -> None:
    """Worker startup hook: initialise skill registry and logging."""
    from shared.logging_config import configure_logging
    configure_logging(settings.log_level, service_name="agent_worker")
    from agent.skills.registry import setup_registry
    setup_registry(settings)
    log.info("worker_startup_complete")


async def shutdown(ctx: dict) -> None:
    log.info("worker_shutdown")


class WorkerSettings:
    """
    Arq WorkerSettings class for use with `arq agent.workers.pool.WorkerSettings`.
    """
    functions = [ingest_url_task, run_directed_exploration]
    on_startup = startup
    on_shutdown = shutdown
    redis_settings = _redis_settings()
    max_jobs = settings.worker_max_jobs
    job_timeout = 600       # 10 min max per job
    keep_result = 3600      # keep results for 1 hour
    retry_jobs = True
    max_tries = settings.retry_max_attempts
    health_check_interval = 30  # heartbeat every 30s

    # Queues: ingestion (normal priority) and expansion (low priority)
    queue_read_limit = 100
