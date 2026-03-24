"""
/skills REST endpoints — expose registered skills and limits.
"""
from fastapi import APIRouter

from agent.skills.registry import registry

router = APIRouter(prefix="/skills", tags=["skills"])


@router.get("")
async def list_skills():
    """
    List all loaded ingestion skills and their configuration (e.g. concurrency limits).
    """
    return {"skills": registry.list_skills()}
