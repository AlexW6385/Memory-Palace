"""
Universe Service — FastAPI application entrypoint.
"""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from shared.logging_config import configure_logging, get_logger
from universe.api.nodes import router as nodes_router
from universe.api.edges import router as edges_router
from universe.api.search import router as search_router
from universe.api.graph import router as graph_router
from universe.api.ws import router as ws_router, start_stream_broadcaster
from universe.cache.redis import close_redis
from universe.db.session import dispose_engines
from universe.events.consumer import run_consumer

settings = get_settings()
configure_logging(settings.log_level, service_name="universe")
log = get_logger(__name__)

_background_tasks: list[asyncio.Task] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("universe_service_starting")

    # Start Redis Streams consumer (idempotency + cache invalidation)
    consumer_task = asyncio.create_task(run_consumer())
    _background_tasks.append(consumer_task)

    # Start WebSocket broadcaster (real-time push to clients)
    broadcaster_task = asyncio.create_task(
        start_stream_broadcaster(
            settings.redis_url,
            settings.stream_name,
            "universe-ws-group",
        )
    )
    _background_tasks.append(broadcaster_task)

    log.info("universe_service_ready")
    yield

    log.info("universe_service_shutting_down")
    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)

    await close_redis()
    await dispose_engines()
    log.info("universe_service_stopped")


app = FastAPI(
    title="Knowledge Universe API",
    description="Core A — Knowledge node and graph management, search, and real-time events",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(nodes_router)
app.include_router(edges_router)
app.include_router(search_router)
app.include_router(graph_router)
app.include_router(ws_router)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "universe"}


@app.get("/")
async def root():
    return {
        "service": "Knowledge Universe",
        "docs": "/docs",
        "health": "/health",
    }
