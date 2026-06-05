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
    """When Node is unavailable, chat still responds with a clear error."""

    def _fail(**_kwargs):
        from app.clients.node_internal import NodeInternalError

        raise NodeInternalError("connection refused")

    from app.intent.router import IntentResult

    monkeypatch.setattr(
        "app.routers.chat.route_intent",
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
    monkeypatch.setattr("app.routers.chat.retrieve_rag", _fail)

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
    assert "RAG unavailable" in data["reply"]
    assert data["toolCalls"] == []
