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
    def side_effect(*, query, levels, limit, locale, min_score):
        lv = levels[0]
        if lv == "L5_BOOKS":
            return _fake_search_payload(lv, "Muscle Laws")
        if lv == "L2_EXERCISE":
            return _fake_search_payload(lv, "Bench Press")
        if lv == "L1_INTERNAL":
            return _fake_search_payload(lv, "Platform Overview")
        return {"results": []}

    mock_search.side_effect = side_effect

    intent, used_levels, hits = retrieve_rag(
        query="bench press alternative",
        intent="exercise_alternative",
    )

    assert intent == "exercise_alternative"
    assert "L5_BOOKS" in used_levels
    assert len(hits) >= 2
    assert hits[0].level == "L5_BOOKS"


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
