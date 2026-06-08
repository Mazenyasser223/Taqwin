"""
Anthropic Claude chat for Taqwin coach (Block E core).
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


def is_llm_configured() -> bool:
    key = get_settings().anthropic_api_key
    return bool(key and str(key).strip())


def _to_anthropic_role(role: str) -> str:
    if role in ("model", "assistant"):
        return "assistant"
    return "user"


def _format_section(title: str, data: dict[str, Any] | None) -> list[str]:
    if not data or not isinstance(data, dict):
        return []
    lines: list[str] = []
    for key, val in data.items():
        if val is None or val == "" or val == []:
            continue
        if isinstance(val, list):
            if not val:
                continue
            val = ", ".join(str(v) for v in val)
        lines.append(f"  {key}: {val}")
    if not lines:
        return []
    return [title, *lines, ""]


def format_context_bundle(bundle: dict[str, Any] | None) -> str:
    """Serialize CAG bundle into compact text for the coach system prompt."""
    if not bundle:
        return ""

    lines: list[str] = []
    profile = bundle.get("profile") or {}
    if profile:
        lines.append("Profile:")
        for key in (
            "displayName",
            "role",
            "gender",
            "ageYears",
            "fitnessGoal",
            "fitnessLevel",
            "weightKg",
            "heightCm",
            "medicalNotes",
            "locale",
        ):
            if profile.get(key) is not None:
                lines.append(f"  {key}: {profile[key]}")

    onboarding_by_flow = bundle.get("onboardingByFlow")
    if isinstance(onboarding_by_flow, dict):
        for section_key, title in (
            ("core", "ONBOARDING — CORE (questionnaire)"),
            ("workout", "ONBOARDING — WORKOUT"),
            ("nutrition", "ONBOARDING — NUTRITION"),
            ("health", "ONBOARDING — HEALTH"),
        ):
            lines.extend(_format_section(title, onboarding_by_flow.get(section_key)))
    else:
        summary = bundle.get("onboardingSummary") or {}
        if isinstance(summary, dict) and summary:
            lines.extend(_format_section("ONBOARDING SUMMARY", summary))

    targets = bundle.get("targets") or profile.get("targets") or {}
    if not targets and bundle.get("nutritionToday", {}).get("targets"):
        targets = bundle["nutritionToday"]["targets"]
    if targets:
        lines.append("Daily targets:")
        for key in ("calories", "protein", "carbs", "fat", "waterMl", "calorieTarget", "proteinTarget"):
            if targets.get(key) is not None:
                lines.append(f"  {key}: {targets[key]}")

    nutrition = bundle.get("nutritionToday") or {}
    if nutrition:
        logged = nutrition.get("logged") or {}
        lines.append(
            f"Nutrition today ({nutrition.get('date', 'today')}): "
            f"meals={logged.get('mealCount', 0)}, "
            f"calories={logged.get('calories', 0)}"
        )

    workout = bundle.get("workoutToday") or {}
    if workout and not workout.get("isRest") and workout.get("exercises"):
        lines.append(f"Workout today: {workout.get('type') or 'training'}")
        for ex in (workout.get("exercises") or [])[:8]:
            name = ex.get("name") if isinstance(ex, dict) else None
            if name:
                lines.append(f"  - {name}")

    body_metrics = bundle.get("bodyMetricsLatest")
    if isinstance(body_metrics, dict):
        inbody_keys = (
            "weightKg",
            "bodyFatPct",
            "skeletalMuscleMassKg",
            "basalMetabolicRate",
            "visceralFatLevel",
            "bmi",
            "inbodyScore",
            "targetWeightKg",
            "source",
            "measuredAt",
            "recordedAt",
        )
        if any(body_metrics.get(k) is not None for k in inbody_keys):
            lines.append("Latest InBody / body metrics:")
            for key in inbody_keys:
                if body_metrics.get(key) is not None:
                    lines.append(f"  {key}: {body_metrics[key]}")
            ext = body_metrics.get("measurements") or body_metrics.get("extended")
            if isinstance(ext, dict):
                if ext.get("totalBodyWaterL") is not None:
                    lines.append(f"  totalBodyWaterL: {ext['totalBodyWaterL']}")
                if ext.get("segmentalLean"):
                    lines.append("  segmentalLean: available")
                if ext.get("segmentalFat"):
                    lines.append("  segmentalFat: available")

    readiness = bundle.get("readinessLatest")
    if isinstance(readiness, dict) and readiness.get("date"):
        lines.append("Latest readiness:")
        for key in ("sleepQuality", "soreness", "rpe", "notes"):
            if readiness.get(key) is not None:
                lines.append(f"  {key}: {readiness[key]}")

    constraints = bundle.get("constraints") or {}
    if constraints:
        inj = constraints.get("injuries") or []
        if inj:
            lines.append(f"Active injury constraints: {', '.join(str(i) for i in inj)}")

    lines.append(
        "RULE: Use onboarding fields above as source of truth (e.g. bodyType, injuries, diet). "
        "Do not guess them from height/weight alone."
    )

    return "\n".join(lines).strip()


async def complete_coach_chat(
    *,
    system: str,
    messages: list[dict[str, str]],
    temperature: float | None = None,
    max_tokens: int | None = None,
) -> str:
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    model = settings.anthropic_model
    temp = temperature if temperature is not None else settings.llm_temperature
    max_tok = max_tokens if max_tokens is not None else settings.llm_max_tokens

    anthropic_messages = [
        {"role": _to_anthropic_role(m.get("role", "user")), "content": m.get("content", "")}
        for m in messages
        if m.get("content")
    ]

    payload = {
        "model": model,
        "max_tokens": max_tok,
        "temperature": temp,
        "system": system,
        "messages": anthropic_messages,
    }

    timeout = settings.plan_timeout_seconds if max_tok > 2000 else settings.llm_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "Content-Type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
            json=payload,
        )

    if res.status_code >= 400:
        logger.warning("Anthropic error %s: %s", res.status_code, res.text[:300])
        raise RuntimeError(f"Anthropic {res.status_code}: {res.text[:300]}")

    data = res.json()
    for block in data.get("content") or []:
        if block.get("type") == "text":
            return str(block.get("text") or "")
    return ""
