"""
Intent definitions and routing table (Block B7).

Maps each intent → RAG levels, tool hints, clarify/RAG flags.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

# Keep in sync with app.rag.levels (avoid circular import via retriever).
L1_INTERNAL = "L1_INTERNAL"
L2_EXERCISE = "L2_EXERCISE"
L3_NUTRITION = "L3_NUTRITION"
L5_BOOKS = "L5_BOOKS"

VALID_INTENTS: Final[tuple[str, ...]] = (
    "personal_status",
    "nutrition",
    "workout",
    "exercise_alternative",
    "platform_help",
    "execute_action",
    "scientific",
    "life_mode",
    "unclear",
    "general",
)


@dataclass(frozen=True)
class IntentRouting:
    levels: tuple[str, ...]
    needs_rag: bool
    needs_clarify: bool
    tool_hints: tuple[str, ...]


ROUTING: Final[dict[str, IntentRouting]] = {
    "personal_status": IntentRouting((), False, False, ("get_nutrition_today", "get_workout_today")),
    "nutrition": IntentRouting((L5_BOOKS, L3_NUTRITION), True, False, ("log_food", "get_nutrition_today")),
    "workout": IntentRouting((L5_BOOKS, L2_EXERCISE), True, False, ("get_workout_today",)),
    "exercise_alternative": IntentRouting(
        (L5_BOOKS, L2_EXERCISE, L1_INTERNAL), True, False, ("replace_exercise_today",)
    ),
    "platform_help": IntentRouting((L1_INTERNAL, L5_BOOKS), True, False, ()),
    "execute_action": IntentRouting((L1_INTERNAL,), False, False, ("log_food", "replace_exercise_today")),
    "scientific": IntentRouting((L5_BOOKS,), True, False, ()),
    "life_mode": IntentRouting((L5_BOOKS, L1_INTERNAL), True, False, ("set_life_mode", "adapt_plan")),
    "unclear": IntentRouting((), False, True, ()),
    "general": IntentRouting((L5_BOOKS, L1_INTERNAL), True, False, ()),
}


def routing_for(intent: str) -> IntentRouting:
    if intent not in ROUTING:
        return ROUTING["general"]
    return ROUTING[intent]


def levels_for_intent(intent: str) -> list[str]:
    return list(routing_for(intent).levels)
