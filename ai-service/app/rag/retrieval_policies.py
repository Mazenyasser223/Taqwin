"""
Tier 3 — domain-specific retrieval modes for coach chat.

Maps intent → purpose (coach_catalog | coach_philosophy | coach_platform | chat)
and purpose → search strategy parameters.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Final

from app.rag.levels import L1_INTERNAL, L2_EXERCISE, L3_NUTRITION, L5_BOOKS

COACH_CATALOG = "coach_catalog"
COACH_PHILOSOPHY = "coach_philosophy"
COACH_PLATFORM = "coach_platform"
CHAT = "chat"
PLAN_CATALOG = "plan_catalog"

VALID_PURPOSES: Final[tuple[str, ...]] = (
    CHAT,
    PLAN_CATALOG,
    COACH_CATALOG,
    COACH_PHILOSOPHY,
    COACH_PLATFORM,
)

INTENT_TO_PURPOSE: Final[dict[str, str]] = {
    "nutrition": COACH_CATALOG,
    "workout": COACH_CATALOG,
    "exercise_alternative": COACH_CATALOG,
    "platform_help": COACH_PLATFORM,
    "scientific": COACH_PHILOSOPHY,
    "life_mode": COACH_PHILOSOPHY,
    "general": COACH_PHILOSOPHY,
    "personal_status": CHAT,
    "execute_action": CHAT,
    "unclear": COACH_PLATFORM,
}


@dataclass(frozen=True)
class RetrievalPolicy:
    purpose: str
    hybrid: bool
    locale_boost: bool
    expand_parents: bool
    include_disclaimer: bool
    metadata_filters_required: bool
    rerank_enabled: bool
    limit_multiplier: float
    min_score_adjust: float


POLICIES: Final[dict[str, RetrievalPolicy]] = {
    # Catalog (L2/L3): hybrid + metadata filters + rerank
    COACH_CATALOG: RetrievalPolicy(
        purpose=COACH_CATALOG,
        hybrid=True,
        locale_boost=False,
        expand_parents=False,
        include_disclaimer=False,
        metadata_filters_required=True,
        rerank_enabled=True,
        limit_multiplier=1.0,
        min_score_adjust=0.0,
    ),
    # Docs (L1): hybrid + locale boost + parent expansion for section context
    COACH_PLATFORM: RetrievalPolicy(
        purpose=COACH_PLATFORM,
        hybrid=True,
        locale_boost=True,
        expand_parents=True,
        include_disclaimer=False,
        metadata_filters_required=True,
        rerank_enabled=True,
        limit_multiplier=1.0,
        min_score_adjust=0.0,
    ),
    # Books (L5): vector + parent expansion + disclaimer
    COACH_PHILOSOPHY: RetrievalPolicy(
        purpose=COACH_PHILOSOPHY,
        hybrid=False,
        locale_boost=False,
        expand_parents=True,
        include_disclaimer=True,
        metadata_filters_required=False,
        rerank_enabled=True,
        limit_multiplier=1.25,
        min_score_adjust=0.0,
    ),
    CHAT: RetrievalPolicy(
        purpose=CHAT,
        hybrid=True,
        locale_boost=False,
        expand_parents=True,
        include_disclaimer=True,
        metadata_filters_required=False,
        rerank_enabled=True,
        limit_multiplier=1.0,
        min_score_adjust=0.0,
    ),
}


def purpose_for_intent(intent: str) -> str:
    return INTENT_TO_PURPOSE.get(intent or "general", CHAT)


def policy_for_purpose(purpose: str) -> RetrievalPolicy:
    return POLICIES.get(purpose, POLICIES[CHAT])


def policy_for_intent(intent: str) -> RetrievalPolicy:
    return policy_for_purpose(purpose_for_intent(intent))


def levels_for_scientific() -> list[str]:
    return [L5_BOOKS]


def is_catalog_level(level: str) -> bool:
    return level in (L2_EXERCISE, L3_NUTRITION)


def is_platform_level(level: str) -> bool:
    return level == L1_INTERNAL


def is_philosophy_level(level: str) -> bool:
    return level == L5_BOOKS


def search_options_for_policy(
    policy: RetrievalPolicy,
    *,
    level: str,
    intent: str,
    locale: str,
    base_limit: int,
) -> dict[str, Any]:
    """Build Node rag/search body overrides from policy + level."""
    limit = max(1, int(base_limit * policy.limit_multiplier))
    hybrid = policy.hybrid

    if policy.purpose == COACH_PHILOSOPHY or intent == "scientific":
        hybrid = False
        limit = max(limit, 12 if intent == "scientific" else limit)

    if is_catalog_level(level):
        hybrid = True
    elif is_platform_level(level):
        hybrid = True
    elif is_philosophy_level(level):
        hybrid = policy.purpose != COACH_CATALOG

    opts: dict[str, Any] = {
        "purpose": policy.purpose,
        "hybrid": hybrid,
        "limit": limit,
        "expandParents": policy.expand_parents or level == L5_BOOKS,
        "localeBoost": policy.locale_boost or (level == L1_INTERNAL),
    }
    return opts
