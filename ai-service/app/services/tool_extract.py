"""
LLM structured extraction for chat tool inputs (Block E).
Fills gaps when message-only payloads cannot parse vague requests (e.g. Arabic swap with no names).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

from app.services.cag_sanitize import sanitize_prompt_text
from app.services.llm_chat import complete_coach_chat, format_context_bundle, is_llm_configured

logger = logging.getLogger(__name__)

_JSON_BLOCK = re.compile(r"\{[\s\S]*\}")


def _parse_json_object(text: str) -> dict[str, Any] | None:
    raw = (text or "").strip()
    if not raw:
        return None
    try:
        data = json.loads(raw)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    match = _JSON_BLOCK.search(raw)
    if not match:
        return None
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _extraction_prompt(
    *,
    tool_names: list[str],
    user_message: str,
    locale: str,
    context_text: str,
) -> str:
    tools = ", ".join(tool_names)
    lang_note = "Reply JSON keys in English; food/exercise names may be Arabic or English." if locale == "ar" else ""
    return f"""Extract structured tool inputs from the athlete message. {lang_note}

Tools to fill: {tools}

USER MESSAGE:
{user_message}

CONTEXT (today plan, foods, exercises — use IDs when present):
{context_text or "(none)"}

Return ONLY one JSON object (no markdown). Shape by tool:
- log_food: {{ "foodName": string, "grams": number|null, "rawText": string }}
- replace_exercise_today: {{ "oldExerciseName": string|null, "newExerciseName": string, "exerciseIndex": number|null, "request": string }}
- set_life_mode: {{ "lifeMode": "normal"|"travel"|"sick"|"fasting"|"injury_flare", "message": string }}
- adapt_plan: {{ "request": string }}

If multiple tools, nest under tool name keys, e.g. {{ "log_food": {{...}}, "replace_exercise_today": {{...}} }}.
Use null for unknown numeric fields. Do not invent UUIDs."""


async def select_action_tools(
    *,
    tool_hints: list[str],
    user_message: str,
    locale: str = "en",
) -> list[str]:
    """Pick which intent tool hints apply to this message (LLM when multiple hints)."""
    hints = [h for h in tool_hints if h]
    if not hints:
        return []
    if len(hints) == 1:
        return hints

    if not is_llm_configured():
        return hints[:1]

    tools_csv = ", ".join(hints)
    lang_note = "User may write Egyptian Arabic or English." if locale == "ar" else ""
    system = (
        "You pick which fitness-app tools apply to the athlete message. "
        "Reply with ONLY JSON: {\"tools\": [\"tool_name\", ...]}. "
        f"Choose from: {tools_csv}. Pick at most 3. {lang_note}"
    )
    try:
        raw = await complete_coach_chat(
            system=system,
            messages=[{"role": "user", "content": user_message.strip()}],
            temperature=0,
            max_tokens=128,
        )
        parsed = _parse_json_object(raw)
        if parsed and isinstance(parsed.get("tools"), list):
            picked = [str(t) for t in parsed["tools"] if str(t) in hints]
            if picked:
                return picked[:3]
    except Exception as exc:
        logger.warning("select_action_tools LLM failed: %s", exc)

    return hints[:1]


async def extract_tool_inputs(
    *,
    tool_names: list[str],
    user_message: str,
    context_bundle: dict[str, Any] | None = None,
    locale: str = "en",
) -> dict[str, dict[str, Any]]:
    """Return per-tool structured inputs merged with the original user text."""
    safe_message = str(sanitize_prompt_text(user_message, "userMessage") or "").strip()
    base: dict[str, dict[str, Any]] = {}
    for name in tool_names:
        payload: dict[str, Any] = {"message": safe_message}
        if name == "log_food":
            payload["rawText"] = safe_message
        elif name in ("replace_exercise_today", "adapt_plan"):
            payload["request"] = safe_message
        elif name == "set_life_mode":
            payload["reason"] = safe_message
        base[name] = payload

    if not is_llm_configured() or not tool_names:
        return base

    context_text = format_context_bundle(context_bundle or {})
    system = "You extract JSON tool parameters for a fitness app. Output valid JSON only."
    user_prompt = _extraction_prompt(
        tool_names=tool_names,
        user_message=safe_message,
        locale=locale,
        context_text=context_text[:6000],
    )

    try:
        raw = await complete_coach_chat(
            system=system,
            messages=[{"role": "user", "content": user_prompt}],
            temperature=0.1,
            max_tokens=800,
        )
        parsed = _parse_json_object(raw)
        if not parsed:
            return base

        for name in tool_names:
            chunk = parsed.get(name) if name in parsed else parsed
            if not isinstance(chunk, dict):
                continue
            merged = {**base[name], **{k: v for k, v in chunk.items() if v is not None}}
            if name == "log_food":
                if chunk.get("foodName"):
                    merged["foodName"] = chunk["foodName"]
                if chunk.get("grams") is not None:
                    merged["grams"] = chunk["grams"]
            elif name == "replace_exercise_today":
                old_n = chunk.get("oldExerciseName")
                new_n = chunk.get("newExerciseName")
                if old_n or new_n:
                    req = safe_message
                    if old_n and new_n:
                        merged["request"] = f"replace {old_n} with {new_n}"
                    elif new_n:
                        merged["request"] = f"replace with {new_n}"
                    else:
                        merged["request"] = req
            elif name == "set_life_mode" and chunk.get("lifeMode"):
                merged["lifeMode"] = chunk["lifeMode"]
            base[name] = merged
    except Exception as exc:
        logger.warning("tool input extraction failed: %s", exc)

    return base
