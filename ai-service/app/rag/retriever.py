"""
Block B6 — RAG retriever: intent → levels → Node pgvector search → ranked chunks.
Pre-E: always prepend L5 philosophy; prompt shows books first.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.clients.node_internal import NodeInternalError, rag_search
from app.config import get_settings
from app.intent.router import IntentResult, route_intent
from app.rag.levels import (
    CONTEXT_DISPLAY_ORDER,
    L5_BOOKS,
    levels_for_intent,
    sort_hits_for_prompt,
    sort_levels,
)

logger = logging.getLogger(__name__)

SCIENTIFIC_DISCLAIMER = (
    "General fitness information only — not medical advice. "
    "Consult a doctor or registered dietitian for clinical conditions."
)


@dataclass(frozen=True)
class RagHit:
    chunk_id: str
    document_id: str
    level: str
    source: str
    title: str
    locale: str
    content: str
    score: float
    metadata: dict[str, Any] | None

    @classmethod
    def from_node_result(cls, row: dict[str, Any]) -> RagHit:
        return cls(
            chunk_id=str(row.get("chunkId") or ""),
            document_id=str(row.get("documentId") or ""),
            level=str(row.get("level") or ""),
            source=str(row.get("source") or ""),
            title=str(row.get("title") or ""),
            locale=str(row.get("locale") or "en"),
            content=str(row.get("content") or ""),
            score=float(row.get("score") or 0),
            metadata=row.get("metadata") if isinstance(row.get("metadata"), dict) else None,
        )


def _merge_hits(hits: list[RagHit], max_total: int) -> list[RagHit]:
    """Dedupe by chunk_id; sort for coach prompt (L5 first, then score)."""
    seen: set[str] = set()
    unique: list[RagHit] = []
    for hit in hits:
        key = hit.chunk_id or f"{hit.level}:{hit.title}:{hit.content[:80]}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(hit)

    return sort_hits_for_prompt(unique)[:max_total]


def _search_level(
    *,
    query: str,
    level: str,
    limit: int,
    min_score: float | None,
) -> list[RagHit]:
    payload = rag_search(
        query=query,
        levels=[level],
        limit=limit,
        locale=None,
        min_score=min_score if min_score and min_score > 0 else None,
    )
    out: list[RagHit] = []
    for row in payload.get("results") or []:
        hit = RagHit.from_node_result(row)
        if hit.content:
            out.append(hit)
    return out


def retrieve_rag(
    *,
    query: str,
    locale: str = "en",
    intent: str | None = None,
    levels: list[str] | None = None,
    routing: IntentResult | None = None,
    limit_per_level: int | None = None,
) -> tuple[str, list[str], list[RagHit]]:
    """
    Run retrieval for one user message.

    Returns (intent, levels_used, hits).
    """
    settings = get_settings()
    explicit_override = intent is not None or levels is not None

    if routing is None and not explicit_override:
        routing = route_intent(query, locale=locale)

    if routing is not None and not routing.needs_rag:
        return routing.intent, [], []

    resolved_intent = intent or (routing.intent if routing else "general")

    if levels is not None:
        level_list = sort_levels(levels)
    elif routing and routing.levels:
        level_list = sort_levels(list(routing.levels))
    else:
        level_list = sort_levels(levels_for_intent(resolved_intent))

    if not level_list:
        return resolved_intent, [], []

    per_level = limit_per_level or settings.rag_limit_per_level
    min_score = settings.rag_min_score
    all_hits: list[RagHit] = []
    search_errors = 0
    levels_used: list[str] = []

    philosophy_limit = settings.rag_philosophy_limit
    if settings.coach_always_l5 and L5_BOOKS not in level_list:
        try:
            all_hits.extend(
                _search_level(
                    query=query,
                    level=L5_BOOKS,
                    limit=philosophy_limit,
                    min_score=min_score,
                )
            )
            levels_used.append(L5_BOOKS)
        except NodeInternalError as exc:
            logger.warning("RAG philosophy L5 failed: %s", exc)
            search_errors += 1

    for level in level_list:
        if level == L5_BOOKS and L5_BOOKS in levels_used:
            limit = max(per_level, philosophy_limit)
        else:
            limit = per_level
        try:
            all_hits.extend(
                _search_level(query=query, level=level, limit=limit, min_score=min_score)
            )
            if level not in levels_used:
                levels_used.append(level)
        except NodeInternalError as exc:
            logger.warning("RAG search failed for %s: %s", level, exc)
            search_errors += 1
            if search_errors >= len(level_list) + 1:
                raise
            continue

    merged = _merge_hits(all_hits, settings.rag_max_total_chunks)
    return resolved_intent, levels_used or level_list, merged


def format_rag_context(hits: list[RagHit], *, locale: str = "en") -> str:
    """Format retrieved chunks for injection into the coach system prompt."""
    if not hits:
        return ""

    lines: list[str] = []
    if any(h.level in ("L4_SCIENTIFIC", "L5_BOOKS") for h in hits):
        lines.append(f"**Disclaimer:** {SCIENTIFIC_DISCLAIMER}")
        lines.append("")

    header = (
        "BOOK REFERENCE (L5) is the primary coaching philosophy. "
        "Cite book/section titles briefly when applying their ideas. "
        "L1/L2/L3 supply Taqwin platform facts, exercise IDs, and food IDs — do not invent IDs."
    )
    if locale == "ar":
        header += " اكتب إجابتك بالعامية المصرية ما لم يكتب المستخدم بالإنجليزية."

    sorted_hits = sort_hits_for_prompt(hits)
    by_level: dict[str, list[RagHit]] = {}
    for hit in sorted_hits:
        by_level.setdefault(hit.level, []).append(hit)

    for level in sorted(by_level.keys(), key=lambda lv: CONTEXT_DISPLAY_ORDER.get(lv, 99)):
        group = by_level[level]
        label = "BOOK REFERENCE" if level == L5_BOOKS else level
        lines.append(f"### {label}")
        for hit in group:
            preview = hit.content.strip()
            if len(preview) > 1200:
                preview = preview[:1200] + "…"
            cite = f"**{hit.title}**"
            if level == L5_BOOKS:
                cite += " [book]"
            lines.append(f"- {cite} (score {hit.score:.2f})")
            lines.append(preview)
            lines.append("")
        lines.append("")

    return header + "\n\n" + "\n".join(lines).strip()
