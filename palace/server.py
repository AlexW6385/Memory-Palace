"""FastAPI app: serves the viewer and lets an LLM build new knowledge systems.

  GET  /                    the 3D viewer (web/)
  GET  /api/systems         systems currently in the palace
  POST /api/systems         {"topic": ..., "notes": ..., "provider": ..., "model": ...} → {"job": id}
  GET  /api/jobs/{id}       progress log and result of a generation job

Generation jobs run one at a time in the background; when a job finishes the
world is rebuilt and the viewer picks it up on reload.
"""
from __future__ import annotations

import asyncio
import os
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from palace.content import CONTENT_DIR, ROOT, ContentStore
from palace.generate import generate_system
from palace.llm import LLMError, make_provider
from palace.world import build_world_file

CONTENT = Path(os.environ.get("PALACE_CONTENT", CONTENT_DIR))
WEB = ROOT / "web"
WORLD = WEB / "data" / "world.json"

app = FastAPI(title="Memory Palace", version="2.0.0")
_jobs: dict[str, dict] = {}
_lock = asyncio.Lock()


class GenerateRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=200)
    notes: str = Field(default="", max_length=20000)
    provider: str | None = None
    model: str | None = None


@app.get("/api/systems")
def list_systems() -> list[dict]:
    store = ContentStore(CONTENT)
    return [{"id": s.id, "title": s.title.model_dump(), "template": s.architecture.template, "exhibits": len(s.exhibits())}
            for s in store.load_systems().values()]


@app.post("/api/systems", status_code=202)
async def create_system(req: GenerateRequest) -> dict:
    try:
        provider = make_provider(req.provider, req.model)
    except LLMError as e:
        raise HTTPException(status_code=400, detail=str(e))
    job_id = uuid.uuid4().hex[:12]
    job = {"id": job_id, "topic": req.topic, "status": "queued", "log": [], "system": None, "error": None,
           "created": time.time()}
    _jobs[job_id] = job
    asyncio.create_task(_run(job, req, provider))
    return {"job": job_id}


@app.get("/api/jobs/{job_id}")
def get_job(job_id: str) -> dict:
    job = _jobs.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="no such job")
    return job


async def _run(job: dict, req: GenerateRequest, provider) -> None:
    def log(line: str) -> None:
        job["log"].append(line)

    async with _lock:
        job["status"] = "running"
        try:
            store = ContentStore(CONTENT)
            system = await generate_system(req.topic, provider, store, notes=req.notes, log=log)
            log("building the world…")
            await asyncio.to_thread(build_world_file, CONTENT, WORLD)
            job["system"] = system.id
            job["status"] = "done"
            log("done — reload the page to walk in")
        except Exception as e:  # report every failure to the client
            job["status"] = "failed"
            job["error"] = str(e)
            log(f"failed: {e}")


app.mount("/", StaticFiles(directory=WEB, html=True), name="web")
