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


def test_chat_stub_echoes_last_user_message() -> None:
    response = client.post(
        "/chat",
        json={
            "userId": "user-1",
            "threadId": "thread-1",
            "messages": [
                {"role": "assistant", "content": "Hello"},
                {"role": "user", "content": "What should I eat?"},
            ],
            "locale": "en",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "[taqwin-ai stub] What should I eat?"
    assert data["toolCalls"] == []
    assert data["confirmationRequired"] is False
    assert data["intent"] == "general"
