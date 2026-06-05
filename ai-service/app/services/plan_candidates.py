"""
Resolve food/exercise/book whitelist for plan generation (Node RAG + ai-service pgvector RAG).
"""

from __future__ import annotations

import logging
from typing import Any

from app.clients.node_internal import NodeInternalError, rag_search
from app.prompts.plan_prompts import _onboarding_flat

logger = logging.getLogger(__name__)


def _plan_rag_query(bundle: dict[str, Any]) -> str:
    onboarding = _onboarding_flat(bundle)
    profile = bundle.get("profile") or {}
    parts = [
        str(profile.get("fitnessGoal") or onboarding.get("primaryGoal") or "fitness plan"),
        str(onboarding.get("dietType") or ""),
        str(onboarding.get("preferredSplit") or onboarding.get("workoutLocation") or ""),
        "meal plan workout exercises coaching",
    ]
    injuries = onboarding.get("injuries") or (bundle.get("constraints") or {}).get("injuries") or []
    if injuries:
        parts.append(f"injuries {' '.join(str(i) for i in injuries if i)}")
    return " ".join(p for p in parts if p).strip()[:500]


def _hits_to_book_chunks(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for row in hits:
        out.append(
            {
                "topic": row.get("title") or row.get("level"),
                "text": row.get("content") or "",
            }
        )
    return out


def _merge_unique_foods(existing: list[dict[str, Any]], extra: list[dict[str, Any]], cap: int = 50) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for item in [*existing, *extra]:
        key = str(item.get("id") or item.get("foodItemId") or item.get("name") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= cap:
            break
    return merged


def _merge_unique_exercises(
    existing: list[dict[str, Any]], extra: list[dict[str, Any]], cap: int = 60
) -> list[dict[str, Any]]:
    seen: set[str] = set()
    merged: list[dict[str, Any]] = []
    for item in [*existing, *extra]:
        key = str(item.get("id") or item.get("exerciseId") or item.get("name") or "")
        if not key or key in seen:
            continue
        seen.add(key)
        merged.append(item)
        if len(merged) >= cap:
            break
    return merged


def resolve_plan_candidates(
    *,
    bundle: dict[str, Any],
    foods: list[dict[str, Any]] | None,
    exercises: list[dict[str, Any]] | None,
    book_chunks: list[dict[str, Any]] | None,
    locale: str,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """
    Returns (foods, exercises, book_chunks).
    Node-passed lists are merged with internal RAG when sparse.
    """
    food_list = list(foods) if foods else []
    ex_list = list(exercises) if exercises else []
    books = list(book_chunks) if book_chunks else []

    query = _plan_rag_query(bundle)
    try:
        if len(food_list) < 12:
            payload = rag_search(query=query, levels=["L3_NUTRITION"], limit=20, locale=locale)
            food_list = _merge_unique_foods(food_list, _rag_foods_from_hits(payload.get("results") or []))
        if len(ex_list) < 15:
            payload = rag_search(query=query, levels=["L2_EXERCISE"], limit=25, locale=locale)
            ex_list = _merge_unique_exercises(ex_list, _rag_exercises_from_hits(payload.get("results") or []))
        if len(books) < 4:
            payload = rag_search(query=query, levels=["L5_BOOKS"], limit=8, locale=locale)
            extra = _hits_to_book_chunks(payload.get("results") or [])
            seen = {str(b.get("text", ""))[:80] for b in books}
            for chunk in extra:
                key = str(chunk.get("text", ""))[:80]
                if key and key not in seen:
                    books.append(chunk)
                    seen.add(key)
                if len(books) >= 10:
                    break
    except NodeInternalError as exc:
        logger.warning("Plan RAG candidates unavailable: %s", exc)
    except Exception as exc:
        logger.warning("Plan RAG candidates error: %s", exc)

    return food_list, ex_list, books


def _rag_foods_from_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    foods: list[dict[str, Any]] = []
    for hit in hits:
        meta = hit.get("metadata") if isinstance(hit.get("metadata"), dict) else {}
        name = meta.get("name") or hit.get("title") or ""
        if not name:
            continue
        fid = meta.get("foodItemId") or meta.get("id")
        wid = meta.get("webtebId")
        if fid:
            foods.append(
                {
                    "source": "foodItem",
                    "id": str(fid),
                    "name": name,
                    "calories": meta.get("calories") or 100,
                    "protein": meta.get("protein") or 10,
                    "carbs": meta.get("carbs") or 10,
                    "fat": meta.get("fat") or 5,
                }
            )
        elif wid:
            foods.append(
                {
                    "source": "webteb",
                    "webtebId": int(wid),
                    "name": name,
                    "calories": meta.get("calories") or 100,
                    "protein": meta.get("protein") or 10,
                    "carbs": meta.get("carbs") or 10,
                    "fat": meta.get("fat") or 5,
                }
            )
    return foods


def _rag_exercises_from_hits(hits: list[dict[str, Any]]) -> list[dict[str, Any]]:
    exercises: list[dict[str, Any]] = []
    for hit in hits:
        meta = hit.get("metadata") if isinstance(hit.get("metadata"), dict) else {}
        eid = meta.get("exerciseId") or meta.get("id")
        name = meta.get("name") or hit.get("title") or ""
        if not name:
            continue
        exercises.append(
            {
                "id": str(eid) if eid else None,
                "exerciseId": str(eid) if eid else None,
                "name": name,
                "category": meta.get("category") or "general",
                "primaryMuscles": meta.get("primaryMuscles") or [],
            }
        )
    return exercises
