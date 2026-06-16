from app.config import Settings
from app.rag.scores import (
    filter_l5_when_catalog_strong,
    l5_search_limit,
    min_score_for_level,
    should_prepend_l5,
    should_use_l1_only_platform,
)
from app.rag.retriever import RagHit


def test_min_score_l2_stricter_than_l5() -> None:
    settings = Settings()
    assert min_score_for_level("L2_EXERCISE", settings) > min_score_for_level("L5_BOOKS", settings)


def test_l5_light_limit_for_nutrition() -> None:
    settings = Settings()
    assert l5_search_limit("nutrition", settings, per_level=6) == settings.rag_l5_light_limit
    assert l5_search_limit("scientific", settings, per_level=6) >= settings.rag_philosophy_limit


def test_prepend_l5_only_when_missing_from_levels() -> None:
    settings = Settings(coach_always_l5=True)
    assert should_prepend_l5("general", ["L1_INTERNAL"], settings) is True
    assert should_prepend_l5("general", ["L5_BOOKS", "L1_INTERNAL"], settings) is False
    assert should_prepend_l5("nutrition", ["L3_NUTRITION"], settings) is False
    assert should_prepend_l5("general", ["L1_INTERNAL"], Settings(coach_always_l5=False)) is False


def test_platform_l1_only_skips_l5_prepend() -> None:
    settings = Settings()
    assert should_use_l1_only_platform("platform_help", 0.92, settings) is True
    assert should_use_l1_only_platform("platform_help", 0.5, settings) is False
    assert should_prepend_l5(
        "platform_help",
        ["L1_INTERNAL"],
        settings,
        l1_only_platform=True,
    ) is False


def test_filter_l5_when_catalog_scores_high() -> None:
    settings = Settings()
    hits = [
        RagHit("1", "d", "L3_NUTRITION", "s", "Food", "en", "body", 0.55, None),
        RagHit("2", "d", "L5_BOOKS", "s", "Book", "en", "body", 0.40, None),
    ]
    filtered = filter_l5_when_catalog_strong(hits, "nutrition", settings)
    assert all(h.level != "L5_BOOKS" for h in filtered)


def test_filter_l5_keeps_books_when_catalog_weak() -> None:
    settings = Settings()
    hits = [
        RagHit("1", "d", "L3_NUTRITION", "s", "Food", "en", "body", 0.30, None),
        RagHit("2", "d", "L5_BOOKS", "s", "Book", "en", "body", 0.40, None),
    ]
    filtered = filter_l5_when_catalog_strong(hits, "nutrition", settings)
    assert any(h.level == "L5_BOOKS" for h in filtered)
