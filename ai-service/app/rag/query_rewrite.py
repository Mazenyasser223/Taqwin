"""
Tier 2 retrieval query rewriting — extends Tier 1 with full CAG-informed enrichment.

Flow: user message → rewrite → hybrid retrieve → rerank → filter → format_rag_context
"""

from __future__ import annotations

import re
from typing import Any

# Arabic / Egyptian fitness slang → English retrieval terms.
_AR_EXERCISE_TERMS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"بنش\s*بر(?:ess|س)", re.I), "bench press"),
    (re.compile(r"ل?بنش", re.I), "bench press"),
    (re.compile(r"سكوات", re.I), "squat"),
    (re.compile(r"ديدليفت", re.I), "deadlift"),
    (re.compile(r"ضغط", re.I), "press"),
    (re.compile(r"عقلة", re.I), "pull-up"),
    (re.compile(r"كتف", re.I), "shoulder"),
    (re.compile(r"صدر", re.I), "chest"),
    (re.compile(r"ظهر", re.I), "back"),
    (re.compile(r"أ?رجل|ارجل", re.I), "legs"),
    (re.compile(r"باي|ذراع", re.I), "biceps arms"),
    (re.compile(r"تمرين|تمارين", re.I), "exercise"),
)

_AR_NUTRITION_TERMS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"بروتين", re.I), "protein"),
    (re.compile(r"سعرات", re.I), "calories"),
    (re.compile(r"وجبات", re.I), "meals"),
    (re.compile(r"وجبة", re.I), "meal"),
    (re.compile(r"فطار", re.I), "breakfast"),
    (re.compile(r"غداء|غدا", re.I), "lunch"),
    (re.compile(r"عشاء|عشا", re.I), "dinner"),
    (re.compile(r"دايت", re.I), "diet nutrition"),
    (re.compile(r"أ?كل|اكل", re.I), "food meal"),
    (re.compile(r"فول", re.I), "foul fava beans"),
)

_AR_PLATFORM_TERMS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"تسجيل|اسجل|أسجل|سجل", re.I), "log logging record track"),
    (re.compile(r"خطة|الخطة", re.I), "plan weekly program schedule"),
    (re.compile(r"مجتمع|كوميونيتي|كومنتي", re.I), "community posts social"),
    (re.compile(r"لغة|اللغة", re.I), "language locale Arabic English"),
    (re.compile(r"تكوين", re.I), "Taqwin platform app"),
    (re.compile(r"إعدادات|اعدادات|الإعدادات", re.I), "settings profile account"),
    (re.compile(r"وزن|الوزن", re.I), "weight body tracking"),
    (re.compile(r"أونبورد|اونبورد|البداية", re.I), "onboarding getting started"),
    (re.compile(r"إزاي|ازاي", re.I), "how to"),
    (re.compile(r"تصدير|export", re.I), "export download history data"),
)

_AR_UNCLEAR_TERMS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"^\s*help\s*$", re.I), "help getting started what can you help with Taqwin coach"),
    (re.compile(r"مساعدة|مش\s*فاهم|مش\s*عارف", re.I), "help getting started what can you do Taqwin coach"),
)

_INTENT_SUFFIX: dict[str, str] = {
    "exercise_alternative": "alternative substitute exercise compound movement",
    "workout": "workout training program sets reps",
    "nutrition": "nutrition meal macros calories protein",
    "scientific": "exercise science research evidence hypertrophy",
    "platform_help": (
        "Taqwin platform app features onboarding food log workout plan "
        "community language settings profile navigation help"
    ),
    "unclear": (
        "Taqwin getting started what can you help with platform features coach guide help"
    ),
    "life_mode": "training adaptation life schedule deload",
    "general": "fitness coaching training nutrition",
}

_HAS_LATIN = re.compile(r"[A-Za-z]")


def _as_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if v and str(v).strip() and str(v).strip() != "none"]


def _extract_cag_hints(context_bundle: dict[str, Any] | None, intent: str) -> str:
    """Enrich retrieval query from CAG: profile, constraints, today's workout/nutrition, goal, lifeMode."""
    if not context_bundle:
        return ""

    profile = context_bundle.get("profile") or {}
    constraints = context_bundle.get("constraints") or {}
    parts: list[str] = []

    for key in ("fitnessGoal", "fitnessLevel", "gender"):
        val = profile.get(key)
        if val:
            parts.append(str(val))

    goal = str(profile.get("fitnessGoal") or "").lower()
    if "lose" in goal or "fat" in goal:
        parts.append("fat loss high protein deficit")
    elif "muscle" in goal or "build" in goal or "hypertrophy" in goal:
        parts.append("muscle gain hypertrophy high protein")

    injuries = _as_list(constraints.get("injuries"))
    for inj in injuries[:3]:
        parts.append(f"avoid {inj}")

    life_mode = constraints.get("lifeMode") or context_bundle.get("lifeMode")
    if life_mode and life_mode != "normal":
        parts.append(f"life mode {life_mode} training adaptation")

    if intent in ("exercise_alternative", "workout"):
        workout_today = context_bundle.get("workoutToday") or {}
        exercises = workout_today.get("exercises") or workout_today.get("loggedExercises") or []
        if isinstance(exercises, list) and exercises:
            ex = exercises[0] if isinstance(exercises[0], dict) else {}
            name = ex.get("name") or ex.get("exerciseName")
            if name:
                parts.append(f"alternatives for logged exercise {name}")
            muscles = ex.get("primaryMuscles") or ex.get("muscles") or []
            if muscles:
                parts.extend(str(m) for m in muscles[:2])

    if intent == "nutrition":
        nutrition_today = context_bundle.get("nutritionToday") or {}
        if nutrition_today.get("proteinTarget"):
            parts.append(f"protein target {nutrition_today['proteinTarget']}g")
        recent = nutrition_today.get("recentFoods") or nutrition_today.get("loggedFoods") or []
        if isinstance(recent, list):
            for food in recent[:3]:
                if isinstance(food, dict) and food.get("name"):
                    parts.append(str(food["name"]))

        diet = constraints.get("dietType") or constraints.get("religiousDiet")
        if diet and diet != "none":
            parts.append(str(diet))

    memories = context_bundle.get("aiMemories") or []
    if isinstance(memories, list):
        for mem in memories[:2]:
            if isinstance(mem, dict) and mem.get("summary"):
                parts.append(str(mem["summary"])[:120])

    signals = context_bundle.get("behavioralSignals") or {}
    if isinstance(signals, dict):
        prefs = signals.get("preferences") or signals.get("mealPatterns")
        if prefs:
            parts.append(str(prefs)[:100])

    return " ".join(parts).strip()


def _apply_term_map(text: str, mapping: tuple[tuple[re.Pattern[str], str], ...]) -> str:
    out = text
    for pattern, replacement in mapping:
        out = pattern.sub(replacement, out)
    return out


def _expand_arabic_fitness_terms(text: str, *, intent: str = "") -> str:
    expanded = _apply_term_map(text, _AR_EXERCISE_TERMS)
    expanded = _apply_term_map(expanded, _AR_NUTRITION_TERMS)
    if intent == "platform_help":
        expanded = _apply_term_map(expanded, _AR_PLATFORM_TERMS)
    if intent == "unclear":
        expanded = _apply_term_map(expanded, _AR_UNCLEAR_TERMS)
    expanded = re.sub(
        r"(بديل|بدل|استبدال|إيه|ايه|ازاي|إزاي|النهارده|اليوم|عايز|عاوز|ل)",
        " ",
        expanded,
        flags=re.I,
    )
    return re.sub(r"\s+", " ", expanded).strip()


def rewrite_retrieval_query(
    *,
    user_message: str,
    intent: str,
    locale: str = "en",
    context_bundle: dict[str, Any] | None = None,
) -> str:
    """
    Build a focused retrieval query from the user turn + full CAG context.
    """
    msg = (user_message or "").strip()
    if not msg:
        return msg

    cag_hints = _extract_cag_hints(context_bundle, intent)
    parts: list[str] = [msg]

    if locale == "ar" or not _HAS_LATIN.search(msg):
        parts[0] = _expand_arabic_fitness_terms(msg, intent=intent)
    elif intent == "unclear" and re.search(r"^\s*help\s*$", msg, re.I):
        parts[0] = "help getting started what can you help with Taqwin coach"

    suffix = _INTENT_SUFFIX.get(intent, "")
    if suffix:
        parts.append(suffix)

    if cag_hints:
        parts.append(cag_hints)

    query = " ".join(p for p in parts if p).strip()
    return query or msg
