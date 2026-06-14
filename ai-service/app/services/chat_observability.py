"""Structured observability for coach chat turns (Block E3)."""

from __future__ import annotations

import hashlib
import json
from typing import Any

from app.rag.types import RagHit


def hash_prompt(*, system: str, messages: list[dict[str, Any]]) -> str:
    """Match Node llmOutputService.hashPrompt (sha256, first 24 hex chars)."""
    payload = json.dumps(
        {"system": system or "", "messages": messages or []},
        sort_keys=True,
        ensure_ascii=False,
        default=str,
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


def hash_json_blob(value: Any) -> str:
    raw = json.dumps(value or {}, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]


def summarize_rag_hits(
    hits: list[RagHit],
    *,
    max_hits: int = 12,
    query: str | None = None,
    retrieval_ms: float = 0.0,
    rerank_lift_avg: float = 0.0,
    purpose: str | None = None,
) -> dict[str, Any]:
    levels = sorted({h.level for h in hits if h.level})
    scores = [float(h.score) for h in hits if h.score]
    avg_score = sum(scores) / len(scores) if scores else 0.0
    top = [
        {
            "chunkId": h.chunk_id,
            "level": h.level,
            "title": (h.title or "")[:120],
            "score": round(float(h.score), 4),
            "source": (h.source or "")[:80],
            "retrievalScore": round(
                float((h.metadata or {}).get("retrievalScore", h.score)), 4
            ),
        }
        for h in hits[:max_hits]
    ]
    return {
        "hitCount": len(hits),
        "levels": levels,
        "hits": top,
        "query": (query or "")[:500] or None,
        "avgScore": round(avg_score, 4),
        "retrievalMs": round(retrieval_ms, 1),
        "rerankLiftAvg": round(rerank_lift_avg, 4),
        "purpose": purpose,
        "emptyRetrieval": len(hits) == 0,
    }


def summarize_cag(
    bundle: dict[str, Any] | None,
    *,
    sanitize_stats: dict[str, Any] | None = None,
) -> dict[str, Any]:
    bundle = bundle or {}
    raw = json.dumps(bundle, sort_keys=True, ensure_ascii=False, default=str)
    out: dict[str, Any] = {
        "chars": len(raw),
        "hash": hash_json_blob(bundle),
        "generatedAt": bundle.get("generatedAt"),
    }
    if sanitize_stats:
        out["sanitizeHits"] = int(sanitize_stats.get("hits") or 0)
        out["sanitizeTruncated"] = int(sanitize_stats.get("truncated") or 0)
        fields = sanitize_stats.get("fields") or {}
        if isinstance(fields, dict) and fields:
            out["sanitizeFields"] = dict(fields)
    return out


def summarize_llm_call(
    *,
    model: str | None,
    system: str,
    messages: list[dict[str, Any]],
    output_text: str,
    latency_ms: int,
    stop_reason: str | None = None,
    scaffold: bool = False,
) -> dict[str, Any]:
    input_chars = sum(len(str(m.get("content") or "")) for m in messages)
    return {
        "model": model,
        "promptHash": hash_prompt(system=system, messages=messages),
        "systemChars": len(system or ""),
        "inputChars": input_chars,
        "outputChars": len(output_text or ""),
        "latencyMs": latency_ms,
        "stopReason": stop_reason,
        "scaffold": scaffold,
    }


def summarize_tools(state: dict[str, Any]) -> dict[str, Any]:
    proposed = [
        str(t.get("name"))
        for t in (state.get("tool_calls_out") or [])
        if t.get("name")
    ]
    executed = [
        str(r.get("tool"))
        for r in (state.get("tool_results") or [])
        if r.get("success") and r.get("tool")
    ]
    pending = [
        str(t.get("name"))
        for t in (state.get("pending_tool_calls") or [])
        if t.get("name")
    ]
    return {
        "proposed": proposed,
        "pending": pending,
        "executed": executed,
        "confirmationRequired": bool(state.get("confirmation_required")),
    }


def build_turn_trace_payload(state: dict[str, Any], *, latency_ms: int) -> dict[str, Any]:
    routing = {
        "source": state.get("routing_source"),
        "confidence": state.get("routing_confidence"),
        "needsRag": state.get("needs_rag"),
        "needsClarify": state.get("needs_clarify"),
    }
    payload: dict[str, Any] = {
        "turnId": state.get("turn_id"),
        "intent": state.get("intent") or "general",
        "routing": routing,
        "rag": state.get("rag_obs") or {},
        "cag": state.get("cag_obs") or {},
        "llm": state.get("llm_obs") or {},
        "tools": summarize_tools(state),
        "nodes": state.get("nodes_trace") or [],
        "latencyMs": latency_ms,
        "model": (state.get("llm_obs") or {}).get("model"),
        "locale": state.get("locale") or "en",
        "success": not state.get("error"),
    }
    if state.get("error"):
        payload["error"] = str(state["error"])[:2000]
    return payload
