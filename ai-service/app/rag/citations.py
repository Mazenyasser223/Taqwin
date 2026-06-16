"""
Tier 3 — grounded citations for coach RAG replies.

Format: [L2: Bench Press] or [L5: Book Chapter]
"""

from __future__ import annotations

import re
from typing import Any

from app.rag.types import RagHit
from app.services.cag_sanitize import sanitize_rag_title

CITATION_RE = re.compile(
    r"\[(L[125](?:_[A-Z]+)?|BOOK(?:\s+REFERENCE)?):\s*([^\]]{1,120})\]",
    re.IGNORECASE,
)


def level_short(level: str) -> str:
    if not level:
        return "L?"
    if level.startswith("L") and "_" in level:
        return level.split("_")[0]
    return level


def citation_tag(hit: RagHit) -> str:
    title = sanitize_rag_title(hit.title or "Untitled", level=hit.level)
    short = level_short(hit.level)
    if hit.level == "L5_BOOKS":
        short = "L5"
    return f"[{short}: {title}]"


def build_citation_index(hits: list[RagHit]) -> dict[str, dict[str, Any]]:
    """Map citation tag (normalized) → hit metadata for validation."""
    index: dict[str, dict[str, Any]] = {}
    for hit in hits:
        tag = citation_tag(hit)
        key = tag.lower()
        index[key] = {
            "tag": tag,
            "chunkId": hit.chunk_id,
            "source": hit.source,
            "level": hit.level,
            "title": hit.title,
        }
    return index


def validate_citations(
    reply: str,
    hits: list[RagHit],
    *,
    require_at_least_one: bool = False,
) -> dict[str, Any]:
    """
    Post-process coach reply citations against retrieved hits.

    Returns stats: found, valid, invalid, missing_required.
    """
    index = build_citation_index(hits)
    found = CITATION_RE.findall(reply or "")
    valid: list[str] = []
    invalid: list[str] = []

    for level_part, title_part in found:
        candidate = f"[{level_part.strip()}: {title_part.strip()}]".lower()
        matched = False
        for key in index:
            if title_part.strip().lower() in key or key in candidate:
                valid.append(candidate)
                matched = True
                break
        if not matched:
            for hit in hits:
                title = (hit.title or "").lower()
                if title and title_part.strip().lower() in title:
                    valid.append(candidate)
                    matched = True
                    break
        if not matched:
            invalid.append(candidate)

    stats: dict[str, Any] = {
        "citationCount": len(found),
        "validCount": len(valid),
        "invalidCount": len(invalid),
        "invalid": invalid[:8],
        "hasHits": len(hits) > 0,
        "missingRequired": False,
    }
    if require_at_least_one and hits and not found:
        stats["missingRequired"] = True
    return stats


def append_citation_reminder(reply: str, stats: dict[str, Any], *, locale: str = "en") -> str:
    """Optional soft nudge when RAG hits exist but no citations were used."""
    if not stats.get("hasHits") or stats.get("citationCount", 0) > 0:
        return reply
    if locale == "ar":
        note = "\n\n_(ملاحظة: الإجابة مبنية على مقتطفات من قاعدة المعرفة.)_"
    else:
        note = "\n\n_(Note: answer grounded in retrieved knowledge base.)_"
    return (reply or "").rstrip() + note
