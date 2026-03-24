"""
PDF ingestion skill — downloads PDF and extracts text using pymupdf.
Supports both http(s) URLs and local file paths.
"""
import io
from pathlib import Path

import httpx

from agent.skills.base import BaseSkill
from shared.schemas.ingestion import ExtractedContent, NormalizedDocument, RawResponse


class PdfSkill(BaseSkill):
    name = "pdf"
    source_patterns = [".pdf"]  # matched on URL path suffix
    cost_tier = "free"
    base_confidence = 0.85

    async def connect(self, url: str) -> RawResponse:
        if url.startswith("http"):
            async with httpx.AsyncClient(follow_redirects=True, timeout=60) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                return RawResponse(
                    url=url,
                    content_type="application/pdf",
                    raw_content=resp.content,
                    status_code=resp.status_code,
                )
        else:
            # Local file
            content = Path(url).read_bytes()
            return RawResponse(
                url=url,
                content_type="application/pdf",
                raw_content=content,
                status_code=200,
            )

    async def extract(self, raw: RawResponse) -> ExtractedContent:
        import fitz  # pymupdf

        pdf_bytes = raw.raw_content if isinstance(raw.raw_content, bytes) else raw.raw_content.encode()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        title = doc.metadata.get("title") or ""
        author = doc.metadata.get("author") or None
        pages_text = []

        for page_num, page in enumerate(doc):
            text = page.get_text("text")
            if text.strip():
                pages_text.append(text.strip())
            if page_num > 50:  # cap at 50 pages
                break

        full_text = "\n\n".join(pages_text)
        doc.close()

        return ExtractedContent(
            title=title,
            author=author,
            language="en",
            plain_text=full_text,
        )

    async def map_to_schema(self, extracted: ExtractedContent, url: str) -> NormalizedDocument:
        # Split into per-page blocks
        pages = extracted.plain_text.split("\n\n")
        blocks = [
            {"block_type": "paragraph", "text": p.strip(), "order": i}
            for i, p in enumerate(pages)
            if p.strip()
        ]

        return NormalizedDocument(
            source_type="pdf",
            platform="pdf",
            title=extracted.title or url.split("/")[-1],
            author=extracted.author,
            language="en",
            content_blocks=blocks[:200],
            raw_url=url,
            canonical_url=url,
        )

    @classmethod
    def supports(cls, url: str) -> bool:
        from urllib.parse import urlparse
        path = urlparse(url).path.lower()
        return path.endswith(".pdf")
