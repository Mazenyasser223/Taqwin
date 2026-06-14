"""
Block C9 — plan adaptation via Claude (meso/macro); keep returns no plan body.
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


def _adapt_notes(snapshot: dict[str, Any] | None, decision_hint: str, locale: str) -> str:
    snap = snapshot or {}
    reasons = snap.get("reasons") or snap.get("explain") or ""
    if locale == "ar":
        return (
            f"تكييف {decision_hint}: التزام {snap.get('overallAdherence', '—')}%, "
            f"أيام فائتة {snap.get('missedWorkoutDays', '—')}. {reasons}"
        )
    return (
        f"Adapt {decision_hint}: adherence {snap.get('overallAdherence', '—')}%, "
        f"missed days {snap.get('missedWorkoutDays', '—')}. {reasons}"
    )


async def adapt_plan(
    *,
    user_id: str,
    context_bundle: dict[str, Any],
    snapshot: dict[str, Any] | None = None,
    decision_hint: str = "keep",
) -> dict[str, Any]:
    hint = (decision_hint or "keep").lower().strip()
    if hint not in ("keep", "micro", "meso", "macro"):
        hint = "keep"

    bundle = sanitize_cag_bundle(context_bundle or {}) or {}
    locale = bundle.get("locale") or "ar"
    if locale not in ("en", "ar"):
        locale = "ar"
    t0 = time.perf_counter()

    if hint == "keep":
        msg_ar = "الخطة الحالية مناسبة — لا تعديل هذا الأسبوع."
        msg_en = "Current plan is appropriate — no changes this week."
        return {
            "plan": None,
            "explainabilityText": msg_ar if locale == "ar" else msg_en,
            "adaptation": {"decision": "keep", "applied": False, "reason": "adherence_ok"},
            "source": "ai",
            "meta": {"userId": user_id, "latencyMs": int((time.perf_counter() - t0) * 1000)},
        }

    food_list, ex_list, books = resolve_plan_candidates(
        bundle=bundle,
        foods=None,
        exercises=None,
        book_chunks=None,
        locale=locale,
    )
    cag_text = format_context_bundle(bundle)
    adapt_feedback = _adapt_notes(snapshot, hint, locale)

    if not is_llm_configured():
        plan = build_scaffold_plan(bundle, locale=locale, regeneration_reason=f"adapt:{hint}")
        msg_ar = f"مسودة تكييف ({hint}) — فعّل Claude للتكييف الكامل."
        msg_en = f"Adaptation draft ({hint}) — enable Claude for full adaptation."
        return {
            "plan": plan,
            "explainabilityText": msg_ar if locale == "ar" else msg_en,
            "adaptation": {"decision": hint, "applied": True, "reason": "scaffold_fallback"},
            "source": "scaffold",
            "meta": {"userId": user_id, "latencyMs": int((time.perf_counter() - t0) * 1000)},
        }

    system = build_plan_system_prompt(locale=locale)
    user_prompt = build_plan_user_prompt(
        bundle=bundle,
        foods=food_list,
        exercises=ex_list,
        book_chunks=books,
        context_bundle_text=cag_text,
        regeneration_reason=f"adapt:{hint}",
        validation_feedback=adapt_feedback,
    )

    settings = get_settings()
    raw = await complete_coach_chat(
        system=system,
        messages=[{"role": "user", "content": user_prompt}],
        temperature=settings.plan_llm_temperature,
        max_tokens=settings.plan_llm_max_tokens,
    )

    parsed = extract_json(raw)
    if not parsed or not has_plan_shape(parsed):
        plan = build_scaffold_plan(bundle, locale=locale, regeneration_reason=f"adapt:{hint}")
        return {
            "plan": plan,
            "explainabilityText": (
                "تكييف — مسودة آمنة (فشل تحليل JSON)."
                if locale == "ar"
                else "Adaptation safe draft (JSON parse failed)."
            ),
            "adaptation": {"decision": hint, "applied": True, "reason": "json_parse_fallback"},
            "source": "scaffold",
            "meta": {"userId": user_id, "latencyMs": int((time.perf_counter() - t0) * 1000)},
        }

    plan = normalize_claude_plan_shape(parsed)
    notes = str(plan.get("coachNotes") or "").strip()
    explain = notes[:400] if notes else adapt_feedback

    return {
        "plan": plan,
        "explainabilityText": explain,
        "adaptation": {"decision": hint, "applied": True, "reason": "claude_adapt"},
        "source": "ai",
        "meta": {
            "userId": user_id,
            "latencyMs": int((time.perf_counter() - t0) * 1000),
            "foodCandidates": len(food_list or []),
            "exerciseCandidates": len(ex_list or []),
        },
    }
