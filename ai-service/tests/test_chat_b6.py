from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@patch("app.agent.coach_graph.is_llm_configured", return_value=False)
@patch("app.agent.coach_graph.retrieve_rag")
@patch("app.agent.coach_graph.route_intent")
def test_chat_uses_rag_retriever(mock_route, mock_retrieve, _mock_llm) -> None:
    from app.intent.router import IntentResult
    from app.rag.retriever import RagHit
    from app.rag.types import RetrievalStats

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
        RetrievalStats(),
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
    assert "nutrition" in data["reply"].lower() or "تكوين" in data["reply"]


@patch("app.agent.coach_graph.is_llm_configured", return_value=False)
@patch("app.agent.coach_graph.route_intent")
def test_chat_execute_action_requires_confirmation(mock_route, _mock_llm) -> None:
    from app.intent.router import IntentResult

    mock_route.return_value = IntentResult(
        intent="execute_action",
        source="rules",
        confidence=0.92,
        levels=["L1_INTERNAL"],
        needs_rag=False,
        needs_clarify=False,
        tool_hints=["log_food"],
    )

    response = client.post(
        "/chat",
        json={
            "userId": "user-1",
            "messages": [{"role": "user", "content": "log 200g chicken for lunch"}],
            "locale": "en",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confirmationRequired"] is True
    assert data["intent"] == "execute_action"
    assert data["toolCalls"][0]["name"] == "log_food"
    assert "Log food" in data["confirmationPreview"]


@patch("app.agent.coach_graph.is_llm_configured", return_value=False)
@patch("app.agent.coach_graph.extract_tool_inputs", new_callable=AsyncMock)
@patch("app.agent.coach_graph.route_intent")
def test_chat_proposal_includes_extracted_inputs(mock_route, mock_extract, _mock_llm) -> None:
    from app.intent.router import IntentResult

    mock_route.return_value = IntentResult(
        intent="execute_action",
        source="rules",
        confidence=0.92,
        levels=["L1_INTERNAL"],
        needs_rag=False,
        needs_clarify=False,
        tool_hints=["log_food"],
    )
    mock_extract.return_value = {
        "log_food": {"foodName": "chicken", "grams": 200, "rawText": "log 200g chicken for lunch"},
    }

    response = client.post(
        "/chat",
        json={
            "userId": "user-1",
            "messages": [{"role": "user", "content": "log 200g chicken for lunch"}],
            "locale": "en",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confirmationRequired"] is True
    assert data["toolCalls"][0]["input"]["foodName"] == "chicken"
    assert data["sourceUserMessage"] == "log 200g chicken for lunch"


def test_classify_turn_endpoint_ar_confirm() -> None:
    response = client.post(
        "/chat/classify-turn",
        json={"message": "ايوه", "locale": "ar", "pendingPreview": "Log food: chicken"},
    )
    assert response.status_code == 200
    assert response.json()["turnType"] == "confirm"


@patch("app.routers.chat.fetch_context_bundle", side_effect=Exception("no bundle"))
def test_chat_pending_text_confirm_hints_app_button(_mock_bundle) -> None:
    response = client.post(
        "/chat",
        json={
            "userId": "user-1",
            "messages": [{"role": "user", "content": "نعم"}],
            "locale": "ar",
            "pendingAction": {
                "actionId": "11111111-1111-4111-8111-111111111111",
                "preview": "تسجيل وجبة: دجاج",
                "tools": ["log_food"],
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["confirmationRequired"] is False
    assert "تأكيد" in data["reply"]
