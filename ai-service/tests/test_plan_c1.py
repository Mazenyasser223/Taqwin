"""Block C1 — /plan/generate and /plan/adapt."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

MINIMAL_BUNDLE = {
    "locale": "en",
    "profile": {
        "fitnessGoal": "muscle",
        "fitnessLevel": "beginner",
        "weightKg": 75,
        "gender": "male",
    },
    "onboardingSummary": {
        "trainingDaysPerWeek": 4,
        "preferredSplit": "full",
        "mealsPerDay": 3,
        "snacksPerDay": 1,
    },
    "nutritionToday": {
        "targets": {
            "calories": 2200,
            "protein": 150,
            "carbs": 220,
            "fat": 70,
            "waterMl": 2500,
        }
    },
    "constraints": {"injuries": [], "foodAllergies": []},
}


def test_plan_generate_scaffold_without_llm(monkeypatch) -> None:
    monkeypatch.setattr("app.services.plan_generate.is_llm_configured", lambda: False)
    monkeypatch.setattr(
        "app.services.plan_generate.resolve_plan_candidates",
        lambda **_k: ([], [], []),
    )

    response = client.post(
        "/plan/generate",
        json={
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": MINIMAL_BUNDLE,
            "weekStart": "2026-06-02",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "scaffold"
    assert "explainabilityText" in data
    plan = data["plan"]
    assert plan["dailyTargets"]["calories"] == 2200
    assert len(plan["dietDays"]) == 7
    assert len(plan["workoutWeeks"]) == 4
    assert plan["workoutWeeks"][0]["days"][0]["dayIndex"] == 1


def test_plan_adapt_keep() -> None:
    response = client.post(
        "/plan/adapt",
        json={
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": MINIMAL_BUNDLE,
            "decisionHint": "keep",
            "snapshot": {"adherencePct": 0.8},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plan"] is None
    assert data["adaptation"]["decision"] == "keep"
    assert data["adaptation"]["applied"] is False


def test_plan_adapt_micro_returns_scaffold(monkeypatch) -> None:
    monkeypatch.setattr("app.services.plan_adapt.is_llm_configured", lambda: False)
    monkeypatch.setattr(
        "app.services.plan_adapt.resolve_plan_candidates",
        lambda **_k: ([], [], []),
    )
    response = client.post(
        "/plan/adapt",
        json={
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": MINIMAL_BUNDLE,
            "decisionHint": "micro",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["plan"] is not None
    assert data["adaptation"]["decision"] == "micro"
    assert data["source"] == "scaffold"


def test_plan_generate_with_candidate_lists(monkeypatch) -> None:
    monkeypatch.setattr("app.services.plan_generate.is_llm_configured", lambda: False)
    monkeypatch.setattr(
        "app.services.plan_generate.resolve_plan_candidates",
        lambda **_k: ([{"source": "foodItem", "id": "x", "name": "Chicken"}], [], []),
    )

    response = client.post(
        "/plan/generate",
        json={
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": MINIMAL_BUNDLE,
            "foods": [
                {
                    "source": "foodItem",
                    "id": "11111111-1111-4111-8111-111111111111",
                    "name": "Chicken breast",
                    "calories": 165,
                    "protein": 31,
                    "carbs": 0,
                    "fat": 4,
                }
            ],
            "exercises": [
                {
                    "id": "22222222-2222-4222-8222-222222222222",
                    "name": "Bench Press",
                    "category": "chest",
                }
            ],
        },
    )
    assert response.status_code == 200
    assert response.json()["meta"]["foodCandidates"] >= 0
