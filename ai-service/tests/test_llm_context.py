from app.services.llm_chat import format_context_bundle


def test_format_context_bundle_includes_onboarding_by_flow() -> None:
    bundle = {
        "profile": {
            "displayName": "Ahmed",
            "weightKg": 82,
            "heightCm": 184,
            "fitnessGoal": "muscle",
        },
        "onboardingByFlow": {
            "core": {"bodyType": "mesomorph — Mesomorph (athletic build)", "primaryGoal": "muscle"},
            "workout": {"trainingDaysPerWeek": "4", "preferredSplit": "push_pull_legs"},
            "nutrition": {"dietType": "high_protein", "religiousDiet": "halal"},
            "health": {"sleep": "7_8h"},
        },
        "nutritionToday": {
            "date": "2026-06-03",
            "logged": {"mealCount": 2, "calories": 1200},
            "targets": {"calories": 2100},
        },
        "constraints": {"injuries": ["shoulder"]},
    }
    text = format_context_bundle(bundle)
    assert "bodyType:" in text
    assert "mesomorph" in text
    assert "ONBOARDING — WORKOUT" in text
    assert "trainingDaysPerWeek" in text
    assert "ONBOARDING — NUTRITION" in text
    assert "ONBOARDING — HEALTH" in text
    assert "Do not guess" in text or "source of truth" in text
