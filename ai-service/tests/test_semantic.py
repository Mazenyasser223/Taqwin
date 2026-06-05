from app.intent.rules import classify_intent
from app.intent.semantic import refine_intent_from_rules, semantic_hints


def test_platform_paraphrases_same_intent() -> None:
    for msg in [
        "من هي تكوين؟",
        "ما هي ميزات تطبيق تكوين",
        "what is the Taqwin app",
    ]:
        assert refine_intent_from_rules(classify_intent(msg), msg) == "platform_help"
        assert "platform" in semantic_hints(msg)


def test_body_type_maps_to_general() -> None:
    msg = "عايز اعرف نوع جسمي"
    assert refine_intent_from_rules(classify_intent(msg), msg) == "general"
    assert "body_type" in semantic_hints(msg)


def test_chat_memory_maps_to_platform_help() -> None:
    msg = "ابعثلي اخر رساله انت بعتها"
    assert refine_intent_from_rules(classify_intent(msg), msg) == "platform_help"
    assert "chat_memory" in semantic_hints(msg)


def test_coach_persona_maps_to_platform_help() -> None:
    msg = "مين انت وبتعمل ايه"
    assert refine_intent_from_rules(classify_intent(msg), msg) == "platform_help"
    assert "coach" in semantic_hints(msg)
