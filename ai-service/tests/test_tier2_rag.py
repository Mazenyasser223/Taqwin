from app.config import get_settings
from app.rag.metadata_filters import build_metadata_filters
from app.rag.query_rewrite import rewrite_retrieval_query
from app.rag.rerank import rerank_hits
from app.rag.retriever import RagHit


def test_metadata_filters_exercise_alternative() -> None:
    filters = build_metadata_filters(
        intent="exercise_alternative",
        context_bundle={
            "profile": {"fitnessLevel": "beginner"},
            "constraints": {"injuries": ["shoulder"]},
            "workoutToday": {"exercises": [{"name": "Bench Press", "primaryMuscles": ["chest"]}]},
        },
    )
    assert filters is not None
    assert filters["difficulty"] == ["beginner"]
    assert "chest" in filters["primaryMuscles"]


def test_metadata_filters_platform_help() -> None:
    filters = build_metadata_filters(intent="platform_help", context_bundle=None, locale="ar")
    assert filters is not None
    assert filters["docType"] == "platform"
    assert filters["excludeTags"] == ["catalog", "books"]
    assert filters["locale"] == "ar"


def test_metadata_filters_platform_help_l1_level() -> None:
    filters = build_metadata_filters(
        intent="platform_help",
        context_bundle=None,
        locale="en",
        level="L1_INTERNAL",
    )
    assert filters is not None
    assert filters["docType"] == "platform"
    assert "catalog" in filters["excludeTags"]


def test_metadata_filters_platform_help_l5_excludes_catalog_only() -> None:
    filters = build_metadata_filters(
        intent="platform_help",
        context_bundle=None,
        locale="en",
        level="L5_BOOKS",
    )
    assert filters is not None
    assert "docType" not in filters
    assert filters["excludeTags"] == ["catalog"]


def test_metadata_filters_nutrition() -> None:
    filters = build_metadata_filters(
        intent="nutrition",
        context_bundle={
            "constraints": {
                "dietType": "high_protein",
                "religiousDiet": "halal",
                "allergies": ["shellfish"],
            }
        },
    )
    assert filters["dietType"] == "high_protein"
    assert filters["excludeAllergens"] == ["shellfish"]


def test_rewrite_includes_workout_context() -> None:
    q = rewrite_retrieval_query(
        user_message="بديل للبENCH",
        intent="exercise_alternative",
        locale="ar",
        context_bundle={
            "workoutToday": {"exercises": [{"name": "Bench Press"}]},
            "constraints": {"injuries": ["shoulder impingement"]},
            "profile": {"fitnessGoal": "muscle gain"},
        },
    )
    assert "Bench Press" in q or "bench" in q.lower()
    assert "avoid" in q.lower() or "shoulder" in q.lower()


def test_rewrite_arabic_foul_keyword() -> None:
    q = rewrite_retrieval_query(
        user_message="الفول",
        intent="nutrition",
        locale="ar",
    )
    assert "foul" in q.lower() or "فول" in q


def test_rerank_disabled_returns_top_n(monkeypatch) -> None:
    hits = [
        RagHit("1", "d", "L2", "s", "A", "en", "content a", 0.5, None),
        RagHit("2", "d", "L2", "s", "B", "en", "content b", 0.9, None),
    ]
    monkeypatch.setenv("RAG_RERANK_ENABLED", "false")
    get_settings.cache_clear()
    out = rerank_hits(query="test", hits=hits, top_n=1)
    assert len(out) == 1
    assert out[0].chunk_id == "1"
    get_settings.cache_clear()
