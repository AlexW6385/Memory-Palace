"""
BaseSkill — abstract base class that all platform-specific skills must implement.

Three-layer architecture:
  Layer 1: Connector — knows HOW to reach the platform
  Layer 2: Extractor — knows WHAT to pull from the response
  Layer 3: Mapper   — knows HOW to convert to NormalizedDocument

Each skill is self-contained: it declares its supported source patterns,
runs all three layers via `run(url)`, and returns a NormalizedDocument.
"""
import hashlib
from abc import ABC, abstractmethod

from shared.schemas.ingestion import (
    ExtractedContent,
    NormalizedDocument,
    RawResponse,
)


class BaseSkill(ABC):
    """Abstract base for all ingestion skills."""

    # Subclasses declare which URL domain patterns they handle
    # e.g. ["wikipedia.org", "en.wikipedia.org"]
    source_patterns: list[str] = []

    # Human-readable skill name (used in registry and logs)
    name: str = "base"

    # Estimated cost tier: "free" | "cheap" | "expensive"
    cost_tier: str = "free"

    # Confidence level of extracted content
    base_confidence: float = 1.0

    # ── Three-layer interface ─────────────────────────────────────────────

    @abstractmethod
    async def connect(self, url: str) -> RawResponse:
        """Layer 1: Fetch raw content from the platform."""
        ...

    @abstractmethod
    async def extract(self, raw: RawResponse) -> ExtractedContent:
        """Layer 2: Parse and extract structured content from raw response."""
        ...

    @abstractmethod
    async def map_to_schema(self, extracted: ExtractedContent, url: str) -> NormalizedDocument:
        """Layer 3: Map extracted content to the unified NormalizedDocument schema."""
        ...

    # ── Full pipeline execution ───────────────────────────────────────────

    async def run(self, url: str) -> NormalizedDocument:
        """
        Execute all three layers in order.
        This is what the Integration Pipeline calls.
        """
        raw = await self.connect(url)
        extracted = await self.extract(raw)
        doc = await self.map_to_schema(extracted, url)
        doc.skill_name = self.name
        # Compute source checksum from raw content for dedup
        if not doc.source_checksum:
            raw_bytes = raw.raw_content if isinstance(raw.raw_content, bytes) else raw.raw_content.encode()
            doc.source_checksum = hashlib.sha256(raw_bytes).hexdigest()
        return doc

    @classmethod
    def supports(cls, url: str) -> bool:
        """Check if this skill supports the given URL."""
        from urllib.parse import urlparse
        try:
            parsed = urlparse(url)
            # Check scheme (e.g., text://)
            if any(p.lower().startswith(f"{parsed.scheme}://") for p in cls.source_patterns):
                return True
            # Check hostname (e.g., wikipedia.org)
            host = parsed.netloc.lower()
            return any(p.lower() in host for p in cls.source_patterns)
        except Exception:
            return False

    def __repr__(self) -> str:
        return f"<Skill name={self.name} patterns={self.source_patterns}>"
