"""
Pipeline Step 4: Placement
Determines WHERE in the knowledge universe this document belongs:
  1. Find semantically similar nodes via pgvector
  2. Use understanding metadata to filter candidates
  3. LLM decides: new node vs. merge into existing + which edges to create
"""
from shared.config import get_settings
from shared.logging_config import get_logger
from shared.schemas.ingestion import NormalizedDocument
from shared.schemas.edge import RelationType

log = get_logger(__name__)
settings = get_settings()


async def place(
    doc: NormalizedDocument,
    understanding: dict,
    embedding: list[float] | None,
) -> dict:
    """
    Returns a placement decision:
    {
        action: "create" | "merge",
        merge_target_node_id: str | None,
        edges_to_create: [{"target_node_id": str, "relation_type": str, "confidence": float}],
        confidence: float,
    }
    """
    candidate_nodes = []

    # ── Find semantic neighbors ────────────────────────────────────────────
    if embedding:
        candidate_nodes = await _find_candidates(embedding)

    # ── Placement decision ─────────────────────────────────────────────────
    if not candidate_nodes:
        log.info("placement_decision_create_new", url=doc.canonical_url)
        return {
            "action": "create",
            "merge_target_node_id": None,
            "edges_to_create": [],
            "confidence": 1.0,
        }

    # LLM-based placement decision if key available
    if settings.openai_api_key and candidate_nodes:
        try:
            return await _llm_placement_decision(doc, understanding, candidate_nodes, embedding)
        except Exception as e:
            log.warning("llm_placement_failed", error=str(e))

    # Fallback: rule-based — if top candidate is very similar, suggest relates_to edges
    return _rule_based_placement(candidate_nodes)


async def _find_candidates(embedding: list[float]) -> list[dict]:
    """Query pgvector for the top-20 most similar existing nodes."""
    import httpx
    # Call Universe service search API
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"http://{settings.postgres_host}:8000/search",  # internal service call
                params={"q": "__vector__", "mode": "vector", "limit": 20},
                json={"embedding": embedding},
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
    except Exception as e:
        log.warning("candidate_search_failed", error=str(e))
    return []


async def _llm_placement_decision(
    doc: NormalizedDocument,
    understanding: dict,
    candidates: list[dict],
    embedding: list[float] | None,
) -> dict:
    from openai import AsyncOpenAI
    import json

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    candidates_summary = [
        {"id": c["id"], "title": c["title"], "similarity": round(c.get("similarity", 0), 3)}
        for c in candidates[:10]
    ]

    system_prompt = """You are a knowledge graph placement engine. Given a new document and a list of existing node candidates (with similarity scores), decide:
1. Should we CREATE a new node, or MERGE this into an existing node?
2. What edges should we create to connect this content to other nodes?

Return JSON with:
- action: "create" or "merge"
- merge_target_node_id: null or ID of node to merge into (only if action=merge, similarity > 0.95)  
- edges_to_create: array of {target_node_id, relation_type, confidence} (relation_type: relates_to/mentions/explains/supports/contradicts/derived_from/example_of)
- confidence: 0.0-1.0

Only merge if content is truly duplicate/extension. Prefer creating new nodes."""

    user_prompt = f"""New document:
- Title: {doc.title}
- Platform: {doc.platform}
- Topics: {understanding.get('topics', [])}
- Summary: {understanding.get('summary', '')[:300]}

Candidate existing nodes:
{json.dumps(candidates_summary, indent=2)}"""

    resp = await client.chat.completions.create(
        model=settings.llm_model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    return json.loads(resp.choices[0].message.content)


def _rule_based_placement(candidates: list[dict]) -> dict:
    """Simple rule-based placement when LLM is not available."""
    edges_to_create = []
    for c in candidates[:5]:
        sim = c.get("similarity", 0)
        if sim > 0.97:
            # Very high similarity → suggest merge
            return {
                "action": "merge",
                "merge_target_node_id": c["id"],
                "edges_to_create": [],
                "confidence": sim,
            }
        elif sim > 0.7:
            edges_to_create.append({
                "target_node_id": c["id"],
                "relation_type": RelationType.RELATES_TO,
                "confidence": round(sim, 3),
            })

    return {
        "action": "create",
        "merge_target_node_id": None,
        "edges_to_create": edges_to_create,
        "confidence": 1.0,
    }
