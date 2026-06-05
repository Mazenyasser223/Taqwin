from types import SimpleNamespace
from unittest.mock import patch

from app.intent.router import route_intent


def test_route_platform_paraphrase() -> None:
    r = route_intent("من هي تكوين؟", locale="ar")
    assert r.intent == "platform_help"
    assert r.needs_rag is True
    assert "L1_INTERNAL" in r.levels


def test_route_nutrition_rules() -> None:
    r = route_intent("What should I eat for high protein lunch?", locale="en")
    assert r.intent == "nutrition"
    assert r.source == "rules"
    assert r.needs_rag is True
    assert "L3_NUTRITION" in r.levels
    assert "L5_BOOKS" in r.levels


def test_route_unclear_empty() -> None:
    r = route_intent("  ", locale="en")
    assert r.intent == "unclear"
    assert r.needs_clarify is True
    assert r.needs_rag is False


def test_route_execute_action() -> None:
    r = route_intent("log my lunch 200g chicken", locale="en")
    assert r.intent == "execute_action"
    assert r.needs_rag is False
    assert "log_food" in r.tool_hints


def test_route_personal_status_no_rag() -> None:
    r = route_intent("what is my weight progress today", locale="en")
    assert r.intent == "personal_status"
    assert r.needs_rag is False


@patch("app.intent.router.get_settings")
@patch("app.intent.router.classify_intent_llm")
def test_route_llm_fallback(mock_llm, mock_get_settings) -> None:
    mock_get_settings.return_value = SimpleNamespace(
        intent_llm_fallback=True,
        anthropic_api_key="test-key",
        intent_llm_min_confidence=0.55,
    )
    mock_llm.return_value = ("workout", 0.8)
    r = route_intent("help me get stronger this month", locale="en")
    assert r.intent == "workout"
    assert r.source == "llm"
    assert r.needs_rag is True
