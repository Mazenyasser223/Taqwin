"""Tests for plan prompt helpers."""

from app.prompts.plan_prompts import build_plan_system_prompt, extract_daily_targets
from app.services.plan_json import extract_json


def test_extract_daily_targets_from_bundle() -> None:
    bundle = {
        "planGenerationHints": {
            "referenceFormulaTargets": {
                "calories": 2000,
                "protein": 140,
                "carbs": 200,
                "fat": 65,
                "waterMl": 3000,
            }
        }
    }
    t = extract_daily_targets(bundle)
    assert t["calories"] == 2000
    assert t["waterMl"] == 3000


def test_build_plan_user_prompt_ai_macro_derivation() -> None:
    from app.prompts.plan_prompts import build_plan_user_prompt

    prompt = build_plan_user_prompt(
        bundle={
            "profile": {"fitnessGoal": "muscle", "weightKg": 80},
            "onboardingSummary": {"calorieTarget": "deficit_mild", "trainingDaysPerWeek": 4},
            "planGenerationHints": {
                "referenceMaintenanceKcal": 2400,
                "referenceFormulaTargets": {"calories": 2100, "protein": 160, "carbs": 210, "fat": 65, "waterMl": 2800},
            },
        },
        foods=[{"name": "Chicken", "id": "x", "calories": 165, "protein": 31, "carbs": 0, "fat": 4}],
        exercises=[{"name": "Squat", "id": "y"}],
        book_chunks=[{"topic": "protein", "text": "Athletes benefit from 1.6-2.2g protein per kg for hypertrophy."}],
    )
    assert "MACRO TARGETING (AI + RAG" in prompt
    assert "WORKOUT PROGRAMMING (AI + RAG" in prompt
    assert "must match exactly" not in prompt
    assert "reference only" in prompt
    assert "COACHING PRINCIPLES" in prompt
    assert "RAG exercise pool" in prompt
    assert "Do NOT use a fixed PPL template" in prompt


def test_extract_json_strips_markdown() -> None:
    raw = (
        '```json\n{"dailyTargets":{"calories":1,"protein":1,"carbs":1,"fat":1,"waterMl":1},'
        '"dietDays":[{"dayIndex":1,"meals":[]}],"workoutWeeks":[{"weekIndex":1,"days":[]}]}\n```'
    )
    data = extract_json(raw)
    assert data is not None
    assert data["dailyTargets"]["calories"] == 1


def test_build_plan_system_prompt_ar() -> None:
    prompt = build_plan_system_prompt(locale="ar")
    assert "HARD RULES" in prompt
    assert "Arabic" in prompt
