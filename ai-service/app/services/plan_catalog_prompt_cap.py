"""
Cap food/exercise lists before building the Claude plan prompt.
"""

from __future__ import annotations

from typing import Any

from app.config import get_settings


def _exercise_cell_key(item: dict[str, Any]) -> str:
    muscle = str(item.get("muscleGroup") or "other")
    difficulty = str(item.get("planDifficulty") or item.get("difficulty") or "intermediate")
    return f"{muscle}:{difficulty}"


def trim_foods_for_prompt(foods: list[dict[str, Any]]) -> list[dict[str, Any]]:
    settings = get_settings()
    max_total = max(20, int(settings.plan_prompt_max_foods or 80))
    max_per_group = max(3, int(settings.plan_prompt_max_foods_per_group or 8))
    group_counts: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    for item in foods:
        group = str(item.get("planGroup") or "other")
        count = group_counts.get(group, 0)
        if count >= max_per_group:
            continue
        group_counts[group] = count + 1
        out.append(item)
        if len(out) >= max_total:
            break
    return out


def trim_exercises_for_prompt(exercises: list[dict[str, Any]]) -> list[dict[str, Any]]:
    settings = get_settings()
    max_total = max(30, int(settings.plan_prompt_max_exercises or 120))
    max_per_cell = max(3, int(settings.plan_prompt_max_exercises_per_cell or 6))
    cell_counts: dict[str, int] = {}
    out: list[dict[str, Any]] = []
    for item in exercises:
        key = _exercise_cell_key(item)
        count = cell_counts.get(key, 0)
        if count >= max_per_cell:
            continue
        cell_counts[key] = count + 1
        out.append(item)
        if len(out) >= max_total:
            break
    return out


def trim_plan_catalog_for_prompt(
    foods: list[dict[str, Any]],
    exercises: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    return trim_foods_for_prompt(foods), trim_exercises_for_prompt(exercises)
