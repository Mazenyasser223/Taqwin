"""
Rule-based intent classifier (Block B7 — first pass).

English + Arabic keyword patterns. First match wins; default `general` (LLM may refine).
"""

from __future__ import annotations

import re

# Order matters — more specific intents first.
_HOW_TO = re.compile(
    r"\b(how\s+(do|can|to)|where\s+(do|can|to)|what\s+is\s+the\s+way)\b"
    r"|\b(ازاي|إزاي|كيف\s+أ|كيف\s+اس|كيف\s+أستخدم)\b",
    re.I,
)
_PLATFORM_CTX = re.compile(
    r"\b(taqwin|takween|takwin|app|platform|dashboard|account|settings|profile|subscription)\b"
    r"|\b(تكوين|تكوّين|التطبيق|المنصة|اشتراك|إعدادات|اعدادات|حساب|لوحة)\b",
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
_WORKOUT_SIGNAL = re.compile(
    r"\b(workouts?|training|exercises?|sets?|reps?|routines?|programs?|"
    r"bench|squat|deadlift|barbell|dumbbell|hypertrophy|leg\s+day|back\s+day|"
    r"chest|shoulder|biceps|triceps|pull[- ]?ups?|push[- ]?ups?)\b"
    r"|\b(تمرين|تمارين|برنامج|تدريب|مجموعات|عدات|بنش|سكوات|ديدليفت|صدر|ظهر|كتف)\b",
    re.I,
)

_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "exercise_alternative",
        re.compile(
            r"\b(alternative|substitute|replace|instead of|swap)\b.*\b(exercises?|lift|bench|squat|deadlift)\b"
            r"|(بديل|بدل|استبدال).*(تمرين|بنش|سكوات|ديدليفت)"
            r"|(تمرين|بنش).*(بديل|بدل)",
            re.I,
        ),
    ),
    (
        "platform_help",
        re.compile(
            r"\b(taqwin|takween|takwin|app|platform|onboarding|how to use|subscription|account|dashboard|features?|"
            r"settings|profile|language|locale|notification|export|download|history|navigation|smart\s*coach|"
            r"community|membership|gym)\b"
            r"|\b(تكوين|تكوّين|التطبيق|المنصة|ازاي|إزاي|كيف\s+أستخدم|اشتراك|حساب|ميزات|خدمات|المدرب\s*الذكي|"
            r"مجتمع|كوميونيتي|نادي|جيم|عضوية|لغة|إعدادات|اعدادات|تصدير|سجل|تاريخ)\b"
            r"|(من\s+هي|من\s+هو|ما\s+هو|ما\s+هي|مين\s+هي|مين\s+هو|ايه\s+هو|إيه\s+هو|اieh\s+هي|إيه\s+هي)"
            r"|\b(فين|اين|أين)\b.*\b(خطة|الخطة|التمرين|الأسبوعية)\b",
            re.I,
        ),
    ),
    (
        "execute_action",
        re.compile(
            r"\b(log|record|track|add)\b.*\b(meals?|food|lunch|dinner|breakfast|workouts?|exercises?|calories)\b"
            r"|\b(log|record|track|add)\b.*\b\d+\s*(g|gram|grams|oz|ml|ك|جرام)\b"
            r"|\b(سجل|سجّل|ضيف|أضف|احسب)\b.*\b(وجبة|أكل|تمرين|سعرات|فطار|غدا|عشا)\b"
            r"|\b(replace|swap|skip)\b.*\b(today|meal|exercise|workout)\b"
            r"|\b(بدّل|بدل|استبدل)\b.*\b(النهارده|اليوم|وجبة|تمرين)\b",
            re.I,
        ),
    ),
    (
        "workout",
        re.compile(
            r"\b(workouts?|training|exercises?|sets?|reps?|programs?|routines?|push pull legs|leg\s+day|back\s+day)\b"
            r"|\b(تمرين|تمارين|برنامج|تدريب|مجموعات|عدات)\b",
            re.I,
        ),
    ),
    (
        "scientific",
        re.compile(
            r"\b(science|study|research|evidence|laws of|progressive overload)\b"
            r"|\b(علمي|دراسة|بحث|قوانين|نمو العضلات|تدريج)\b",
            re.I,
        ),
    ),
    (
        "nutrition",
        re.compile(
            r"\b(diet|meals?|nutrition|macro|calories?|protein|carbs?|foods?|eat|breakfast|lunch|dinner)\b"
            r"|\b(دايت|وجبة|وجبات|تغذية|سعرات|بروتين|أكل|اكل|فطار|غدا|عشا)\b",
            re.I,
        ),
    ),
    (
        "personal_status",
        re.compile(
            r"\b(my weight|how am i|progress today|logged today|adherence)\b"
            r"|\b(وزني|تقدمي|سجلت|التزامي|وضعي)\b",
            re.I,
        ),
    ),
    (
        "life_mode",
        re.compile(r"\b(ramadan|travel|busy week|life mode|deload)\b|\b(رمضان|سفر|مشغول)\b", re.I),
    ),
]

_ACTION_VERB = re.compile(r"\b(log|record|track|add|سجل|سجّل|ضيف|أضف)\b", re.I)


def message_has_workout_signal(message: str) -> bool:
    return bool(_WORKOUT_SIGNAL.search((message or "").strip()))


def classify_intent(message: str) -> str:
    text = (message or "").strip()
    if not text:
        return "unclear"
    if _PLATFORM_NAV.search(text):
        return "platform_help"
    for intent, pattern in _PATTERNS:
        if not pattern.search(text):
            continue
        if intent == "nutrition" and _ACTION_VERB.search(text):
            continue
        if intent == "execute_action" and re.search(r"\b(export|download|تصدير)\b", text, re.I):
            continue
        if intent == "execute_action" and (_HOW_TO.search(text) or _PLATFORM_CTX.search(text)):
            continue
        if intent == "execute_action" and re.search(
            r"\b(فين|اين|أين|where)\b", text, re.I
        ) and re.search(r"\b(خطة|plan|workout)\b", text, re.I):
            continue
        if intent == "workout" and _PLATFORM_NAV.search(text):
            continue
        if intent == "scientific" and _WORKOUT_SIGNAL.search(text):
            continue
        return intent
    if _WORKOUT_SIGNAL.search(text):
        return "workout"
    return "general"
