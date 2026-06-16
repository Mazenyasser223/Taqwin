"""
Block C1 — orchestrate plan JSON generation via Claude (RAG + CAG). Scaffold only if LLM is off.
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.config import get_settings
from app.prompts.plan_prompts import build_plan_system_prompt, build_plan_user_prompt
from app.services.cag_sanitize import sanitize_cag_bundle
from app.services.llm_chat import complete_coach_chat, format_context_bundle, is_llm_configured
from app.services.plan_candidates import resolve_plan_candidates
from app.services.plan_json import extract_json, has_plan_shape, normalize_claude_plan_shape
from app.services.plan_scaffold import build_scaffold_plan

logger = logging.getLogger(__name__)


def _explainability(plan: dict[str, Any], locale: str, *, source: str) -> str:
    notes = str(plan.get("coachNotes") or "").strip()
    if notes and "safe baseline" not in notes.lower():
        return notes[:400]
    if locale == "ar":
        if source == "ai":
            return (
                "خطة أسبوعية مخصصة بالذكاء الاصطناعي (Claude) — الماكروز والوجبات والتمارين من ملفك + RAG + الكتب التدريبية."
            )
        return "خطة آمنة افتراضية — فعّل ANTHROPIC_API_KEY في ai-service لتوليد Claude."
    if source == "ai":
        return (
            "Personalized weekly plan from Claude — macros, meals, and workouts from your dossier, RAG catalogs, and coaching books."
        )
    return "Safe default plan until Claude (ANTHROPIC_API_KEY) is configured in ai-service."


async def _call_claude_plan(
    *,
    locale: str,
    system: str,
    user_prompt: str,
) -> dict[str, Any] | None:
    settings = get_settings()
    attempts = max(1, min(2, int(settings.plan_llm_internal_attempts or 1)))
    for attempt in range(attempts):
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
                return parsed
            logger.warning(
                "plan JSON parse/shape failed attempt=%s preview=%s",
                attempt + 1,
                (raw or "")[:200],
            )
        except Exception as exc:
            logger.warning("plan LLM attempt=%s failed: %s", attempt + 1, exc)
    return None


async def generate_plan(
    *,
    user_id: str,
    context_bundle: dict[str, Any],
    week_start: str = "",
    foods: list[dict[str, Any]] | None = None,
    exercises: list[dict[str, Any]] | None = None,
    book_chunks: list[dict[str, Any]] | None = None,
    regeneration_reason: str = "",
    validation_feedback: str = "",
) -> dict[str, Any]:
    """
    Returns { plan, explainabilityText, source, meta }.
    source is 'ai' | 'scaffold' (scaffold only when Anthropic is not configured).
    """
    bundle = sanitize_cag_bundle(context_bundle or {}) or {}
    locale = bundle.get("locale") or "ar"
    if locale not in ("en", "ar"):
        locale = "ar"

    t0 = time.perf_counter()
    food_list, ex_list, books = resolve_plan_candidates(
        bundle=bundle,
        foods=foods,
        exercises=exercises,
        book_chunks=book_chunks,
        locale=locale,
    )

    cag_text = format_context_bundle(bundle)
    system = build_plan_system_prompt(locale=locale)
    user_prompt = build_plan_user_prompt(
        bundle=bundle,
        foods=food_list,
        exercises=ex_list,
        book_chunks=books,
        context_bundle_text=cag_text,
        regeneration_reason=regeneration_reason,
        validation_feedback=validation_feedback,
        week_start=week_start,
    )

    settings = get_settings()
    source = "scaffold"
    plan: dict[str, Any] | None = None

    if is_llm_configured():
        plan = await _call_claude_plan(locale=locale, system=system, user_prompt=user_prompt)
        if plan is not None:
            source = "ai"
    else:
        logger.warning("ANTHROPIC_API_KEY not set in ai-service — plan scaffold only")

    if plan is None:
        plan = build_scaffold_plan(
            bundle,
            locale=locale,
            regeneration_reason=regeneration_reason,
        )
        source = "scaffold"

    latency_ms = int((time.perf_counter() - t0) * 1000)
    return {
        "plan": plan,
        "explainabilityText": _explainability(plan, locale, source=source),
        "source": source,
        "meta": {
            "userId": user_id,
            "weekStart": week_start or None,
            "locale": locale,
            "model": settings.anthropic_model if source == "ai" else "scaffold",
            "latencyMs": latency_ms,
            "foodCandidates": len(food_list),
            "exerciseCandidates": len(ex_list),
            "bookChunks": len(books),
            "cagIncluded": bool(cag_text),
        },
    }
