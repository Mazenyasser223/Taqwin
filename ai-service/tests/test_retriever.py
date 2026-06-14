from types import SimpleNamespace
from unittest.mock import patch

from app.rag.retriever import RagHit, format_rag_context, retrieve_rag


def _fake_search_payload(level: str, title: str) -> dict:
    return {
        "query": "test",
        "levels": [level],
        "limit": 6,
        "results": [
            {
                "chunkId": f"id-{level}",
                "documentId": "doc-1",
                "level": level,
                "source": f"src:{level}",
                "title": title,
                "locale": "en",
                "content": f"# {title}\n\nBody for {level}.",
                "score": 0.8,
                "metadata": {},
            }
        ],
    }


@patch("app.rag.retriever.rag_search")
def test_retrieve_shows_books_first_in_prompt_order(mock_search) -> None:
    def side_effect(*, query, levels, limit, locale, min_score, **kwargs):
        lv = levels[0]
        if lv == "L5_BOOKS":
            return _fake_search_payload(lv, "Muscle Laws")
        if lv == "L2_EXERCISE":
            return _fake_search_payload(lv, "Bench Press")
        if lv == "L1_INTERNAL":
            return _fake_search_payload(lv, "Platform Overview")
        return {"results": []}

    mock_search.side_effect = side_effect

    intent, used_levels, hits, _stats = retrieve_rag(
        query="bench press alternative",
        intent="exercise_alternative",
    )

    assert intent == "exercise_alternative"
    assert "L5_BOOKS" in used_levels
    assert len(hits) >= 2
    assert hits[0].level == "L5_BOOKS"
    assert mock_search.call_count >= 2


@patch("app.rag.retriever.rag_search")
def test_retrieve_passes_locale(mock_search) -> None:
    mock_search.return_value = _fake_search_payload("L2_EXERCISE", "Bench Press")

    retrieve_rag(query="bench press", intent="workout", locale="ar")

    assert mock_search.call_args.kwargs["locale"] == "ar"


@patch("app.rag.retriever.rag_search")
def test_retrieve_uses_rewritten_query(mock_search) -> None:
    mock_search.return_value = {"results": []}

    retrieve_rag(query="بديل للبنش", intent="exercise_alternative", locale="ar")

    search_query = mock_search.call_args.kwargs["query"]
    assert "bench press" in search_query.lower()


@patch("app.rag.retriever.rag_search")
def test_retrieve_platform_help_l1_only_when_confident(mock_search) -> None:
    mock_search.return_value = _fake_search_payload("L1_INTERNAL", "Food logging")

    routing = SimpleNamespace(
        intent="platform_help",
        confidence=0.92,
        levels=["L1_INTERNAL", "L5_BOOKS"],
        needs_rag=True,
    )
    intent, used_levels, hits, _stats = retrieve_rag(
        query="How do I log food in Taqwin?",
        routing=routing,
    )

    assert intent == "platform_help"
    assert used_levels == ["L1_INTERNAL"]
    assert all(h.level == "L1_INTERNAL" for h in hits)
    assert mock_search.call_count == 1
    assert mock_search.call_args.kwargs["levels"] == ["L1_INTERNAL"]
    assert mock_search.call_args.kwargs["metadata_filters"]["docType"] == "platform"
    assert mock_search.call_args.kwargs["expand_parents"] is True


@patch("app.rag.retriever.rag_search")
def test_retrieve_platform_help_keeps_l5_when_low_confidence(mock_search) -> None:
    def side_effect(*, query, levels, limit, locale, min_score, **kwargs):
        lv = levels[0]
        return _fake_search_payload(lv, f"Hit {lv}")

    mock_search.side_effect = side_effect

    routing = SimpleNamespace(
        intent="platform_help",
        confidence=0.5,
        levels=["L1_INTERNAL", "L5_BOOKS"],
        needs_rag=True,
    )
    _intent, _used_levels, hits, _stats = retrieve_rag(
        query="help",
        routing=routing,
    )

    searched_levels = [call.kwargs["levels"][0] for call in mock_search.call_args_list]
    assert "L1_INTERNAL" in searched_levels
    assert "L5_BOOKS" in searched_levels
    l5_call = next(c for c in mock_search.call_args_list if c.kwargs["levels"] == ["L5_BOOKS"])
    assert "docType" not in (l5_call.kwargs.get("metadata_filters") or {})
    assert len(hits) >= 2


def test_format_includes_disclaimer_and_book_header() -> None:
    hits = [
        RagHit(
            chunk_id="1",
            document_id="d1",
            level="L5_BOOKS",
            source="l5:x",
            title="Muscle Laws",
            locale="en",
            content="Law one text.",
            score=0.7,
            metadata=None,
        )
    ]
    block = format_rag_context(hits)
    assert "Disclaimer" in block
    assert "BOOK REFERENCE" in block
    assert "Muscle Laws" in block
    assert "[L5:" in block
