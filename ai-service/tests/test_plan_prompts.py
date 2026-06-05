"""Tests for plan prompt helpers."""

from app.prompts.plan_prompts import build_plan_system_prompt, extract_daily_targets
from app.services.plan_json import extract_json


def test_extract_daily_targets_from_bundle() -> None:
    bundle = {
        "nutritionToday": {
            "targets": {
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
