"""
Semantic hints for intent routing (Block B7).

Maps paraphrases / alternate phrasings to intents when keyword rules return `general`.
"""

from __future__ import annotations

import re

_PLATFORM = re.compile(
    r"\b(taqwin|takween|takwin|app|platform|onboarding|dashboard|subscription|account|smart\s*coach|"
    r"community|gym|membership|settings|profile|language|locale|notification|export|download|history|navigation)\b"
    r"|(تكوين|تكوّين|التطبيق|المنصة|الموقع|المدرب\s*الذكي|اشتراك|حساب|تسجيل|لوحة|الداشبورد|مجتمع|نادي|جيم|عضوية|متجر|مكملات|"
    r"كوميونيتي|إعدادات|اعدادات|لغة|تصدير|سجل|تاريخ)",
    re.I,
)

_PLATFORM_NAV = re.compile(
    r"\b(where\s+(is|can\s+i\s+find|do\s+i\s+find)|how\s+(do|can)\s+i\s+(find|access|view|export|download)|export|download)\b"
    r".*\b(plan|workout|food|log|history|data|profile|settings|language|dashboard|weekly)\b"
    r"|\b(export|download)\b.*\b(history|workout|food|logs?|data)\b"
    r"|\b(change|switch)\b.*\b(language|locale)\b"
    r"|\b(track|follow)\b.*\b(weight|body)\b"
    r"|\b(how\s+(does|do)|what\s+is)\b.*\b(community|dashboard|subscription|smart\s*coach|membership)\b"
    r"|(فين|اين|أين|ازاي|إزاي).*(خطة|الخطة|التمرين|الأسبوعية|سجل|تمارين|لغة|إعدادات|وزن|الكوميونيتي|مجتمع)"
    r"|(تصدير|export).*(سجل|تاريخ|تمارين|بيانات)"
    r"|(إزاي|ازاي).*(أسجل|اسجل|سجل|أغير|اغير).*(أكل|اكل|لغة|وزن)",
    re.I,
)

_META = re.compile(
    r"\b(who\s+is|what\s+is|what\s+are|what\s+do|how\s+does|tell\s+me\s+about|features?|how\s+to\s+use)\b"
    r"|(من\s+هي|من\s+هو|ما\s+هو|ما\s+هي|مين\s+هي|مين\s+هو|ايه\s+هو|إيه\s+هو|ايه\s+هي|إيه\s+هي|ميزات|خدمات|ازاي|إزاي|كيف\s+أستخدم|عرفني\s+عن)",
    re.I,
)

_BODY_TYPE = re.compile(
    r"\b(body\s*type|somatotype|ectomorph|mesomorph|endomorph)\b"
    r"|(نوع\s*جسم|جسمي|ميزومورف|إكتومورف|اندومورف|نحيف|رياضي)",
    re.I,
)

_PROFILE = re.compile(
    r"\b(my\s+(weight|progress|plan|meals?|workout|body|profile)|how\s+am\s+i|logged\s+today)\b"
    r"|(وزني|تقدمي|سجلت|وضعي|بياناتي|خطتي)",
    re.I,
)

_CHAT_META = re.compile(
    r"\b(last message|you said|you sent|what did i say|repeat|our chat|conversation|send me your)\b"
    r"|(ابعت|ابعث|أبعت|أبعث|ابعثلي|ابعتلي|ارسل|آخر|اخر|رسال[ةه]|قبل\s*كده|فاكر|تذكر|محادثة|شات|كرر|قول\s*تاني|انت\s*بعت)",
    re.I,
)

_COACH_META = re.compile(
    r"\b(who are you|what can you do|what can you help|getting started)\b"
    r"|(مين\s*انت|انت\s*مين|تقدر\s*تعمل|تقدر\s*تساعد|ايه\s*تقدر\s*تساعد)",
    re.I,
)

_SCIENTIFIC = re.compile(
    r"\b(science|research|evidence|laws?\s+of|progressive\s+overload)\b"
    r"|(علمي|قوانين|نمو\s*العضلات)",
    re.I,
)

_WORKOUT = re.compile(
    r"\b(workouts?|training|exercises?|bench|squat|deadlift|barbell|hypertrophy|leg\s+day|back\s+day)\b"
    r"|\b(تمرين|تمارين|بنش|سكوات|ديدليفت)",
    re.I,
)


def semantic_hints(message: str) -> list[str]:
    text = (message or "").strip()
    if not text:
        return []
    hints: list[str] = []
    if _PLATFORM.search(text) or _META.search(text):
        hints.append("platform")
    if _PLATFORM_NAV.search(text):
        hints.append("platform_nav")
    if _CHAT_META.search(text):
        hints.append("chat_memory")
    if _COACH_META.search(text):
        hints.append("coach")
    if _BODY_TYPE.search(text):
        hints.append("body_type")
    if _PROFILE.search(text):
        hints.append("profile")
    if _WORKOUT.search(text):
        hints.append("workout")
    if _SCIENTIFIC.search(text):
        hints.append("scientific")
    return hints


def refine_intent_from_rules(rules_intent: str, message: str) -> str:
    """
    When rules return `general`, map common paraphrases to a specific intent.
    """
    if rules_intent != "general":
        return rules_intent

    text = (message or "").strip()
    hints = semantic_hints(text)

    if rules_intent in ("workout", "execute_action", "nutrition") and "platform_nav" in hints:
        return "platform_help"

    if "platform" in hints or "coach" in hints or "chat_memory" in hints or "platform_nav" in hints:
        return "platform_help"
    if "profile" in hints and "body_type" not in hints:
        return "personal_status"
    if "body_type" in hints:
        return "general"
    if "workout" in hints:
        return "workout"
    if "scientific" in hints and "workout" not in hints:
        return "scientific"

    # Platform name alone or short "what is X" with Taqwin
    if _PLATFORM.search(text):
        return "platform_help"
    if _META.search(text) and len(text.split()) <= 8:
        return "platform_help"

    return "general"
