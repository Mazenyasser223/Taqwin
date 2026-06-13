from app.rag.query_rewrite import rewrite_retrieval_query


def test_rewrite_ar_exercise_alternative() -> None:
    q = rewrite_retrieval_query(
        user_message="بديل للبنش",
        intent="exercise_alternative",
        locale="ar",
    )
    assert "bench press" in q.lower()
    assert "alternative" in q.lower()


def test_rewrite_preserves_english_query() -> None:
    q = rewrite_retrieval_query(
        user_message="bench press alternative for shoulder pain",
        intent="exercise_alternative",
        locale="en",
    )
    assert "bench press" in q
    assert "alternative" in q


def test_rewrite_includes_cag_hints() -> None:
    q = rewrite_retrieval_query(
        user_message="وجبة غداء",
        intent="nutrition",
        locale="ar",
        context_bundle={"profile": {"fitnessGoal": "muscle gain", "fitnessLevel": "intermediate"}},
    )
    assert "muscle gain" in q
    assert "nutrition" in q.lower()


def test_rewrite_nutrition_arabic() -> None:
    q = rewrite_retrieval_query(
        user_message="كام بروتين في الفطار؟",
        intent="nutrition",
        locale="ar",
    )
    assert "protein" in q.lower()
    assert "breakfast" in q.lower()


def test_rewrite_platform_arabic_terms() -> None:
    q = rewrite_retrieval_query(
        user_message="إزاي أسجل الأكل و أغير اللغة؟",
        intent="platform_help",
        locale="ar",
    )
    assert "log" in q.lower()
    assert "language" in q.lower()
    assert "food" in q.lower() or "meal" in q.lower()
    assert "onboarding" in q.lower() or "platform" in q.lower()


def test_rewrite_unclear_help() -> None:
    q = rewrite_retrieval_query(user_message="help", intent="unclear", locale="en")
    assert "getting started" in q.lower()
    assert "help" in q.lower()


def test_rewrite_unclear_ar() -> None:
    q = rewrite_retrieval_query(user_message="مش فاهم", intent="unclear", locale="ar")
    assert "getting started" in q.lower() or "help" in q.lower()
    assert "taqwin" in q.lower() or "coach" in q.lower()
