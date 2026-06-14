"""
Block B6 / Tier 2 — RAG retriever: query rewrite → hybrid search → rerank → filter → format.

Flow:
  Query → query rewrite (CAG-informed) → hybrid retrieve top-K → rerank → minScore + dedupe → format_rag_context
"""

from __future__ import annotations

import logging
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any

from app.clients.node_internal import NodeInternalError, rag_search
from app.config import get_settings
from app.intent.router import IntentResult, route_intent
from app.intent.rules import message_has_workout_signal
from app.rag.citations import citation_tag
from app.rag.levels import (
    CONTEXT_DISPLAY_ORDER,
    L1_INTERNAL,
    L5_BOOKS,
    levels_for_intent,
    sort_hits_for_prompt,
    sort_levels,
)
from app.rag.metadata_filters import build_metadata_filters
from app.rag.query_rewrite import rewrite_retrieval_query
from app.rag.rerank import rerank_hits
from app.rag.retrieval_policies import (
    policy_for_intent,
    search_options_for_policy,
)
from app.rag.scores import (
    filter_l5_when_catalog_strong,
    l5_min_score,
    l5_search_limit,
    min_score_for_level,
    should_prepend_l5,
    should_use_l1_only_platform,
)
from app.rag.types import RagHit, RetrievalStats
from app.services.cag_sanitize import sanitize_rag_content, sanitize_rag_title

logger = logging.getLogger(__name__)

SCIENTIFIC_DISCLAIMER = (
    "General fitness information only — not medical advice. "
    "Consult a doctor or registered dietitian for clinical conditions."
)


@dataclass(frozen=True)
class _LevelSearchJob:
    level: str
    query: str
    limit: int
    locale: str
    min_score: float | None
    metadata_filters: dict[str, Any] | None
    purpose: str
    hybrid: bool
    expand_parents: bool
    locale_boost: bool


def _rerank_lift(hits_before: list[RagHit], hits_after: list[RagHit]) -> float:
    if not hits_before or not hits_after:
        return 0.0
    before_by_id = {h.chunk_id: float(h.score) for h in hits_before}
    lifts: list[float] = []
    for h in hits_after:
        prev = before_by_id.get(h.chunk_id)
        if prev is None:
            continue
        meta = h.metadata or {}
        retrieval = float(meta.get("retrievalScore", prev))
        lifts.append(float(h.score) - retrieval)
    return sum(lifts) / len(lifts) if lifts else 0.0


def _dedupe_hits(hits: list[RagHit]) -> list[RagHit]:
    seen: set[str] = set()
    unique: list[RagHit] = []
    for hit in hits:
        meta = hit.metadata or {}
        entity_key = (
            meta.get("exerciseId")
            or meta.get("foodItemId")
            or meta.get("webtebId")
            or hit.chunk_id
        )
        key = f"{hit.level}:{entity_key}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(hit)
    return unique


def _merge_hits(hits: list[RagHit], max_total: int) -> list[RagHit]:
    """Dedupe by entity/chunk; sort for coach prompt (L5 first, then score)."""
    unique = _dedupe_hits(hits)
    return sort_hits_for_prompt(unique)[:max_total]


def _passes_score_floor(hit: RagHit, floor: float) -> bool:
    if floor <= 0:
        return True
    meta = hit.metadata or {}
    # Hybrid RRF scores are ~0.01–0.05; floors are calibrated for cosine similarity.
    vector = meta.get("vectorScore")
    if vector is not None:
        retrieval = float(vector)
    else:
        retrieval = float(meta.get("retrievalScore", hit.score))
    return retrieval >= floor or hit.score >= floor


def _search_level(
    *,
    query: str,
    level: str,
    limit: int,
    locale: str,
    min_score: float | None,
    metadata_filters: dict[str, Any] | None,
    purpose: str = "chat",
    hybrid: bool | None = None,
    expand_parents: bool | None = None,
    locale_boost: bool | None = None,
) -> tuple[list[RagHit], float, float]:
    t0 = time.perf_counter()
    payload = rag_search(
        query=query,
        levels=[level],
        limit=limit,
        locale=locale if locale in ("en", "ar") else None,
        min_score=None,
        metadata_filters=metadata_filters,
        hybrid=hybrid,
        purpose=purpose,
        expand_parents=expand_parents,
        locale_boost=locale_boost,
    )
    out: list[RagHit] = []
    for row in payload.get("results") or []:
        hit = RagHit.from_node_result(row)
        if hit.content:
            out.append(hit)

    before_rerank = list(out)
    reranked = rerank_hits(
        query=query,
        hits=out,
        top_n=min(get_settings().rag_rerank_keep_per_level, limit),
    )
    lift = _rerank_lift(before_rerank, reranked)

    floor = min_score if min_score and min_score > 0 else 0.0
    filtered = [h for h in reranked if _passes_score_floor(h, floor)]
    ms = (time.perf_counter() - t0) * 1000
    return filtered, ms, lift


def _run_searches_parallel(jobs: list[_LevelSearchJob]) -> tuple[list[RagHit], int, float, float]:
    if not jobs:
        return [], 0, 0.0, 0.0

    if len(jobs) == 1:
        job = jobs[0]
        try:
            hits, ms, lift = _search_level(
                query=job.query,
                level=job.level,
                limit=job.limit,
                locale=job.locale,
                min_score=job.min_score,
                metadata_filters=job.metadata_filters,
                purpose=job.purpose,
                hybrid=job.hybrid,
                expand_parents=job.expand_parents,
                locale_boost=job.locale_boost,
            )
            return hits, 0, ms, lift
        except NodeInternalError:
            raise

    hits: list[RagHit] = []
    errors = 0
    total_ms = 0.0
    lifts: list[float] = []
    max_workers = min(len(jobs), 4)
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(
                _search_level,
                query=job.query,
                level=job.level,
                limit=job.limit,
                locale=job.locale,
                min_score=job.min_score,
                metadata_filters=job.metadata_filters,
                purpose=job.purpose,
                hybrid=job.hybrid,
                expand_parents=job.expand_parents,
                locale_boost=job.locale_boost,
            ): job.level
            for job in jobs
        }
        for fut in as_completed(futures):
            level = futures[fut]
            try:
                level_hits, ms, lift = fut.result()
                hits.extend(level_hits)
                total_ms = max(total_ms, ms)
                if lift:
                    lifts.append(lift)
            except NodeInternalError as exc:
                logger.warning("RAG search failed for %s: %s", level, exc)
                errors += 1

    if errors >= len(jobs):
        raise NodeInternalError(f"All {len(jobs)} RAG level searches failed")
    avg_lift = sum(lifts) / len(lifts) if lifts else 0.0
    return hits, errors, total_ms, avg_lift


def _build_search_jobs(
    *,
    search_query: str,
    locale: str,
    intent: str,
    level_list: list[str],
    per_level: int,
    settings: Any,
    prepend_l5: bool,
    context_bundle: dict[str, Any] | None,
) -> list[_LevelSearchJob]:
    policy = policy_for_intent(intent)
    jobs: list[_LevelSearchJob] = []
    levels_used: list[str] = []
    fetch_k = settings.rag_rerank_fetch_k if settings.rag_rerank_enabled else per_level

    if prepend_l5:
        opts = search_options_for_policy(policy, level=L5_BOOKS, intent=intent, locale=locale, base_limit=fetch_k)
        jobs.append(
            _LevelSearchJob(
                level=L5_BOOKS,
                query=search_query,
                limit=max(opts["limit"], settings.rag_philosophy_limit),
                locale=locale,
                min_score=l5_min_score(intent, settings),
                metadata_filters=build_metadata_filters(
                    intent=intent,
                    context_bundle=context_bundle,
                    locale=locale,
                    level=L5_BOOKS,
                ),
                purpose=opts["purpose"],
                hybrid=opts["hybrid"],
                expand_parents=opts["expandParents"],
                locale_boost=opts["localeBoost"],
            )
        )
        levels_used.append(L5_BOOKS)

    for level in level_list:
        opts = search_options_for_policy(policy, level=level, intent=intent, locale=locale, base_limit=fetch_k)
        if level == L5_BOOKS:
            limit = l5_search_limit(intent, settings, per_level=opts["limit"])
            if L5_BOOKS in levels_used:
                limit = max(limit, settings.rag_philosophy_limit)
            score = l5_min_score(intent, settings)
        else:
            limit = opts["limit"]
            score = min_score_for_level(level, settings)

        jobs.append(
            _LevelSearchJob(
                level=level,
                query=search_query,
                limit=limit,
                locale=locale,
                min_score=score,
                metadata_filters=build_metadata_filters(
                    intent=intent,
                    context_bundle=context_bundle,
                    locale=locale,
                    level=level,
                ),
                purpose=opts["purpose"],
                hybrid=opts["hybrid"],
                expand_parents=opts["expandParents"],
                locale_boost=opts["localeBoost"],
            )
        )
        if level not in levels_used:
            levels_used.append(level)

    return jobs


def retrieve_rag(
    *,
    query: str,
    locale: str = "en",
    intent: str | None = None,
    levels: list[str] | None = None,
    routing: IntentResult | None = None,
    limit_per_level: int | None = None,
    context_bundle: dict[str, Any] | None = None,
) -> tuple[str, list[str], list[RagHit], RetrievalStats]:
    """
    Run Tier 3 retrieval for one user message.

    Returns (intent, levels_used, hits, stats).
    """
    settings = get_settings()
    explicit_override = intent is not None or levels is not None

    if routing is None and not explicit_override:
        routing = route_intent(query, locale=locale)

    if routing is not None and not routing.needs_rag:
        return routing.intent, [], [], RetrievalStats()

    resolved_intent = intent or (routing.intent if routing else "general")
    policy = policy_for_intent(resolved_intent)

    if routing is not None:
        confidence = routing.confidence
    elif explicit_override:
        confidence = 0.92
    else:
        confidence = 0.4

    if levels is not None:
        level_list = sort_levels(levels)
    elif routing and routing.levels:
        level_list = sort_levels(list(routing.levels))
    else:
        level_list = sort_levels(levels_for_intent(resolved_intent))

    if resolved_intent == "scientific" and not message_has_workout_signal(query):
        level_list = [L5_BOOKS]

    l1_only_platform = should_use_l1_only_platform(resolved_intent, confidence, settings)
    if l1_only_platform:
        level_list = [L1_INTERNAL]

    if not level_list:
        return resolved_intent, [], [], RetrievalStats(purpose=policy.purpose)

    search_query = rewrite_retrieval_query(
        user_message=query,
        intent=resolved_intent,
        locale=locale,
        context_bundle=context_bundle,
    )

    per_level = limit_per_level or settings.rag_limit_per_level
    if resolved_intent == "scientific":
        per_level = max(per_level, settings.rag_philosophy_limit)

    prepend_l5 = should_prepend_l5(
        resolved_intent,
        level_list,
        settings,
        l1_only_platform=l1_only_platform,
    )
    jobs = _build_search_jobs(
        search_query=search_query,
        locale=locale,
        intent=resolved_intent,
        level_list=level_list,
        per_level=per_level,
        settings=settings,
        prepend_l5=prepend_l5,
        context_bundle=context_bundle,
    )

    all_hits, _errors, retrieval_ms, rerank_lift = _run_searches_parallel(jobs)
    all_hits = filter_l5_when_catalog_strong(all_hits, resolved_intent, settings)
    merged = _merge_hits(all_hits, settings.rag_max_total_chunks)
    hit_levels = list(dict.fromkeys(h.level for h in merged))
    stats = RetrievalStats(
        retrieval_ms=retrieval_ms,
        rerank_lift_avg=rerank_lift,
        purpose=policy.purpose,
    )
    return resolved_intent, hit_levels or level_list, merged, stats


def format_rag_context(hits: list[RagHit], *, locale: str = "en") -> str:
    """Format retrieved chunks for injection into the coach system prompt."""
    if not hits:
        return ""

    lines: list[str] = []
    if any(h.level == L5_BOOKS for h in hits):
        lines.append(f"**Disclaimer:** {SCIENTIFIC_DISCLAIMER}")
        lines.append("")

    header = (
        "BOOK REFERENCE (L5) is the primary coaching philosophy. "
        "When you use retrieved facts, cite sources as [L2: Title] or [L5: Book Chapter] "
        "(tags below). L1/L2/L3 supply Taqwin platform facts, exercise IDs, and food IDs — do not invent IDs."
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
            preview = sanitize_rag_content(hit.content.strip())
            if len(preview) > 1200:
                preview = preview[:1200] + "…"
            title = sanitize_rag_title(hit.title or "", level=level)
            cite = citation_tag(hit)
            source_note = f"source={hit.source}" if hit.source else ""
            chunk_note = f"chunkId={hit.chunk_id}" if hit.chunk_id else ""
            meta_bits = ", ".join(x for x in (chunk_note, source_note) if x)
            lines.append(f"- {cite} (score {hit.score:.2f}{', ' + meta_bits if meta_bits else ''})")
            lines.append(preview)
            lines.append("")
        lines.append("")

    return header + "\n\n" + "\n".join(lines).strip()
