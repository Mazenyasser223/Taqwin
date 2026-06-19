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
_NUTRITION_CONTRACT_PATH = _REPO_ROOT / "shared" / "plan-nutrition-prompt-contract.json"
_WORKOUT_CONTRACT_PATH = _REPO_ROOT / "shared" / "plan-workout-prompt-contract.json"
_FOOD_GROUPS_PATH = _REPO_ROOT / "shared" / "plan-food-groups.json"
_WORKOUT_GROUPS_PATH = _REPO_ROOT / "shared" / "plan-workout-groups.json"
_TRAINING_STYLES_PATH = _REPO_ROOT / "shared" / "plan-training-styles.json"
_MEAL_PAIRING_PATH = _REPO_ROOT / "shared" / "plan-meal-pairing-rules.json"
_VOLUME_PRESCRIPTION_PATH = _REPO_ROOT / "shared" / "plan-volume-prescription.json"


@lru_cache(maxsize=1)
def _load_meal_pairing_rules() -> dict[str, Any]:
    if not _MEAL_PAIRING_PATH.is_file():
        return {}
    with _MEAL_PAIRING_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_volume_prescription() -> dict[str, Any]:
    if not _VOLUME_PRESCRIPTION_PATH.is_file():
        return {}
    with _VOLUME_PRESCRIPTION_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_food_groups() -> dict[str, Any]:
    if not _FOOD_GROUPS_PATH.is_file():
        return {"groups": {}}
    with _FOOD_GROUPS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_training_styles() -> dict[str, Any]:
    if not _TRAINING_STYLES_PATH.is_file():
        return {"styles": []}
    with _TRAINING_STYLES_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def _normalize_split_token(value: str) -> str:
    return str(value or "").lower().strip().replace(" ", "_").replace("-", "_")


def _match_training_style(preferred_split: str) -> dict[str, Any] | None:
    raw = _normalize_split_token(preferred_split)
    if not raw:
        return None
    for style in _load_training_styles().get("styles") or []:
        aliases = [_normalize_split_token(a) for a in style.get("aliases") or []]
        if raw in aliases or any(raw in a or a in raw for a in aliases if a):
            return style
    return None


def format_training_style_nutrition(onboarding: dict[str, Any], bundle: dict[str, Any], *, locale: str) -> str:
    """Famous training splits → nutrition timing and macro emphasis."""
    contract = _load_nutrition_contract()
    intro = str(contract.get("trainingStyleGuideIntro") or "").strip()
    lines: list[str] = []
    if intro:
        lines.append(intro)
        lines.append("")

    preferred = str(onboarding.get("preferredSplit") or "").strip()
    blueprint = (bundle.get("planGenerationHints") or {}).get("workoutStructureBlueprint") or {}
    pattern = blueprint.get("pattern") or blueprint.get("splitPattern") or ""
    match_key = preferred or str(pattern or "")

    matched = _match_training_style(match_key)
    if matched:
        label = matched.get("labelAr") if locale == "ar" else matched.get("labelEn")
        note = matched.get("nutritionAr") if locale == "ar" else matched.get("nutritionEn")
        lines.append(f"ATHLETE MATCH: {label}")
        lines.append(str(note or ""))
        lines.append("")

    lines.append("REFERENCE — famous training styles (pick closest if split unclear):")
    for style in _load_training_styles().get("styles") or []:
        label = style.get("labelAr") if locale == "ar" else style.get("labelEn")
        note = style.get("nutritionAr") if locale == "ar" else style.get("nutritionEn")
        if label and note:
            lines.append(f"- {label}: {note}")
    return "\n".join(lines)


@lru_cache(maxsize=1)
def _load_workout_groups() -> dict[str, Any]:
    if not _WORKOUT_GROUPS_PATH.is_file():
        return {"groups": {}, "difficulties": ["beginner", "intermediate", "advanced"]}
    with _WORKOUT_GROUPS_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_nutrition_contract() -> dict[str, Any]:
    with _NUTRITION_CONTRACT_PATH.open(encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _load_workout_contract() -> dict[str, Any]:
    with _WORKOUT_CONTRACT_PATH.open(encoding="utf-8") as f:
        return json.load(f)


PLAN_WORKOUT_DIFFICULTY_ORDER = ["beginner", "intermediate", "advanced"]

PLAN_FOOD_GROUP_ORDER = [
    "protein",
    "carbs",
    "fats",
    "nuts",
    "dairy",
    "eggs",
    "vegetables",
    "fruits",
    "other",
]


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


def _group_label(group_key: str, locale: str) -> str:
    cfg = _load_food_groups().get("groups") or {}
    defn = cfg.get(group_key) or {}
    if locale == "ar":
        return str(defn.get("labelAr") or group_key.upper())
    return str(defn.get("labelEn") or group_key.upper())


def format_foods_by_group(foods: list[dict[str, Any]], *, locale: str = "ar") -> str:
    if not foods:
        return "(none — generic meals, foodItemId/webtebId null)"
    by_group: dict[str, list[dict[str, Any]]] = {}
    for food in foods:
        key = str(food.get("planGroup") or "other")
        by_group.setdefault(key, []).append(food)

    sections: list[str] = [
        "FOOD RULES: pick `name` EXACTLY as written below; copy webtebId/foodItemId from the same line.",
        "Set item calories/protein/carbs/fat to 0 — server computes macros from this library.",
        "",
    ]
    for group_key in PLAN_FOOD_GROUP_ORDER:
        items = by_group.get(group_key)
        if not items:
            continue
        sections.append(f"--- {_group_label(group_key, locale)} ({len(items)} items) ---")
        sections.extend(format_food_line(f) for f in items)
        sections.append("")

    other = [g for g in by_group if g not in PLAN_FOOD_GROUP_ORDER]
    for group_key in sorted(other):
        items = by_group[group_key]
        sections.append(f"--- {group_key.upper()} ({len(items)} items) ---")
        sections.extend(format_food_line(f) for f in items)
        sections.append("")

    return "\n".join(sections).rstrip()


def format_exercise_line(ex: dict[str, Any]) -> str:
    eid = ex.get("id") or ex.get("exerciseId")
    name = sanitize_cag_string(str(ex.get("name") or "exercise"), "exerciseName")
    category = ex.get("category") or "general"
    diff = ex.get("planDifficulty") or ex.get("difficulty") or "intermediate"
    muscles = ex.get("primaryMuscles") or []
    muscle_hint = f" | {'/'.join(str(m) for m in muscles[:2])}" if muscles else ""
    return f"- {name} | exerciseId:{eid} | {diff} | {category}{muscle_hint}"


def _workout_group_label(group_key: str, locale: str) -> str:
    cfg = _load_workout_groups().get("groups") or {}
    defn = cfg.get(group_key) or {}
    if locale == "ar":
        return str(defn.get("labelAr") or group_key.upper())
    return str(defn.get("labelEn") or group_key.upper())


def format_exercises_by_group_difficulty(exercises: list[dict[str, Any]], *, locale: str = "ar") -> str:
    if not exercises:
        return "(none — exerciseId null, generic names)"
    by_cell: dict[str, list[dict[str, Any]]] = {}
    for ex in exercises:
        group = str(ex.get("muscleGroup") or "other")
        diff = str(ex.get("planDifficulty") or ex.get("difficulty") or "intermediate").lower()
        by_cell.setdefault(f"{group}:{diff}", []).append(ex)

    sections: list[str] = [
        "EXERCISE RULES: pick `name` EXACTLY as written; copy exerciseId from the same line.",
        "",
    ]
    groups = _load_workout_groups().get("groups") or {}
    for group_key in list(groups.keys()) + ["other"]:
        for diff in PLAN_WORKOUT_DIFFICULTY_ORDER:
            items = by_cell.get(f"{group_key}:{diff}")
            if not items:
                continue
            label = _workout_group_label(group_key, locale) if group_key != "other" else "OTHER"
            sections.append(f"--- {label} · {diff.upper()} ({len(items)} exercises) ---")
            sections.extend(format_exercise_line(e) for e in items)
            sections.append("")
    return "\n".join(sections).rstrip()


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
    """Legacy scaffold/fallback only — AI plans derive dailyTargets in output JSON."""
    hints = bundle.get("planGenerationHints") or {}
    ref = hints.get("referenceFormulaTargets") or {}
    if ref.get("calories"):
        return {
            "calories": int(ref["calories"]),
            "protein": int(ref.get("protein") or 120),
            "carbs": int(ref.get("carbs") or 200),
            "fat": int(ref.get("fat") or 60),
            "waterMl": int(ref.get("waterMl") or 2500),
        }
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


def _reference_macro_hints(bundle: dict[str, Any]) -> list[str]:
    """Non-binding reference lines for the LLM (formula baseline + maintenance)."""
    hints = bundle.get("planGenerationHints") or {}
    lines: list[str] = []
    maint = hints.get("referenceMaintenanceKcal")
    if maint:
        lines.append(f"estimated maintenance (reference only): ~{int(maint)} kcal/day")
    ref = hints.get("referenceFormulaTargets") or {}
    if ref.get("calories"):
        lines.append(
            "formula baseline (reference only, do NOT copy blindly): "
            f"{int(ref['calories'])} kcal · P{int(ref.get('protein') or 0)}g "
            f"C{int(ref.get('carbs') or 0)}g F{int(ref.get('fat') or 0)}g "
            f"water {int(ref.get('waterMl') or 2500)}ml"
        )
    return lines


def format_rag_coaching_guidance(book_chunks: list[dict[str, Any]] | None) -> str:
    if not book_chunks:
        return "(no coaching book excerpts — use profile + onboarding + catalogs)"
    lines: list[str] = []
    for i, chunk in enumerate(book_chunks[:8], 1):
        topic = chunk.get("topic") or chunk.get("title") or "coaching"
        text = str(chunk.get("text") or chunk.get("content") or "").strip()
        if not text:
            continue
        lines.append(f"[{i}] {topic}: {text[:420]}")
    return "\n".join(lines) if lines else "(book chunks empty)"


# Back-compat alias
format_rag_macro_guidance = format_rag_coaching_guidance


def format_food_catalog_macro_hints(foods: list[dict[str, Any]]) -> str:
    if not foods:
        return "(no food catalog — estimate macros from standard portions)"
    proteins = [float(f.get("protein") or 0) for f in foods if f.get("protein")]
    cals = [float(f.get("calories") or 0) for f in foods if f.get("calories")]
    lines = [f"RAG food pool: {len(foods)} items available for meal building"]
    if proteins:
        lines.append(
            f"catalog protein density (per 100g): min {min(proteins):.0f}g · "
            f"median {sorted(proteins)[len(proteins) // 2]:.0f}g · max {max(proteins):.0f}g"
        )
    if cals:
        lines.append(
            f"catalog energy (per 100g): median {sorted(cals)[len(cals) // 2]:.0f} kcal"
        )
    lines.append("Use catalog macros when picking FOODS — dailyTargets must be achievable with listed items.")
    return "\n".join(lines)


def _reference_workout_hints(bundle: dict[str, Any], onboarding: dict[str, Any]) -> list[str]:
    """Non-binding workout structure hints for the LLM."""
    hints = bundle.get("planGenerationHints") or {}
    ref = hints.get("referenceWorkoutHints") or {}
    lines: list[str] = []
    for key, label in (
        ("trainingDaysPerWeek", "training days/week (reference)"),
        ("preferredSplit", "preferred split (reference)"),
        ("workoutLocation", "location"),
        ("workoutDuration", "session duration"),
        ("equipment", "equipment"),
        ("fitnessLevel", "fitness level"),
    ):
        val = ref.get(key) or onboarding.get(key)
        if val:
            lines.append(f"{label}: {sanitize_cag_string(str(val), 'onboardingText')}")
    for key in ("pushups", "squats", "pullups", "benchMax", "deadliftMax", "liftExperience"):
        val = onboarding.get(key)
        if val and val != "unknown":
            lines.append(f"{key}: {sanitize_cag_string(str(val), 'onboardingText')}")
    injuries = ref.get("injuries") or onboarding.get("injuries") or []
    if injuries and injuries != ["none"]:
        inj = injuries if isinstance(injuries, list) else [injuries]
        lines.append(
            "injuries to respect: "
            + ", ".join(
                sanitize_cag_string(str(i), "injuryLabel") for i in inj if i and i != "none"
            )
        )
    return lines


def format_meal_pairing_guide(*, locale: str = "ar") -> str:
    """Logical meal/snack food combinations per slot."""
    cfg = _load_meal_pairing_rules()
    if not cfg:
        return "(compose each meal slot as one coherent plate — protein + carb + veg for mains; light pairs for snacks)"
    intro = cfg.get("introAr") if locale == "ar" else cfg.get("introEn")
    rules_key = "rulesAr" if locale == "ar" else "rulesEn"
    lines: list[str] = []
    if intro:
        lines.append(str(intro))
        lines.append("")
    for rule in cfg.get(rules_key) or cfg.get("rulesEn") or []:
        lines.append(f"- {sanitize_cag_string(str(rule), 'onboardingText')}")
    return "\n".join(lines)


def _norm_fitness_level(value: str) -> str:
    raw = str(value or "").lower()
    if "advanced" in raw or "expert" in raw:
        return "advanced"
    if "intermediate" in raw or "moderate" in raw:
        return "intermediate"
    return "beginner"


def format_volume_prescription_guide(onboarding: dict[str, Any], *, locale: str = "ar") -> str:
    """Sets/reps/rest logic from dossier + shared prescription tables."""
    cfg = _load_volume_prescription()
    if not cfg:
        return "(use fitnessLevel and session duration to set sets/reps/rest — compounds 8–12, accessories 10–15)"
    intro = cfg.get("introAr") if locale == "ar" else cfg.get("introEn")
    lines: list[str] = []
    if intro:
        lines.append(str(intro))
        lines.append("")

    level = _norm_fitness_level(
        str(onboarding.get("fitnessLevel") or onboarding.get("liftExperience") or "beginner")
    )
    by_level = cfg.get("byFitnessLevel") or {}
    tier = by_level.get(level) or by_level.get("intermediate") or {}
    if tier:
        lines.append(f"Fitness tier: {level}")
        lines.append(
            f"  sets {tier.get('sets')} · reps {tier.get('reps')} · restSec {tier.get('restSec')} · "
            f"exercises/session {tier.get('exercisesPerSession')}"
        )
        lines.append("")

    dur = str(onboarding.get("workoutDuration") or "")
    dur_adj = cfg.get("durationAdjustments") or {}
    if dur and dur_adj.get(dur):
        lines.append(f"Session duration {dur} min: {dur_adj[dur]}")
        lines.append("")

    for key, label in (
        ("pushups", "Push-ups"),
        ("squats", "Squats"),
        ("pullups", "Pull-ups"),
    ):
        val = str(onboarding.get(key) or "")
        if not val or val == "unknown":
            continue
        override_key = f"{key}_{val}"
        note = (cfg.get("baselineOverrides") or {}).get(override_key)
        if note:
            lines.append(f"{label} baseline ({val}): {note}")

    bench = onboarding.get("benchMax")
    dead = onboarding.get("deadliftMax")
    if bench and bench != "unknown":
        lines.append(f"benchMax (reference 1RM): {bench} kg — program pressing reps accordingly")
    if dead and dead != "unknown":
        lines.append(f"deadliftMax (reference 1RM): {dead} kg — program hinge/squat reps accordingly")

    compound = cfg.get("compoundVsAccessory") or {}
    if compound:
        lines.append("")
        lines.append("Compound vs accessory:")
        for k, v in compound.items():
            lines.append(f"- {k}: {v}")

    max_note = cfg.get("maxLiftNoteAr") if locale == "ar" else cfg.get("maxLiftNoteEn")
    if max_note:
        lines.append("")
        lines.append(str(max_note))

    return "\n".join(lines)


def format_exercise_catalog_hints(exercises: list[dict[str, Any]]) -> str:
    if not exercises:
        return "(no exercise catalog — use safe generic names, exerciseId null)"
    categories: dict[str, int] = {}
    muscles: dict[str, int] = {}
    for ex in exercises:
        cat = str(ex.get("category") or "general").lower()
        categories[cat] = categories.get(cat, 0) + 1
        for m in ex.get("primaryMuscles") or []:
            mk = str(m).lower()
            muscles[mk] = muscles.get(mk, 0) + 1
    top_cats = sorted(categories.items(), key=lambda x: -x[1])[:6]
    top_muscles = sorted(muscles.items(), key=lambda x: -x[1])[:8]
    lines = [
        f"RAG exercise pool: {len(exercises)} movements — pick ONLY from EXERCISES list below",
        "catalog categories: " + ", ".join(f"{k}({v})" for k, v in top_cats),
    ]
    if top_muscles:
        lines.append("primary muscles covered: " + ", ".join(f"{k}({v})" for k, v in top_muscles))
    lines.append(
        "Design workoutWeeks: place rest days, match training volume to dossier, "
        "balance push/pull/legs or preferred split, sets/reps appropriate to fitness level."
    )
    return "\n".join(lines)


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


def format_structure_lock(bundle: dict[str, Any]) -> str | None:
    hints = bundle.get("planGenerationHints") or {}
    lock = hints.get("structureLock")
    if not isinstance(lock, dict) or not lock:
        return None
    lines = [
        "Preserve this weekly skeleton unless the athlete dossier materially changed (goal, injuries, equipment, allergies).",
        json.dumps(lock, ensure_ascii=False),
    ]
    return "\n".join(lines)


def format_nutrition_structure_blueprint(bundle: dict[str, Any]) -> str | None:
    hints = bundle.get("planGenerationHints") or {}
    blueprint = hints.get("nutritionStructureBlueprint")
    if not isinstance(blueprint, dict) or not blueprint:
        return None
    return "\n".join(
        [
            "MANDATORY meal structure — match dietSkeleton (dayIndex, meal slots, targetItemCount).",
            "Foods must come from FOOD LIBRARY only.",
            json.dumps(blueprint, ensure_ascii=False),
        ]
    )


def format_workout_structure_blueprint(bundle: dict[str, Any]) -> str | None:
    hints = bundle.get("planGenerationHints") or {}
    blueprint = hints.get("workoutStructureBlueprint")
    if not isinstance(blueprint, dict) or not blueprint:
        return None
    return "\n".join(
        [
            "MANDATORY weekly workout shape — match workoutSkeleton (dayIndex, isRest, type, targetExerciseCount).",
            "Exercises must come from EXERCISE LIBRARY only.",
            json.dumps(blueprint, ensure_ascii=False),
        ]
    )


def build_plan_system_prompt(*, locale: str = "ar") -> str:
    base = _load_contract()
    nutrition = _load_nutrition_contract()
    workout = _load_workout_contract()
    directives = base.get("localeDirectives") or nutrition.get("localeDirectives") or {}
    lang = directives.get(locale) or directives.get("ar") or ""

    shared_rules = list(base.get("hardRules") or [])
    nutrition_rules = [f"[NUTRITION] {r}" for r in nutrition.get("hardRules") or []]
    workout_rules = [f"[WORKOUT] {r}" for r in workout.get("hardRules") or []]
    all_rules = shared_rules + nutrition_rules + workout_rules
    rules = "\n".join(f"{i + 1}. {r}" for i, r in enumerate(all_rules))

    schema = "\n".join(
        [
            str(base.get("schemaHint") or ""),
            "",
            "NUTRITION SCHEMA:",
            str(nutrition.get("schemaHint") or ""),
            "",
            "WORKOUT SCHEMA:",
            str(workout.get("schemaHint") or ""),
        ]
    )

    intro = "\n".join(
        [
            str(base.get("systemPromptIntro") or ""),
            "",
            str(nutrition.get("systemPromptIntro") or ""),
            "",
            str(workout.get("systemPromptIntro") or ""),
        ]
    )

    return "\n".join(
        [
            intro,
            "",
            "HARD RULES:",
            rules,
            "",
            lang,
            "",
            "EXPECTED SCHEMA:",
            schema,
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
    contract = _load_contract()
    locale = bundle.get("locale") or "ar"
    if locale not in ("en", "ar"):
        locale = "ar"

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
        "equipment",
        "activityLevel",
        "lastTraining",
        "otherSports",
        "upcomingEvent",
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
        "pushups",
        "squats",
        "pullups",
        "benchMax",
        "deadliftMax",
        "liftExperience",
    ):
        if onboarding.get(key):
            lines.append(f"{key}: {sanitize_cag_string(str(onboarding[key]), 'onboardingText')}")
    if profile.get("medicalNotes"):
        lines.append(f"medicalNotes: {sanitize_cag_string(str(profile['medicalNotes']), 'medicalNotes')}")
    sections.append("\n".join(lines))
    sections.append("")

    sections.append("--- MACRO TARGETING (AI + RAG — you MUST set dailyTargets in JSON) ---")
    sections.append(
        "Derive dailyTargets.calories, protein, carbs, fat, waterMl from this dossier, "
        "COACHING PRINCIPLES, FOODS catalog, goal, activity level, calorieTarget preference, "
        "training volume, and body metrics. Output them in dailyTargets — do NOT use a generic formula alone."
    )
    ref_lines = _reference_macro_hints(bundle)
    if ref_lines:
        sections.append("Reference hints (advisory — personalize with RAG + dossier):")
        sections.extend(f"- {line}" for line in ref_lines)
    sections.append("")
    sections.append("Food catalog macro context:")
    sections.append(format_food_catalog_macro_hints(foods))
    sections.append("")

    nutrition_blueprint = format_nutrition_structure_blueprint(bundle)
    workout_blueprint = format_workout_structure_blueprint(bundle)

    sections.append("--- NUTRITION PROGRAMMING ---")
    if nutrition_blueprint:
        sections.append(nutrition_blueprint)
    else:
        sections.append("Build 7 dietDays with 3–4 meal slots per day from FOOD LIBRARY.")
    sections.append("")
    sections.append("--- TRAINING STYLE → NUTRITION ---")
    sections.append(format_training_style_nutrition(onboarding, bundle, locale=locale))
    sections.append("")
    sections.append("--- MEAL PAIRING (logical combinations per slot) ---")
    sections.append(format_meal_pairing_guide(locale=locale))
    sections.append("")

    sections.append("--- WORKOUT PROGRAMMING ---")
    if workout_blueprint:
        sections.append(workout_blueprint)
        sections.append(
            "Build workoutWeeks[0] to MATCH workoutSkeleton. Pick exercises from EXERCISE LIBRARY by muscle group and difficulty."
        )
    else:
        sections.append(
            "Build workoutWeeks[0]: rest vs training days from dossier; exercises from EXERCISE LIBRARY only."
        )
    workout_ref = _reference_workout_hints(bundle, onboarding)
    if workout_ref:
        sections.append("Athlete hints:")
        sections.extend(f"- {line}" for line in workout_ref)
    sections.append("")
    sections.append("--- VOLUME PRESCRIPTION (sets / reps / rest) ---")
    sections.append(format_volume_prescription_guide(onboarding, locale=locale))
    sections.append("")
    sections.append("Exercise catalog context:")
    sections.append(format_exercise_catalog_hints(exercises))
    sections.append("")

    sections.append("--- EXCLUDED / SAFETY ---")
    sections.append(format_excluded_list(onboarding, constraints))
    sections.append("")

    sections.append("--- NUTRITION ADAPTATION ---")
    sections.append(format_nutrition_adaptation(onboarding, constraints))
    sections.append("")

    lock_text = format_structure_lock(bundle)
    if lock_text:
        sections.append("--- STRUCTURE LOCK (consistency — preserve skeleton) ---")
        sections.append(lock_text)
        sections.append("")

    sections.append(f"--- FOOD LIBRARY (use ONLY these, {len(foods)} items) ---")
    sections.append(format_foods_by_group(foods, locale=locale))
    sections.append("")

    sections.append(f"--- EXERCISE LIBRARY (use ONLY these, {len(exercises)} items) ---")
    sections.append(format_exercises_by_group_difficulty(exercises, locale=locale))
    sections.append("")

    if book_chunks:
        sections.append(
            "--- COACHING PRINCIPLES (books / L5 RAG — use for macros + workout programming) ---"
        )
        sections.append(format_rag_coaching_guidance(book_chunks))
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
