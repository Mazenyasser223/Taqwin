"""
Prompts for coach-template plan pipeline: Haiku retrieve + Sonnet template fill.
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.prompts.plan_prompts import format_excluded_list, _onboarding_flat
from app.services.cag_sanitize import sanitize_cag_string, sanitize_prompt_text

_REPO_ROOT = Path(__file__).resolve().parents[3]
_TEMPLATE_CONTRACT_PATH = _REPO_ROOT / "shared" / "plan-template-fill-contract.json"


@lru_cache(maxsize=1)
def _load_template_contract() -> dict[str, Any]:
    with _TEMPLATE_CONTRACT_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def build_retrieve_system_prompt() -> str:
    return (
        "You are Taqwin plan retrieval. Pick coach programs and filter RAG candidates for one athlete. "
        "Output ONLY valid JSON — no markdown."
    )


def build_retrieve_user_prompt(
    *,
    bundle: dict[str, Any],
    targets: dict[str, Any],
    program_summaries: dict[str, Any],
    book_candidates: list[dict[str, Any]],
    food_candidates: list[dict[str, Any]],
    exercise_candidates: list[dict[str, Any]],
) -> str:
    profile = bundle.get("profile") or {}
    onboarding = _onboarding_flat(bundle)
    hints = bundle.get("planGenerationHints") or {}

    lines: list[str] = [
        "--- ATHLETE ---",
        f"goal: {profile.get('fitnessGoal') or onboarding.get('primaryGoal') or 'fitness'}",
        f"fitnessLevel: {onboarding.get('fitnessLevel') or profile.get('fitnessLevel') or 'beginner'}",
        f"trainingDaysPerWeek: {onboarding.get('trainingDaysPerWeek') or 4}",
        f"calorieTarget: {targets.get('calorieTarget') or hints.get('referenceFormulaTargets', {}).get('calories')}",
        f"proteinTarget: {targets.get('proteinTarget') or hints.get('referenceFormulaTargets', {}).get('protein')}",
        "",
        "--- EXCLUDED / SAFETY ---",
        format_excluded_list(onboarding, bundle.get("constraints") or {}),
        "",
        "--- COACH DIET PROGRAMS (pick one dietId) ---",
        json.dumps(program_summaries.get("diets") or [], ensure_ascii=False),
        "",
        "--- COACH WORKOUT PROGRAMS (pick one workoutId) ---",
        json.dumps(program_summaries.get("workouts") or [], ensure_ascii=False),
        "",
    ]

    lines.append(f"--- BOOK CHUNKS (pick up to 6 indices 0..{max(0, len(book_candidates) - 1)}) ---")
    for i, chunk in enumerate(book_candidates[:20]):
        topic = chunk.get("topic") or chunk.get("title") or "coaching"
        text = str(chunk.get("text") or chunk.get("content") or "")[:280]
        lines.append(f"[{i}] {topic}: {text}")
    lines.append("")

    lines.append(f"--- FOODS (pick up to 15 indices 0..{max(0, len(food_candidates) - 1)}) ---")
    for i, food in enumerate(food_candidates[:40]):
        wid = food.get("webtebId")
        name = sanitize_cag_string(str(food.get("name") or "food"), "foodName")
        lines.append(f"[{i}] {name} | webtebId:{wid}")
    lines.append("")

    lines.append(f"--- EXERCISES (pick up to 20 indices 0..{max(0, len(exercise_candidates) - 1)}) ---")
    for i, ex in enumerate(exercise_candidates[:50]):
        eid = ex.get("id") or ex.get("exerciseId")
        name = sanitize_cag_string(str(ex.get("name") or "exercise"), "exerciseName")
        lines.append(f"[{i}] {name} | exerciseId:{eid}")
    lines.append("")

    lines.extend(
        [
            "--- OUTPUT JSON SCHEMA ---",
            '{',
            '  "dietId": "diet-2..diet-8",',
            '  "workoutId": "workout-1..workout-4",',
            '  "bookIndices": [0, 1],',
            '  "foodIndices": [0, 2],',
            '  "exerciseIndices": [0, 1],',
            '  "dailyTargetsHint": { "calories": int, "protein": int, "carbs": int, "fat": int, "waterMl": int },',
            '  "coachFocus": ["string"],',
            '  "reason": "string"',
            "}",
            "",
            "Return ONLY the JSON object.",
        ]
    )
    return "\n".join(lines)


def build_fill_system_prompt(*, locale: str = "ar") -> str:
    contract = _load_template_contract()
    rules = "\n".join(f"{i + 1}. {r}" for i, r in enumerate(contract["hardRules"]))
    lang = "Use Arabic for item names, day labels, and coachNotes." if locale == "ar" else "Use English for names and coachNotes."
    return "\n".join(
        [
            contract["systemPromptIntro"],
            "",
            "HARD RULES:",
            rules,
            "",
            lang,
            "",
            contract.get("schemaHint", ""),
        ]
    )


def build_fill_user_prompt(
    *,
    bundle: dict[str, Any],
    template_plan: dict[str, Any],
    book_chunks: list[dict[str, Any]],
    retrieval: dict[str, Any],
    validation_feedback: str = "",
) -> str:
    onboarding = _onboarding_flat(bundle)
    constraints = bundle.get("constraints") or {}
    lines: list[str] = [
        "--- TEMPLATE_PLAN (preserve structure) ---",
        json.dumps(template_plan, ensure_ascii=False)[:12000],
        "",
        "--- RETRIEVAL HINTS ---",
        json.dumps(
            {
                "dietId": retrieval.get("dietId"),
                "workoutId": retrieval.get("workoutId"),
                "dailyTargetsHint": retrieval.get("dailyTargetsHint"),
                "coachFocus": retrieval.get("coachFocus") or [],
                "reason": retrieval.get("reason"),
            },
            ensure_ascii=False,
        ),
        "",
        "--- COACHING PRINCIPLES ---",
    ]
    for i, chunk in enumerate(book_chunks[:8], 1):
        topic = chunk.get("topic") or "coaching"
        text = str(chunk.get("text") or chunk.get("content") or "")[:400]
        lines.append(f"[{i}] {topic}: {text}")
    lines.extend(
        [
            "",
            "--- EXCLUDED / SAFETY ---",
            format_excluded_list(onboarding, constraints),
            "",
        ]
    )
    if validation_feedback:
        lines.extend(
            [
                "--- FIX VALIDATION ERRORS ---",
                sanitize_prompt_text(validation_feedback, "planFeedback"),
                "",
            ]
        )
    contract = _load_template_contract()
    lines.append(contract.get("userPromptClosing") or "Return ONLY the JSON plan.")
    return "\n".join(lines)
