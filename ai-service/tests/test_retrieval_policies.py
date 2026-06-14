"""Tier 3 domain retrieval policies."""

from app.rag.retrieval_policies import (
    COACH_CATALOG,
    COACH_PHILOSOPHY,
    COACH_PLATFORM,
    policy_for_intent,
    purpose_for_intent,
)


def test_intent_maps_to_coach_purpose() -> None:
    assert purpose_for_intent("nutrition") == COACH_CATALOG
    assert purpose_for_intent("platform_help") == COACH_PLATFORM
    assert purpose_for_intent("scientific") == COACH_PHILOSOPHY


def test_policy_enables_hybrid_for_catalog() -> None:
    p = policy_for_intent("workout")
    assert p.purpose == COACH_CATALOG
    assert p.hybrid is True
    assert p.metadata_filters_required is True


def test_policy_philosophy_vector_parent_expand() -> None:
    p = policy_for_intent("scientific")
    assert p.purpose == COACH_PHILOSOPHY
    assert p.expand_parents is True
    assert p.include_disclaimer is True


def test_policy_platform_parent_expand_and_filters() -> None:
    p = policy_for_intent("platform_help")
    assert p.purpose == COACH_PLATFORM
    assert p.expand_parents is True
    assert p.locale_boost is True
    assert p.metadata_filters_required is True


def test_policy_unclear_uses_platform_l1() -> None:
    p = policy_for_intent("unclear")
    assert p.purpose == COACH_PLATFORM
    assert p.locale_boost is True
    assert purpose_for_intent("unclear") == COACH_PLATFORM
