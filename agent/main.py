"""
Agent Service — FastAPI application entrypoint.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from shared.logging_config import configure_logging, get_logger
from agent.api.tasks import router as tasks_router
from agent.api.skills import router as skills_router
from agent.skills.registry import setup_registry
from agent.workers.pool import close_arq_pool

settings = get_settings()
configure_logging(settings.log_level, service_name="agent")
log = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("agent_service_starting")

    # Initialize skill registry and concurrency limits
    setup_registry(settings)

    log.info("agent_service_ready")
    yield

    log.info("agent_service_shutting_down")
    await close_arq_pool()
    log.info("agent_service_stopped")


app = FastAPI(
    title="Agent Ingestion API",
    description="Core B — Agent Ingestion & Integration task submission",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tasks_router)
app.include_router(skills_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent"}
