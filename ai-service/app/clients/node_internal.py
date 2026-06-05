"""
Block B6 — Node internal API client (FastAPI → backend-node).

Calls POST /api/internal/ai/rag/search (Block B5).
"""

from __future__ import annotations

from typing import Any

import httpx

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
