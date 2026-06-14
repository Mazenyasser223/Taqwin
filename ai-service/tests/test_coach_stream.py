"""Tests for coach SSE streaming helper."""

from __future__ import annotations

import pytest

from app.agent.coach_stream import _chunk_text, _done_payload


@pytest.mark.asyncio
async def test_chunk_text_phrases():
    text = (
        "Hello world. This is a longer second sentence for chunking. "
        "And here is a third sentence that pushes the combined reply well past the chunk limit."
    )
    parts = []
    async for delta in _chunk_text(text):
        parts.append(delta)
    assert "".join(parts) == text
    assert len(parts) >= 2
    assert all(len(p) <= 120 for p in parts)


def test_done_payload_shape():
    state = {"turn_id": "t1"}
    result = {
        "reply": "Hi",
        "intent": "general",
        "tool_calls_out": [],
        "tool_results": [],
        "confirmation_required": False,
        "confirmation_preview": None,
        "source_user_message": "hey",
        "plan_steps": [],
        "pending_cancelled": False,
        "turn_id": "t1",
    }
    payload = _done_payload(state, result)
    assert payload["reply"] == "Hi"
    assert payload["turnId"] == "t1"
    assert payload["confirmationRequired"] is False
