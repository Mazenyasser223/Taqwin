from app.rag.retriever import RagHit
from app.services.chat_observability import (
    build_turn_trace_payload,
    hash_prompt,
    summarize_cag,
    summarize_rag_hits,
    summarize_tools,
)


def test_hash_prompt_stable() -> None:
    h1 = hash_prompt(system="sys", messages=[{"role": "user", "content": "hi"}])
    h2 = hash_prompt(system="sys", messages=[{"role": "user", "content": "hi"}])
    assert h1 == h2
    assert len(h1) == 24


def test_summarize_rag_hits_caps_and_levels() -> None:
    hits = [
        RagHit(
            chunk_id="c1",
            document_id="d1",
            level="L5_BOOKS",
            source="books/x",
            title="Laws of muscle growth",
            locale="en",
            content="...",
            score=0.91,
            metadata=None,
        ),
        RagHit(
            chunk_id="c2",
            document_id="d2",
            level="L3_NUTRITION",
            source="food",
            title="Chicken breast",
            locale="en",
            content="...",
            score=0.82,
            metadata=None,
        ),
    ]
    summary = summarize_rag_hits(hits)
    assert summary["hitCount"] == 2
    assert summary["levels"] == ["L3_NUTRITION", "L5_BOOKS"]
    assert summary["hits"][0]["chunkId"] == "c1"


def test_summarize_cag_includes_hash() -> None:
    summary = summarize_cag({"generatedAt": "2026-01-01", "profile": {"displayName": "Ali"}})
    assert summary["chars"] > 0
    assert len(summary["hash"]) == 24
    assert summary["generatedAt"] == "2026-01-01"


def test_build_turn_trace_payload() -> None:
    state = {
        "turn_id": "turn-1",
        "intent": "log_food",
        "routing_source": "rules",
        "routing_confidence": 0.9,
        "needs_rag": False,
        "needs_clarify": False,
        "rag_obs": {"hitCount": 0, "levels": [], "hits": []},
        "cag_obs": {"chars": 100, "hash": "abc"},
        "llm_obs": {"model": "claude-test", "promptHash": "xyz", "latencyMs": 50},
        "tool_calls_out": [{"name": "log_food", "input": {}}],
        "confirmation_required": True,
        "nodes_trace": [{"node": "intent_route"}],
        "locale": "en",
    }
    payload = build_turn_trace_payload(state, latency_ms=120)
    assert payload["turnId"] == "turn-1"
    assert payload["tools"]["proposed"] == ["log_food"]
    assert payload["tools"]["confirmationRequired"] is True
    assert payload["latencyMs"] == 120
    assert payload["model"] == "claude-test"


def test_summarize_tools_executed_only_success() -> None:
    tools = summarize_tools(
        {
            "tool_results": [
                {"tool": "log_food", "success": True},
                {"tool": "ping", "success": False},
            ]
        }
    )
    assert tools["executed"] == ["log_food"]
