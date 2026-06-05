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


def normalize_claude_plan_shape(plan: dict[str, Any] | None) -> dict[str, Any] | None:
    if not plan or not isinstance(plan, dict):
        return None
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
