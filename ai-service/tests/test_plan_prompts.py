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


def test_build_plan_user_prompt_groups_food_library() -> None:
    from app.prompts.plan_prompts import build_plan_user_prompt

    prompt = build_plan_user_prompt(
        bundle={"profile": {}, "onboardingSummary": {}, "locale": "en"},
        foods=[
            {
                "name": "Chicken",
                "webtebId": 1,
                "planGroup": "protein",
                "calories": 165,
                "protein": 31,
                "carbs": 0,
                "fat": 4,
            },
            {
                "name": "Rice",
                "webtebId": 2,
                "planGroup": "carbs",
                "calories": 130,
                "protein": 3,
                "carbs": 28,
                "fat": 0,
            },
        ],
        exercises=[],
    )
    assert "FOOD LIBRARY" in prompt
    assert "PROTEINS" in prompt
    assert "CARBS" in prompt
    assert "webtebId:1" in prompt


def test_build_plan_user_prompt_includes_structure_lock() -> None:
    from app.prompts.plan_prompts import build_plan_user_prompt

    prompt = build_plan_user_prompt(
        bundle={
            "profile": {"fitnessGoal": "muscle"},
            "onboardingSummary": {},
            "planGenerationHints": {
                "structureLock": {
                    "dailyTargets": {"calories": 2400, "protein": 180, "carbs": 250, "fat": 70, "waterMl": 3000},
                    "workoutSkeleton": [{"dayIndex": 1, "type": "push", "isRest": False}],
                    "dietSkeleton": [{"dayIndex": 1, "mealSlots": ["breakfast", "lunch"]}],
                    "anchorFoods": ["Eggs"],
                    "anchorExercises": ["ex-1"],
                },
            },
        },
        foods=[],
        exercises=[],
    )
    assert "STRUCTURE LOCK" in prompt
    assert "anchorFoods" in prompt


def test_build_plan_user_prompt_includes_nutrition_and_workout_blueprints() -> None:
    from app.prompts.plan_prompts import build_plan_user_prompt

    prompt = build_plan_user_prompt(
        bundle={
            "profile": {"fitnessGoal": "muscle"},
            "onboardingSummary": {"trainingDaysPerWeek": 4},
            "locale": "en",
            "planGenerationHints": {
                "nutritionStructureBlueprint": {
                    "dietSkeleton": [{"dayIndex": 1, "meals": [{"slot": "breakfast", "targetItemCount": 4}]}],
                },
                "workoutStructureBlueprint": {
                    "workoutSkeleton": [{"dayIndex": 1, "isRest": False, "targetExerciseCount": 6}],
                },
            },
        },
        foods=[],
        exercises=[],
    )
    assert "NUTRITION PROGRAMMING" in prompt
    assert "WORKOUT PROGRAMMING" in prompt
    assert "dietSkeleton" in prompt
    assert "workoutSkeleton" in prompt
    assert "FOOD LIBRARY" in prompt or "MANDATORY meal structure" in prompt


def test_build_plan_user_prompt_groups_exercise_library() -> None:
    from app.prompts.plan_prompts import build_plan_user_prompt

    prompt = build_plan_user_prompt(
        bundle={"profile": {}, "onboardingSummary": {}, "locale": "en"},
        foods=[],
        exercises=[
            {
                "name": "Bench Press",
                "id": "ex-1",
                "muscleGroup": "chest",
                "planDifficulty": "intermediate",
                "category": "strength",
            },
        ],
    )
    assert "EXERCISE LIBRARY" in prompt
    assert "exerciseId:ex-1" in prompt
    assert "INTERMEDIATE" in prompt


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
    assert "COACHING PRINCIPLES" in prompt
    assert "RAG exercise pool" in prompt


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
    assert "[NUTRITION]" in prompt
    assert "[WORKOUT]" in prompt
