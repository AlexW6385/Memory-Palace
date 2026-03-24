"""
Generic web article skill — handles any HTML URL using trafilatura.
Fallback skill for URLs not matched by specialized skills.
"""
import httpx

from agent.skills.base import BaseSkill
from shared.schemas.ingestion import ExtractedContent, NormalizedDocument, RawResponse


class WebArticleSkill(BaseSkill):
    name = "web_article"
    source_patterns = []  # catch-all — also used as fallback
    cost_tier = "free"
    base_confidence = 0.8

    async def connect(self, url: str) -> RawResponse:
        headers = {
            "User-Agent": "KnowledgeUniverse/0.1 (+https://github.com/ku-engine)",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return RawResponse(
                url=str(response.url),
                content_type=response.headers.get("content-type", "text/html"),
                raw_content=response.text,
                headers=dict(response.headers),
                status_code=response.status_code,
            )

    async def extract(self, raw: RawResponse) -> ExtractedContent:
        try:
            import trafilatura
            from trafilatura.settings import use_config

            extracted = trafilatura.extract(
                raw.raw_content,
                include_links=True,
                include_tables=True,
                include_comments=False,
                with_metadata=True,
                output_format="json",
            )

            if extracted:
                import json
                data = json.loads(extracted)
                return ExtractedContent(
                    title=data.get("title") or "",
                    author=data.get("author"),
                    published_at=_parse_date(data.get("date")),
                    language=data.get("language", "en"),
                    plain_text=data.get("text") or "",
                    outgoing_links=_extract_links(data.get("links", [])),
                    tags=data.get("tags", []),
                )
        except Exception:
            pass

        # Fallback: BeautifulSoup
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(raw.raw_content, "html.parser")
        title = soup.find("title")
        paragraphs = [p.get_text(strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]
        links = [a.get("href", "") for a in soup.find_all("a", href=True)]

        return ExtractedContent(
            title=title.get_text() if title else "",
            plain_text="\n".join(paragraphs),
            outgoing_links=[lnk for lnk in links if lnk.startswith("http")][:50],
        )

    async def map_to_schema(self, extracted: ExtractedContent, url: str) -> NormalizedDocument:
        from urllib.parse import urlparse
        platform = urlparse(url).netloc.replace("www.", "")

        # Split plain_text into content_blocks
        blocks = [
            {"block_type": "paragraph", "text": para.strip(), "order": i}
            for i, para in enumerate(extracted.plain_text.split("\n\n"))
            if para.strip()
        ]

        return NormalizedDocument(
            source_type="article",
            platform=platform,
            title=extracted.title,
            author=extracted.author,
            published_at=extracted.published_at,
            language=extracted.language or "en",
            content_blocks=blocks[:200],  # cap at 200 blocks
            outgoing_links=extracted.outgoing_links[:100],
            tags=extracted.tags,
            raw_url=url,
            canonical_url=url,
        )


def _parse_date(date_str: str | None):
    if not date_str:
        return None
    try:
        from datetime import datetime
        return datetime.fromisoformat(date_str)
    except Exception:
        return None


def _extract_links(links) -> list[str]:
    if isinstance(links, list):
        return [str(lnk) for lnk in links if str(lnk).startswith("http")][:100]
    return []
