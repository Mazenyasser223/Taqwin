"""Coach graph streaming — phase events + live Anthropic tokens + final payload."""

from __future__ import annotations

import asyncio
import time
import uuid
from typing import Any, AsyncIterator

# Max wait when queues are idle (lower = snappier token delivery).
_COACH_STREAM_WAIT_SEC = 0.008
# Fallback chunk size when the LLM did not stream (fewer SSE/WS round-trips).
_FALLBACK_CHUNK_LEN = 120

from app.agent.coach_graph import (
    _post_trace,
    _state_to_response,
    get_coach_graph,
)
from app.agent.state import CoachGraphState
from app.services.chat_observability import summarize_cag
from app.services.llm_chat import bind_coach_token_sink, reset_coach_token_sink


def _split_fallback_chunks(text: str, *, max_len: int = _FALLBACK_CHUNK_LEN) -> list[str]:
    """Split reply into fixed-size chunks for fast fallback display."""
    if not text:
        return []
    if len(text) <= max_len:
        return [text]
    return [text[i : i + max_len] for i in range(0, len(text), max_len)]


async def _chunk_text(text: str) -> AsyncIterator[str]:
    """Fallback: yield reply in large chunks when LLM did not stream."""
    for chunk in _split_fallback_chunks(text):
        yield chunk


def _drain_token_batch(queue: asyncio.Queue[str | None]) -> tuple[str | None, str]:
    """Drain consecutive token deltas; returns (sentinel, joined_batch)."""
    batch: list[str] = []
    sentinel: str | None = "pending"
    while not queue.empty():
        delta = queue.get_nowait()
        if delta is None:
            sentinel = None
            break
        batch.append(delta)
    return sentinel, "".join(batch)


def _done_payload(state: CoachGraphState, result: dict[str, Any]) -> dict[str, Any]:
    tool_calls = [
        {
            "name": t.get("name", ""),
            "input": t.get("input") or {},
            "stepId": t.get("stepId"),
            "stepType": t.get("stepType"),
        }
        for t in result.get("tool_calls_out") or []
    ]
    return {
        "reply": result.get("reply") or "",
        "intent": result.get("intent") or "general",
        "toolCalls": tool_calls,
        "toolResults": result.get("tool_results") or [],
        "confirmationRequired": bool(result.get("confirmation_required")),
        "confirmationPreview": result.get("confirmation_preview"),
        "sourceUserMessage": result.get("source_user_message"),
        "planSteps": result.get("plan_steps") or [],
        "pendingCancelled": bool(result.get("pending_cancelled")),
        "turnId": result.get("turn_id"),
    }


async def iter_coach_stream_events(
    *,
    user_id: str,
    messages: list[dict[str, str]],
    user_message: str,
    thread_id: str | None = None,
    context_bundle: dict[str, Any] | None = None,
    locale: str = "en",
    pending_action: dict[str, Any] | None = None,
    cancel_event: asyncio.Event | None = None,
    sanitize_stats: dict[str, Any] | None = None,
) -> AsyncIterator[dict[str, Any]]:
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
        "enable_llm_stream": True,
        "stream_tokens_emitted": False,
    }

    graph = get_coach_graph()
    token_queue: asyncio.Queue[str | None] = asyncio.Queue()
    phase_queue: asyncio.Queue[tuple[str, dict[str, Any]] | None] = asyncio.Queue()
    final_box: dict[str, CoachGraphState | None] = {"state": None}
    last_trace_len = 0

    async def on_token(delta: str) -> None:
        await token_queue.put(delta)

    async def run_graph() -> None:
        nonlocal last_trace_len
        sink_token = bind_coach_token_sink(on_token)
        try:
            async for state in graph.astream(initial, stream_mode="values"):
                if cancel_event and cancel_event.is_set():
                    break
                final_box["state"] = state
                trace = state.get("nodes_trace") or []
                while last_trace_len < len(trace):
                    node = trace[last_trace_len].get("node", "unknown")
                    await phase_queue.put(("phase", {"phase": node}))
                    last_trace_len += 1
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            await phase_queue.put(("error", {"message": str(exc)[:300]}))
        finally:
            reset_coach_token_sink(sink_token)
            await token_queue.put(None)
            await phase_queue.put(None)

    yield {"event": "phase", "data": {"phase": "starting"}}

    task = asyncio.create_task(run_graph())

    try:
        while True:
            if cancel_event and cancel_event.is_set():
                task.cancel()
                yield {"event": "error", "data": {"message": "cancelled"}}
                return

            emitted = False
            sentinel, batch = _drain_token_batch(token_queue)
            if batch:
                yield {"event": "token", "data": {"delta": batch}}
                emitted = True
            if sentinel is None and task.done():
                break

            while not phase_queue.empty():
                item = phase_queue.get_nowait()
                if item is None:
                    break
                event, data = item
                yield {"event": event, "data": data}

            if task.done():
                while True:
                    sentinel, batch = _drain_token_batch(token_queue)
                    if batch:
                        yield {"event": "token", "data": {"delta": batch}}
                    if sentinel is None:
                        break
                break

            if not emitted:
                try:
                    delta = await asyncio.wait_for(token_queue.get(), timeout=_COACH_STREAM_WAIT_SEC)
                except asyncio.TimeoutError:
                    continue
                if delta is None:
                    if task.done():
                        break
                    continue
                batch = delta
                while not token_queue.empty():
                    more = token_queue.get_nowait()
                    if more is None:
                        if task.done():
                            break
                        continue
                    batch += more
                if batch:
                    yield {"event": "token", "data": {"delta": batch}}
    finally:
        if not task.done():
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    final = final_box["state"]
    if not final:
        yield {"event": "error", "data": {"message": "Coach graph returned no state"}}
        return

    reply = str(final.get("reply") or "")
    if reply and not final.get("stream_tokens_emitted"):
        async for delta in _chunk_text(reply):
            yield {"event": "token", "data": {"delta": delta}}

    result = _state_to_response(final)
    _post_trace(final)
    yield {"event": "done", "data": _done_payload(final, result)}
