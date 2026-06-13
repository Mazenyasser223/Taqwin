"""Tier 3 citation helpers."""

from __future__ import annotations

from app.rag.citations import citation_tag, validate_citations
from app.rag.retriever import RagHit


def test_citation_tag_format() -> None:
    hit = RagHit(
        chunk_id="abc-123",
        document_id="d1",
        level="L2_EXERCISE",
        source="ex:bench",
        title="Bench Press",
        locale="en",
        content="Press the bar.",
        score=0.9,
        metadata=None,
    )
    assert citation_tag(hit) == "[L2: Bench Press]"


def test_validate_citations_accepts_matching_title() -> None:
    hit = RagHit(
        chunk_id="1",
        document_id="d",
        level="L5_BOOKS",
        source="l5",
        title="Muscle Laws",
        locale="en",
        content="Law one.",
        score=0.8,
        metadata=None,
    )
    reply = "According to [L5: Muscle Laws], progressive overload matters."
    stats = validate_citations(reply, [hit])
    assert stats["citationCount"] == 1
    assert stats["validCount"] >= 1


def test_validate_citations_flags_missing_when_required() -> None:
    hit = RagHit(
        chunk_id="1",
        document_id="d",
        level="L2_EXERCISE",
        source="x",
        title="Squat",
        locale="en",
        content="Squat down.",
        score=0.7,
        metadata=None,
    )
    stats = validate_citations("Just squat more.", [hit], require_at_least_one=True)
    assert stats["missingRequired"] is True
