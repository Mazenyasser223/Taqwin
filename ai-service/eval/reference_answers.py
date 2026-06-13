"""Ground-truth reference answers for golden eval cases (L1 platform + common intents)."""

from __future__ import annotations

# Exact question → substantive reference answer (used by golden dataset generator + patch script).
REFERENCE_ANSWERS_BY_QUESTION: dict[str, str] = {
    # platform_help — L1 FAQ docs
    "How do I log food in Taqwin?": (
        "Log food from Dashboard meal slots (tap a meal → Log meal) or the Nutrition library "
        "(search Taqwin's food catalog → pick serving unit and quantity). Logged meals update "
        "daily calories and macros on the dashboard."
    ),
    "إزاي أسجل الأكل في تكوين؟": (
        "سجّل الأكل من الدashboard (اختر وجبة → سجّل الوجبة) أو من التغذية "
        "(دور في قاعدة تكوين → اختار وحدة وكمية). الأكل المسجّل يتحدّث على ماكروز اليوم."
    ),
    "Where is my weekly workout plan?": (
        "Your workout and diet plans appear on the Dashboard after onboarding. Open Dashboard → "
        "Today for today's workout, use week arrows or Open workout plan to browse the 4-week plan."
    ),
    "فين خطة التمرين الأسبوعية؟": (
        "خطة التمرين والأكل على الدashboard بعد الـ onboarding. الدashboard → اليوم لتمرين النهاردة، "
        "واستخدم أسهم الأسبوع أو رابط الخطة الكاملة."
    ),
    "How does community work in Taqwin?": (
        "Open Community from the nav for Feed posts, Stories, Inbox DMs, Groups, and Browse profiles. "
        "Create posts from the Feed composer; like, comment, and follow athletes from Following."
    ),
    "إيه ميزة الكوميونيتي في تكوين؟": (
        "من Community في القائمة: Feed للمنشورات، Stories، Inbox للرسائل، Groups، وBrowse للبحث. "
        "اكتب منشور من أول الـ Feed وتفاعل مع الآخرين."
    ),
    "How to change language to Arabic?": (
        "Open Settings → Preferences → Language and select English or Arabic. A header EN/ع toggle may "
        "also switch UI language; the coach follows your locale (Arabic replies when you write in Arabic)."
    ),
    "إزاي أغير اللغة للإنجليزي؟": (
        "من الإعدادات → Preferences → Language اختار English أو العربية. التبديل يحدّث الواجهة "
        "والمدرب يتبع لغتك."
    ),
    "How to track body weight trend?": (
        "Track progress from your dashboard profile and progress section — weight trend, logs, and "
        "targets appear when you log body weight and ask about your own data in coach chat."
    ),
    "إزاي أتابع وزني؟": (
        "تابع التقدم من البروفايل والدashboard — تسجيل الوزن يظهر في تتبع التقدم ولما تسأل المدرب "
        "عن بياناتك اليوم."
    ),
    "How to reset onboarding?": (
        "Re-run onboarding from Profile or Settings when the app offers reset questionnaire — answers "
        "update goals, injuries, and allergies used for plan regeneration."
    ),
    "إزاي أعيد الاونبوردينج؟": (
        "أعد الـ onboarding من البروفايل أو الإعدادات لتحديث الأهداف والإصابات والحساسية قبل "
        "إعادة توليد الخطة."
    ),
    "Export my workout history": (
        "Open Profile → Activity / Workout history to view past sessions. Use the Export button in "
        "the app when available to download your workout history file."
    ),
    "تصدير سجل التمارين": (
        "من البروفايل → Activity / سجل التمارين لعرض الجلسات. استخدم زر Export في التطبيق لتصدير "
        "الملف عندما يكون متاح."
    ),
    "How do I use the dashboard?": (
        "The Dashboard shows today's meals and workout, macro progress, and links to the full weekly "
        "plan — no chat required after onboarding."
    ),
    "What does my subscription include?": (
        "Free athletes get core coaching, plans, and logging. Active gym membership on your profile "
        "card may unlock check-in, member gyms, and Pro-style badges — join via Gyms Near Me."
    ),
    "DROP TABLE users; what is Taqwin?": (
        "Taqwin is a fitness platform for athletes with onboarding, AI coaching chat, weekly diet and "
        "workout plans, food logging, exercise and food catalogs, and community features."
    ),
    "What is the capital of France?": (
        "That is outside Taqwin's scope — the coach helps with training, nutrition, and using the "
        "Taqwin app, not general geography trivia."
    ),
    # unclear
    "help": (
        "The Smart Coach can help with workouts, nutrition from the catalog, platform features "
        "(dashboard, logging, community), or your progress today — reply with the area you need."
    ),
    "مش فاهم": (
        "المدرب يساعد في التمرين، التغذية، ميزات التطبيق، أو بياناتك اليوم — اختار الموضوع اللي "
        "محتاجه."
    ),
}

# Fallback templates when question is not in the map (non-L1 filler cases).
INTENT_REFERENCE_TEMPLATES: dict[str, str] = {
    "nutrition": (
        "Use Taqwin's nutrition catalog (FoodItem/Webteb) with accurate macros per serving; "
        "coaching books supply principles only."
    ),
    "workout": (
        "Exercises must come from Taqwin's exercise library with valid exerciseId; coaching books "
        "provide programming principles."
    ),
    "exercise_alternative": (
        "Suggest swaps from the exercise catalog that avoid blocked injury patterns and match "
        "equipment constraints."
    ),
    "scientific": (
        "Explain using licensed coaching book principles — general fitness information, not medical advice."
    ),
    "life_mode": (
        "Adapt training or meals using coaching book guidance and Taqwin platform features when relevant."
    ),
    "general": (
        "Ground advice in licensed coaching books and Taqwin catalog data — no invented foods or exercises."
    ),
    "unclear": (
        "Ask which area the athlete needs: workout, nutrition, platform help, or today's data."
    ),
    "platform_help": (
        "Answer using Taqwin L1 platform docs: dashboard, plans, logging, community, language, or profile."
    ),
}


def reference_answer_for_case(case: dict) -> str | None:
    """Return a substantive reference answer for a golden case, or None if already good."""
    question = (case.get("question") or "").strip()
    if question in REFERENCE_ANSWERS_BY_QUESTION:
        return REFERENCE_ANSWERS_BY_QUESTION[question]

    current = (case.get("reference_answer") or "").strip()
    if not current.startswith("Grounded answer for"):
        return None

    intent = str(case.get("expected_intent") or "general")
    template = INTENT_REFERENCE_TEMPLATES.get(intent, INTENT_REFERENCE_TEMPLATES["general"])
    levels = case.get("expected_levels") or []
    if levels:
        return f"{template} (levels: {', '.join(levels)})."
    return template
