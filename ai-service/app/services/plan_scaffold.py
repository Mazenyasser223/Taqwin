"""
Deterministic fallback plan when LLM is unavailable (Block C1 scaffold).
Production parity with backend-node lib/plans/fallback.js — multi-exercise PPL + 4 meals/day.
"""

from __future__ import annotations

import re
from typing import Any

from app.prompts.plan_prompts import extract_daily_targets

TRAINING_DAY_PATTERNS: dict[int, list[int]] = {
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 6],
    5: [1, 2, 3, 4, 5],
    6: [1, 2, 3, 4, 5, 6],
}

PPL_TEMPLATE: dict[str, list[str]] = {
    "push": ["push", "push", "arms"],
    "pull": ["pull", "pull", "arms"],
    "legs": ["legs", "legs", "core"],
}

SAFE_EXERCISES: dict[str, list[dict[str, Any]]] = {
    "push": [
        {"name": "Dumbbell Chest Press", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Incline Dumbbell Press", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Seated Dumbbell Shoulder Press", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Lateral Raise", "sets": 3, "reps": 15, "restSec": 60},
    ],
    "pull": [
        {"name": "Dumbbell Row", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Lat Pulldown", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Seated Cable Row", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Face Pull", "sets": 3, "reps": 15, "restSec": 60},
    ],
    "legs": [
        {"name": "Goblet Squat", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Dumbbell Romanian Deadlift", "sets": 3, "reps": 12, "restSec": 90},
        {"name": "Glute Bridge", "sets": 3, "reps": 15, "restSec": 60},
        {"name": "Plank", "sets": 3, "reps": 1, "restSec": 60, "notes": "Hold 45s"},
    ],
    "arms": [
        {"name": "Dumbbell Biceps Curl", "sets": 3, "reps": 12, "restSec": 60},
        {"name": "Triceps Pushdown", "sets": 3, "reps": 12, "restSec": 60},
    ],
    "core": [
        {"name": "Plank", "sets": 3, "reps": 1, "restSec": 60, "notes": "Hold 45s"},
        {"name": "Dead Bug", "sets": 3, "reps": 10, "restSec": 45},
    ],
}

SAFE_BREAKFASTS = [
    {"name": "Greek yogurt with oats", "protein": 25, "carbs": 50, "fat": 6, "grams": 350},
    {"name": "Oats with banana", "protein": 12, "carbs": 65, "fat": 5, "grams": 300},
]
SAFE_LUNCHES = [
    {"name": "Grilled chicken with rice", "protein": 40, "carbs": 70, "fat": 10, "grams": 450},
    {"name": "Lentil soup with bread", "protein": 22, "carbs": 65, "fat": 6, "grams": 450},
]
SAFE_DINNERS = [
    {"name": "Grilled chicken with vegetables", "protein": 38, "carbs": 30, "fat": 8, "grams": 400},
    {"name": "Baked fish with sweet potato", "protein": 35, "carbs": 45, "fat": 8, "grams": 400},
]
SAFE_SNACKS = [
    {"name": "Greek yogurt", "protein": 18, "carbs": 8, "fat": 0, "grams": 200},
    {"name": "Boiled eggs", "protein": 12, "carbs": 1, "fat": 10, "grams": 100},
]


def _clamp_training_days(raw: Any) -> int:
    if raw is None or raw == "":
        return 4
    m = re.search(r"(\d+)", str(raw))
    if m:
        return max(2, min(6, int(m.group(1))))
    return 4


def _pick_split(onboarding: dict[str, Any]) -> str:
    v = str(onboarding.get("preferredSplit") or "").lower()
    if "ppl" in v or "push" in v:
        return "ppl"
    if "upper" in v:
        return "upper_lower"
    return "full"


def _pick(items: list[dict], day_index: int) -> dict | None:
    if not items:
        return None
    return items[(day_index - 1) % len(items)]


def _meal(slot: str, food: dict, scale: float) -> dict[str, Any]:
    protein = round((food.get("protein") or 0) * scale)
    carbs = round((food.get("carbs") or 0) * scale)
    fat = round((food.get("fat") or 0) * scale)
    grams = round((food.get("grams") or 0) * scale)
    calories = round(protein * 4 + carbs * 4 + fat * 9)
    return {
        "slot": slot,
        "items": [
            {
                "foodItemId": None,
                "webtebId": None,
                "name": food["name"],
                "grams": max(grams, 50),
                "calories": calories,
                "protein": protein,
                "carbs": carbs,
                "fat": fat,
                "notes": "",
            }
        ],
    }


def _diet_day(day_index: int, targets: dict[str, int], locale: str) -> dict[str, Any]:
    b = _pick(SAFE_BREAKFASTS, day_index) or SAFE_BREAKFASTS[0]
    l = _pick(SAFE_LUNCHES, day_index) or SAFE_LUNCHES[0]
    d = _pick(SAFE_DINNERS, day_index) or SAFE_DINNERS[0]
    s = _pick(SAFE_SNACKS, day_index) or SAFE_SNACKS[0]
    base_p = b["protein"] + l["protein"] + d["protein"] + s["protein"]
    required = targets["protein"] * 0.9
    scale = min(2.4, max(1.0, required / base_p)) if base_p > 0 else 1.0
    label = f"اليوم {day_index}" if locale == "ar" else f"Day {day_index}"
    return {
        "dayIndex": day_index,
        "label": label,
        "meals": [
            _meal("breakfast", b, scale),
            _meal("lunch", l, scale),
            _meal("dinner", d, scale),
            _meal("snack", s, scale),
        ],
    }


def _exercises_for_type(day_type: str) -> list[dict[str, Any]]:
    groups = PPL_TEMPLATE.get(day_type, [day_type])
    out: list[dict[str, Any]] = []
    for g in groups:
        for ex in SAFE_EXERCISES.get(g, [])[:2]:
            out.append(
                {
                    "exerciseId": None,
                    "name": ex["name"],
                    "sets": ex["sets"],
                    "reps": ex["reps"],
                    "restSec": ex.get("restSec", 90),
                    "notes": ex.get("notes", ""),
                }
            )
            if len(out) >= 5:
                return out
    return out[:5]


def _workout_week(week_index: int, training_days: int, split: str) -> dict[str, Any]:
    train_set = set(TRAINING_DAY_PATTERNS.get(training_days, TRAINING_DAY_PATTERNS[4]))
    type_order = ["push", "pull", "legs"] if split == "ppl" else ["push", "legs", "pull", "legs"]
    rot = 0
    days: list[dict[str, Any]] = []
    for d in range(1, 8):
        if d not in train_set:
            days.append({"dayIndex": d, "type": "rest", "label": "", "isRest": True, "exercises": []})
            continue
        day_type = type_order[rot % len(type_order)]
        rot += 1
        exercises = _exercises_for_type(day_type)
        if not exercises:
            days.append({"dayIndex": d, "type": "rest", "label": "", "isRest": True, "exercises": []})
        else:
            days.append(
                {
                    "dayIndex": d,
                    "type": day_type,
                    "label": "",
                    "isRest": False,
                    "exercises": exercises,
                }
            )
    return {"weekIndex": week_index, "days": days}


def build_scaffold_plan(
    bundle: dict[str, Any],
    *,
    locale: str = "ar",
    regeneration_reason: str = "",
) -> dict[str, Any]:
    onboarding = bundle.get("onboardingSummary") or {}
    if isinstance(bundle.get("onboardingByFlow"), dict):
        for section in ("core", "workout", "nutrition"):
            part = bundle["onboardingByFlow"].get(section)
            if isinstance(part, dict):
                onboarding = {**onboarding, **part}
    targets = extract_daily_targets(bundle)
    training_days = _clamp_training_days(onboarding.get("trainingDaysPerWeek"))
    split = _pick_split(onboarding)
    daily_targets = {
        "calories": targets["calories"],
        "protein": targets["protein"],
        "carbs": targets["carbs"],
        "fat": targets["fat"],
        "waterMl": targets["waterMl"],
    }
    coach_ar = "خطة أسبوعية من ملفك — تمارين ووجبات كاملة (تُحسَّن تلقائياً عند نجاح توليد الذكاء الاصطناعي)."
    coach_en = "Weekly plan from your profile — full workouts and meals (refined when AI generation succeeds)."
    return {
        "dailyTargets": daily_targets,
        "dietDays": [_diet_day(i, daily_targets, locale) for i in range(1, 8)],
        "workoutWeeks": [_workout_week(w, training_days, split) for w in range(1, 5)],
        "coachNotes": coach_ar if locale == "ar" else coach_en,
        "regenerationReason": regeneration_reason[:120] if regeneration_reason else "",
    }
