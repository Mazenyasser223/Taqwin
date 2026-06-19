"""
Anthropic Claude chat for Taqwin coach (Block E core).
"""

from __future__ import annotations

import contextvars
import json
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import get_settings
from app.services.cag_sanitize import sanitize_cag_bundle, sanitize_cag_string

logger = logging.getLogger(__name__)

TokenSink = Callable[[str], Awaitable[None] | None]
_coach_token_sink: contextvars.ContextVar[TokenSink | None] = contextvars.ContextVar(
    "coach_token_sink", default=None
)


def bind_coach_token_sink(sink: TokenSink | None) -> contextvars.Token:
    return _coach_token_sink.set(sink)


def reset_coach_token_sink(token: contextvars.Token) -> None:
    _coach_token_sink.reset(token)


async def _emit_stream_token(delta: str) -> None:
    if not delta:
        return
    sink = _coach_token_sink.get()
    if not sink:
        return
    result = sink(delta)
    if result is not None and hasattr(result, "__await__"):
        await result


async def _parse_anthropic_stream(
    response: httpx.Response,
    *,
    on_text: Callable[[str], Awaitable[None]] | None = None,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], str, list[str]]:
    """Parse Anthropic SSE stream → (raw_blocks, tool_uses, stop_reason, text_parts)."""
    text_parts: list[str] = []
    tool_uses: list[dict[str, Any]] = []
    raw_blocks: list[dict[str, Any]] = []
    stop_reason = "end_turn"
    current_block: dict[str, Any] | None = None
    current_tool: dict[str, Any] | None = None
    tool_json_buf = ""

    async for line in response.aiter_lines():
        if not line or not line.startswith("data:"):
            continue
        payload = line[5:].strip()
        if not payload or payload == "[DONE]":
            continue
        try:
            event = json.loads(payload)
        except json.JSONDecodeError:
            continue

        etype = event.get("type")
        if etype == "content_block_start":
            block = event.get("content_block") or {}
            if block.get("type") == "text":
                current_block = {"type": "text", "text": ""}
            elif block.get("type") == "tool_use":
                current_tool = {
                    "id": block.get("id"),
                    "name": block.get("name"),
                    "input": block.get("input") if isinstance(block.get("input"), dict) else {},
                }
                tool_json_buf = ""
        elif etype == "content_block_delta":
            delta = event.get("delta") or {}
            if delta.get("type") == "text_delta":
                piece = str(delta.get("text") or "")
                if piece:
                    text_parts.append(piece)
                    if current_block is not None:
                        current_block["text"] = str(current_block.get("text") or "") + piece
                    if on_text:
                        await on_text(piece)
            elif delta.get("type") == "input_json_delta":
                tool_json_buf += str(delta.get("partial_json") or "")
        elif etype == "content_block_stop":
            if current_block is not None:
                raw_blocks.append(current_block)
                current_block = None
            if current_tool is not None:
                if tool_json_buf.strip():
                    try:
                        current_tool["input"] = json.loads(tool_json_buf)
                    except json.JSONDecodeError:
                        pass
                tool_uses.append(current_tool)
                raw_blocks.append(
                    {
                        "type": "tool_use",
                        "id": current_tool.get("id"),
                        "name": current_tool.get("name"),
                        "input": current_tool.get("input") or {},
                    }
                )
                current_tool = None
                tool_json_buf = ""
        elif etype == "message_delta":
            stop_reason = str((event.get("delta") or {}).get("stop_reason") or stop_reason)

    return raw_blocks, tool_uses, stop_reason, text_parts

SEMANTIC_MEMORY_KEYS = frozenset({
    "diet_preferences",
    "training_constraints",
    "injury_notes",
    "goals_mentioned",
    "chat_context_summary",
})


def _memory_priority(key: str) -> int:
    if key in SEMANTIC_MEMORY_KEYS:
        return 0
    if key.startswith("last_"):
        return 2
    return 1


def _prioritize_ai_memories(memories: list[Any], limit: int = 5) -> list[Any]:
    if not memories:
        return []
    valid = [m for m in memories if isinstance(m, dict) and m.get("summary")]
    valid.sort(
        key=lambda m: (
            _memory_priority(str(m.get("key") or "")),
            -(float(m.get("confidence") or 0)),
        )
    )
    return valid[:limit]


def _format_ai_memories(memories: list[Any]) -> list[str]:
    ordered = _prioritize_ai_memories(memories, limit=5)
    if not ordered:
        return []
    lines = ["AI memories (durable facts — prefer over stale tool snapshots):"]
    for item in ordered:
        key = item.get("key") or "note"
        summary = str(sanitize_cag_string(str(item.get("summary") or "").strip(), "memorySummary"))
        if summary:
            lines.append(f"  - {key}: {summary}")
    lines.append("")
    return lines


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
            val = ", ".join(str(sanitize_cag_string(str(v), "onboardingText")) for v in val)
        elif isinstance(val, str):
            val = sanitize_cag_string(val, "onboardingText")
        lines.append(f"  {key}: {val}")
    if not lines:
        return []
    return [title, *lines, ""]


def format_context_bundle(bundle: dict[str, Any] | None) -> str:
    """Serialize CAG bundle into compact text for the coach system prompt."""
    if not bundle:
        return ""

    bundle = sanitize_cag_bundle(bundle) or {}
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
                field = "displayName" if key == "displayName" else "medicalNotes" if key == "medicalNotes" else "default"
                lines.append(f"  {key}: {sanitize_cag_string(str(profile[key]), field)}")

    onboarding_by_flow = bundle.get("onboardingByFlow")
    if isinstance(onboarding_by_flow, dict):
        for section_key, title in (
            ("core", "ONBOARDING — CORE (questionnaire)"),
            ("workout", "ONBOARDING — WORKOUT"),
            ("nutrition", "ONBOARDING — NUTRITION"),
            ("health", "ONBOARDING — HEALTH"),
            ("femaleHealth", "ONBOARDING — FEMALE HEALTH (optional)"),
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
        lines.append(
            f"Workout today: {sanitize_cag_string(str(workout.get('type') or 'training'), 'exerciseName')}"
        )
        for ex in (workout.get("exercises") or [])[:8]:
            name = ex.get("name") if isinstance(ex, dict) else None
            if name:
                lines.append(f"  - {sanitize_cag_string(str(name), 'exerciseName')}")

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
                field = "readinessNotes" if key == "notes" else "default"
                lines.append(f"  {key}: {sanitize_cag_string(str(readiness[key]), field)}")

    constraints = bundle.get("constraints") or {}
    if constraints:
        inj = constraints.get("injuries") or []
        if inj:
            lines.append(
                f"Active injury constraints: {', '.join(sanitize_cag_string(str(i), 'injuryLabel') for i in inj)}"
            )

    memories = bundle.get("aiMemories")
    if isinstance(memories, list) and memories:
        lines.extend(_format_ai_memories(memories))

    lines.append(
        "RULE: Use onboarding fields above as source of truth (e.g. bodyType, injuries, diet). "
        "Do not guess them from height/weight alone."
    )

    return "\n".join(lines).strip()


def _resolve_anthropic_model(model: str | None) -> str:
    return (model or get_settings().anthropic_model).strip()


def _use_prompt_cache(cache_system: bool | None) -> bool:
    if cache_system is None:
        return bool(get_settings().prompt_cache_enabled)
    return cache_system


def _anthropic_system_field(system: str, *, cache: bool) -> str | list[dict[str, Any]]:
    if not cache or not (system or "").strip():
        return system
    return [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]


def _anthropic_headers(*, api_key: str, prompt_cache: bool) -> dict[str, str]:
    headers = {
        "Content-Type": "application/json",
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
    }
    if prompt_cache:
        headers["anthropic-beta"] = "prompt-caching-2024-07-31"
    return headers


@dataclass
class CoachTextResult:
    text: str = ""
    stop_reason: str = ""


async def complete_coach_chat_with_meta(
    *,
    system: str,
    messages: list[dict[str, str]],
    temperature: float | None = None,
    max_tokens: int | None = None,
    model: str | None = None,
    cache_system: bool | None = None,
) -> CoachTextResult:
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    use_model = _resolve_anthropic_model(model)
    temp = temperature if temperature is not None else settings.llm_temperature
    max_tok = max_tokens if max_tokens is not None else settings.llm_max_tokens
    use_cache = _use_prompt_cache(cache_system)
    system_field = _anthropic_system_field(system, cache=use_cache)

    anthropic_messages = [
        {"role": _to_anthropic_role(m.get("role", "user")), "content": m.get("content", "")}
        for m in messages
        if m.get("content")
    ]

    payload = {
        "model": use_model,
        "max_tokens": max_tok,
        "temperature": temp,
        "system": system_field,
        "messages": anthropic_messages,
    }

    timeout = settings.plan_timeout_seconds if max_tok > 2000 else settings.llm_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=_anthropic_headers(api_key=api_key, prompt_cache=use_cache),
            json=payload,
        )

    if res.status_code >= 400:
        logger.warning("Anthropic error %s: %s", res.status_code, res.text[:300])
        raise RuntimeError(f"Anthropic {res.status_code}: {res.text[:300]}")

    data = res.json()
    text = ""
    for block in data.get("content") or []:
        if block.get("type") == "text":
            text = str(block.get("text") or "")
            break
    return CoachTextResult(text=text, stop_reason=str(data.get("stop_reason") or ""))


async def complete_coach_chat(
    *,
    system: str,
    messages: list[dict[str, str]],
    temperature: float | None = None,
    max_tokens: int | None = None,
    model: str | None = None,
    cache_system: bool | None = None,
) -> str:
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    use_model = _resolve_anthropic_model(model)
    temp = temperature if temperature is not None else settings.llm_temperature
    max_tok = max_tokens if max_tokens is not None else settings.llm_max_tokens
    use_cache = _use_prompt_cache(cache_system)
    system_field = _anthropic_system_field(system, cache=use_cache)

    anthropic_messages = [
        {"role": _to_anthropic_role(m.get("role", "user")), "content": m.get("content", "")}
        for m in messages
        if m.get("content")
    ]

    payload = {
        "model": use_model,
        "max_tokens": max_tok,
        "temperature": temp,
        "system": system_field,
        "messages": anthropic_messages,
    }

    timeout = settings.plan_timeout_seconds if max_tok > 2000 else settings.llm_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=_anthropic_headers(api_key=api_key, prompt_cache=use_cache),
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


@dataclass
class CoachLlmResult:
    text: str = ""
    tool_uses: list[dict[str, Any]] = field(default_factory=list)
    stop_reason: str = "end_turn"
    raw_assistant_content: list[dict[str, Any]] = field(default_factory=list)


def _normalize_messages_for_anthropic(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for m in messages:
        role = _to_anthropic_role(str(m.get("role", "user")))
        content = m.get("content")
        if isinstance(content, list):
            out.append({"role": role, "content": content})
        elif content:
            out.append({"role": role, "content": str(content)})
    return out


async def complete_coach_with_tools(
    *,
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    model: str | None = None,
    cache_system: bool | None = None,
) -> CoachLlmResult:
    """Claude coach turn with optional tool_use blocks."""
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    use_model = _resolve_anthropic_model(model)
    temp = temperature if temperature is not None else settings.llm_temperature
    max_tok = max_tokens if max_tokens is not None else settings.llm_max_tokens
    use_cache = _use_prompt_cache(cache_system)
    system_field = _anthropic_system_field(system, cache=use_cache)

    payload: dict[str, Any] = {
        "model": use_model,
        "max_tokens": max_tok,
        "temperature": temp,
        "system": system_field,
        "messages": _normalize_messages_for_anthropic(messages),
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = {"type": "auto"}

    timeout = settings.plan_timeout_seconds if max_tok > 2000 else settings.llm_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers=_anthropic_headers(api_key=api_key, prompt_cache=use_cache),
            json=payload,
        )

    if res.status_code >= 400:
        logger.warning("Anthropic error %s: %s", res.status_code, res.text[:300])
        raise RuntimeError(f"Anthropic {res.status_code}: {res.text[:300]}")

    data = res.json()
    text_parts: list[str] = []
    tool_uses: list[dict[str, Any]] = []
    raw_blocks: list[dict[str, Any]] = []
    for block in data.get("content") or []:
        raw_blocks.append(block)
        if block.get("type") == "text":
            text_parts.append(str(block.get("text") or ""))
        elif block.get("type") == "tool_use":
            tool_uses.append(
                {
                    "id": block.get("id"),
                    "name": block.get("name"),
                    "input": block.get("input") if isinstance(block.get("input"), dict) else {},
                }
            )

    return CoachLlmResult(
        text="\n".join(text_parts).strip(),
        tool_uses=tool_uses,
        stop_reason=str(data.get("stop_reason") or "end_turn"),
        raw_assistant_content=raw_blocks,
    )


async def complete_coach_with_tools_stream(
    *,
    system: str,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None = None,
    temperature: float | None = None,
    max_tokens: int | None = None,
    on_token: Callable[[str], Awaitable[None]] | None = None,
    model: str | None = None,
    cache_system: bool | None = None,
) -> CoachLlmResult:
    """Claude coach turn with Anthropic streaming (text deltas via on_token)."""
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    use_model = _resolve_anthropic_model(model)
    temp = temperature if temperature is not None else settings.llm_temperature
    max_tok = max_tokens if max_tokens is not None else settings.llm_max_tokens
    use_cache = _use_prompt_cache(cache_system)
    system_field = _anthropic_system_field(system, cache=use_cache)

    payload: dict[str, Any] = {
        "model": use_model,
        "max_tokens": max_tok,
        "temperature": temp,
        "system": system_field,
        "messages": _normalize_messages_for_anthropic(messages),
        "stream": True,
    }
    if tools:
        payload["tools"] = tools
        payload["tool_choice"] = {"type": "auto"}

    timeout = settings.plan_timeout_seconds if max_tok > 2000 else settings.llm_timeout_seconds
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers=_anthropic_headers(api_key=api_key, prompt_cache=use_cache),
            json=payload,
        ) as res:
            if res.status_code >= 400:
                body = await res.aread()
                logger.warning("Anthropic stream error %s: %s", res.status_code, body[:300])
                raise RuntimeError(f"Anthropic {res.status_code}: {body[:300].decode(errors='ignore')}")

            raw_blocks, tool_uses, stop_reason, text_parts = await _parse_anthropic_stream(
                res, on_text=on_token
            )

    return CoachLlmResult(
        text="\n".join(text_parts).strip(),
        tool_uses=tool_uses,
        stop_reason=stop_reason,
        raw_assistant_content=raw_blocks,
    )


async def complete_coach_chat_stream(
    *,
    system: str,
    messages: list[dict[str, str]],
    temperature: float | None = None,
    max_tokens: int | None = None,
    on_token: Callable[[str], Awaitable[None]] | None = None,
    model: str | None = None,
    cache_system: bool | None = None,
) -> str:
    """Streaming variant of complete_coach_chat."""
    settings = get_settings()
    api_key = settings.anthropic_api_key
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not configured")

    use_model = _resolve_anthropic_model(model)
    temp = temperature if temperature is not None else settings.llm_temperature
    max_tok = max_tokens if max_tokens is not None else settings.llm_max_tokens
    use_cache = _use_prompt_cache(cache_system)
    system_field = _anthropic_system_field(system, cache=use_cache)

    anthropic_messages = [
        {"role": _to_anthropic_role(m.get("role", "user")), "content": m.get("content", "")}
        for m in messages
        if m.get("content")
    ]

    payload = {
        "model": use_model,
        "max_tokens": max_tok,
        "temperature": temp,
        "system": system_field,
        "messages": anthropic_messages,
        "stream": True,
    }

    timeout = settings.plan_timeout_seconds if max_tok > 2000 else settings.llm_timeout_seconds
    text_parts: list[str] = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            "https://api.anthropic.com/v1/messages",
            headers=_anthropic_headers(api_key=api_key, prompt_cache=use_cache),
            json=payload,
        ) as res:
            if res.status_code >= 400:
                body = await res.aread()
                raise RuntimeError(f"Anthropic {res.status_code}: {body[:300].decode(errors='ignore')}")

            _, _, _, text_parts = await _parse_anthropic_stream(res, on_text=on_token)

    return "\n".join(text_parts).strip()


def format_tool_results_message(tool_results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build Anthropic tool_result user message content blocks."""
    blocks: list[dict[str, Any]] = []
    for tr in tool_results:
        tool_use_id = tr.get("tool_use_id")
        if not tool_use_id:
            continue
        payload = {
            "success": tr.get("success"),
            "tool": tr.get("tool"),
            "output": tr.get("output"),
            "error": tr.get("error"),
        }
        blocks.append(
            {
                "type": "tool_result",
                "tool_use_id": tool_use_id,
                "content": json.dumps(payload, ensure_ascii=False)[:8000],
            }
        )
    return blocks

