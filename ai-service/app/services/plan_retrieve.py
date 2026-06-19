"""
Step 1 — Haiku retrieval: pick coach programs + filter RAG candidates.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import get_settings
from app.prompts.plan_template_prompts import build_retrieve_system_prompt, build_retrieve_user_prompt
from app.services.llm_chat import complete_coach_chat, is_llm_configured
from app.services.plan_json import extract_json

logger = logging.getLogger(__name__)

VALID_DIETS = {f"diet-{i}" for i in range(2, 9)}
VALID_WORKOUTS = {f"workout-{i}" for i in range(1, 5)}


def _fallback_retrieval(
    *,
    targets: dict[str, Any],
    onboarding: dict[str, Any],
    program_summaries: dict[str, Any],
) -> dict[str, Any]:
    """Rule-based fallback when Haiku is off or parse fails."""
    calories = int(targets.get("calorieTarget") or 2400)
    diets = program_summaries.get("diets") or []
    diet_id = diets[0]["id"] if diets else "diet-2"
    for d in reversed(diets):
        tier = d.get("approxTierKcal") or 0
        if calories >= tier:
            diet_id = d["id"]
            break

    days = int(onboarding.get("trainingDaysPerWeek") or 4)
    level = str(onboarding.get("fitnessLevel") or "").lower()
    workout_id = "workout-2"
    if days <= 3:
        workout_id = "workout-1"
    elif days >= 5:
        workout_id = "workout-3"
    if "beginner" in level:
        workout_id = "workout-1"
    if "advanced" in level:
        workout_id = "workout-4"

    workouts = program_summaries.get("workouts") or []
    valid_w = {w["id"] for w in workouts}
    if workout_id not in valid_w and workouts:
        workout_id = workouts[0]["id"]
    valid_d = {d["id"] for d in diets}
    if diet_id not in valid_d and diets:
        diet_id = diets[0]["id"]

    return {
        "dietId": diet_id,
        "workoutId": workout_id,
        "bookIndices": [],
        "foodIndices": [],
        "exerciseIndices": [],
        "dailyTargetsHint": {
            "calories": int(targets.get("calorieTarget") or 2400),
            "protein": int(targets.get("proteinTarget") or 150),
            "carbs": int(targets.get("carbTarget") or 250),
            "fat": int(targets.get("fatTarget") or 70),
            "waterMl": int(targets.get("waterMl") or 2500),
        },
        "coachFocus": [],
        "reason": "rule_fallback",
        "source": "rules",
    }


def _pick_indices(raw: Any, max_len: int, cap: int) -> list[int]:
    if not isinstance(raw, list) or max_len <= 0:
        return []
    out: list[int] = []
    for val in raw:
        try:
            idx = int(val)
        except (TypeError, ValueError):
            continue
        if 0 <= idx < max_len and idx not in out:
            out.append(idx)
        if len(out) >= cap:
            break
    return out


def _normalize_retrieval(
    parsed: dict[str, Any] | None,
    *,
    targets: dict[str, Any],
    onboarding: dict[str, Any],
    program_summaries: dict[str, Any],
    book_candidates: list[dict[str, Any]],
    food_candidates: list[dict[str, Any]],
    exercise_candidates: list[dict[str, Any]],
) -> dict[str, Any]:
    if not parsed:
        return _fallback_retrieval(
            targets=targets,
            onboarding=onboarding,
            program_summaries=program_summaries,
        )

    diets = {d["id"] for d in (program_summaries.get("diets") or []) if d.get("id")}
    workouts = {w["id"] for w in (program_summaries.get("workouts") or []) if w.get("id")}

    diet_id = str(parsed.get("dietId") or "")
    if diet_id not in diets:
        diet_id = diets.pop() if len(diets) == 1 else (sorted(diets)[0] if diets else "diet-2")
    if diet_id not in VALID_DIETS:
        diet_id = "diet-2"

    workout_id = str(parsed.get("workoutId") or "")
    if workout_id not in workouts:
        workout_id = workouts.pop() if len(workouts) == 1 else (sorted(workouts)[0] if workouts else "workout-1")
    if workout_id not in VALID_WORKOUTS:
        workout_id = "workout-1"

    hint = parsed.get("dailyTargetsHint") if isinstance(parsed.get("dailyTargetsHint"), dict) else {}
    daily_targets_hint = {
        "calories": int(hint.get("calories") or targets.get("calorieTarget") or 2400),
        "protein": int(hint.get("protein") or targets.get("proteinTarget") or 150),
        "carbs": int(hint.get("carbs") or targets.get("carbTarget") or 250),
        "fat": int(hint.get("fat") or targets.get("fatTarget") or 70),
        "waterMl": int(hint.get("waterMl") or targets.get("waterMl") or 2500),
    }

    book_indices = _pick_indices(parsed.get("bookIndices"), len(book_candidates), 8)
    food_indices = _pick_indices(parsed.get("foodIndices"), len(food_candidates), 15)
    exercise_indices = _pick_indices(parsed.get("exerciseIndices"), len(exercise_candidates), 20)

    coach_focus = parsed.get("coachFocus")
    if not isinstance(coach_focus, list):
        coach_focus = []
    coach_focus = [str(x)[:80] for x in coach_focus[:5]]

    return {
        "dietId": diet_id,
        "workoutId": workout_id,
        "bookIndices": book_indices,
        "foodIndices": food_indices,
        "exerciseIndices": exercise_indices,
        "dailyTargetsHint": daily_targets_hint,
        "coachFocus": coach_focus,
        "reason": str(parsed.get("reason") or "")[:200],
        "source": "ai",
    }


def filter_candidates_by_indices(
    candidates: list[dict[str, Any]], indices: list[int]
) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for idx in indices:
        if 0 <= idx < len(candidates):
            out.append(candidates[idx])
    return out


async def retrieve_plan_context(
    *,
    context_bundle: dict[str, Any],
    targets: dict[str, Any],
    program_summaries: dict[str, Any],
    book_candidates: list[dict[str, Any]] | None = None,
    food_candidates: list[dict[str, Any]] | None = None,
    exercise_candidates: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Returns retrieval package for Node: program IDs, filtered lists, hints.
    """
    from app.prompts.plan_prompts import _onboarding_flat

    bundle = context_bundle or {}
    onboarding = _onboarding_flat(bundle)
    books = list(book_candidates or [])
    foods = list(food_candidates or [])
    exercises = list(exercise_candidates or [])

    parsed: dict[str, Any] | None = None
    source = "rules"

    if is_llm_configured():
        settings = get_settings()
        try:
            raw = await complete_coach_chat(
                system=build_retrieve_system_prompt(),
                messages=[
                    {
                        "role": "user",
                        "content": build_retrieve_user_prompt(
                            bundle=bundle,
                            targets=targets,
                            program_summaries=program_summaries,
                            book_candidates=books,
                            food_candidates=foods,
                            exercise_candidates=exercises,
                        ),
                    }
                ],
                temperature=0.1,
                max_tokens=1200,
                model=settings.anthropic_haiku_model,
                cache_system=False,
            )
            parsed = extract_json(raw)
            if parsed:
                source = "ai"
        except Exception as exc:
            logger.warning("plan retrieve Haiku failed: %s", exc)

    retrieval = _normalize_retrieval(
        parsed,
        targets=targets,
        onboarding=onboarding,
        program_summaries=program_summaries,
        book_candidates=books,
        food_candidates=foods,
        exercise_candidates=exercises,
    )
    retrieval["source"] = source

    return {
        "retrieval": retrieval,
        "bookChunks": filter_candidates_by_indices(books, retrieval["bookIndices"]),
        "foods": filter_candidates_by_indices(foods, retrieval["foodIndices"]),
        "exercises": filter_candidates_by_indices(exercises, retrieval["exerciseIndices"]),
    }
