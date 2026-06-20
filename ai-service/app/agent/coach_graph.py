"""
Taqwin coach pipeline (LangGraph orchestration) — safety → intent → RAG → tool loop → confirm.

Compound turns (e.g. lose weight + travel): planner node decomposes into ordered steps → confirm → execute.
Normal Q&A uses bounded read-tool loops (default 2, max 5). Writes require actionId confirmation.
"""

from __future__ import annotations

import logging
import re
import time
import uuid
from typing import Any, Literal

from app.agent.graph import run_tool_agent_graph
from app.agent.state import CoachGraphState
from app.agent.tools.registry import (
    anthropic_tools_for_llm,
    shipped_tool_hints,
    tool_requires_confirmation,
    tools_for_intent,
)
from app.config import get_settings
from app.intent.greetings import build_greeting_reply
from app.intent.router import IntentResult, route_intent
from app.prompts.coach_system import build_coach_system_prompt
from app.rag.retriever import format_rag_context, retrieve_rag
from app.services.chat_observability import (
    build_turn_trace_payload,
    summarize_cag,
    summarize_llm_call,
    summarize_rag_hits,
)
from app.services.llm_chat import (
    CoachLlmResult,
    complete_coach_chat,
    complete_coach_chat_stream,
    complete_coach_with_tools,
    complete_coach_with_tools_stream,
    _emit_stream_token,
    format_context_bundle,
    format_tool_results_message,
    is_llm_configured,
)
from app.services.tool_extract import extract_tool_inputs, select_action_tools
from app.services.tool_loop import (
    build_action_preview,
    cancel_reply,
    confirmation_prompt,
    confirmation_requires_step_up,
    execution_success_reply,
    intent_requires_confirmation,
)
from app.services.compound_planner import (
    execute_plan_steps,
    format_plan_preview,
    generate_compound_plan,
    merge_plan_inputs,
    needs_compound_planner,
    plan_confirmation_reply,
    plan_steps_to_tool_calls,
    validate_plan_steps,
)
from app.services.turn_classify import classify_turn

logger = logging.getLogger(__name__)

def _max_tool_loops() -> int:
    loops = int(get_settings().coach_max_tool_loops or 2)
    return max(1, min(5, loops))


def _history_limit() -> int:
    limit = int(get_settings().coach_history_max_messages or 10)
    return max(4, min(30, limit))

_MEDICAL_PAIN_RE = re.compile(
    r"\b(chest pain|heart attack|pregnant|pregnancy|diagnos|prescri|steroid|emergency)\b"
    r"|(ألم صدر|نوبة قلب|حامل|حمل|تشخيص|وصفة طبية|ستيرويد|طوارئ)",
    re.I,
)


def _trace(state: CoachGraphState, node: str, **extra: Any) -> list[dict[str, Any]]:
    trace = list(state.get("nodes_trace") or [])
    trace.append({"node": node, **extra})
    return trace


def _check_safety_message(text: str, *, locale: str) -> str | None:
    if not _MEDICAL_PAIN_RE.search(text or ""):
        return None
    if locale == "ar":
        return (
            "لو في ألم حاد أو حالة طبية، تواصل مع دكتور أو مختص تغذية مسجّل فوراً. "
            "أقدر أساعدك في تخفيف الحمل التدريبي أو تعديل الخطة بأمان بعد ما تستقر."
        )
    return (
        "If you have acute pain or a medical condition, contact a doctor or registered "
        "dietitian right away. I can help lighten training load or adjust your plan safely "
        "once you're cleared."
    )


def _clarify_reply(locale: str) -> str:
    if locale == "ar":
        return (
            "محتاج أوضح شوية — تقصد تغذية (أكل/سعرات)، تمرين، مساعدة في التطبيق، "
            "ولا حاجة تانية؟ اكتب سؤالك بجملة أوضح."
        )
    return (
        "I need a bit more detail — are you asking about nutrition, workouts, "
        "the Taqwin app, or something else? Please rephrase in one clear sentence."
    )


def _scaffold_reply(
    *,
    user_message: str,
    intent: str,
    source: str,
    confidence: float,
    rag_context: str,
    locale: str,
) -> str:
    lines: list[str] = []
    if locale == "ar":
        lines.append("المدرب الذكي في تكوين (وضع تجريبي — ضع ANTHROPIC_API_KEY لتفعيل Claude).")
    else:
        lines.append("Taqwin AI coach (scaffold — set ANTHROPIC_API_KEY for Claude).")
    lines.append(f"Intent: {intent} ({source}, conf={confidence:.2f})")
    if rag_context:
        if locale == "ar":
            lines.append("\n**مقتطفات من قاعدة المعرفة:**")
        else:
            lines.append("\n**Knowledge retrieved:**")
        for block_line in rag_context.split("\n"):
            if block_line.startswith("- ") and "(score" in block_line:
                lines.append(block_line.lstrip("- ").strip())
    lines.append(f"\nYour message: {user_message}")
    return "\n".join(lines)


def _routing_from_state(state: CoachGraphState) -> IntentResult:
    return IntentResult(
        intent=state.get("intent") or "general",
        source=state.get("routing_source") or "fallback",
        confidence=float(state.get("routing_confidence") or 0.4),
        levels=list(state.get("rag_levels") or []),
        needs_rag=bool(state.get("needs_rag")),
        needs_clarify=bool(state.get("needs_clarify")),
        tool_hints=list(state.get("tool_hints") or []),
    )


def _messages_for_llm(state: CoachGraphState) -> list[dict[str, Any]]:
    if state.get("llm_messages"):
        return list(state["llm_messages"])
    return [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in (state.get("messages") or [])
        if m.get("content")
    ][-_history_limit():]


async def _safety_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    msg = state.get("user_message") or ""
    safety = _check_safety_message(msg, locale=locale)
    if safety:
        return {
            **state,
            "reply": safety,
            "intent": "general",
            "blocked_by_safety": True,
            "nodes_trace": _trace(state, "safety_guard", blocked=True),
        }
    return {**state, "blocked_by_safety": False, "nodes_trace": _trace(state, "safety_guard")}


async def _handle_pending_node(state: CoachGraphState) -> CoachGraphState:
    pending = state.get("pending_action")
    if not pending or state.get("resume_mode"):
        return {**state, "nodes_trace": _trace(state, "handle_pending", skipped=True)}
    locale = state.get("locale") or "en"
    from app.services.cag_sanitize import sanitize_pending_preview

    turn = await classify_turn(
        state.get("user_message") or "",
        locale=locale,
        pending_preview=sanitize_pending_preview(pending.get("preview")),
    )
    if turn == "cancel":
        return {
            **state,
            "reply": cancel_reply(locale=locale),
            "intent": "execute_action",
            "pending_cancelled": True,
            "nodes_trace": _trace(state, "handle_pending", turn="cancel"),
        }
    if turn == "confirm":
        hint = (
            "تمام — استخدم زر «تأكيد» في التطبيق، أو أرسل طلب التأكيد من العميل مع actionId."
            if locale == "ar"
            else "Got it — use the Confirm button in the app to run this action safely."
        )
        return {
            **state,
            "reply": hint,
            "intent": "execute_action",
            "nodes_trace": _trace(state, "handle_pending", turn="confirm_hint"),
        }
    return {**state, "nodes_trace": _trace(state, "handle_pending", turn=turn)}


async def _intent_node(state: CoachGraphState) -> CoachGraphState:
    if state.get("resume_mode"):
        return {**state, "nodes_trace": _trace(state, "intent_route", resume=True)}
    locale = state.get("locale") or "en"
    routing = route_intent(state.get("user_message") or "", locale=locale)
    hints = list(shipped_tool_hints(list(routing.tool_hints)))
    use_planner = needs_compound_planner(state.get("user_message") or "", hints, routing.intent)
    return {
        **state,
        "intent": routing.intent,
        "routing_source": routing.source,
        "routing_confidence": routing.confidence,
        "needs_clarify": routing.needs_clarify,
        "needs_rag": routing.needs_rag,
        "rag_levels": list(routing.levels),
        "tool_hints": hints,
        "use_planner": use_planner,
        "nodes_trace": _trace(
            state,
            "intent_route",
            intent=routing.intent,
            source=routing.source,
            use_planner=use_planner,
        ),
    }


async def _clarify_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    return {
        **state,
        "reply": _clarify_reply(locale),
        "nodes_trace": _trace(state, "clarify_reply"),
    }


def _display_name_from_bundle(bundle: dict[str, Any] | None) -> str | None:
    profile = (bundle or {}).get("profile") or {}
    name = profile.get("displayName") or profile.get("display_name")
    if isinstance(name, str) and name.strip():
        return name.strip()
    return None


async def _greeting_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    reply = build_greeting_reply(
        locale=locale,
        display_name=_display_name_from_bundle(state.get("context_bundle")),
    )
    return {
        **state,
        "reply": reply,
        "intent": "greeting",
        "nodes_trace": _trace(state, "greeting_reply"),
    }


async def _fast_confirm_node(state: CoachGraphState) -> CoachGraphState:
    """LLM tool selection + extraction when intent implies a write action."""
    locale = state.get("locale") or "en"
    routing = _routing_from_state(state)
    hints = list(shipped_tool_hints(list(routing.tool_hints)))
    action_tools = await select_action_tools(
        tool_hints=hints,
        user_message=state.get("user_message") or "",
        locale=locale,
    )
    if not action_tools:
        return {
            **state,
            "reply": _clarify_reply(locale),
            "intent": routing.intent,
            "nodes_trace": _trace(state, "fast_confirm", empty=True),
        }
    inputs_by_tool = await extract_tool_inputs(
        tool_names=action_tools,
        user_message=state.get("user_message") or "",
        context_bundle=state.get("context_bundle"),
        locale=locale,
    )
    preview = build_action_preview(action_tools, state.get("user_message") or "", locale=locale)
    step_up = confirmation_requires_step_up(action_tools)
    tool_calls_out = [
        {"name": name, "input": inputs_by_tool.get(name, {})} for name in action_tools[:3]
    ]
    return {
        **state,
        "reply": confirmation_prompt(preview, locale=locale, step_up=step_up),
        "intent": routing.intent,
        "confirmation_required": True,
        "confirmation_preview": preview,
        "source_user_message": state.get("user_message"),
        "inputs_by_tool": inputs_by_tool,
        "pending_tool_calls": [{"name": n, "input": inputs_by_tool.get(n, {})} for n in action_tools],
        "tool_calls_out": tool_calls_out,
        "nodes_trace": _trace(state, "fast_confirm", tools=action_tools),
    }


async def _plan_compound_node(state: CoachGraphState) -> CoachGraphState:
    """Decompose compound requests into ordered read/write steps."""
    locale = state.get("locale") or "en"
    routing = _routing_from_state(state)
    msg = state.get("user_message") or ""
    hints = list(state.get("tool_hints") or [])

    steps = await generate_compound_plan(
        user_message=msg,
        tool_hints=hints,
        locale=locale,
        context_bundle=state.get("context_bundle"),
        rag_context=state.get("rag_context") or "",
    )
    allowed = {t["name"] for t in tools_for_intent(routing.intent)}
    allowed.update(hints)
    valid, errors = validate_plan_steps(steps, allowed_tools=allowed)
    if not valid:
        logger.warning("compound plan invalid: %s", errors)
        return {
            **(await _fast_confirm_node(state)),
            "use_planner": False,
            "nodes_trace": _trace(state, "plan_compound", fallback="fast_confirm", errors=errors),
        }

    write_tools = [s["tool"] for s in steps if s.get("step_type") == "write"]
    inputs_by_tool = await extract_tool_inputs(
        tool_names=write_tools,
        user_message=msg,
        context_bundle=state.get("context_bundle"),
        locale=locale,
    )
    inputs_by_tool = merge_plan_inputs(steps, inputs_by_tool)
    preview = format_plan_preview(steps, locale=locale)
    step_up = confirmation_requires_step_up(write_tools)
    tool_calls_out = plan_steps_to_tool_calls(steps, inputs_by_tool)

    return {
        **state,
        "reply": plan_confirmation_reply(preview, locale=locale, step_up=step_up),
        "intent": routing.intent,
        "plan_steps": steps,
        "confirmation_required": True,
        "confirmation_preview": preview,
        "source_user_message": msg,
        "inputs_by_tool": inputs_by_tool,
        "tool_calls_out": tool_calls_out,
        "nodes_trace": _trace(state, "plan_compound", steps=len(steps), writes=len(write_tools)),
    }


async def _retrieve_rag_node(state: CoachGraphState) -> CoachGraphState:
    routing = _routing_from_state(state)
    locale = state.get("locale") or "en"
    rag_context = ""
    rag_obs: dict[str, Any] = {"hitCount": 0, "levels": [], "hits": []}
    rag_hits: list = []
    try:
        _intent, _levels, hits, stats = retrieve_rag(
            query=state.get("user_message") or "",
            locale=locale,
            routing=routing,
            context_bundle=state.get("context_bundle"),
        )
        rag_hits = hits
        rag_obs = summarize_rag_hits(
            hits,
            query=state.get("user_message") or "",
            retrieval_ms=stats.retrieval_ms,
            rerank_lift_avg=stats.rerank_lift_avg,
            purpose=stats.purpose,
        )
        rag_context = format_rag_context(hits, locale=locale)
    except Exception as exc:
        logger.warning("RAG retrieve failed: %s", exc)
        rag_context = ""
    return {
        **state,
        "rag_context": rag_context,
        "rag_hits": rag_hits,
        "rag_obs": rag_obs,
        "nodes_trace": _trace(
            state,
            "retrieve_rag",
            chars=len(rag_context),
            hitCount=rag_obs.get("hitCount", 0),
        ),
    }


async def _build_prompt_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    bundle = state.get("context_bundle") or {}
    user_context = format_context_bundle(bundle)
    system = build_coach_system_prompt(
        user_context=user_context,
        rag_context=state.get("rag_context") or "",
        locale=locale,
    )
    intent = state.get("intent") or "general"
    allowed = tools_for_intent(intent)
    llm_messages = _messages_for_llm(state)
    return {
        **state,
        "system_prompt": system,
        "allowed_tool_names": [t["name"] for t in allowed],
        "llm_messages": llm_messages,
        "loop_count": int(state.get("loop_count") or 0),
        "cag_obs": summarize_cag(bundle),
        "nodes_trace": _trace(state, "build_prompt", tools=len(allowed)),
    }


async def _coach_llm_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    intent = state.get("intent") or "general"
    routing = _routing_from_state(state)
    system = state.get("system_prompt") or ""
    llm_messages = list(state.get("llm_messages") or _messages_for_llm(state))
    model = get_settings().anthropic_model

    if not is_llm_configured():
        reply = _scaffold_reply(
            user_message=state.get("user_message") or "",
            intent=intent,
            source=routing.source,
            confidence=routing.confidence,
            rag_context=state.get("rag_context") or "",
            locale=locale,
        )
        return {
            **state,
            "reply": reply,
            "llm_obs": summarize_llm_call(
                model=None,
                system=system,
                messages=llm_messages,
                output_text=reply,
                latency_ms=0,
                scaffold=True,
            ),
            "nodes_trace": _trace(state, "coach_llm", scaffold=True),
        }

    intent_tools = tools_for_intent(intent)
    anthropic_tools = anthropic_tools_for_llm(intent_tools)
    llm_started = time.perf_counter()
    use_stream = bool(state.get("enable_llm_stream"))
    tokens_emitted = bool(state.get("stream_tokens_emitted"))
    try:
        if use_stream:
            result: CoachLlmResult = await complete_coach_with_tools_stream(
                system=system,
                messages=llm_messages,
                tools=anthropic_tools,
                on_token=_emit_stream_token,
            )
            if result.text:
                tokens_emitted = True
        else:
            result = await complete_coach_with_tools(
                system=system,
                messages=llm_messages,
                tools=anthropic_tools,
            )
    except Exception as exc:
        logger.warning("coach LLM failed: %s", exc)
        reply = _scaffold_reply(
            user_message=state.get("user_message") or "",
            intent=intent,
            source=routing.source,
            confidence=routing.confidence,
            rag_context=state.get("rag_context") or "",
            locale=locale,
        )
        latency_ms = int((time.perf_counter() - llm_started) * 1000)
        return {
            **state,
            "reply": reply,
            "error": str(exc),
            "llm_obs": summarize_llm_call(
                model=model,
                system=system,
                messages=llm_messages,
                output_text=reply,
                latency_ms=latency_ms,
                scaffold=True,
            ),
            "nodes_trace": _trace(state, "coach_llm", error=True),
        }

    latency_ms = int((time.perf_counter() - llm_started) * 1000)
    if result.raw_assistant_content:
        llm_messages.append({"role": "assistant", "content": result.raw_assistant_content})

    reply = result.text or ""
    rag_hits = state.get("rag_hits") or []
    if rag_hits and reply:
        from app.rag.citations import validate_citations

        cite_stats = validate_citations(reply, rag_hits)
        rag_obs = dict(state.get("rag_obs") or {})
        rag_obs["citations"] = cite_stats

    out_state = {
        **state,
        "reply": reply,
        "pending_tool_calls": result.tool_uses,
        "llm_messages": llm_messages,
        "loop_count": int(state.get("loop_count") or 0) + (1 if result.tool_uses else 0),
        "stream_tokens_emitted": tokens_emitted,
        "llm_obs": summarize_llm_call(
            model=model,
            system=system,
            messages=llm_messages[:-1] if result.raw_assistant_content else llm_messages,
            output_text=reply,
            latency_ms=latency_ms,
            stop_reason=result.stop_reason,
        ),
        "nodes_trace": _trace(
            state,
            "coach_llm",
            tool_calls=len(result.tool_uses),
            stop=result.stop_reason,
        ),
    }
    if rag_hits and reply:
        out_state["rag_obs"] = rag_obs
    return out_state


async def _execute_tools_node(state: CoachGraphState) -> CoachGraphState:
    from app.clients.node_internal import NodeInternalError, execute_tool

    user_id = state["user_id"]
    thread_id = state.get("thread_id")
    locale = state.get("locale") or "en"
    tool_calls = state.get("pending_tool_calls") or []
    if state.get("resume_mode"):
        tools = state.get("tools_to_execute") or []
        inputs = state.get("inputs_by_tool") or {}
        tool_calls = [{"name": n, "input": inputs.get(n, {}), "id": f"resume-{n}"} for n in tools]

    results: list[dict[str, Any]] = list(state.get("tool_results") or [])
    llm_messages = list(state.get("llm_messages") or [])

    for tc in tool_calls[:5]:
        name = tc.get("name")
        if not name:
            continue
        tool_input = tc.get("input") if isinstance(tc.get("input"), dict) else {}
        if state.get("user_message") and "message" not in tool_input:
            tool_input = {**tool_input, "message": state["user_message"]}
        try:
            out = execute_tool(
                user_id=user_id,
                tool_name=name,
                input=tool_input,
                thread_id=thread_id,
            )
            results.append(
                {
                    "tool": name,
                    "tool_use_id": tc.get("id"),
                    "success": True,
                    "output": out.get("output") if isinstance(out, dict) else out,
                }
            )
        except NodeInternalError as exc:
            results.append(
                {
                    "tool": name,
                    "tool_use_id": tc.get("id"),
                    "success": False,
                    "error": str(exc),
                }
            )

    if tool_calls and not state.get("resume_mode"):
        result_blocks = format_tool_results_message(
            [r for r in results if r.get("tool_use_id")][-len(tool_calls) :]
        )
        if result_blocks:
            llm_messages.append({"role": "user", "content": result_blocks})

    return {
        **state,
        "tool_results": results,
        "pending_tool_calls": [],
        "llm_messages": llm_messages,
        "nodes_trace": _trace(state, "execute_tools", count=len(tool_calls), resume=state.get("resume_mode")),
    }


async def _prepare_confirmation_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    tool_calls = state.get("pending_tool_calls") or []
    names = [tc.get("name") for tc in tool_calls if tc.get("name")]
    inputs_by_tool: dict[str, dict[str, Any]] = {}
    for tc in tool_calls:
        name = tc.get("name")
        if name:
            inputs_by_tool[name] = dict(tc.get("input") or {})
    if not inputs_by_tool:
        inputs_by_tool = await extract_tool_inputs(
            tool_names=names,
            user_message=state.get("user_message") or "",
            context_bundle=state.get("context_bundle"),
            locale=locale,
        )
    preview = build_action_preview(names, state.get("user_message") or "", locale=locale)
    step_up = confirmation_requires_step_up(names)
    reply = state.get("reply") or ""
    if not reply.strip():
        reply = confirmation_prompt(preview, locale=locale, step_up=step_up)
    tool_calls_out = [{"name": n, "input": inputs_by_tool.get(n, {})} for n in names[:5]]
    return {
        **state,
        "reply": reply,
        "confirmation_required": True,
        "confirmation_preview": preview,
        "source_user_message": state.get("user_message"),
        "inputs_by_tool": inputs_by_tool,
        "tool_calls_out": tool_calls_out,
        "nodes_trace": _trace(state, "prepare_confirmation", tools=names),
    }


async def _summarize_results_node(state: CoachGraphState) -> CoachGraphState:
    locale = state.get("locale") or "en"
    results = state.get("tool_results") or []
    tools = [r.get("tool") for r in results if r.get("tool")]
    if state.get("resume_mode") and results:
        reply = execution_success_reply(tools, results, locale=locale)
        settings = get_settings()
        if settings.coach_summarize_after_tools and is_llm_configured() and state.get("user_message"):
            try:
                if state.get("enable_llm_stream"):
                    summary = await complete_coach_chat_stream(
                        system=state.get("system_prompt")
                        or "Summarize tool results briefly for the athlete in their locale.",
                        messages=[
                            {
                                "role": "user",
                                "content": f"User asked: {state.get('user_message')}\nTool results: {results}\nWrite a short success reply.",
                            }
                        ],
                        max_tokens=400,
                        on_token=_emit_stream_token,
                    )
                else:
                    summary = await complete_coach_chat(
                        system=state.get("system_prompt")
                        or "Summarize tool results briefly for the athlete in their locale.",
                        messages=[
                            {
                                "role": "user",
                                "content": f"User asked: {state.get('user_message')}\nTool results: {results}\nWrite a short success reply.",
                            }
                        ],
                        max_tokens=400,
                    )
                if summary.strip():
                    reply = summary.strip()
            except Exception:
                pass
        return {
            **state,
            "reply": reply,
            "stream_tokens_emitted": bool(state.get("stream_tokens_emitted")) or bool(reply),
            "tool_calls_out": [
                {"name": r.get("tool"), "input": state.get("inputs_by_tool", {}).get(r.get("tool"), {})}
                for r in results
                if r.get("tool")
            ],
            "nodes_trace": _trace(state, "summarize_results", ok=sum(1 for r in results if r.get("success"))),
        }
    if results and is_llm_configured():
        return {**state, "nodes_trace": _trace(state, "summarize_results", defer=True)}
    return {**state, "nodes_trace": _trace(state, "summarize_results", skipped=True)}


async def _execute_subgraph_node(state: CoachGraphState) -> CoachGraphState:
    """Resume path: ordered plan execution or LangGraph extract→execute→retry."""
    started = time.perf_counter()
    plan_steps = list(state.get("plan_steps") or [])
    inputs = dict(state.get("inputs_by_tool") or {})

    if plan_steps:
        results = execute_plan_steps(
            user_id=state["user_id"],
            plan_steps=plan_steps,
            user_message=state.get("user_message") or "",
            thread_id=state.get("thread_id"),
            inputs_by_tool=inputs,
        )
    else:
        tools = list(state.get("tools_to_execute") or [])
        results = await run_tool_agent_graph(
            user_id=state["user_id"],
            tool_names=tools,
            user_message=state.get("user_message") or "",
            thread_id=state.get("thread_id"),
            context_bundle=state.get("context_bundle"),
            locale=state.get("locale") or "en",
            inputs_by_tool=inputs,
        )
    mapped = [
        {
            "tool": r.get("tool"),
            "success": r.get("success"),
            "output": r.get("output"),
            "error": r.get("error"),
        }
        for r in results
    ]
    latency_ms = int((time.perf_counter() - started) * 1000)
    return {
        **state,
        "tool_results": mapped,
        "nodes_trace": _trace(state, "execute_subgraph", latencyMs=latency_ms, count=len(mapped)),
    }


def _route_after_safety(state: CoachGraphState) -> Literal["__end__", "handle_pending", "intent", "execute_subgraph"]:
    if state.get("blocked_by_safety"):
        return "__end__"
    if state.get("resume_mode"):
        return "execute_subgraph"
    return "handle_pending"


def _route_after_pending(state: CoachGraphState) -> Literal["__end__", "intent"]:
    if state.get("reply") and state.get("pending_action"):
        return "__end__"
    return "intent"


def _should_fast_confirm_without_llm(state: CoachGraphState) -> bool:
    """No-LLM write scaffold — skip for informational RAG turns (e.g. nutrition Q&A)."""
    if is_llm_configured():
        return False
    routing = _routing_from_state(state)
    if not intent_requires_confirmation(routing.intent, list(routing.tool_hints)):
        return False
    if state.get("needs_rag") and routing.intent not in ("execute_action", "life_mode"):
        return False
    return True


def _route_after_intent(
    state: CoachGraphState,
) -> Literal["greeting_reply", "clarify", "fast_confirm", "retrieve_rag", "build_prompt", "plan_compound"]:
    if state.get("intent") == "greeting":
        return "greeting_reply"
    if state.get("needs_clarify"):
        return "clarify"
    if state.get("use_planner"):
        if state.get("needs_rag"):
            return "retrieve_rag"
        return "plan_compound"
    if _should_fast_confirm_without_llm(state):
        return "fast_confirm"
    if state.get("needs_rag"):
        return "retrieve_rag"
    return "build_prompt"


def _route_after_rag(
    state: CoachGraphState,
) -> Literal["build_prompt", "fast_confirm", "plan_compound"]:
    if state.get("use_planner"):
        return "plan_compound"
    if _should_fast_confirm_without_llm(state):
        return "fast_confirm"
    return "build_prompt"


def _route_after_llm(state: CoachGraphState) -> Literal["__end__", "prepare_confirmation", "execute_tools"]:
    tool_calls = state.get("pending_tool_calls") or []
    if not tool_calls:
        return "__end__"
    write_calls = [tc for tc in tool_calls if tool_requires_confirmation(str(tc.get("name")))]
    if write_calls:
        return "prepare_confirmation"
    if int(state.get("loop_count") or 0) >= _max_tool_loops():
        return "__end__"
    return "execute_tools"


def _route_after_execute(state: CoachGraphState) -> Literal["coach_llm", "summarize_results"]:
    if state.get("resume_mode"):
        return "summarize_results"
    if int(state.get("loop_count") or 0) >= _max_tool_loops():
        return "summarize_results"
    return "coach_llm"


def _build_coach_graph():
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(CoachGraphState)
    graph.add_node("safety_guard", _safety_node)
    graph.add_node("handle_pending", _handle_pending_node)
    graph.add_node("intent_route", _intent_node)
    graph.add_node("clarify_reply", _clarify_node)
    graph.add_node("greeting_reply", _greeting_node)
    graph.add_node("fast_confirm", _fast_confirm_node)
    graph.add_node("retrieve_rag", _retrieve_rag_node)
    graph.add_node("plan_compound", _plan_compound_node)
    graph.add_node("build_prompt", _build_prompt_node)
    graph.add_node("coach_llm", _coach_llm_node)
    graph.add_node("execute_tools", _execute_tools_node)
    graph.add_node("prepare_confirmation", _prepare_confirmation_node)
    graph.add_node("summarize_results", _summarize_results_node)
    graph.add_node("execute_subgraph", _execute_subgraph_node)

    graph.add_edge(START, "safety_guard")
    graph.add_conditional_edges(
        "safety_guard",
        _route_after_safety,
        {
            "__end__": END,
            "handle_pending": "handle_pending",
            "execute_subgraph": "execute_subgraph",
        },
    )
    graph.add_conditional_edges(
        "handle_pending",
        _route_after_pending,
        {"__end__": END, "intent": "intent_route"},
    )
    graph.add_conditional_edges(
        "intent_route",
        _route_after_intent,
        {
            "greeting_reply": "greeting_reply",
            "clarify": "clarify_reply",
            "fast_confirm": "fast_confirm",
            "retrieve_rag": "retrieve_rag",
            "build_prompt": "build_prompt",
            "plan_compound": "plan_compound",
        },
    )
    graph.add_edge("greeting_reply", END)
    graph.add_edge("clarify_reply", END)
    graph.add_edge("fast_confirm", END)
    graph.add_edge("plan_compound", END)
    graph.add_conditional_edges(
        "retrieve_rag",
        _route_after_rag,
        {
            "build_prompt": "build_prompt",
            "fast_confirm": "fast_confirm",
            "plan_compound": "plan_compound",
        },
    )
    graph.add_edge("build_prompt", "coach_llm")
    graph.add_conditional_edges(
        "coach_llm",
        _route_after_llm,
        {"__end__": END, "prepare_confirmation": "prepare_confirmation", "execute_tools": "execute_tools"},
    )
    graph.add_edge("prepare_confirmation", END)
    graph.add_conditional_edges(
        "execute_tools",
        _route_after_execute,
        {"coach_llm": "coach_llm", "summarize_results": "summarize_results"},
    )
    graph.add_edge("summarize_results", END)
    graph.add_edge("execute_subgraph", "summarize_results")
    return graph.compile()


_compiled_coach_graph = None


def get_coach_graph():
    global _compiled_coach_graph
    if _compiled_coach_graph is None:
        _compiled_coach_graph = _build_coach_graph()
    return _compiled_coach_graph


def _post_trace(state: CoachGraphState) -> None:
    try:
        from app.clients.node_internal import log_agent_trace

        started = state.get("trace_started_at")
        latency_ms = (
            int((time.perf_counter() - started) * 1000)
            if started is not None
            else 0
        )
        turn_payload = build_turn_trace_payload(state, latency_ms=latency_ms)
        results = state.get("tool_results") or []
        log_agent_trace(
            user_id=state["user_id"],
            thread_id=state.get("thread_id"),
            turn_id=turn_payload.get("turnId"),
            intent=turn_payload.get("intent") or "general",
            routing=turn_payload.get("routing"),
            rag=turn_payload.get("rag"),
            cag=turn_payload.get("cag"),
            llm=turn_payload.get("llm"),
            tools=turn_payload.get("tools"),
            nodes=turn_payload.get("nodes") or [],
            tool_calls=results,
            locale=turn_payload.get("locale") or "en",
            success=bool(turn_payload.get("success", True)),
            error=turn_payload.get("error"),
            latency_ms=latency_ms,
            model=turn_payload.get("model"),
        )
    except Exception as exc:
        logger.debug("coach trace skipped: %s", exc)


def _state_to_response(state: CoachGraphState) -> dict[str, Any]:
    tool_results = state.get("tool_results") or []
    return {
        "reply": state.get("reply") or "",
        "intent": state.get("intent") or "general",
        "tool_calls_out": state.get("tool_calls_out") or [],
        "tool_results": tool_results,
        "confirmation_required": bool(state.get("confirmation_required")),
        "confirmation_preview": state.get("confirmation_preview"),
        "source_user_message": state.get("source_user_message"),
        "inputs_by_tool": state.get("inputs_by_tool") or {},
        "plan_steps": state.get("plan_steps") or [],
        "pending_cancelled": bool(state.get("pending_cancelled")),
        "nodes_trace": state.get("nodes_trace") or [],
        "turn_id": state.get("turn_id"),
    }


async def run_coach_graph(
    *,
    user_id: str,
    messages: list[dict[str, str]],
    user_message: str,
    thread_id: str | None = None,
    context_bundle: dict[str, Any] | None = None,
    locale: str = "en",
    pending_action: dict[str, Any] | None = None,
    sanitize_stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from app.services.cag_sanitize import (
        new_sanitize_stats,
        sanitize_chat_messages,
        sanitize_prompt_text,
    )

    stats = sanitize_stats or new_sanitize_stats()
    safe_messages = sanitize_chat_messages(messages, stats)
    safe_user_message = str(sanitize_prompt_text(user_message, "userMessage", stats) or "")

    initial: CoachGraphState = {
        "user_id": user_id,
        "thread_id": thread_id,
        "turn_id": str(uuid.uuid4()),
        "trace_started_at": time.perf_counter(),
        "locale": locale,
        "messages": safe_messages,
        "user_message": safe_user_message,
        "context_bundle": context_bundle,
        "pending_action": pending_action,
        "rag_obs": {"hitCount": 0, "levels": [], "hits": []},
        "cag_obs": summarize_cag(context_bundle, sanitize_stats=stats),
        "nodes_trace": [],
        "loop_count": 0,
        "resume_mode": False,
    }
    graph = get_coach_graph()
    final = await graph.ainvoke(initial)
    _post_trace(final)
    return _state_to_response(final)


async def run_coach_resume(
    *,
    user_id: str,
    tools: list[str],
    inputs_by_tool: dict[str, dict[str, Any]],
    user_message: str,
    thread_id: str | None = None,
    context_bundle: dict[str, Any] | None = None,
    locale: str = "en",
    intent: str = "execute_action",
    plan_steps: list[dict[str, Any]] | None = None,
    sanitize_stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    from app.services.cag_sanitize import new_sanitize_stats, sanitize_prompt_text

    stats = sanitize_stats or new_sanitize_stats()
    bundle = context_bundle or {}
    user_context = format_context_bundle(bundle)
    system = build_coach_system_prompt(
        user_context=user_context,
        rag_context="",
        locale=locale,
    )
    safe_user_message = str(sanitize_prompt_text(user_message, "userMessage", stats) or "")
    initial: CoachGraphState = {
        "user_id": user_id,
        "thread_id": thread_id,
        "turn_id": str(uuid.uuid4()),
        "trace_started_at": time.perf_counter(),
        "locale": locale,
        "user_message": safe_user_message,
        "context_bundle": context_bundle,
        "tools_to_execute": list(tools),
        "plan_steps": list(plan_steps or []),
        "inputs_by_tool": inputs_by_tool,
        "intent": intent,
        "system_prompt": system,
        "rag_obs": {"hitCount": 0, "levels": [], "hits": []},
        "cag_obs": summarize_cag(context_bundle, sanitize_stats=stats),
        "resume_mode": True,
        "nodes_trace": [],
    }
    graph = get_coach_graph()
    final = await graph.ainvoke(initial)
    _post_trace(final)
    return _state_to_response(final)
