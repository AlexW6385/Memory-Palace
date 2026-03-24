"""
Wikipedia skill — uses the Wikipedia REST API for clean structured extraction.
"""
import httpx

from agent.skills.base import BaseSkill
from shared.schemas.ingestion import ExtractedContent, NormalizedDocument, RawResponse


class WikipediaSkill(BaseSkill):
    name = "wikipedia"
    source_patterns = ["wikipedia.org"]
    cost_tier = "free"
    base_confidence = 0.95  # Wikipedia is high-quality

    _API_BASE = "https://en.wikipedia.org/api/rest_v1"

    async def connect(self, url: str) -> RawResponse:
        title = self._extract_title(url)
        api_url = f"{self._API_BASE}/page/summary/{title}"

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(api_url, headers={"Accept": "application/json"})
            resp.raise_for_status()
            # Also fetch full content separately
            content_resp = await client.get(
                f"{self._API_BASE}/page/mobile-sections/{title}",
                headers={"Accept": "application/json"},
            )
            combined = {
                "summary": resp.json(),
                "sections": content_resp.json() if content_resp.status_code == 200 else {},
                "original_url": url,
            }
            import json
            return RawResponse(
                url=url,
                content_type="application/json",
                raw_content=json.dumps(combined),
                status_code=resp.status_code,
            )

    async def extract(self, raw: RawResponse) -> ExtractedContent:
        import json
        data = json.loads(raw.raw_content)
        summary = data.get("summary", {})
        sections_data = data.get("sections", {})

        # Extract sections
        sections = []
        for section in sections_data.get("remaining", {}).get("sections", [])[:10]:
            text = _strip_html(section.get("text", ""))
            if text:
                sections.append({"heading": section.get("line", ""), "text": text})

        # Extract related links from summary
        links = []
        for link_obj in summary.get("content_urls", {}).get("desktop", {}).values():
            if isinstance(link_obj, str) and link_obj.startswith("http"):
                links.append(link_obj)

        return ExtractedContent(
            title=summary.get("title", ""),
            author=None,  # Wikipedia articles are community-authored
            language=summary.get("lang", "en"),
            plain_text=summary.get("extract", ""),
            sections=sections,
            outgoing_links=links,
            tags=[cat for cat in summary.get("categories", [])],
        )

    async def map_to_schema(self, extracted: ExtractedContent, url: str) -> NormalizedDocument:
        blocks = [
            {"block_type": "paragraph", "text": extracted.plain_text, "order": 0}
        ]
        for i, section in enumerate(extracted.sections, start=1):
            blocks.append({"block_type": "heading", "text": section["heading"], "order": i * 2 - 1})
            blocks.append({"block_type": "paragraph", "text": section["text"], "order": i * 2})

        return NormalizedDocument(
            source_type="wiki",
            platform="wikipedia",
            title=extracted.title,
            language=extracted.language or "en",
            content_blocks=blocks,
            outgoing_links=extracted.outgoing_links,
            tags=extracted.tags,
            raw_url=url,
            canonical_url=f"https://en.wikipedia.org/wiki/{extracted.title.replace(' ', '_')}",
        )

    @staticmethod
    def _extract_title(url: str) -> str:
        from urllib.parse import urlparse, unquote
        path = urlparse(url).path
        # /wiki/Knowledge_graph → Knowledge_graph
        parts = path.split("/wiki/")
        if len(parts) > 1:
            return unquote(parts[-1])
        return path.strip("/").split("/")[-1]


def _strip_html(text: str) -> str:
    try:
        from bs4 import BeautifulSoup
        return BeautifulSoup(text, "html.parser").get_text(separator=" ", strip=True)
    except Exception:
        import re
        return re.sub(r"<[^>]+>", "", text)
