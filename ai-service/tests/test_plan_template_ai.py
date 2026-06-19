"""Tests for coach template AI pipeline (retrieve + fill merge)."""

from __future__ import annotations

from app.services.plan_fill_template import merge_template_plan
from app.services.plan_retrieve import _fallback_retrieval, _normalize_retrieval


def test_fallback_retrieval_picks_tier_by_calories() -> None:
    out = _fallback_retrieval(
        targets={"calorieTarget": 3300, "proteinTarget": 200},
        onboarding={"trainingDaysPerWeek": 5, "fitnessLevel": "advanced"},
        program_summaries={
            "diets": [{"id": "diet-2", "approxTierKcal": 2000}, {"id": "diet-8", "approxTierKcal": 3200}],
            "workouts": [{"id": "workout-1"}, {"id": "workout-4"}],
        },
    )
    assert out["dietId"] == "diet-8"
    assert out["workoutId"] == "workout-4"
    assert out["source"] == "rules"


def test_normalize_retrieval_filters_indices() -> None:
    books = [{"topic": "a"}, {"topic": "b"}, {"topic": "c"}]
    foods = [{"name": "f1", "webtebId": 1}, {"name": "f2", "webtebId": 2}]
    parsed = {
        "dietId": "diet-5",
        "workoutId": "workout-2",
        "bookIndices": [0, 2],
        "foodIndices": [1],
        "exerciseIndices": [],
        "dailyTargetsHint": {"calories": 2600, "protein": 180, "carbs": 250, "fat": 70, "waterMl": 2500},
        "reason": "test",
    }
    out = _normalize_retrieval(
        parsed,
        targets={"calorieTarget": 2400},
        onboarding={},
        program_summaries={
            "diets": [{"id": "diet-5"}],
            "workouts": [{"id": "workout-2"}],
        },
        book_candidates=books,
        food_candidates=foods,
        exercise_candidates=[],
    )
    assert out["dietId"] == "diet-5"
    assert out["bookIndices"] == [0, 2]
    assert out["foodIndices"] == [1]


def test_merge_template_preserves_structure_on_mismatch() -> None:
    template = {
        "dailyTargets": {"calories": 2400, "protein": 150, "carbs": 250, "fat": 70, "waterMl": 2500},
        "dietDays": [
            {
                "dayIndex": 1,
                "meals": [{"slot": "breakfast", "items": [{"name": "Oats", "grams": 50, "webtebId": 8258}]}],
            }
        ],
        "workoutWeeks": [
            {
                "weekIndex": 1,
                "days": [
                    {
                        "dayIndex": 1,
                        "isRest": False,
                        "exercises": [{"name": "Press", "exerciseId": "abc", "sets": 3, "reps": 10}],
                    }
                ],
            }
        ],
        "coachNotes": "",
    }
    bad = {
        "dailyTargets": {"calories": 2500, "protein": 160, "carbs": 260, "fat": 72, "waterMl": 2600},
        "dietDays": [{"dayIndex": 1, "meals": []}],
        "workoutWeeks": [{"weekIndex": 1, "days": []}],
        "coachNotes": "Focus protein",
    }
    merged = merge_template_plan(template, bad)
    assert len(merged["dietDays"][0]["meals"]) == 1
    assert merged["dailyTargets"]["calories"] == 2500
    assert merged["coachNotes"] == "Focus protein"
