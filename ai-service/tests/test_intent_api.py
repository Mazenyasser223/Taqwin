from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_intent_endpoint_nutrition() -> None:
    res = client.post("/intent", json={"message": "high protein meal plan", "locale": "en"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "nutrition"
    assert data["needsRag"] is True
    assert "L3_NUTRITION" in data["levels"]


def test_intent_endpoint_unclear() -> None:
    res = client.post("/intent", json={"message": "?", "locale": "en"})
    assert res.status_code == 200
    data = res.json()
    assert data["intent"] == "unclear"
    assert data["needsClarify"] is True
