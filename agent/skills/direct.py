"""
Direct Text ingestion skill — reads raw text submitted via the frontend.
The API endpoint stores the text in Redis, and this skill reads it out
using a custom text:// URL scheme.
"""
from shared.config import get_settings
from agent.skills.base import BaseSkill
from shared.schemas.ingestion import ExtractedContent, NormalizedDocument, RawResponse
from universe.cache.redis import get_redis

class DirectTextSkill(BaseSkill):
    name = "direct_text"
    source_patterns = ["text://"]
    cost_tier = "free"
    base_confidence = 1.0

    async def connect(self, url: str) -> RawResponse:
        # url is of the form text://<uuid>
        r = await get_redis()
        content = await r.get(url) or ""
        # Optionally delete it after reading
        await r.delete(url)
        return RawResponse(
            url=url,
            content_type="text/plain",
            raw_content=content,
            status_code=200,
        )

    async def extract(self, raw: RawResponse) -> ExtractedContent:
        # For direct text, the first line is often a title
        lines = [line.strip() for line in raw.raw_content.split("\\n") if line.strip()]
        title = lines[0] if lines else "Direct User Input"
        
        return ExtractedContent(
            title=title,
            author="User",
            language="en",
            plain_text=raw.raw_content,
        )

    async def map_to_schema(self, extracted: ExtractedContent, url: str) -> NormalizedDocument:
        blocks = [
            {"block_type": "paragraph", "text": p.strip(), "order": i}
            for i, p in enumerate(extracted.plain_text.split("\\n\\n"))
            if p.strip()
        ]

        return NormalizedDocument(
            source_type="note",
            platform="direct",
            title=extracted.title[:200],  # Limit title length
            language="en",
            content_blocks=blocks[:200],
            raw_url=url,
            canonical_url=url,
        )
