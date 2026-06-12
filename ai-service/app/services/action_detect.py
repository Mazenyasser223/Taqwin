"""Detect action-oriented messages for LLM-first intent routing."""

from __future__ import annotations

import re

_ACTION_HINT = re.compile(
    r"\b(log|record|track|add|replace|swap|substitute|change|skip|set|activate|simplify|adapt)\b"
    r"|(سجل|سجّل|ضيف|أضف|بدّل|بدل|استبدل|تبسيط|عدّل|عدل|فعّل|فعل|غيّر|غير)",
    re.I,
)


def message_likely_action(message: str) -> bool:
    text = (message or "").strip()
    if len(text) < 4:
        return False
    return bool(_ACTION_HINT.search(text))
