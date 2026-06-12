"""
Block E — Compound request planner: decompose multi-goal turns into ordered tool steps.

Example: "lose 5kg and I'm traveling next week" → read progress → set_life_mode → adapt_plan → update_fitness_goal.
Writes still require user confirmation via actionId; reads run as part of the confirmed plan bundle.
"""

from __future__ import annotations

import json
import logging
import re
from collections import deque
from typing import Any, Literal

from app.agent.tools.registry import (
    CONFIRM_REQUIRED,
    READ_TOOLS,
    is_chat_tool,
    tool_requires_confirmation,
)
from app.services.llm_chat import complete_coach_chat, format_context_bundle, is_llm_configured
from app.services.tool_extract import _parse_json_object

logger = logging.getLogger(__name__)

MAX_PLAN_STEPS = 5

StepType = Literal["read", "write"]

_COMPOUND_RE = re.compile(
    r"\b(and|also|plus|then|while|as well|both|next week|this week)\b"
    r"|(\+|،)"
    r"|(كمان|وبعدين|بالإضافة|الأسبوع الجاي|الأسبوع ده|و)",
    re.I,
)

_GOAL_RE = re.compile(
    r"\b(lose|gain|weight|travel|trip|ramadan|fasting|goal|adapt|swap|log)\b"
    r"|(خس|وزن|سفر|رمضان|صيام|هدف|بدّل|سجّل)",
    re.I,
)

_TOOL_LABELS: dict[str, dict[str, str]] = {
    "get_progress_summary": {"en": "Check progress", "ar": "مراجعة التقدم"},
    "get_macro_targets": {"en": "Check macro targets", "ar": "مراجعة أهداف الماكرو"},
    "get_nutrition_today": {"en": "Today's nutrition", "ar": "تغذية اليوم"},
    "get_workout_today": {"en": "Today's workout", "ar": "تمرين اليوم"},
    "set_life_mode": {"en": "Set life mode", "ar": "تغيير وضع الحياة"},
    "adapt_plan": {"en": "Adapt plan", "ar": "تعديل الخطة"},
    "update_fitness_goal": {"en": "Update fitness goal", "ar": "تحديث الهدف"},
    "log_food": {"en": "Log food", "ar": "تسجيل وجبة"},
    "replace_exercise_today": {"en": "Replace exercise", "ar": "استبدال تمرين"},
    "replace_meal_today": {"en": "Replace meal", "ar": "استبدال وجبة"},
    "skip_day": {"en": "Skip day", "ar": "تخطي يوم"},
}


def needs_compound_planner(message: str, tool_hints: list[str], intent: str) -> bool:
    """True when the turn likely needs upfront multi-step decomposition."""
    if intent in ("unclear", "general", "platform_help"):
        return False
    text = (message or "").strip()
    if len(text) < 12:
        return False

    write_hints = [h for h in tool_hints if tool_requires_confirmation(h)]
    if len(write_hints) >= 2:
        return True

    has_compound = bool(_COMPOUND_RE.search(text))
    has_goal = bool(_GOAL_RE.search(text))

    if has_compound and write_hints and has_goal:
        return True
    if has_compound and intent in ("execute_action", "life_mode", "personal_status") and len(text.split()) >= 6:
        return True
    return False


def _step_type(tool: str) -> StepType:
    return "read" if tool in READ_TOOLS or not tool_requires_confirmation(tool) else "write"


def _tool_label(tool: str, locale: str) -> str:
    lang = "ar" if locale == "ar" else "en"
    return _TOOL_LABELS.get(tool, {}).get(lang, tool)


def topological_sort_steps(steps: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    """Order steps by depends_on. Returns None when a cycle is detected."""
    if not steps:
        return []
    by_id = {s["id"]: s for s in steps if s.get("id")}
    if len(by_id) != len(steps):
        return None

    in_degree = {sid: 0 for sid in by_id}
    dependents: dict[str, list[str]] = {sid: [] for sid in by_id}
    for step in steps:
        sid = step["id"]
        for dep in step.get("depends_on") or []:
            if dep in by_id:
                in_degree[sid] += 1
                dependents[dep].append(sid)

    queue = deque([sid for sid, deg in in_degree.items() if deg == 0])
    ordered_ids: list[str] = []
    while queue:
        sid = queue.popleft()
        ordered_ids.append(sid)
        for child in dependents[sid]:
            in_degree[child] -= 1
            if in_degree[child] == 0:
                queue.append(child)

    if len(ordered_ids) != len(steps):
        return None
    return [by_id[sid] for sid in ordered_ids]


def validate_plan_steps(
    steps: list[dict[str, Any]],
    *,
    allowed_tools: set[str] | None = None,
) -> tuple[bool, list[str]]:
    from app.agent.tools.validate import validate_plan_step_inputs, validate_tool_input

    errors: list[str] = []
    if not steps:
        return False, ["empty_plan"]
    if len(steps) > MAX_PLAN_STEPS:
        return False, [f"too_many_steps:{len(steps)}"]

    ids: set[str] = set()
    write_tools: list[str] = []
    for step in steps:
        sid = step.get("id")
        tool = step.get("tool")
        if not sid or not tool:
            errors.append("missing_id_or_tool")
            continue
        if sid in ids:
            errors.append(f"duplicate_id:{sid}")
        ids.add(sid)
        if not is_chat_tool(tool):
            errors.append(f"tool_not_chat:{tool}")
        if allowed_tools is not None and tool not in allowed_tools:
            errors.append(f"tool_not_allowed:{tool}")
        st = step.get("step_type") or _step_type(tool)
        if st == "write" and tool not in CONFIRM_REQUIRED:
            errors.append(f"write_not_confirmable:{tool}")
        if st == "write":
            write_tools.append(tool)

        step_inputs = step.get("inputs") if isinstance(step.get("inputs"), dict) else {}
        if tool and st == "write":
            inp_ok, inp_errors = validate_plan_step_inputs(tool, step_inputs)
            if not inp_ok:
                for inp_err in inp_errors:
                    errors.append(f"invalid_inputs:{sid}:{inp_err}")
        elif tool and step_inputs:
            inp_ok, inp_errors = validate_tool_input(tool, step_inputs)
            if not inp_ok:
                for inp_err in inp_errors:
                    errors.append(f"invalid_inputs:{sid}:{inp_err}")

    for step in steps:
        for dep in step.get("depends_on") or []:
            if dep not in ids:
                errors.append(f"invalid_dep:{dep}")

    sorted_steps = topological_sort_steps(steps)
    if sorted_steps is None:
        errors.append("cycle_in_dependencies")

    if write_tools.count("set_life_mode") > 1:
        errors.append("duplicate_set_life_mode")

    return len(errors) == 0, errors


def _write_step_inputs(tool: str, user_message: str) -> dict[str, Any]:
    """Best-effort structured inputs for heuristic compound plans."""
    from app.agent.tools.registry import TOOL_BY_NAME
    from app.agent.tools.validate import MESSAGE_RESOLVER_TOOLS

    text = user_message.strip()
    if tool in MESSAGE_RESOLVER_TOOLS:
        payload: dict[str, Any] = {"message": text}
        if tool == "log_food":
            payload["rawText"] = text
        elif tool in ("replace_exercise_today", "adapt_plan"):
            payload["request"] = text
        elif tool == "set_life_mode":
            payload["reason"] = text
        return payload

    tool_def = TOOL_BY_NAME.get(tool) or {}
    schema = tool_def.get("input_schema") or {}
    properties = schema.get("properties") or {}
    required = schema.get("required") or []
    if len(required) == 1:
        field = required[0]
        field_schema = properties.get(field) or {}
        if field_schema.get("type") == "string" and text:
            return {field: text[:256]}
    return {}


def _heuristic_plan(
    tool_hints: list[str],
    user_message: str,
    locale: str,
) -> list[dict[str, Any]]:
    """Deterministic plan when LLM is unavailable."""
    writes = [h for h in tool_hints if tool_requires_confirmation(h)][:3]
    reads: list[str] = []

    if any(t in writes for t in ("update_fitness_goal", "adapt_plan", "record_body_metric")):
        reads.append("get_progress_summary")
    if "adapt_plan" in writes or "set_life_mode" in writes:
        if "get_macro_targets" not in reads:
            reads.append("get_macro_targets")
    for h in tool_hints:
        if h in READ_TOOLS and h not in reads:
            reads.append(h)

    steps: list[dict[str, Any]] = []
    prev_id: str | None = None
    idx = 1

    for tool in reads[:2]:
        sid = f"step_{idx}"
        steps.append(
            {
                "id": sid,
                "tool": tool,
                "step_type": "read",
                "depends_on": [prev_id] if prev_id else [],
                "inputs": {},
                "rationale": _tool_label(tool, locale),
            }
        )
        prev_id = sid
        idx += 1

    for tool in writes:
        sid = f"step_{idx}"
        steps.append(
            {
                "id": sid,
                "tool": tool,
                "step_type": "write",
                "depends_on": [prev_id] if prev_id else [],
                "inputs": _write_step_inputs(tool, user_message),
                "rationale": _tool_label(tool, locale),
            }
        )
        prev_id = sid
        idx += 1

    return steps[:MAX_PLAN_STEPS]


def _plan_prompt(
    *,
    user_message: str,
    tool_hints: list[str],
    locale: str,
    context_text: str,
    rag_context: str,
) -> str:
    hints = ", ".join(tool_hints) if tool_hints else "(infer from message)"
    lang = "User may write Egyptian Arabic or English." if locale == "ar" else ""
    return f"""Decompose the athlete's compound request into an ordered multi-step plan. {lang}

USER MESSAGE:
{user_message}

SUGGESTED TOOLS (pick from these when possible): {hints}

CONTEXT:
{context_text[:4000] or "(none)"}

KNOWLEDGE:
{rag_context[:2000] or "(none)"}

Return ONLY JSON:
{{
  "steps": [
    {{
      "id": "step_1",
      "tool": "get_progress_summary",
      "step_type": "read",
      "depends_on": [],
      "inputs": {{}},
      "rationale": "short reason"
    }},
    {{
      "id": "step_2",
      "tool": "set_life_mode",
      "step_type": "write",
      "depends_on": ["step_1"],
      "inputs": {{ "lifeMode": "travel", "message": "..." }},
      "rationale": "short reason"
    }}
  ]
}}

Rules:
- Max {MAX_PLAN_STEPS} steps.
- Put read tools (get_progress_summary, get_macro_targets, get_nutrition_today, get_workout_today) BEFORE writes when baseline data helps.
- step_type "read" for lookup tools; "write" for mutations (log_food, set_life_mode, adapt_plan, update_fitness_goal, replace_exercise_today, etc.).
- depends_on lists step ids that must run first (usually prior step only).
- Do not invent UUIDs. Use lifeMode enum: normal|travel|sick|fasting|injury_flare.
- Order writes logically (e.g. set_life_mode before adapt_plan for travel)."""


async def generate_compound_plan(
    *,
    user_message: str,
    tool_hints: list[str],
    locale: str = "en",
    context_bundle: dict[str, Any] | None = None,
    rag_context: str = "",
) -> list[dict[str, Any]]:
    hints = [h for h in tool_hints if is_chat_tool(h)]
    if not is_llm_configured():
        return _heuristic_plan(hints, user_message, locale)

    context_text = format_context_bundle(context_bundle or {})
    system = "You plan safe fitness-app tool sequences. Output valid JSON only."
    prompt = _plan_prompt(
        user_message=user_message,
        tool_hints=hints,
        locale=locale,
        context_text=context_text,
        rag_context=rag_context,
    )
    try:
        raw = await complete_coach_chat(
            system=system,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1200,
        )
        parsed = _parse_json_object(raw)
        steps_raw = parsed.get("steps") if parsed else None
        if not isinstance(steps_raw, list) or not steps_raw:
            return _heuristic_plan(hints, user_message, locale)

        steps: list[dict[str, Any]] = []
        for i, item in enumerate(steps_raw[:MAX_PLAN_STEPS]):
            if not isinstance(item, dict):
                continue
            tool = str(item.get("tool") or "").strip()
            if not tool or not is_chat_tool(tool):
                continue
            sid = str(item.get("id") or f"step_{i + 1}")
            st: StepType = item.get("step_type") or _step_type(tool)
            if st == "write" and not tool_requires_confirmation(tool):
                st = "read"
            deps = [str(d) for d in (item.get("depends_on") or []) if d]
            inputs = item.get("inputs") if isinstance(item.get("inputs"), dict) else {}
            steps.append(
                {
                    "id": sid,
                    "tool": tool,
                    "step_type": st,
                    "depends_on": deps,
                    "inputs": inputs,
                    "rationale": str(item.get("rationale") or _tool_label(tool, locale)),
                }
            )
        if steps:
            return steps
    except Exception as exc:
        logger.warning("compound plan LLM failed: %s", exc)

    return _heuristic_plan(hints, user_message, locale)


def merge_plan_inputs(
    steps: list[dict[str, Any]],
    inputs_by_tool: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Merge extracted inputs into plan steps (step inputs take precedence)."""
    merged = dict(inputs_by_tool)
    for step in steps:
        tool = step.get("tool")
        if not tool:
            continue
        step_inputs = step.get("inputs") if isinstance(step.get("inputs"), dict) else {}
        merged[tool] = {**(merged.get(tool) or {}), **step_inputs}
    return merged


def format_plan_preview(steps: list[dict[str, Any]], *, locale: str = "en") -> str:
    lang = "ar" if locale == "ar" else "en"
    ordered = topological_sort_steps(steps) or list(steps)
    lines: list[str] = []
    for i, step in enumerate(ordered, 1):
        tool = step.get("tool") or "?"
        label = _tool_label(tool, lang)
        rationale = (step.get("rationale") or "").strip()
        prefix = "📖" if step.get("step_type") == "read" else "✏️"
        line = f"{i}. {prefix} {label}"
        if rationale and rationale != label:
            line += f" — {rationale}"
        lines.append(line)
    header = "خطة الإجراءات:" if lang == "ar" else "Action plan:"
    return header + "\n" + "\n".join(lines)


def plan_confirmation_reply(preview: str, *, locale: str = "en", step_up: bool = False) -> str:
    from app.services.tool_loop import step_up_idle_minutes, step_up_phrase

    phrase = step_up_phrase(locale=locale)
    idle_min = step_up_idle_minutes()
    if locale == "ar":
        base = (
            f"جهّزت خطة متعددة الخطوات:\n\n{preview}\n\n"
            "اضغط «تأكيد» في التطبيق لتنفيذ الخطة بالترتيب، أو «إلغاء» للتراجع."
        )
        if step_up:
            base += (
                f"\n\n**تأكيد إضافي:** إذا انتظرت أكثر من {idle_min} دقيقة، "
                f"اكتب **{phrase}** أو أدخل كلمة المرور قبل التأكيد."
            )
        return base
    base = (
        f"I prepared a multi-step plan:\n\n{preview}\n\n"
        "Tap **Confirm** in the app to run these steps in order, or **Cancel** to dismiss."
    )
    if step_up:
        base += (
            f"\n\n**Extra confirmation:** if this sits idle for more than {idle_min} minutes, "
            f"type **{phrase}** or enter your password before confirming."
        )
    return base


def plan_steps_to_tool_calls(
    steps: list[dict[str, Any]],
    inputs_by_tool: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    ordered = topological_sort_steps(steps) or list(steps)
    out: list[dict[str, Any]] = []
    for step in ordered:
        tool = step.get("tool")
        if not tool:
            continue
        out.append(
            {
                "name": tool,
                "input": dict(inputs_by_tool.get(tool) or step.get("inputs") or {}),
                "stepId": step.get("id"),
                "stepType": step.get("step_type"),
            }
        )
    return out


def ordered_tool_names(steps: list[dict[str, Any]]) -> list[str]:
    ordered = topological_sort_steps(steps) or list(steps)
    return [s["tool"] for s in ordered if s.get("tool")]


def execute_plan_steps(
    *,
    user_id: str,
    plan_steps: list[dict[str, Any]],
    user_message: str,
    thread_id: str | None = None,
    inputs_by_tool: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Execute plan steps in dependency order; stop on first failure."""
    from app.clients.node_internal import NodeInternalError, execute_tool

    merged = merge_plan_inputs(plan_steps, dict(inputs_by_tool or {}))
    ordered = topological_sort_steps(plan_steps) or list(plan_steps)
    results: list[dict[str, Any]] = []

    for step in ordered[:MAX_PLAN_STEPS]:
        tool = step.get("tool")
        if not tool:
            continue
        payload = dict(merged.get(tool) or step.get("inputs") or {})
        if user_message and "message" not in payload:
            payload["message"] = user_message
        try:
            out = execute_tool(
                user_id=user_id,
                tool_name=tool,
                input=payload,
                thread_id=thread_id,
            )
            results.append(
                {
                    "tool": tool,
                    "stepId": step.get("id"),
                    "success": True,
                    "output": out.get("output") if isinstance(out, dict) else out,
                }
            )
        except NodeInternalError as exc:
            results.append(
                {
                    "tool": tool,
                    "stepId": step.get("id"),
                    "success": False,
                    "error": str(exc),
                }
            )
            break

    return results
