from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_200() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "taqwin-ai"
    assert "version" in data


def test_chat_returns_intent_without_node(monkeypatch) -> None:
    """When Node RAG is unavailable, coach graph still responds (scaffold mode)."""

    def _fail(**_kwargs):
        raise RuntimeError("connection refused")

    from app.intent.router import IntentResult

    monkeypatch.setattr(
        "app.agent.coach_graph.route_intent",
        lambda *_a, **_k: IntentResult(
            intent="nutrition",
            source="rules",
            confidence=0.9,
            levels=["L3_NUTRITION"],
            needs_rag=True,
            needs_clarify=False,
            tool_hints=[],
        ),
    )
    monkeypatch.setattr("app.agent.coach_graph.retrieve_rag", _fail)
    monkeypatch.setattr("app.agent.coach_graph.is_llm_configured", lambda: False)

    response = client.post(
        "/chat",
        json={
            "userId": "user-1",
            "messages": [{"role": "user", "content": "What should I eat?"}],
            "locale": "en",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "nutrition"
    assert "What should I eat?" in data["reply"]
