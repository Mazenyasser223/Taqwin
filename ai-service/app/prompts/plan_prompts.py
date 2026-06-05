"""
Block C1 — prompts for weekly workout + diet plan JSON (mirrors backend-node lib/plans/prompt.js).
"""

from __future__ import annotations

from typing import Any

HARD_RULES = [
    "Output a SINGLE JSON object with no markdown fences, no commentary, no leading text.",
    "Use ONLY the foods listed under FOODS — set `foodItemId` for items tagged `foodItemId:` "
    "and `webtebId` (integer) for items tagged `webtebId:`.",
    "Use ONLY the exercises listed under EXERCISES — set `exerciseId` to the UUID after `exerciseId:`.",
    "Do NOT invent foodItemId, webtebId, or exerciseId values — copy them from the lists.",
    "NEVER recommend foods that match the EXCLUDED list (allergies, religious diet, user blocks).",
    "NEVER recommend exercises that match BLOCKED EXERCISES (injuries).",
    "Each diet day must hit ≥85% of dailyTargets.protein across its meals.",
    "Calories per day should be within ±10% of dailyTargets.calories.",
    "Plan exactly 7 diet days (dayIndex 1..7) and ONE workout week (weekIndex 1, 7 days). "
    "Server copies week 1 to weeks 2–4. Rest days: isRest true, exercises [].",
    "On each non-rest training day include at least 3 exercises from EXERCISES (copy exerciseId).",
    "Each diet day: 3–4 meals using FOODS list IDs where possible.",
]

SCHEMA_HINT = """{
  "dailyTargets": { "calories": int, "protein": int, "carbs": int, "fat": int, "waterMl": int },
  "dietDays": [
    {
      "dayIndex": 1..7,
      "label": "Day 1" | "اليوم 1",
      "meals": [
        {
          "slot": "breakfast"|"lunch"|"dinner"|"snack",
          "foodItemId": "uuid" | null,
          "webtebId": int | null,
          "name": "string",
          "grams": int > 0,
          "calories": int,
          "protein": int,
          "carbs": int,
          "fat": int,
          "notes": "string"
        }
      ]
    }
  ],
  "workoutWeeks": [
    {
      "weekIndex": 1..4,
      "days": [
        {
          "dayIndex": 1..7,
          "type": "push|pull|legs|upper|lower|full|cardio|rest",
          "label": "string",
          "isRest": bool,
          "exercises": [
            { "exerciseId": "uuid", "name": "string", "sets": int, "reps": int, "restSec": int, "notes": "string" }
          ]
        }
      ]
    }
  ],
  "coachNotes": "string (≤300 chars)",
  "regenerationReason": "string (≤120 chars)"
}"""


def format_food_line(food: dict[str, Any]) -> str:
    source = food.get("source") or ("foodItem" if food.get("foodItemId") else "webteb")
    fid = food.get("id") or food.get("foodItemId")
    wid = food.get("webtebId")
    if source == "foodItem" or fid:
        id_hint = f"foodItemId:{fid}"
    else:
        id_hint = f"webtebId:{wid}"
    name = food.get("name") or "food"
    cal = round(float(food.get("calories") or 0))
    p = round(float(food.get("protein") or 0))
    c = round(float(food.get("carbs") or 0))
    f = round(float(food.get("fat") or 0))
    return f"- {name} | {id_hint} | {cal} kcal/100g | P{p}g C{c}g F{f}g"


def format_exercise_line(ex: dict[str, Any]) -> str:
    eid = ex.get("id") or ex.get("exerciseId")
    name = ex.get("name") or "exercise"
    category = ex.get("category") or "general"
    muscles = ex.get("primaryMuscles") or []
    muscle_hint = f" | {'/'.join(str(m) for m in muscles[:2])}" if muscles else ""
    return f"- {name} | exerciseId:{eid} | {category}{muscle_hint}"


def _onboarding_flat(bundle: dict[str, Any]) -> dict[str, Any]:
    by_flow = bundle.get("onboardingByFlow")
    if isinstance(by_flow, dict):
        flat: dict[str, Any] = {}
        for section in ("core", "workout", "nutrition", "health"):
            part = by_flow.get(section)
            if isinstance(part, dict):
                flat.update(part)
        if flat:
            return flat
    summary = bundle.get("onboardingSummary")
    return summary if isinstance(summary, dict) else {}


def extract_daily_targets(bundle: dict[str, Any]) -> dict[str, int]:
    nt = bundle.get("nutritionToday") or {}
    t = nt.get("targets") or {}
    if t.get("calories"):
        return {
            "calories": int(t["calories"]),
            "protein": int(t.get("protein") or 120),
            "carbs": int(t.get("carbs") or 200),
            "fat": int(t.get("fat") or 60),
            "waterMl": int(t.get("waterMl") or 2500),
        }
    profile = bundle.get("profile") or {}
    weight = float(profile.get("weightKg") or 70)
    return {
        "calories": int(weight * 24),
        "protein": int(weight * 1.8),
        "carbs": int(weight * 3),
        "fat": int(weight * 0.8),
        "waterMl": 2500,
    }


def format_excluded_list(onboarding: dict[str, Any], constraints: dict[str, Any]) -> str:
    parts: list[str] = []
    allergies = onboarding.get("foodAllergies") or constraints.get("foodAllergies") or []
    if allergies:
        parts.append(f"allergies: {', '.join(str(a) for a in allergies)}")
    excluded = onboarding.get("foodsExcluded") or constraints.get("excludedFoods") or []
    if excluded:
        names = [
            e if isinstance(e, str) else (e.get("name") if isinstance(e, dict) else str(e))
            for e in excluded
        ]
        names = [n for n in names if n]
        if names:
            parts.append(f"excluded foods: {', '.join(names)}")
    if onboarding.get("foodsExcludedCustom"):
        parts.append(f"also avoid: {onboarding['foodsExcludedCustom']}")
    rd = onboarding.get("religiousDiet") or constraints.get("religiousDiet") or ""
    if rd and rd != "none":
        parts.append(f"religious diet: {rd}")
    injuries = onboarding.get("injuries") or constraints.get("injuries") or []
    inj = [i for i in injuries if i and i != "none"]
    if inj:
        parts.append(f"injuries: {', '.join(str(i) for i in inj)}")
    return "\n".join(parts) if parts else "(none reported)"


def build_plan_system_prompt(*, locale: str = "ar") -> str:
    lang = (
        "Use Arabic for meal `name`, `label`, and `coachNotes`. Keep `slot`, `type`, and numbers in English."
        if locale == "ar"
        else "Use English for meal `name`, `label`, and `coachNotes`."
    )
    rules = "\n".join(f"{i + 1}. {r}" for i, r in enumerate(HARD_RULES))
    return "\n".join(
        [
            "You are Taqwin Coach generating a personalized 7-day diet + 4-week workout plan as JSON.",
            "",
            "HARD RULES:",
            rules,
            "",
            lang,
            "",
            "EXPECTED SCHEMA:",
            SCHEMA_HINT,
        ]
    )


def build_plan_user_prompt(
    *,
    bundle: dict[str, Any],
    foods: list[dict[str, Any]],
    exercises: list[dict[str, Any]],
    book_chunks: list[dict[str, Any]] | None = None,
    context_bundle_text: str = "",
    regeneration_reason: str = "",
    validation_feedback: str = "",
    week_start: str = "",
) -> str:
    profile = bundle.get("profile") or {}
    onboarding = _onboarding_flat(bundle)
    constraints = bundle.get("constraints") or {}
    targets = extract_daily_targets(bundle)

    sections: list[str] = []
    if week_start:
        sections.append(f"Week start date: {week_start}")
        sections.append("")

    if context_bundle_text.strip():
        sections.append("--- LIVE CONTEXT (CAG) ---")
        sections.append(context_bundle_text.strip()[:4000])
        sections.append("")

    sections.append("--- USER PROFILE ---")
    lines = [
        f"goal: {profile.get('fitnessGoal') or onboarding.get('primaryGoal') or 'general fitness'}",
        f"fitnessLevel: {onboarding.get('fitnessLevel') or profile.get('fitnessLevel') or 'beginner'}",
    ]
    if profile.get("weightKg"):
        lines.append(f"weight: {profile['weightKg']} kg")
    if profile.get("heightCm"):
        lines.append(f"height: {profile['heightCm']} cm")
    if profile.get("gender"):
        lines.append(f"gender: {profile['gender']}")
    for key in (
        "trainingDaysPerWeek",
        "preferredSplit",
        "workoutLocation",
        "workoutDuration",
        "mealsPerDay",
        "snacksPerDay",
        "dietType",
        "calorieTarget",
        "religiousDiet",
        "foodBudget",
        "water",
    ):
        if onboarding.get(key):
            lines.append(f"{key}: {onboarding[key]}")
    if profile.get("medicalNotes"):
        lines.append(f"medicalNotes: {profile['medicalNotes']}")
    lines.append(
        f"DAILY TARGETS (must match exactly): calories={targets['calories']} "
        f"protein={targets['protein']}g carbs={targets['carbs']}g "
        f"fat={targets['fat']}g water={targets['waterMl']}ml"
    )
    sections.append("\n".join(lines))
    sections.append("")

    sections.append("--- EXCLUDED / SAFETY ---")
    sections.append(format_excluded_list(onboarding, constraints))
    sections.append("")

    sections.append(f"--- FOODS (use ONLY these, {len(foods)} options) ---")
    if foods:
        sections.append("\n".join(format_food_line(f) for f in foods))
    else:
        sections.append("(none — generic meals, foodItemId/webtebId null)")
    sections.append("")

    sections.append(f"--- EXERCISES (use ONLY these, {len(exercises)} options) ---")
    if exercises:
        sections.append("\n".join(format_exercise_line(e) for e in exercises))
    else:
        sections.append("(none — exerciseId null, generic names)")
    sections.append("")

    if book_chunks:
        sections.append("--- COACHING PRINCIPLES (books / L5 RAG) ---")
        for i, chunk in enumerate(book_chunks[:10], 1):
            topic = chunk.get("topic") or chunk.get("title") or ""
            text = chunk.get("text") or chunk.get("content") or ""
            prefix = f"{topic}: " if topic else ""
            sections.append(f"[{i}] {prefix}{text[:500]}")
        sections.append("")

    if validation_feedback:
        sections.append("--- PREVIOUS ATTEMPT FAILED VALIDATION — FIX THESE ---")
        sections.append(validation_feedback)
        sections.append("")

    if regeneration_reason:
        sections.append(f"Regeneration reason: {regeneration_reason}")
        sections.append("")

    sections.append("Return ONLY the JSON object — no markdown, no preface.")
    return "\n".join(sections)
