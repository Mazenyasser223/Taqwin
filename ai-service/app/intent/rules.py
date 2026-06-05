"""
Rule-based intent classifier (Block B7 — first pass).

English + Arabic keyword patterns. First match wins; default `general` (LLM may refine).
"""

from __future__ import annotations

import re

# Order matters — more specific intents first.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "exercise_alternative",
        re.compile(
            r"\b(alternative|substitute|replace|instead of|swap)\b.*\b(exercise|lift|bench|squat|deadlift)\b"
            r"|(بديل|بدل|استبدال).*(تمرين|بنش|سكوات|ديدليفت)"
            r"|(تمرين|بنش).*(بديل|بدل)",
            re.I,
        ),
    ),
    (
        "execute_action",
        re.compile(
            r"\b(log|record|track|add)\b.*\b(meal|meals|food|lunch|dinner|breakfast|workout|exercise|calories)\b"
            r"|\b(سجل|سجّل|ضيف|أضف|احسب)\b.*\b(وجبة|أكل|تمرين|سعرات|فطار|غدا|عشا)\b"
            r"|\b(replace|swap|skip)\b.*\b(today|meal|exercise|workout)\b"
            r"|\b(بدّل|بدل|استبدل)\b.*\b(النهارده|اليوم|وجبة|تمرين)\b",
            re.I,
        ),
    ),
    (
        "platform_help",
        re.compile(
            r"\b(taqwin|takween|app|platform|onboarding|how to use|subscription|account|dashboard|features?)\b"
            r"|\b(تكوين|تكوّين|التطبيق|المنصة|ازاي|إزاي|كيف\s+أستخدم|اشتراك|حساب|ميزات|خدمات|المدرب\s*الذكي)\b"
            r"|(من\s+هي|من\s+هو|ما\s+هو|ما\s+هي|مين\s+هي|مين\s+هو|ايه\s+هو|إيه\s+هو|ايه\s+هي|إيه\s+هي)",
            re.I,
        ),
    ),
    (
        "scientific",
        re.compile(
            r"\b(science|study|research|evidence|laws of|hypertrophy|progressive overload)\b"
            r"|\b(علمي|دراسة|بحث|قوانين|نمو العضلات|تدريج)\b",
            re.I,
        ),
    ),
    (
        "nutrition",
        re.compile(
            r"\b(diet|meal|nutrition|macro|calorie|protein|carb|food|eat|breakfast|lunch|dinner)\b"
            r"|\b(دايت|وجبة|وجبات|تغذية|سعرات|بروتين|أكل|اكل|فطار|غدا|عشا)\b",
            re.I,
        ),
    ),
    (
        "workout",
        re.compile(
            r"\b(workout|training|exercise|sets|reps|program|routine|push pull legs)\b"
            r"|\b(تمرين|تمارين|برنامج|تدريب|مجموعات|عدات)\b",
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


def classify_intent(message: str) -> str:
    text = (message or "").strip()
    if not text:
        return "unclear"
    for intent, pattern in _PATTERNS:
        if not pattern.search(text):
            continue
        if intent == "nutrition" and _ACTION_VERB.search(text):
            continue
        return intent
    return "general"
