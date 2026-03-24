"""
Pipeline Step 2: Normalization
Validates and normalizes the NormalizedDocument coming from the Skill layer.
Computes canonical URL, deduplicates links, and ensures schema compliance.
"""
import hashlib
import re
from urllib.parse import urlparse, urljoin, urlunparse

from shared.logging_config import get_logger
from shared.schemas.ingestion import NormalizedDocument

log = get_logger(__name__)

# Domains to exclude from outgoing link expansion  
_BLOCKED_DOMAINS = {
    "twitter.com", "facebook.com", "instagram.com",
    "ads.google.com", "doubleclick.net",
}


def normalize(doc: NormalizedDocument) -> NormalizedDocument:
    """
    Normalize a NormalizedDocument for safe pipeline consumption:
    - Canonicalize URL (strip tracking params, fragments)
    - Deduplicate and filter outgoing links
    - Recompute checksum if not set
    - Truncate oversized fields
    """
    # ── Canonical URL normalization ───────────────────────────────────────
    if doc.canonical_url:
        doc.canonical_url = _canonicalize_url(doc.canonical_url)
    if doc.raw_url:
        doc.raw_url = _canonicalize_url(doc.raw_url)

    # ── Link normalization ────────────────────────────────────────────────
    cleaned_links = []
    for link in doc.outgoing_links:
        try:
            canonical = _canonicalize_url(link)
            parsed = urlparse(canonical)
            if parsed.scheme not in ("http", "https"):
                continue
            if any(blocked in parsed.netloc for blocked in _BLOCKED_DOMAINS):
                continue
            cleaned_links.append(canonical)
        except Exception:
            continue

    # Deduplicate while preserving order
    seen = set()
    doc.outgoing_links = []
    for link in cleaned_links:
        if link not in seen:
            seen.add(link)
            doc.outgoing_links.append(link)
    doc.outgoing_links = doc.outgoing_links[:200]

    # ── Checksum ──────────────────────────────────────────────────────────
    if not doc.source_checksum:
        content_repr = f"{doc.canonical_url or doc.raw_url}:{doc.title}"
        doc.source_checksum = hashlib.sha256(content_repr.encode()).hexdigest()

    # ── Title sanitization ────────────────────────────────────────────────
    doc.title = doc.title.strip()[:512] if doc.title else "Untitled"

    # ── Content blocks cap ────────────────────────────────────────────────
    doc.content_blocks = doc.content_blocks[:200]

    log.debug(
        "normalization_complete",
        url=doc.canonical_url,
        blocks=len(doc.content_blocks),
        links=len(doc.outgoing_links),
    )
    return doc


def _canonicalize_url(url: str) -> str:
    """Remove tracking params, fragments; lowercase scheme and host."""
    _TRACKING_PARAMS = {
        "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
        "fbclid", "gclid", "ref", "source",
    }
    try:
        parsed = urlparse(url)
        from urllib.parse import parse_qs, urlencode
        params = {k: v for k, v in parse_qs(parsed.query).items()
                  if k.lower() not in _TRACKING_PARAMS}
        clean_query = urlencode(params, doseq=True)
        canonical = urlunparse((
            parsed.scheme.lower(),
            parsed.netloc.lower(),
            parsed.path,
            parsed.params,
            clean_query,
            "",  # strip fragment
        ))
        return canonical
    except Exception:
        return url
