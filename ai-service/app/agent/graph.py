"""
Block E1 — LangGraph tool agent: extract → execute → retry on failure (max attempts).
Falls back to linear runner if LangGraph is unavailable.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Literal

from app.agent.state import ToolAgentState
from app.services.tool_extract import extract_tool_inputs
from app.services.tool_loop import execute_pending_tools

logger = logging.getLogger(__name__)

MAX_TOOL_EXECUTIONS = 5
MAX_GRAPH_ATTEMPTS = 3


def _trace(state: ToolAgentState, node: str, **extra: Any) -> list[dict[str, Any]]:
    trace = list(state.get("nodes_trace") or [])
    trace.append({"node": node, **extra})
    return trace


async def _extract_node(state: ToolAgentState) -> ToolAgentState:
    attempt = int(state.get("attempt") or 0) + 1
    tool_names = list(state.get("tool_names") or [])[:MAX_TOOL_EXECUTIONS]
    existing = state.get("inputs_by_tool") or {}
    if existing and attempt == 1 and all(n in existing for n in tool_names):
        inputs = existing
    else:
        inputs = await extract_tool_inputs(
            tool_names=tool_names,
            user_message=state.get("user_message") or "",
            context_bundle=state.get("context_bundle"),
            locale=state.get("locale") or "en",
        )
        if existing:
            for key, val in existing.items():
                inputs[key] = {**(inputs.get(key) or {}), **val}
    return {
        **state,
        "attempt": attempt,
        "inputs_by_tool": inputs,
        "nodes_trace": _trace(state, "extract", attempt=attempt, tools=tool_names),
    }


async def _execute_node(state: ToolAgentState) -> ToolAgentState:
    started = time.perf_counter()
    results = execute_pending_tools(
        user_id=state["user_id"],
        tool_names=list(state.get("tool_names") or []),
        user_message=state.get("user_message") or "",
        thread_id=state.get("thread_id"),
        inputs_by_tool=state.get("inputs_by_tool"),
        max_tools=MAX_TOOL_EXECUTIONS,
    )
    latency_ms = int((time.perf_counter() - started) * 1000)
    ok = sum(1 for r in results if r.get("success"))
    return {
        **state,
        "results": results,
        "nodes_trace": _trace(
            state,
            "execute",
            success=ok,
            total=len(results),
            latencyMs=latency_ms,
        ),
    }


def _route_after_execute(state: ToolAgentState) -> Literal["extract", "__end__"]:
    results = state.get("results") or []
    attempt = int(state.get("attempt") or 0)
    max_attempts = int(state.get("max_attempts") or MAX_GRAPH_ATTEMPTS)
    if not results:
        return "__end__"
    failed = any(not r.get("success") for r in results)
    if failed and attempt < max_attempts:
        return "extract"
    return "__end__"


def _build_graph():
    from langgraph.graph import END, START, StateGraph

    graph = StateGraph(ToolAgentState)
    graph.add_node("extract", _extract_node)
    graph.add_node("execute", _execute_node)
    graph.add_edge(START, "extract")
    graph.add_edge("extract", "execute")
    graph.add_conditional_edges(
        "execute",
        _route_after_execute,
        {"extract": "extract", "__end__": END},
    )
    return graph.compile()


_compiled_graph = None


def get_tool_agent_graph():
    global _compiled_graph
    if _compiled_graph is None:
        _compiled_graph = _build_graph()
    return _compiled_graph


async def run_tool_agent_graph(
    *,
    user_id: str,
    tool_names: list[str],
    user_message: str,
    thread_id: str | None = None,
    context_bundle: dict[str, Any] | None = None,
    locale: str = "en",
    inputs_by_tool: dict[str, dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """Run LangGraph tool loop; post trace to Node when configured."""
    initial: ToolAgentState = {
        "user_id": user_id,
        "thread_id": thread_id,
        "user_message": user_message,
        "tool_names": list(tool_names)[:MAX_TOOL_EXECUTIONS],
        "locale": locale,
        "context_bundle": context_bundle,
        "inputs_by_tool": dict(inputs_by_tool or {}),
        "results": [],
        "nodes_trace": [],
        "attempt": 0,
        "max_attempts": MAX_GRAPH_ATTEMPTS,
    }

    try:
        graph = get_tool_agent_graph()
        final = await graph.ainvoke(initial)
    except ImportError:
        logger.warning("LangGraph not installed — using linear runner")
        from app.agent.runner import run_tool_agent

        return await run_tool_agent(
            user_id=user_id,
            tool_names=tool_names,
            user_message=user_message,
            thread_id=thread_id,
            context_bundle=context_bundle,
            locale=locale,
        )

    results = list(final.get("results") or [])
    _post_agent_trace(
        user_id=user_id,
        thread_id=thread_id,
        locale=locale,
        nodes=final.get("nodes_trace") or [],
        tool_calls=results,
    )
    return results


def _post_agent_trace(
    *,
    user_id: str,
    thread_id: str | None,
    locale: str,
    nodes: list[dict[str, Any]],
    tool_calls: list[dict[str, Any]],
) -> None:
    try:
        from app.clients.node_internal import log_agent_trace

        log_agent_trace(
            user_id=user_id,
            thread_id=thread_id,
            intent="execute_action",
            nodes=nodes,
            tool_calls=tool_calls,
            locale=locale,
            success=all(t.get("success") for t in tool_calls) if tool_calls else True,
        )
    except Exception as exc:
        logger.debug("agent trace post skipped: %s", exc)
