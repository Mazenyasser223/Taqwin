from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.rag.retriever import RagHit
from app.rag.types import RetrievalStats

client = TestClient(app)


@patch("app.routers.rag.retrieve_rag")
def test_rag_retrieve_passes_context_bundle(mock_retrieve) -> None:
    mock_retrieve.return_value = ("nutrition", ["L3_NUTRITION"], [], RetrievalStats())

    bundle = {"profile": {"fitnessGoal": "muscle gain"}}
    response = client.post(
        "/rag/retrieve",
        json={
            "query": "وجبة غداء",
            "locale": "ar",
            "intent": "nutrition",
            "contextBundle": bundle,
        },
    )

    assert response.status_code == 200
    mock_retrieve.assert_called_once()
    assert mock_retrieve.call_args.kwargs["context_bundle"] == bundle
    assert mock_retrieve.call_args.kwargs["locale"] == "ar"


@patch("app.routers.rag.retrieve_rag")
def test_rag_retrieve_response_shape(mock_retrieve) -> None:
    mock_retrieve.return_value = (
        "workout",
        ["L2_EXERCISE"],
        [
            RagHit(
                chunk_id="c1",
                document_id="d1",
                level="L2_EXERCISE",
                source="ex",
                title="Bench Press",
                locale="en",
                content="Instructions for bench press.",
                score=0.81,
                metadata=None,
            )
        ],
        RetrievalStats(),
    )

    response = client.post(
        "/rag/retrieve",
        json={"query": "bench press form", "intent": "workout"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data["intent"] == "workout"
    assert data["hitCount"] == 1
    assert data["hits"][0]["title"] == "Bench Press"
    assert "contextBlock" in data
