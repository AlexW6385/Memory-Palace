"""
arXiv skill — fetches paper metadata and abstract via the arXiv API.
"""
import httpx
import xml.etree.ElementTree as ET
from datetime import datetime

from agent.skills.base import BaseSkill
from shared.schemas.ingestion import ExtractedContent, NormalizedDocument, RawResponse

NS = {"atom": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}


class ArxivSkill(BaseSkill):
    name = "arxiv"
    source_patterns = ["arxiv.org"]
    cost_tier = "free"
    base_confidence = 0.98  # arXiv papers are pre-print academic

    async def connect(self, url: str) -> RawResponse:
        paper_id = self._extract_id(url)
        api_url = f"https://export.arxiv.org/api/query?id_list={paper_id}"

        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(api_url)
            resp.raise_for_status()
            return RawResponse(
                url=url,
                content_type="application/xml",
                raw_content=resp.text,
                status_code=resp.status_code,
            )

    async def extract(self, raw: RawResponse) -> ExtractedContent:
        root = ET.fromstring(raw.raw_content)
        entry = root.find("atom:entry", NS)
        if entry is None:
            return ExtractedContent(title="Unknown arXiv paper", plain_text="")

        title = _text(entry.find("atom:title", NS))
        abstract = _text(entry.find("atom:summary", NS))
        published_str = _text(entry.find("atom:published", NS))
        published_at = None
        if published_str:
            try:
                published_at = datetime.fromisoformat(published_str.rstrip("Z"))
            except Exception:
                pass

        authors = [
            _text(author.find("atom:name", NS))
            for author in entry.findall("atom:author", NS)
        ]

        categories = [
            tag.get("term", "")
            for tag in entry.findall("atom:category", NS)
        ]

        links = [
            link.get("href", "")
            for link in entry.findall("atom:link", NS)
            if link.get("href", "").startswith("http")
        ]

        return ExtractedContent(
            title=title,
            author=", ".join(filter(None, authors)),
            published_at=published_at,
            language="en",
            plain_text=abstract,
            tags=categories,
            outgoing_links=links,
        )

    async def map_to_schema(self, extracted: ExtractedContent, url: str) -> NormalizedDocument:
        paper_id = self._extract_id(url)
        canonical = f"https://arxiv.org/abs/{paper_id}"

        blocks = [{"block_type": "paragraph", "text": extracted.plain_text, "order": 0}]

        return NormalizedDocument(
            source_type="paper",
            platform="arxiv",
            title=extracted.title,
            author=extracted.author,
            published_at=extracted.published_at,
            language="en",
            content_blocks=blocks,
            tags=extracted.tags,
            outgoing_links=extracted.outgoing_links,
            raw_url=url,
            canonical_url=canonical,
        )

    @staticmethod
    def _extract_id(url: str) -> str:
        """Extract arXiv paper ID from URL like https://arxiv.org/abs/2301.12345."""
        from urllib.parse import urlparse
        path = urlparse(url).path
        parts = path.strip("/").split("/")
        # /abs/2301.12345 or /pdf/2301.12345
        return parts[-1].replace(".pdf", "")


def _text(element) -> str:
    if element is None:
        return ""
    return (element.text or "").strip()
