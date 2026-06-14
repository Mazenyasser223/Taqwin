"""
Block C1 — prompts for weekly workout + diet plan JSON.

Contract (HARD_RULES, schema, locale directives): shared/plan-prompt-contract.json
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.services.cag_sanitize import sanitize_cag_string, sanitize_prompt_text

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONTRACT_PATH = _REPO_ROOT / "shared" / "plan-prompt-contract.json"


@lru_cache(maxsize=1)
def _load_contract() -> dict[str, Any]:
    with _CONTRACT_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def contract_path() -> Path:
    return _CONTRACT_PATH


def hard_rules() -> list[str]:
    return list(_load_contract()["hardRules"])


def schema_hint() -> str:
    return str(_load_contract()["schemaHint"])


# Back-compat for tests and imports
HARD_RULES = hard_rules()
SCHEMA_HINT = schema_hint()


def format_food_line(food: dict[str, Any]) -> str:
    source = food.get("source") or ("foodItem" if food.get("foodItemId") else "webteb")
    fid = food.get("id") or food.get("foodItemId")
    wid = food.get("webtebId")
    if source == "foodItem" or fid:
        id_hint = f"foodItemId:{fid}"
    else:
        id_hint = f"webtebId:{wid}"
    name = sanitize_cag_string(str(food.get("name") or "food"), "foodName")
    cal = round(float(food.get("calories") or 0))
    p = round(float(food.get("protein") or 0))
    c = round(float(food.get("carbs") or 0))
    f = round(float(food.get("fat") or 0))
    return f"- {name} | {id_hint} | {cal} kcal/100g | P{p}g C{c}g F{f}g"


def format_exercise_line(ex: dict[str, Any]) -> str:
    eid = ex.get("id") or ex.get("exerciseId")
    name = sanitize_cag_string(str(ex.get("name") or "exercise"), "exerciseName")
    category = ex.get("category") or "general"
    muscles = ex.get("primaryMuscles") or []
    muscle_hint = f" | {'/'.join(str(m) for m in muscles[:2])}" if muscles else ""
    return f"- {name} | exerciseId:{eid} | {category}{muscle_hint}"


def _onboarding_flat(bundle: dict[str, Any]) -> dict[str, Any]:
    by_flow = bundle.get("onboardingByFlow")
    if isinstance(by_flow, dict):
        flat: dict[str, Any] = {}
        for section in ("core", "workout", "nutrition", "health", "femaleHealth"):
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
    if allergies and allergies != ["none"]:
        parts.append(
            "RULE: Allergy > Preference — never include allergens even if user prefers them"
        )
        parts.append(
            f"allergies: {', '.join(sanitize_cag_string(str(a), 'injuryLabel') for a in allergies)}"
        )
    excluded = onboarding.get("foodsExcluded") or constraints.get("excludedFoods") or []
    if excluded:
        names = [
            e if isinstance(e, str) else (e.get("name") if isinstance(e, dict) else str(e))
            for e in excluded
        ]
        names = [sanitize_cag_string(str(n), "foodName") for n in names if n]
        if names:
            parts.append(f"excluded foods: {', '.join(str(n) for n in names)}")
    if onboarding.get("foodsExcludedCustom"):
        parts.append(
            f"also avoid: {sanitize_cag_string(str(onboarding['foodsExcludedCustom']), 'onboardingText')}"
        )
    rd = onboarding.get("religiousDiet") or constraints.get("religiousDiet") or ""
    if rd and rd != "none":
        parts.append(f"religious diet: {sanitize_cag_string(str(rd), 'default')}")
    injuries = onboarding.get("injuries") or constraints.get("injuries") or []
    inj = [i for i in injuries if i and i != "none"]
    if inj:
        parts.append(
            f"injuries: {', '.join(sanitize_cag_string(str(i), 'injuryLabel') for i in inj)}"
        )
    return "\n".join(parts) if parts else "(none reported)"


def format_nutrition_adaptation(onboarding: dict[str, Any], constraints: dict[str, Any]) -> str:
    notes: list[str] = list(constraints.get("nutritionAdaptNotes") or [])
    if notes:
        return "\n".join(f"- {sanitize_cag_string(str(n), 'onboardingText')}" for n in notes[:14])
    lines: list[str] = []
    allergies = onboarding.get("foodAllergies") or constraints.get("foodAllergies") or []
    if allergies and allergies != ["none"]:
        lines.append(
            "Allergy filters ACTIVE — Allergy > Preference (block allergens even if preferred)"
        )
    diet = str(onboarding.get("dietType") or "").lower()
    if diet in ("vegetarian", "vegan_strict"):
        lines.append("Vegetarian/vegan: prioritize legumes, nuts, soy, plant proteins")
    mps = str(onboarding.get("mealPlanStyle") or "")
    if mps == "fixed_weekly":
        lines.append("Meal plan style: simple repeating weekly template")
    elif mps == "rotating_daily":
        lines.append("Meal plan style: rotate meals daily (higher variety/complexity)")
    budget = str(onboarding.get("foodBudget") or "").lower()
    if budget == "low":
        lines.append("Low budget: favor eggs, beans, lentils, rice, chicken, tuna, oats, potatoes")
    prep = str(onboarding.get("mealPrepTime") or "")
    if prep == "0_15" or str(onboarding.get("preferSimpleMeals") or "") == "yes":
        lines.append("Simple meals: sandwiches, yogurt bowls, canned tuna, eggs")
    elif prep == "60_plus":
        lines.append("Meal prep 60+ min: batch-cook recipes allowed")
    cook = str(onboarding.get("cookOrReady") or "").lower()
    if cook == "ready":
        lines.append("Mostly ready/delivery: restaurant-friendly options with portion guidance")
    rel = onboarding.get("religiousDiet") or constraints.get("religiousDiet") or []
    rel_list = rel if isinstance(rel, list) else ([rel] if rel else [])
    seasonal = str(
        onboarding.get("seasonalNutritionMode") or constraints.get("seasonalNutritionMode") or ""
    ).lower()
    if seasonal == "ramadan":
        lines.append(
            "seasonalNutritionMode: ramadan — suhoor + iftar plan; shift workouts; hydrate at night"
        )
    elif "ramadan" in [str(r).lower() for r in rel_list]:
        lines.append("Ramadan: suhoor + iftar timing; shift workouts; hydrate at night")
    if "christian_fasting" in [str(r).lower() for r in rel_list]:
        lines.append("Christian fasting: plant-based alternatives on fast days")
    if not lines:
        return "(no special nutrition adaptation)"
    return "\n".join(f"- {sanitize_cag_string(str(x), 'onboardingText')}" for x in lines)


def build_plan_system_prompt(*, locale: str = "ar") -> str:
    contract = _load_contract()
    directives = contract.get("localeDirectives") or {}
    lang = directives.get(locale) or directives.get("ar") or ""
    rules = "\n".join(f"{i + 1}. {r}" for i, r in enumerate(contract["hardRules"]))
    return "\n".join(
        [
            contract["systemPromptIntro"],
            "",
            "HARD RULES:",
            rules,
            "",
            lang,
            "",
            "EXPECTED SCHEMA:",
            contract["schemaHint"],
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
    contract = _load_contract()

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
        "seasonalNutritionMode",
        "foodBudget",
        "eatingOutFrequency",
        "weekendEating",
        "preferSimpleMeals",
        "eatingHabits",
        "water",
        "mealPlanStyle",
        "mealPrepTime",
        "cookOrReady",
    ):
        if onboarding.get(key):
            lines.append(f"{key}: {sanitize_cag_string(str(onboarding[key]), 'onboardingText')}")
    if profile.get("medicalNotes"):
        lines.append(f"medicalNotes: {sanitize_cag_string(str(profile['medicalNotes']), 'medicalNotes')}")
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

    sections.append("--- NUTRITION ADAPTATION ---")
    sections.append(format_nutrition_adaptation(onboarding, constraints))
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
        sections.append(str(sanitize_prompt_text(validation_feedback, "planFeedback")))
        sections.append("")

    if regeneration_reason:
        safe_reason = str(sanitize_prompt_text(regeneration_reason, "planFeedback"))
        sections.append(f"Regeneration reason: {safe_reason}")
        sections.append("")

    sections.append(contract.get("userPromptClosing") or "Return ONLY the JSON object.")
    return "\n".join(sections)
