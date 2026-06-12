"""
Block B6 — Node internal API client (FastAPI → backend-node).

Calls POST /api/internal/ai/rag/search (Block B5).
"""

from __future__ import annotations

from typing import Any

import httpx

from app.agent.tools.validate import validate_tool_input
from app.config import get_settings


class NodeInternalError(Exception):
    def __init__(self, message: str, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


def _headers() -> dict[str, str]:
    settings = get_settings()
    key = (settings.ai_internal_key or "").strip()
    if not key:
        raise NodeInternalError("AI_INTERNAL_KEY is not configured on ai-service")
    return {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Internal-Key": key,
    }


def _base_url() -> str:
    return get_settings().node_internal_api_url.rstrip("/")


def fetch_context_bundle(user_id: str) -> dict[str, Any]:
    """
    GET /api/internal/ai/debug/context/:userId
    Fresh CAG bundle when Node did not attach one (safety net).
    """
    url = f"{_base_url()}/api/internal/ai/debug/context/{user_id}"
    timeout = get_settings().node_internal_timeout_seconds

    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.get(url, headers=_headers())
    except httpx.TimeoutException as exc:
        raise NodeInternalError(f"Node CAG fetch timed out after {timeout}s") from exc
    except httpx.RequestError as exc:
        raise NodeInternalError(f"Node CAG fetch request failed: {exc}") from exc

    if res.status_code == 401:
        raise NodeInternalError("Invalid X-Internal-Key for Node internal API", 401)
    if res.status_code >= 400:
        detail = res.text[:300]
        raise NodeInternalError(f"Node CAG fetch {res.status_code}: {detail}", res.status_code)

    data = res.json()
    return data if isinstance(data, dict) else {}


def rag_search(
    *,
    query: str,
    levels: list[str],
    limit: int | None = None,
    locale: str | None = None,
    min_score: float | None = None,
) -> dict[str, Any]:
    """
    POST /api/internal/ai/rag/search
    Returns Node payload: { query, levels, limit, embedding, results[] }.
    """
    settings = get_settings()
    body: dict[str, Any] = {
        "query": query,
        "levels": levels,
    }
    if limit is not None:
        body["limit"] = limit
    if locale in ("en", "ar"):
        body["locale"] = locale
    if min_score is not None:
        body["minScore"] = min_score

    url = f"{_base_url()}/api/internal/ai/rag/search"
    timeout = settings.node_internal_timeout_seconds

    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.post(url, headers=_headers(), json=body)
    except httpx.TimeoutException as exc:
        raise NodeInternalError(f"Node RAG search timed out after {timeout}s") from exc
    except httpx.RequestError as exc:
        raise NodeInternalError(f"Node RAG search request failed: {exc}") from exc

    if res.status_code == 401:
        raise NodeInternalError("Invalid X-Internal-Key for Node internal API", 401)
    if res.status_code == 503:
        raise NodeInternalError("Node embeddings not configured", 503)
    if res.status_code >= 400:
        detail = res.text[:300]
        raise NodeInternalError(f"Node RAG search {res.status_code}: {detail}", res.status_code)

    return res.json()


def list_registered_tools() -> list[str]:
    """
    GET /api/internal/ai/tools/list
    Returns tool names Node can execute in coach chat.
    """
    url = f"{_base_url()}/api/internal/ai/tools/list"
    timeout = get_settings().node_internal_timeout_seconds

    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.get(url, headers=_headers())
    except httpx.TimeoutException as exc:
        raise NodeInternalError(f"Node tools/list timed out after {timeout}s") from exc
    except httpx.RequestError as exc:
        raise NodeInternalError(f"Node tools/list request failed: {exc}") from exc

    if res.status_code == 401:
        raise NodeInternalError("Invalid X-Internal-Key for Node internal API", 401)
    if res.status_code >= 400:
        detail = res.text[:300]
        raise NodeInternalError(f"Node tools/list {res.status_code}: {detail}", res.status_code)

    data = res.json()
    tools = data.get("tools") if isinstance(data, dict) else None
    if not isinstance(tools, list):
        return []
    return [str(t) for t in tools if t]


def execute_tool(
    *,
    user_id: str,
    tool_name: str,
    input: dict[str, Any] | None = None,
    thread_id: str | None = None,
) -> dict[str, Any]:
    """
    POST /api/internal/ai/tools/execute
    Returns Node payload: { success, output, error?, executionId }.
    """
    payload = input or {}
    ok, validation_errors = validate_tool_input(tool_name, payload)
    if not ok:
        detail = "; ".join(validation_errors)
        raise NodeInternalError(f"Invalid tool input for {tool_name}: {detail}", 422)

    settings = get_settings()
    body: dict[str, Any] = {
        "userId": user_id,
        "toolName": tool_name,
        "input": payload,
    }
    if thread_id:
        body["threadId"] = thread_id

    url = f"{_base_url()}/api/internal/ai/tools/execute"
    timeout = settings.node_internal_timeout_seconds

    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.post(url, headers=_headers(), json=body)
    except httpx.TimeoutException as exc:
        raise NodeInternalError(f"Node tool execute timed out after {timeout}s") from exc
    except httpx.RequestError as exc:
        raise NodeInternalError(f"Node tool execute request failed: {exc}") from exc

    if res.status_code == 401:
        raise NodeInternalError("Invalid X-Internal-Key for Node internal API", 401)
    if res.status_code >= 400:
        detail = res.text[:300]
        raise NodeInternalError(f"Node tool execute {res.status_code}: {detail}", res.status_code)

    data = res.json()
    if not data.get("success"):
        raise NodeInternalError(data.get("error") or "Tool execution failed")
    return data


def log_agent_trace(
    *,
    user_id: str,
    thread_id: str | None = None,
    turn_id: str | None = None,
    intent: str = "execute_action",
    routing: dict[str, Any] | None = None,
    rag: dict[str, Any] | None = None,
    cag: dict[str, Any] | None = None,
    llm: dict[str, Any] | None = None,
    tools: dict[str, Any] | None = None,
    nodes: list[dict[str, Any]] | None = None,
    tool_calls: list[dict[str, Any]] | None = None,
    locale: str = "en",
    success: bool = True,
    error: str | None = None,
    latency_ms: int | None = None,
    model: str | None = None,
) -> dict[str, Any] | None:
    """POST /api/internal/ai/traces — best-effort unified chat turn observability."""
    body: dict[str, Any] = {
        "userId": user_id,
        "intent": intent,
        "nodes": nodes or [],
        "toolCalls": tool_calls or [],
        "locale": locale,
        "success": success,
    }
    if thread_id:
        body["threadId"] = thread_id
    if turn_id:
        body["turnId"] = turn_id
    if routing:
        body["routing"] = routing
    if rag:
        body["rag"] = rag
    if cag:
        body["cag"] = cag
    if llm:
        body["llm"] = llm
    if tools:
        body["tools"] = tools
    if error:
        body["error"] = error[:2000]
    if latency_ms is not None:
        body["latencyMs"] = latency_ms
    if model:
        body["model"] = model

    url = f"{_base_url()}/api/internal/ai/traces"
    timeout = get_settings().node_internal_timeout_seconds
    try:
        with httpx.Client(timeout=timeout) as client:
            res = client.post(url, headers=_headers(), json=body)
        if res.status_code >= 400:
            return None
        return res.json()
    except httpx.RequestError:
        return None
