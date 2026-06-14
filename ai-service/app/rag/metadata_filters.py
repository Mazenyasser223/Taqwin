"""
Metadata-aware retrieval filters for coach chat RAG.
Applied during Node hybrid search (before reranking).
"""

from __future__ import annotations

from typing import Any

from app.rag.levels import L1_INTERNAL, L5_BOOKS


def _as_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip() for v in value if v and str(v).strip() and str(v).strip() != "none"]


def build_metadata_filters(
    *,
    intent: str,
    context_bundle: dict[str, Any] | None,
    locale: str = "en",
    level: str | None = None,
) -> dict[str, Any] | None:
    """
    Map intent + CAG bundle (+ optional level) → Node metadataFilters payload.

    | Intent               | Filters                                      |
    |----------------------|----------------------------------------------|
    | exercise_alternative | primaryMuscles, difficulty, injury exclusions|
    | nutrition            | dietType, religiousDiet, allergens           |
    | platform_help        | L1: docType=platform; L5: exclude catalog    |
    """
    bundle = context_bundle or {}
    profile = bundle.get("profile") or {}
    constraints = bundle.get("constraints") or {}
    onboarding = bundle.get("onboardingSummary") or {}
    nutrition_onboarding = (bundle.get("onboardingByFlow") or {}).get("nutrition") or {}

    filters: dict[str, Any] = {
        "chunkRoles": ["child", "standalone"],
        "requireEmbedding": True,
    }

    resolved = str(intent or "general")

    if resolved in ("platform_help", "unclear"):
        if level == L5_BOOKS:
            filters["excludeTags"] = ["catalog"]
            return filters
        if level is None or level == L1_INTERNAL:
            filters["docType"] = "platform"
            filters["excludeTags"] = ["catalog", "books"]
            if locale in ("en", "ar"):
                filters["locale"] = locale
            return filters
        return filters

    if resolved in ("exercise_alternative", "workout"):
        level = str(profile.get("fitnessLevel") or onboarding.get("fitnessLevel") or "").lower()
        if "beginner" in level or "novice" in level:
            filters["difficulty"] = ["beginner"]
            filters["excludeDifficulty"] = ["advanced"]
        elif "advanced" in level or "expert" in level:
            filters["difficulty"] = ["intermediate", "advanced"]
        elif level:
            filters["difficulty"] = ["beginner", "intermediate"]

        injuries = _as_list(constraints.get("injuries"))
        if injuries:
            filters["excludeExerciseNames"] = injuries

        workout_today = bundle.get("workoutToday") or {}
        exercises = workout_today.get("exercises") or workout_today.get("loggedExercises") or []
        if isinstance(exercises, list) and exercises:
            first = exercises[0] if isinstance(exercises[0], dict) else {}
            muscles = first.get("primaryMuscles") or first.get("muscles") or []
            if not muscles and first.get("muscleGroup"):
                muscles = [first["muscleGroup"]]
            if muscles:
                filters["primaryMuscles"] = [str(m) for m in muscles[:4]]
        return filters

    if resolved == "nutrition":
        diet_type = (
            constraints.get("dietType")
            or onboarding.get("dietType")
            or nutrition_onboarding.get("dietType")
        )
        if diet_type:
            filters["dietType"] = str(diet_type)

        religious = constraints.get("religiousDiet") or onboarding.get("religiousDiet")
        rel_list = _as_list(religious if isinstance(religious, list) else [religious] if religious else [])
        dietary = next(
            (r for r in rel_list if r.lower() not in ("none", "ramadan", "christian_fasting")),
            rel_list[0] if rel_list else "",
        )
        if dietary:
            filters["religiousDiet"] = str(dietary)

        allergy_filters = constraints.get("allergyFilters") or {}
        if isinstance(allergy_filters, dict) and allergy_filters.get("active"):
            keywords = allergy_filters.get("keywords") or []
            if keywords:
                filters["excludeAllergens"] = [str(k) for k in keywords[:24]]
        else:
            food_allergies = _as_list(
                constraints.get("foodAllergies")
                or onboarding.get("foodAllergies")
                or nutrition_onboarding.get("foodAllergies")
            )
            legacy = _as_list(
                constraints.get("allergies") or constraints.get("allergens") or onboarding.get("allergies")
            )
            merged = food_allergies or legacy
            if merged:
                filters["excludeAllergens"] = merged
        return filters

    return filters if len(filters) > 2 else None
