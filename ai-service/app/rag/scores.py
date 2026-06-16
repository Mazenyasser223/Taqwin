"""Level-specific RAG score floors and L5 injection policy (Tier 1)."""

from __future__ import annotations

from app.config import Settings
from app.rag.levels import L1_INTERNAL, L2_EXERCISE, L3_NUTRITION, L5_BOOKS

# Intents that always get full L5 philosophy injection.
L5_FULL_INTENTS: frozenset[str] = frozenset(
    {"scientific", "life_mode", "general", "exercise_alternative", "platform_help"}
)

# Intents where L5 is optional/light when catalog chunks (L2/L3) are primary.
L5_LIGHT_INTENTS: frozenset[str] = frozenset({"nutrition", "workout"})


def min_score_for_level(level: str, settings: Settings) -> float | None:
    """Return level-specific min score; None means no floor (legacy rag_min_score=0)."""
    by_level = {
        L1_INTERNAL: settings.rag_min_score_l1,
        L2_EXERCISE: settings.rag_min_score_l2,
        L3_NUTRITION: settings.rag_min_score_l3,
        L5_BOOKS: settings.rag_min_score_l5,
    }
    score = by_level.get(level, settings.rag_min_score)
    if score is None or score <= 0:
        return None
    return score


def l5_min_score(intent: str, settings: Settings) -> float | None:
    if intent in L5_LIGHT_INTENTS:
        light = settings.rag_min_score_l5_light
        return light if light > 0 else min_score_for_level(L5_BOOKS, settings)
    return min_score_for_level(L5_BOOKS, settings)


def l5_search_limit(intent: str, settings: Settings, *, per_level: int) -> int:
    if intent in L5_LIGHT_INTENTS:
        return settings.rag_l5_light_limit
    if intent in L5_FULL_INTENTS:
        return max(per_level, settings.rag_philosophy_limit)
    return per_level


def should_use_l1_only_platform(intent: str, confidence: float, settings: Settings) -> bool:
    """Pure platform questions with confident routing should not pull L5 philosophy."""
    if intent != "platform_help":
        return False
    threshold = settings.rag_platform_l1_only_confidence
    return confidence >= threshold


def should_prepend_l5(
    intent: str,
    level_list: list[str],
    settings: Settings,
    *,
    l1_only_platform: bool = False,
) -> bool:
    """Prepend L5 when not in routed levels and policy says philosophy is always needed."""
    if l1_only_platform:
        return False
    if L5_BOOKS in level_list:
        return False
    if not settings.coach_always_l5:
        return False
    return intent in L5_FULL_INTENTS


def filter_l5_when_catalog_strong(
    hits: list,
    intent: str,
    settings: Settings,
) -> list:
    """
    Drop L5 chunks for nutrition/workout when L2/L3 already returned strong matches.
    Keeps parallel search latency while reducing philosophy noise in the prompt.
    """
    if intent not in L5_LIGHT_INTENTS:
        return hits
    catalog_levels = {L2_EXERCISE, L3_NUTRITION}
    catalog_hits = [h for h in hits if getattr(h, "level", None) in catalog_levels]
    if not catalog_hits:
        return hits
    threshold = settings.rag_l5_skip_when_catalog_score
    if threshold <= 0:
        return hits
    max_catalog = max(float(getattr(h, "score", 0) or 0) for h in catalog_hits)
    if max_catalog >= threshold:
        return [h for h in hits if getattr(h, "level", None) != L5_BOOKS]
    return hits
