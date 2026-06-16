"""
Block E4 — chat transcript → durable AiMemory facts (Claude on ai-service).
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.services.llm_chat import complete_coach_chat
from app.services.cag_sanitize import sanitize_cag_string, sanitize_prompt_text

logger = logging.getLogger(__name__)

ALLOWED_KEYS = frozenset({
    "diet_preferences",
    "training_constraints",
    "injury_notes",
    "goals_mentioned",
    "chat_context_summary",
})

SUMMARIZE_SYSTEM = """You extract durable coaching facts from athlete chat logs.
Return ONLY valid JSON:
{
  "memories": [
    { "key": "diet_preferences|training_constraints|injury_notes|goals_mentioned|chat_context_summary", "summary": "one sentence", "confidence": 0.0-1.0 }
  ]
}
Rules:
- 0-4 items max; omit if nothing durable was stated.
- Only explicit facts (allergies, injuries, schedule, goals, food dislikes).
- No medical diagnosis; injury_notes = athlete-reported only.
- summaries in the user's language (Arabic or English)."""


def parse_memories_json(raw: str) -> list[dict[str, Any]]:
    text = str(raw or "").strip()
    if not text:
        return []
    try:
        data = json.loads(text)
        memories = data.get("memories") if isinstance(data, dict) else None
        return memories if isinstance(memories, list) else []
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                data = json.loads(text[start : end + 1])
                memories = data.get("memories") if isinstance(data, dict) else None
                return memories if isinstance(memories, list) else []
            except json.JSONDecodeError:
                return []
        return []


def _filter_memories(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        key = str(item.get("key") or "").strip()
        summary = str(sanitize_cag_string(str(item.get("summary") or "").strip(), "memorySummary"))
        if key not in ALLOWED_KEYS or len(summary) < 8:
            continue
        confidence = item.get("confidence")
        try:
            conf = float(confidence) if confidence is not None else 0.75
        except (TypeError, ValueError):
            conf = 0.75
        out.append({"key": key, "summary": summary, "confidence": conf})
    return out


async def summarize_chat_transcript(
    *,
    transcript: str,
    locale: str = "ar",
    temperature: float = 0.2,
    max_tokens: int = 900,
) -> dict[str, Any]:
    """Run Claude on a chat transcript; return raw JSON text + parsed memories."""
    text = str(sanitize_prompt_text(str(transcript or "").strip(), "memoryTranscript") or "").strip()
    if len(text) < 40:
        return {"raw": "", "memories": [], "skipped": True, "reason": "insufficient_chat"}

    raw = await complete_coach_chat(
        system=SUMMARIZE_SYSTEM,
        messages=[{"role": "user", "content": text}],
        temperature=temperature,
        max_tokens=max_tokens,
    )
    items = _filter_memories(parse_memories_json(raw))
    return {
        "raw": raw,
        "memories": items,
        "locale": "en" if locale == "en" else "ar",
        "skipped": False,
    }
