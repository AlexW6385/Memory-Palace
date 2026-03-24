"""
Skill Registry — routes URLs to the correct skill.

Skills self-register by being imported. The registry matches
a URL to the first skill whose source_patterns match.
Each skill can declare per-domain concurrency limits which are
enforced via asyncio.Semaphore.
"""
import asyncio
from typing import Type

from agent.skills.base import BaseSkill
from shared.logging_config import get_logger
from shared.schemas.ingestion import NormalizedDocument

log = get_logger(__name__)


class SkillRegistry:
    """
    Central registry for all ingestion skills.
    Provides URL-based routing and per-skill concurrency control.
    """

    def __init__(self):
        self._skills: list[Type[BaseSkill]] = []
        self._semaphores: dict[str, asyncio.Semaphore] = {}

    def register(self, skill_cls: Type[BaseSkill], max_concurrency: int = 10) -> None:
        """Register a skill class with its concurrency limit."""
        self._skills.append(skill_cls)
        self._semaphores[skill_cls.name] = asyncio.Semaphore(max_concurrency)
        log.info("skill_registered", skill=skill_cls.name, max_concurrency=max_concurrency)

    def resolve(self, url: str) -> Type[BaseSkill] | None:
        """Find the best-matching skill for a URL."""
        for skill_cls in self._skills:
            if skill_cls.supports(url):
                return skill_cls
        return None

    async def run(self, url: str) -> NormalizedDocument:
        """
        Route URL to skill, enforce per-skill concurrency semaphore, execute pipeline.
        Raises ValueError if no skill matches the URL.
        """
        skill_cls = self.resolve(url)
        if skill_cls is None:
            log.warning("no_skill_for_url", url=url)
            # Fall back to generic web article skill
            from agent.skills.web_article import WebArticleSkill
            skill_cls = WebArticleSkill

        sem = self._semaphores.get(skill_cls.name)
        skill = skill_cls()

        if sem:
            async with sem:
                log.debug("skill_running", skill=skill_cls.name, url=url)
                return await skill.run(url)
        else:
            return await skill.run(url)

    def list_skills(self) -> list[dict]:
        """Return metadata for all registered skills."""
        return [
            {
                "name": cls.name,
                "source_patterns": cls.source_patterns,
                "cost_tier": cls.cost_tier,
                "max_concurrency": self._semaphores.get(cls.name, asyncio.Semaphore(1))._value,
            }
            for cls in self._skills
        ]


# ── Singleton registry (initialized at startup) ───────────────────────────────

registry = SkillRegistry()


def setup_registry(settings) -> None:
    """Register all skills with their configured concurrency limits. Call at startup."""
    from agent.skills.web_article import WebArticleSkill
    from agent.skills.wikipedia import WikipediaSkill
    from agent.skills.arxiv import ArxivSkill
    from agent.skills.pdf import PdfSkill
    from agent.skills.direct import DirectTextSkill

    registry.register(WikipediaSkill, max_concurrency=settings.skill_concurrency_wikipedia)
    registry.register(ArxivSkill, max_concurrency=settings.skill_concurrency_arxiv)
    registry.register(PdfSkill, max_concurrency=settings.skill_concurrency_pdf)
    registry.register(WebArticleSkill, max_concurrency=settings.skill_concurrency_web)
    registry.register(DirectTextSkill, max_concurrency=100)

    log.info("skill_registry_ready", count=len(registry._skills))
