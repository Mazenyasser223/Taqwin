from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@patch("app.routers.chat.is_llm_configured", return_value=False)
@patch("app.routers.chat.retrieve_rag")
@patch("app.routers.chat.route_intent")
def test_chat_uses_rag_retriever(mock_route, mock_retrieve, _mock_llm) -> None:
    from app.intent.router import IntentResult
    from app.rag.retriever import RagHit

    mock_route.return_value = IntentResult(
        intent="nutrition",
        source="rules",
        confidence=0.92,
        levels=["L5_BOOKS", "L3_NUTRITION"],
        needs_rag=True,
        needs_clarify=False,
        tool_hints=["log_food"],
    )
    mock_retrieve.return_value = (
        "nutrition",
        ["L3_NUTRITION"],
        [
            RagHit(
                chunk_id="c1",
                document_id="d1",
                level="L3_NUTRITION",
                source="l3:x",
                title="Chicken breast",
                locale="en",
                content="# Chicken\n\nHigh protein.",
                score=0.55,
                metadata=None,
            )
        ],
    )

    response = client.post(
        "/chat",
        json={
            "userId": "user-1",
            "messages": [{"role": "user", "content": "high protein meal ideas"}],
            "locale": "en",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "nutrition"
    assert "Chicken breast" in data["reply"]
    assert "Chicken breast" in data["reply"]
    assert "nutrition" in data["reply"].lower() or "تكوين" in data["reply"]


@patch("app.rag.retriever.rag_search")
def test_rag_retrieve_endpoint(mock_search) -> None:
    mock_search.return_value = {
        "results": [
            {
                "chunkId": "1",
                "documentId": "d",
                "level": "L2_EXERCISE",
                "source": "l2:x",
                "title": "Barbell Bench Press",
                "locale": "en",
                "content": "# Bench\n\nPress movement.",
                "score": 0.6,
                "metadata": {},
            }
        ],
    }

    response = client.post(
        "/rag/retrieve",
        json={"query": "bench press chest", "locale": "en", "intent": "workout"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "workout"
    assert data["hitCount"] >= 1
    assert "Barbell Bench Press" in data["contextBlock"]
