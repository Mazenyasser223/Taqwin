"""LangGraph coach agent state."""

from __future__ import annotations

from typing import Any, TypedDict


class CoachGraphState(TypedDict, total=False):
    user_id: str
    thread_id: str | None
    locale: str
    messages: list[dict[str, str]]
    context_bundle: dict[str, Any] | None
    pending_action: dict[str, Any] | None

    user_message: str
    intent: str
    routing_source: str
    routing_confidence: float
    needs_clarify: bool
    needs_rag: bool
    rag_levels: list[str]
    tool_hints: list[str]

    rag_context: str
    system_prompt: str
    allowed_tool_names: list[str]

    llm_messages: list[dict[str, Any]]
    pending_tool_calls: list[dict[str, Any]]
    tool_results: list[dict[str, Any]]
    inputs_by_tool: dict[str, dict[str, Any]]
    loop_count: int

    reply: str
    confirmation_required: bool
    confirmation_preview: str | None
    source_user_message: str | None
    tool_calls_out: list[dict[str, Any]]

    resume_mode: bool
    tools_to_execute: list[str]
    plan_steps: list[dict[str, Any]]
    use_planner: bool
    exec_attempt: int
    max_exec_attempts: int

    nodes_trace: list[dict[str, Any]]
    turn_id: str | None
    trace_started_at: float | None
    rag_obs: dict[str, Any] | None
    cag_obs: dict[str, Any] | None
    llm_obs: dict[str, Any] | None
    error: str | None
    blocked_by_safety: bool

    # Streaming (/chat/stream only)
    enable_llm_stream: bool
    stream_tokens_emitted: bool


class ToolAgentState(TypedDict, total=False):
    """Execution subgraph state (confirm/resume path)."""

    user_id: str
    thread_id: str | None
    user_message: str
    tool_names: list[str]
    locale: str
    context_bundle: dict[str, Any] | None
    inputs_by_tool: dict[str, dict[str, Any]]
    results: list[dict[str, Any]]
    nodes_trace: list[dict[str, Any]]
    attempt: int
    max_attempts: int
