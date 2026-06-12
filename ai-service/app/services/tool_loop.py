"""
Block E lite — action preview/execution helpers and no-LLM confirm routing.
Write detection uses the tool registry (CONFIRM_REQUIRED), not message regex.
"""

from __future__ import annotations

from typing import Any

from app.clients.node_internal import NodeInternalError, execute_tool
from app.services.cag_sanitize import sanitize_prompt_text

_TOOL_LABELS: dict[str, dict[str, str]] = {
    "log_food": {
        "en": "Log food",
        "ar": "تسجيل وجبة",
    },
    "replace_exercise_today": {
        "en": "Replace today's exercise",
        "ar": "استبدال تمرين اليوم",
    },
    "set_life_mode": {
        "en": "Set life mode",
        "ar": "تغيير وضع الحياة",
    },
    "adapt_plan": {
        "en": "Adapt plan",
        "ar": "تعديل الخطة",
    },
    "get_nutrition_today": {
        "en": "Today's nutrition",
        "ar": "تغذية اليوم",
    },
    "get_workout_today": {
        "en": "Today's workout",
        "ar": "تمرين اليوم",
    },
}


def build_action_preview(tool_names: list[str], user_message: str, *, locale: str = "en") -> str:
    lang = "ar" if locale == "ar" else "en"
    labels = [_TOOL_LABELS.get(name, {}).get(lang, name) for name in tool_names[:3]]
    action = " + ".join(labels) if labels else ("Action" if lang == "en" else "إجراء")
    detail = str(sanitize_prompt_text(user_message, "userMessage") or "").strip()
    if lang == "ar":
        return f"{action}: {detail}" if detail else action
    return f"{action}: {detail}" if detail else action


def step_up_idle_minutes() -> int:
    from app.agent.tools.step_up_config import step_up_idle_ms

    return max(1, step_up_idle_ms() // 60_000)


def step_up_phrase(*, locale: str = "en") -> str:
    return "تعديل" if locale == "ar" else "ADAPT"


def confirmation_eligible_for_step_up(tool_names: list[str]) -> bool:
    from app.agent.tools.registry import tool_requires_step_up

    return any(tool_requires_step_up(name) for name in tool_names)


def confirmation_requires_step_up(tool_names: list[str]) -> bool:
    """Alias — prompts mention step-up eligibility (actual gate is stale pending in Node)."""
    return confirmation_eligible_for_step_up(tool_names)


def confirmation_prompt(
    preview: str,
    *,
    locale: str = "en",
    step_up: bool = False,
    step_up_phrase_hint: str | None = None,
) -> str:
    phrase = step_up_phrase_hint or step_up_phrase(locale=locale)
    idle_min = max(1, step_up_idle_minutes())
    if locale == "ar":
        base = (
            f"سأنفّذ هذا الإجراء:\n\n**{preview}**\n\n"
            "اضغط «تأكيد» في التطبيق لتنفيذ الإجراء، أو «إلغاء» للتراجع."
        )
        if step_up:
            base += (
                f"\n\n**تأكيد إضافي:** إذا انتظرت أكثر من {idle_min} دقيقة قبل التأكيد، "
                f"ستحتاج لكتابة **{phrase}** أو إدخال كلمة المرور."
            )
        return base
    base = (
        f"I'll run this action:\n\n**{preview}**\n\n"
        "Tap **Confirm** in the app to run this safely, or **Cancel** to dismiss."
    )
    if step_up:
        base += (
            f"\n\n**Extra confirmation:** if this sits idle for more than {idle_min} minutes, "
            f"you'll need to type **{phrase}** or enter your password before confirming."
        )
    return base


def cancel_reply(*, locale: str = "en") -> str:
    if locale == "ar":
        return "تم الإلغاء — لم أنفّذ أي إجراء."
    return "Cancelled — no action was taken."


def execution_success_reply(
    tool_names: list[str],
    results: list[dict[str, Any]],
    *,
    locale: str = "en",
) -> str:
    ok = sum(1 for r in results if r.get("success"))
    if locale == "ar":
        if ok == len(results) and ok > 0:
            return f"تم التنفيذ بنجاح ({ok} {'أداة' if ok == 1 else 'أدوات'})."
        if ok > 0:
            return f"تم تنفيذ {ok} من {len(results)}. تحقق من لوحة التحكم."
        return "تعذّر تنفيذ الإجراء. حاول مرة أخرى أو عدّل الطلب."
    if ok == len(results) and ok > 0:
        return f"Done — {ok} action{'s' if ok != 1 else ''} completed successfully."
    if ok > 0:
        return f"Partially completed ({ok}/{len(results)}). Check your dashboard."
    return "Could not complete the action. Try again or rephrase your request."


def intent_requires_confirmation(intent: str, tool_hints: list[str]) -> bool:
    """No-LLM scaffold: route to fast_confirm when intent implies a write tool."""
    if not tool_hints:
        return False
    if intent == "execute_action":
        return True
    from app.agent.tools.registry import tool_requires_confirmation

    return any(tool_requires_confirmation(h) for h in tool_hints)


def tool_input_from_message(tool_name: str, user_message: str) -> dict[str, Any]:
    """Pass user text to Node resolvers (structured IDs resolved server-side)."""
    text = user_message.strip()
    base: dict[str, Any] = {"message": text}
    if tool_name == "log_food":
        base["rawText"] = text
    elif tool_name in ("replace_exercise_today", "adapt_plan"):
        base["request"] = text
    elif tool_name == "set_life_mode":
        base["message"] = text
        base["reason"] = text
    return base


def execute_pending_tools(
    *,
    user_id: str,
    tool_names: list[str],
    user_message: str,
    thread_id: str | None = None,
    inputs_by_tool: dict[str, dict[str, Any]] | None = None,
    max_tools: int = 5,
) -> list[dict[str, Any]]:
    """Execute an explicit pending tool list (no regex disambiguation)."""
    results: list[dict[str, Any]] = []
    for name in (tool_names or [])[:max_tools]:
        try:
            tool_input = inputs_by_tool.get(name) if inputs_by_tool and name in inputs_by_tool else None
            if not tool_input:
                tool_input = tool_input_from_message(name, user_message)
            output = execute_tool(
                user_id=user_id,
                tool_name=name,
                input=tool_input,
                thread_id=thread_id,
            )
            results.append({"tool": name, "success": True, "output": output})
        except NodeInternalError as exc:
            results.append({"tool": name, "success": False, "error": str(exc)})
    return results
