"""Tools Node can execute — synced from GET /api/internal/ai/tools/list."""

from __future__ import annotations

import logging
import time
from typing import Any

from app.clients.node_internal import NodeInternalError, list_registered_tools

logger = logging.getLogger(__name__)

_CACHE_TTL_SECONDS = 60.0
_cache_at: float = 0.0
_cache_names: frozenset[str] | None = None


def _refresh_cache() -> frozenset[str]:
    global _cache_at, _cache_names
    now = time.monotonic()
    if _cache_names is not None and (now - _cache_at) < _CACHE_TTL_SECONDS:
        return _cache_names

    try:
        names = frozenset(list_registered_tools())
        _cache_names = names
        _cache_at = now
        return names
    except NodeInternalError as exc:
        logger.warning("Node tools/list unavailable — using stale or empty shipped set: %s", exc)
        if _cache_names is not None:
            return _cache_names
        return frozenset()


def invalidate_shipped_cache() -> None:
    global _cache_at, _cache_names
    _cache_at = 0.0
    _cache_names = None


def shipped_tool_names() -> frozenset[str]:
    return _refresh_cache()


def is_shipped_tool(name: str) -> bool:
    allowed = shipped_tool_names()
    if not allowed:
        return True
    return name in allowed


def filter_shipped_names(names: list[str]) -> list[str]:
    allowed = shipped_tool_names()
    if not allowed:
        return list(names)
    return [n for n in names if n in allowed]


def filter_shipped_tools(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    allowed = shipped_tool_names()
    if not allowed:
        return list(tools)
    return [t for t in tools if t.get("name") in allowed]
