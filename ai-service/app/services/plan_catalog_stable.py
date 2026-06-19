"""Deterministic ordering for plan RAG catalogs."""

from __future__ import annotations

from typing import Any


def _food_key(item: dict[str, Any]) -> str:
    if item.get("id"):
        return f"food:{item['id']}"
    if item.get("foodItemId"):
        return f"food:{item['foodItemId']}"
    if item.get("webtebId") is not None:
        return f"webteb:{item['webtebId']}"
    return f"name:{str(item.get('name') or '').lower()}"


def _exercise_key(item: dict[str, Any]) -> str:
    eid = item.get("id") or item.get("exerciseId")
    if eid:
        return f"exercise:{eid}"
    return f"name:{str(item.get('name') or '').lower()}"


def _book_key(chunk: dict[str, Any]) -> str:
    topic = str(chunk.get("topic") or chunk.get("title") or "").lower()
    text = str(chunk.get("text") or chunk.get("content") or "")[:80].lower()
    return f"{topic}:{text}"


def stable_sort_plan_catalogs(
    foods: list[dict[str, Any]],
    exercises: list[dict[str, Any]],
    books: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    return (
        sorted(foods, key=_food_key),
        sorted(exercises, key=_exercise_key),
        sorted(books, key=_book_key),
    )
