"""
Step 3 — Sonnet fills coach template plan (structure locked).
"""

from __future__ import annotations

import copy
import logging
from typing import Any

from app.config import get_settings
from app.prompts.plan_template_prompts import build_fill_system_prompt, build_fill_user_prompt
from app.services.cag_sanitize import sanitize_cag_bundle
from app.services.llm_chat import complete_coach_chat, is_llm_configured
from app.services.plan_json import extract_json, has_plan_shape, normalize_claude_plan_shape

logger = logging.getLogger(__name__)


def _structure_signature(plan: dict[str, Any]) -> tuple:
    diet_sig = []
    for day in plan.get("dietDays") or []:
        meals = day.get("meals") or []
        diet_sig.append(
            (
                day.get("dayIndex"),
                tuple((m.get("slot"), len(m.get("items") or [])) for m in meals),
            )
        )
    workout_sig = []
    for week in plan.get("workoutWeeks") or []:
        for day in week.get("days") or []:
            workout_sig.append(
                (
                    day.get("dayIndex"),
                    bool(day.get("isRest")),
                    len(day.get("exercises") or []),
                )
            )
    return (tuple(diet_sig), tuple(workout_sig))


def _merge_ids_from_template(template: dict[str, Any], filled: dict[str, Any]) -> dict[str, Any]:
    """Restore catalog IDs from template when Claude dropped them."""
    out = copy.deepcopy(filled)
    t_days = template.get("dietDays") or []
    f_days = out.get("dietDays") or []
    for di, t_day in enumerate(t_days):
        if di >= len(f_days):
            break
        f_day = f_days[di]
        t_meals = t_day.get("meals") or []
        f_meals = f_day.get("meals") or []
        for mi, t_meal in enumerate(t_meals):
            if mi >= len(f_meals):
                break
            t_items = t_meal.get("items") or []
            f_items = f_meals[mi].get("items") or []
            for ii, t_item in enumerate(t_items):
                if ii >= len(f_items):
                    break
                f_item = f_items[ii]
                if t_item.get("webtebId") is not None:
                    f_item["webtebId"] = t_item["webtebId"]
                if t_item.get("foodItemId"):
                    f_item["foodItemId"] = t_item["foodItemId"]
    t_weeks = template.get("workoutWeeks") or []
    f_weeks = out.get("workoutWeeks") or []
    if t_weeks and f_weeks:
        t_days_w = t_weeks[0].get("days") or []
        f_days_w = f_weeks[0].get("days") or []
        for di, t_day in enumerate(t_days_w):
            if di >= len(f_days_w):
                break
            t_ex = t_day.get("exercises") or []
            f_ex = f_days_w[di].get("exercises") or []
            for ei, t_e in enumerate(t_ex):
                if ei >= len(f_ex):
                    break
                if t_e.get("exerciseId"):
                    f_ex[ei]["exerciseId"] = t_e["exerciseId"]
    return out


def merge_template_plan(template: dict[str, Any], candidate: dict[str, Any] | None) -> dict[str, Any]:
    """Use Claude output when structure matches; otherwise keep template."""
    if not candidate:
        return copy.deepcopy(template)
    if _structure_signature(template) != _structure_signature(candidate):
        logger.warning("template fill structure mismatch — using template base with targets/notes only")
        out = copy.deepcopy(template)
        if isinstance(candidate.get("dailyTargets"), dict):
            out["dailyTargets"] = {**out.get("dailyTargets", {}), **candidate["dailyTargets"]}
        if candidate.get("coachNotes"):
            out["coachNotes"] = str(candidate["coachNotes"])[:300]
        return out
    merged = _merge_ids_from_template(template, candidate)
    return merged


async def fill_coach_template(
    *,
    context_bundle: dict[str, Any],
    template_plan: dict[str, Any],
    book_chunks: list[dict[str, Any]] | None = None,
    retrieval: dict[str, Any] | None = None,
    validation_feedback: str = "",
    locale: str = "ar",
) -> dict[str, Any]:
    bundle = sanitize_cag_bundle(context_bundle or {}) or {}
    template = copy.deepcopy(template_plan)
    retrieval = retrieval or {}

    if not is_llm_configured():
        logger.warning("ANTHROPIC_API_KEY not set — returning template unchanged")
        hint = retrieval.get("dailyTargetsHint") or {}
        if hint:
            template["dailyTargets"] = {
                **template.get("dailyTargets", {}),
                **{k: int(v) for k, v in hint.items() if v},
            }
        focus = retrieval.get("coachFocus") or []
        if focus:
            prefix = "مبادئ: " if locale == "ar" else "Focus: "
            template["coachNotes"] = f"{prefix}{' · '.join(focus)}"[:300]
        return {"plan": template, "source": "template"}

    settings = get_settings()
    system = build_fill_system_prompt(locale=locale)
    user_prompt = build_fill_user_prompt(
        bundle=bundle,
        template_plan=template,
        book_chunks=book_chunks or [],
        retrieval=retrieval,
        validation_feedback=validation_feedback,
    )

    try:
        raw = await complete_coach_chat(
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=settings.plan_llm_temperature,
            max_tokens=settings.plan_llm_max_tokens,
            cache_system=True,
        )
        parsed = normalize_claude_plan_shape(extract_json(raw))
        if parsed and has_plan_shape(parsed):
            plan = merge_template_plan(template, parsed)
            return {"plan": plan, "source": "ai"}
        logger.warning("template fill parse/shape failed — returning template")
    except Exception as exc:
        logger.warning("template fill failed: %s", exc)

    return {"plan": template, "source": "template"}
