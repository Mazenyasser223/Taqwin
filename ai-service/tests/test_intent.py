from app.intent.rules import classify_intent


def test_classify_nutrition_en() -> None:
    assert classify_intent("What should I eat for high protein lunch?") == "nutrition"


def test_classify_workout_ar() -> None:
    assert classify_intent("إيه برنامج التمرين الأسبوع ده؟") == "workout"


def test_classify_exercise_alternative() -> None:
    assert classify_intent("بديل لتمرين البنش عندي ألم كتف") == "exercise_alternative"


def test_classify_scientific() -> None:
    assert classify_intent("What are the laws of muscle growth?") == "scientific"


def test_classify_platform() -> None:
    assert classify_intent("How does Taqwin onboarding work?") == "platform_help"


def test_classify_platform_ar_paraphrase() -> None:
    assert classify_intent("من هي تكوين؟") == "platform_help"
    assert classify_intent("ما هي ميزات تطبيق تكوين") == "platform_help"
