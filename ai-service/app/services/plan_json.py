"""
Parse and minimally validate plan JSON from the LLM (full validation is Node C2).
"""

from __future__ import annotations

import json
import re
from typing import Any


def extract_json(raw: str | None) -> dict[str, Any] | None:
    if not raw:
        return None
    text = str(raw).strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-z]*\n?", "", text, flags=re.I)
        text = re.sub(r"\n?```\s*$", "", text)
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last > first:
        text = text[first : last + 1]
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def expand_workout_weeks_to_four(plan: dict[str, Any]) -> dict[str, Any]:
    weeks = plan.get("workoutWeeks")
    if not isinstance(weeks, list) or not weeks:
        return plan
    if len(weeks) >= 4:
        plan["workoutWeeks"] = [{**w, "weekIndex": i + 1} for i, w in enumerate(weeks[:4])]
        return plan
    import copy

    template = weeks[0]
    base_days = copy.deepcopy(template.get("days") or [])
    out = [{**template, "weekIndex": 1, "days": base_days}]
    for w in range(2, 5):
        out.append({"weekIndex": w, "days": copy.deepcopy(base_days)})
    plan["workoutWeeks"] = out
    return plan


def _meal_item_fields(item: Any) -> dict[str, Any] | None:
    if not isinstance(item, dict):
        return None
    name = str(item.get("name") or item.get("label") or item.get("foodName") or "").strip()
    grams_raw = item.get("grams", item.get("quantity", item.get("amount", item.get("portionGrams"))))
    try:
        grams = float(grams_raw)
    except (TypeError, ValueError):
        return None
    if not name or grams <= 0:
        return None
    return {
        "name": name,
        "grams": grams,
        "foodItemId": item.get("foodItemId"),
        "webtebId": item.get("webtebId"),
        "calories": item.get("calories") or 0,
        "protein": item.get("protein") or 0,
        "carbs": item.get("carbs") or 0,
        "fat": item.get("fat") or 0,
        "notes": item.get("notes") or "",
    }


def _normalize_meal_to_slot(meal: Any) -> dict[str, Any] | None:
    if not isinstance(meal, dict):
        return None
    slot = str(meal.get("slot") or meal.get("mealType") or meal.get("mealSlot") or "meal").strip() or "meal"
    nested = meal.get("items") or meal.get("foods") or meal.get("foodItems")
    if isinstance(nested, list) and nested:
        items = [row for row in (_meal_item_fields(item) for item in nested) if row]
        if items:
            return {"slot": slot, "items": items}

    flat = _meal_item_fields(meal)
    if flat:
        return {"slot": slot, "items": [flat]}
    return None


def normalize_diet_meals_to_slot_shape(plan: dict[str, Any]) -> dict[str, Any]:
    diet_days = plan.get("dietDays")
    if not isinstance(diet_days, list):
        return plan
    for day in diet_days:
        if not isinstance(day, dict):
            continue
        meals = day.get("meals")
        if not isinstance(meals, list):
            continue
        grouped: list[dict[str, Any]] = []
        slot_index: dict[str, int] = {}
        for raw in meals:
            normalized = _normalize_meal_to_slot(raw)
            if not normalized or not normalized.get("items"):
                continue
            slot = normalized["slot"]
            if slot in slot_index:
                grouped[slot_index[slot]]["items"].extend(normalized["items"])
            else:
                slot_index[slot] = len(grouped)
                grouped.append(normalized)
        day["meals"] = grouped
    return plan


def normalize_claude_plan_shape(plan: dict[str, Any] | None) -> dict[str, Any] | None:
    if not plan or not isinstance(plan, dict):
        return None
    normalize_diet_meals_to_slot_shape(plan)
    return expand_workout_weeks_to_four(plan)


def has_plan_shape(plan: dict[str, Any]) -> bool:
    """Lightweight check before returning to Node."""
    if not isinstance(plan.get("dailyTargets"), dict):
        return False
    dt = plan["dailyTargets"]
    for key in ("calories", "protein", "carbs", "fat", "waterMl"):
        if not isinstance(dt.get(key), (int, float)) or dt[key] <= 0:
            return False
    diet_days = plan.get("dietDays")
    workout_weeks = plan.get("workoutWeeks")
    if not isinstance(diet_days, list) or len(diet_days) < 1:
        return False
    if not isinstance(workout_weeks, list) or len(workout_weeks) < 1:
        return False
    return True
