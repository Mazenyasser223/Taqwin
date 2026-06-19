"""Quick Claude plan JSON diagnostic — run from ai-service/: python scripts/diagnose_plan_claude.py"""

from __future__ import annotations

import asyncio
import sys

from app.config import get_settings
from app.services.llm_chat import complete_coach_chat
from app.services.plan_json import extract_json, has_plan_shape, normalize_claude_plan_shape


async def test_minimal() -> bool:
    settings = get_settings()
    system = "You output a single JSON object only. No markdown."
    user = (
        'Return ONLY valid JSON with dailyTargets (calories, protein, carbs, fat, waterMl all > 0), '
        "one dietDay with one meal item, one workoutWeek with one training day and one exercise. "
        'Keys: dailyTargets, dietDays, workoutWeeks, coachNotes, regenerationReason.'
    )
    raw = await complete_coach_chat(
        system=system,
        messages=[{"role": "user", "content": user}],
        temperature=0,
        max_tokens=settings.plan_llm_max_tokens,
        cache_system=False,
    )
    print("minimal raw_len", len(raw))
    print("minimal preview", (raw or "")[:400])
    parsed = normalize_claude_plan_shape(extract_json(raw))
    ok = bool(parsed and has_plan_shape(parsed))
    print("minimal has_shape", ok)
    return ok


async def test_full_prompt_chars(user_prompt: str) -> None:
    settings = get_settings()
    from app.prompts.plan_prompts import build_plan_system_prompt

    system = build_plan_system_prompt(locale="en")
    print("full prompt chars", len(user_prompt), "system chars", len(system))
    raw = await complete_coach_chat(
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
        temperature=settings.plan_llm_temperature,
        max_tokens=settings.plan_llm_max_tokens,
        cache_system=True,
    )
    print("full raw_len", len(raw))
    print("full tail", (raw or "")[-200:])
    parsed = normalize_claude_plan_shape(extract_json(raw))
    print("full has_shape", bool(parsed and has_plan_shape(parsed)))
    if parsed:
        print("diet_days", len(parsed.get("dietDays") or []))
        print("workout_weeks", len(parsed.get("workoutWeeks") or []))
        dt = parsed.get("dailyTargets") or {}
        print("dailyTargets", {k: dt.get(k) for k in ("calories", "protein", "carbs", "fat", "waterMl")})


async def main() -> int:
    run_full = "--full" in sys.argv
    if not run_full:
        if not await test_minimal():
            return 1

    if run_full:
        from app.prompts.plan_prompts import build_plan_user_prompt
        from app.services.llm_chat import format_context_bundle

        bundle = {
            "locale": "en",
            "profile": {"fitnessGoal": "Build Muscle", "weightKg": 80, "heightCm": 180, "gender": "male"},
            "onboarding": {
                "fitnessLevel": "advanced",
                "trainingDaysPerWeek": 4,
                "dietType": "halal",
                "mealsPerDay": 3,
            },
            "constraints": {},
            "nutritionStructureBlueprint": {"mealSlots": ["breakfast", "lunch", "dinner"]},
            "workoutStructureBlueprint": {"days": [{"dayIndex": 1, "type": "push", "isRest": False}]},
        }
        foods = [{"id": f"f{i}", "name": f"Food {i}", "planGroup": "proteins", "calories": 100, "protein": 20, "carbs": 0, "fat": 2, "source": "foodItem"} for i in range(72)]
        exercises = [
            {
                "id": f"e{i}",
                "name": f"Exercise {i}",
                "muscleGroup": "chest",
                "planDifficulty": "intermediate",
                "category": "strength",
            }
            for i in range(120)
        ]
        user_prompt = build_plan_user_prompt(
            bundle=bundle,
            foods=foods,
            exercises=exercises,
            book_chunks=[{"topic": "hypertrophy", "text": "Progressive overload 8-12 reps."}],
            context_bundle_text=format_context_bundle(bundle),
            week_start="2026-06-16",
        )
        await test_full_prompt_chars(user_prompt)

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
