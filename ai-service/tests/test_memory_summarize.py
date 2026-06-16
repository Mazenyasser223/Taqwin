"""Block E4 — /internal/memory/summarize."""

from fastapi.testclient import TestClient

from app.main import app
from app.services.memory_summarize import parse_memories_json

client = TestClient(app)

SAMPLE_TRANSCRIPT = (
    "user: I am allergic to dairy and want to build muscle\n"
    "assistant: Noted — we will avoid dairy in your meal plan.\n"
    "user: I train 4 days per week at home with dumbbells only."
)


def test_parse_memories_json_extracts_array() -> None:
    raw = (
        '{"memories":[{"key":"diet_preferences","summary":"Avoids dairy","confidence":0.9}]}'
    )
    items = parse_memories_json(raw)
    assert len(items) == 1
    assert items[0]["key"] == "diet_preferences"


def test_memory_summarize_skips_short_transcript() -> None:
    response = client.post(
        "/internal/memory/summarize",
        json={"transcript": "hi", "locale": "en"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["skipped"] is True
    assert data["reason"] == "insufficient_chat"
    assert data["memories"] == []


def test_memory_summarize_returns_memories(monkeypatch) -> None:
    async def fake_llm(**_kwargs):
        return (
            '{"memories":[{"key":"diet_preferences","summary":"Avoids all dairy products","confidence":0.9},'
            '{"key":"training_constraints","summary":"Home workouts with dumbbells only","confidence":0.85}]}'
        )

    monkeypatch.setattr(
        "app.services.memory_summarize.complete_coach_chat",
        fake_llm,
    )

    response = client.post(
        "/internal/memory/summarize",
        json={"transcript": SAMPLE_TRANSCRIPT, "locale": "en"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["skipped"] is False
    assert len(data["memories"]) == 2
    assert data["memories"][0]["key"] == "diet_preferences"


def test_memory_summarize_503_when_llm_unconfigured(monkeypatch) -> None:
    async def fail_llm(**_kwargs):
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    monkeypatch.setattr(
        "app.services.memory_summarize.complete_coach_chat",
        fail_llm,
    )

    response = client.post(
        "/internal/memory/summarize",
        json={"transcript": SAMPLE_TRANSCRIPT, "locale": "en"},
    )
    assert response.status_code == 503
