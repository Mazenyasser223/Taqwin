"""
Block B7 — Intent router: rules first, lightweight LLM if unclear.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.config import get_settings
from app.intent.intents import routing_for, levels_for_intent
from app.intent.llm import classify_intent_llm
from app.intent.rules import classify_intent as classify_intent_rules
from app.intent.semantic import refine_intent_from_rules
from app.services.action_detect import message_likely_action


@dataclass(frozen=True)
class IntentResult:
    intent: str
    source: str  # rules | llm | fallback
    confidence: float
    levels: list[str]
    needs_rag: bool
    needs_clarify: bool
    tool_hints: list[str]


def _from_intent(intent: str, source: str, confidence: float) -> IntentResult:
    from app.agent.tools.registry import is_chat_tool

    route = routing_for(intent)
    return IntentResult(
        intent=intent,
        source=source,
        confidence=confidence,
        levels=list(route.levels),
        needs_rag=route.needs_rag,
        needs_clarify=route.needs_clarify,
        tool_hints=[h for h in route.tool_hints if is_chat_tool(h)],
    )


def route_intent(message: str, *, locale: str = "en") -> IntentResult:
    """
    Classify user message and return routing metadata for RAG + tools.
    """
    text = (message or "").strip()
    if not text or len(text) < 2:
        return _from_intent("unclear", "rules", 1.0)

    rules_intent = refine_intent_from_rules(classify_intent_rules(text), text)

    settings = get_settings()
    if (
        rules_intent == "general"
        and message_likely_action(text)
        and settings.intent_llm_fallback
        and (settings.anthropic_api_key or "").strip()
    ):
        llm_intent, conf = classify_intent_llm(text, locale=locale)
        if llm_intent in ("execute_action", "life_mode") and conf >= settings.intent_llm_min_confidence:
            return _from_intent(llm_intent, "llm", conf)

    if rules_intent != "general":
        return _from_intent(rules_intent, "rules", 0.92)

    if settings.intent_llm_fallback and (settings.anthropic_api_key or "").strip():
        llm_intent, conf = classify_intent_llm(text, locale=locale)
        if llm_intent not in ("general", "unclear") and conf >= settings.intent_llm_min_confidence:
            return _from_intent(llm_intent, "llm", conf)
        if llm_intent == "unclear" and conf >= 0.5:
            return _from_intent("unclear", "llm", conf)

    # Short vague messages without a rule/LLM match → ask to clarify.
    if len(text.split()) < 5:
        return _from_intent("unclear", "fallback", 0.55)

    return _from_intent("general", "fallback", 0.4)


def intent_to_levels(intent: str) -> list[str]:
    """Convenience for retriever/tests."""
    return levels_for_intent(intent)
