from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.mark.live_cag_fetch
@patch("app.agent.coach_graph.is_llm_configured", return_value=False)
@patch("app.agent.coach_graph.retrieve_rag", return_value=("general", [], []))
@patch("app.agent.coach_graph.route_intent")
@patch("app.routers.chat.fetch_context_bundle")
def test_chat_fetches_cag_when_bundle_missing(mock_fetch, mock_route, _rag, _llm) -> None:
    from app.intent.router import IntentResult

    mock_fetch.return_value = {
        "locale": "ar",
        "generatedAt": "2026-06-01T12:00:00Z",
        "profile": {"displayName": "أحمد"},
    }
    mock_route.return_value = IntentResult(
        intent="general",
        source="rules",
        confidence=0.8,
        levels=[],
        needs_rag=False,
        needs_clarify=False,
        tool_hints=[],
    )

    response = client.post(
        "/chat",
        json={
            "userId": "user-cag-1",
            "messages": [{"role": "user", "content": "مرحبا"}],
        },
    )
    assert response.status_code == 200
    mock_fetch.assert_called_once_with("user-cag-1")
