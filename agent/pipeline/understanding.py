"""
Pipeline Step 3: Understanding
Uses LLM to classify the document, extract entities, generate summary,
and identify content type. Falls back to rule-based heuristics when LLM
is unavailable or cost is too high.

Three-tier approach (from cheapest to most expensive):
  Tier 1: Rule-based (always runs) — content type, language, basic tags
  Tier 2: Cheap LLM call — summary, topic labels
  Tier 3: Full LLM analysis — entity extraction, relation candidates (optional)
"""
import re
from shared.config import get_settings
from shared.logging_config import get_logger
from shared.schemas.ingestion import NormalizedDocument

log = get_logger(__name__)
settings = get_settings()


async def understand(doc: NormalizedDocument) -> dict:
    """
    Analyze the document and return understanding metadata:
    {
        summary: str,
        topics: list[str],
        entities: list[str],
        content_type: str,
        possible_relation_candidates: list[str],
        requires_review: bool,
    }
    """
    # ── Tier 1: Rule-based ────────────────────────────────────────────────
    understanding = _rule_based_analysis(doc)

    # ── Tier 2: LLM (if API key available) ───────────────────────────────
    if settings.openai_api_key:
        try:
            llm_result = await _llm_analysis(doc)
            understanding.update(llm_result)
        except Exception as e:
            log.warning("llm_understanding_failed", error=str(e), url=doc.canonical_url)
            # gracefully degrade — rule-based result is still valid
    else:
        log.debug("llm_skipped_no_api_key")

    log.info(
        "understanding_complete",
        url=doc.canonical_url,
        content_type=understanding.get("content_type"),
        topics=understanding.get("topics"),
    )
    return understanding


def _rule_based_analysis(doc: NormalizedDocument) -> dict:
    """Fast, free rule-based analysis."""
    # Detect content type
    content_type = doc.source_type  # from skill

    # Platform-based rules
    platform_type_map = {
        "wikipedia": "wiki",
        "arxiv": "paper",
        "pdf": "pdf",
        "github.com": "code",
        "news": "article",
    }
    for platform, ctype in platform_type_map.items():
        if platform in (doc.platform or "").lower():
            content_type = ctype
            break

    # Extract keywords from title as provisional topics
    title_words = re.findall(r"\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b", doc.title or "")
    topics = list(set(doc.tags + title_words))[:10]

    # Very rough summary if none
    plain_text = " ".join(
        block.get("text", "") for block in doc.content_blocks[:3]
    )
    summary = plain_text[:400] if plain_text else doc.title

    return {
        "summary": summary,
        "topics": topics,
        "entities": [],
        "content_type": content_type,
        "possible_relation_candidates": [],
        "requires_review": False,
    }


async def _llm_analysis(doc: NormalizedDocument) -> dict:
    """LLM-based deep analysis — summary, topics, entities."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # Build a compact representation of the document
    content_preview = " ".join(
        block.get("text", "") for block in doc.content_blocks[:5]
    )[:1500]

    system_prompt = """You are a knowledge graph assistant. Analyze the given content and return a JSON object with these exact fields:
- summary: 2-3 sentence summary
- topics: list of 3-7 topic labels (short noun phrases)
- entities: list of named entities (people, orgs, concepts, places)
- content_type: one of [article, paper, wiki, pdf, note, video_transcript, unknown]
- possible_relation_candidates: list of concepts this content likely relates to
- requires_review: boolean — true if content seems low quality, controversial, or uncertain

Respond ONLY with valid JSON."""

    user_prompt = f"""Title: {doc.title}
Platform: {doc.platform}
Content: {content_preview}"""

    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    import json
    result = json.loads(resp.choices[0].message.content)
    return result
