from app.intent.greetings import build_greeting_reply, is_greeting_message
from app.intent.router import route_intent


def test_is_greeting_en() -> None:
    assert is_greeting_message("Hi")
    assert is_greeting_message("hello!")
    assert is_greeting_message("How are you?")


def test_is_greeting_ar() -> None:
    assert is_greeting_message("ازيك")
    assert is_greeting_message("إزيك عامل ايه")
    assert is_greeting_message("مرحبا")


def test_is_not_greeting_when_question() -> None:
    assert not is_greeting_message("What should I eat for lunch?")


def test_route_greeting_hi() -> None:
    r = route_intent("Hi", locale="en")
    assert r.intent == "greeting"
    assert r.needs_clarify is False
    assert r.needs_rag is False


def test_route_greeting_ar() -> None:
    r = route_intent("ازيك", locale="ar")
    assert r.intent == "greeting"
    assert r.needs_clarify is False


def test_build_greeting_reply_uses_name() -> None:
    reply = build_greeting_reply(locale="en", display_name="Mazen Ali")
    assert "Mazen" in reply
    assert "training" in reply.lower()


def test_build_greeting_reply_ar() -> None:
    reply = build_greeting_reply(locale="ar", display_name="مازن")
    assert "مازن" in reply
    assert "تكوين" in reply
