"""
Knowledge levels (Block B6 / pre-E).

- LEVEL_PRIORITY: factual conflict resolution (platform catalog wins over books for IDs).
- CONTEXT_DISPLAY_ORDER: order chunks appear in the coach prompt (books first).
"""

from __future__ import annotations

from typing import Final

L1_INTERNAL = "L1_INTERNAL"
L2_EXERCISE = "L2_EXERCISE"
L3_NUTRITION = "L3_NUTRITION"
L4_SCIENTIFIC = "L4_SCIENTIFIC"
L5_BOOKS = "L5_BOOKS"

ALL_LEVELS: Final[tuple[str, ...]] = (
    L1_INTERNAL,
    L2_EXERCISE,
    L3_NUTRITION,
    L4_SCIENTIFIC,
    L5_BOOKS,
)

LEVEL_PRIORITY: Final[dict[str, int]] = {
    L1_INTERNAL: 0,
    L2_EXERCISE: 1,
    L3_NUTRITION: 2,
    L4_SCIENTIFIC: 3,
    L5_BOOKS: 4,
}

CONTEXT_DISPLAY_ORDER: Final[dict[str, int]] = {
    L5_BOOKS: 0,
    L1_INTERNAL: 1,
    L2_EXERCISE: 2,
    L3_NUTRITION: 3,
    L4_SCIENTIFIC: 4,
}


def sort_levels(levels: list[str]) -> list[str]:
    """Return levels ordered by architecture priority (search loop order)."""
    unique = []
    for lv in levels:
        if lv in LEVEL_PRIORITY and lv not in unique:
            unique.append(lv)
    return sorted(unique, key=lambda x: LEVEL_PRIORITY[x])


def sort_hits_for_prompt(hits: list) -> list:
    """Sort RagHit-like objects for prompt injection (books first)."""
    return sorted(
        hits,
        key=lambda h: (
            CONTEXT_DISPLAY_ORDER.get(getattr(h, "level", ""), 99),
            -float(getattr(h, "score", 0) or 0),
        ),
    )


def levels_for_intent(intent: str) -> list[str]:
    from app.intent.intents import levels_for_intent as _levels

    return _levels(intent)
