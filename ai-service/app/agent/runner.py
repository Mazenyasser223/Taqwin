"""
Block E2 — agent runner (LangGraph-free): intent → extract → execute tools (max 5).
"""

from __future__ import annotations

from typing import Any

from app.services.tool_extract import extract_tool_inputs
from app.services.tool_loop import execute_pending_tools

MAX_TOOL_EXECUTIONS = 5


async def run_tool_agent(
    *,
    user_id: str,
    tool_names: list[str],
    user_message: str,
    thread_id: str | None = None,
    context_bundle: dict[str, Any] | None = None,
    locale: str = "en",
) -> list[dict[str, Any]]:
    """
    Extract structured inputs (LLM when configured) then execute up to MAX_TOOL_EXECUTIONS tools.
    """
    names = list(tool_names)[:MAX_TOOL_EXECUTIONS]
    inputs_by_tool = await extract_tool_inputs(
        tool_names=names,
        user_message=user_message,
        context_bundle=context_bundle,
        locale=locale,
    )

    return execute_pending_tools(
        user_id=user_id,
        tool_names=names,
        user_message=user_message,
        thread_id=thread_id,
        inputs_by_tool=inputs_by_tool,
        max_tools=MAX_TOOL_EXECUTIONS,
    )
