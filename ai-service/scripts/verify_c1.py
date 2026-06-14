#!/usr/bin/env python3
"""
Block C1 smoke verify — run with ai-service up: uvicorn app.main:app --port 8000
Or pass AI_SERVICE_URL (default http://127.0.0.1:8000).
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

# Allow `python scripts/verify_c1.py` from ai-service/
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))

BASE = os.environ.get("AI_SERVICE_URL", "http://127.0.0.1:8000").rstrip("/")

BUNDLE = {
    "locale": "ar",
    "profile": {"fitnessGoal": "muscle", "weightKg": 75, "gender": "male"},
    "onboardingSummary": {"trainingDaysPerWeek": 4, "mealsPerDay": 3},
    "nutritionToday": {
        "targets": {
            "calories": 2200,
            "protein": 150,
            "carbs": 220,
            "fat": 70,
            "waterMl": 2500,
        }
    },
    "constraints": {"injuries": []},
}


def post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.loads(res.read().decode("utf-8"))


def verify_local() -> int:
    """In-process checks (no uvicorn) — fast CI path."""
    from unittest.mock import patch

    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    errors: list[str] = []

    health = client.get("/health").json()
    if health.get("status") != "ok":
        errors.append(f"health: {health}")
    print(f"OK  GET /health (local) -> v{health.get('version')}")

    body = {
        "userId": "00000000-0000-4000-8000-000000000001",
        "contextBundle": BUNDLE,
        "weekStart": "2026-06-02",
        "foods": [],
        "exercises": [],
        "bookChunks": [],
    }
    with patch("app.services.plan_generate.is_llm_configured", return_value=False):
        gen = client.post("/plan/generate", json=body).json()
    _check_generate(gen, errors)

    keep = client.post(
        "/plan/adapt",
        json={
            "userId": body["userId"],
            "contextBundle": BUNDLE,
            "decisionHint": "keep",
        },
    ).json()
    if keep.get("plan") is not None:
        errors.append("adapt keep plan should be null")

    micro = client.post(
        "/plan/adapt",
        json={
            "userId": body["userId"],
            "contextBundle": BUNDLE,
            "decisionHint": "micro",
        },
    ).json()
    if not micro.get("plan"):
        errors.append("adapt micro missing plan")

    if errors:
        print("\nC1 local verify FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1
    print("\nC1 local verify PASSED")
    return 0


def _check_generate(gen: dict, errors: list[str]) -> None:
    plan = gen.get("plan") or {}
    if gen.get("source") not in ("ai", "scaffold"):
        errors.append(f"generate source: {gen.get('source')}")
    if len(plan.get("dietDays") or []) != 7:
        errors.append(f"dietDays: {len(plan.get('dietDays') or [])}")
    if len(plan.get("workoutWeeks") or []) != 4:
        errors.append(f"workoutWeeks: {len(plan.get('workoutWeeks') or [])}")
    print(
        f"OK  POST /plan/generate -> source={gen.get('source')} "
        f"dietDays=7 workoutWeeks=4"
    )


def main() -> int:
    if "--local" in sys.argv:
        return verify_local()

    errors: list[str] = []

    try:
        with urllib.request.urlopen(f"{BASE}/health", timeout=5) as res:
            health = json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError) as exc:
        print(f"FAIL: cannot reach {BASE}/health — {exc}")
        print("Start: cd ai-service && uvicorn app.main:app --port 8000")
        return 1

    if health.get("status") != "ok":
        errors.append(f"health status: {health}")

    print(f"OK  GET /health -> {health.get('service')} v{health.get('version')}")

    gen = post(
        "/plan/generate",
        {
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": BUNDLE,
            "weekStart": "2026-06-02",
            "foods": [],
            "exercises": [],
            "bookChunks": [],
        },
    )
    _check_generate(gen, errors)
    plan = gen.get("plan") or {}
    dt = plan.get("dailyTargets") or {}
    for key in ("calories", "protein", "carbs", "fat", "waterMl"):
        if not dt.get(key):
            errors.append(f"dailyTargets.{key} missing")
    if not gen.get("explainabilityText"):
        errors.append("explainabilityText missing")

    keep = post(
        "/plan/adapt",
        {
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": BUNDLE,
            "decisionHint": "keep",
            "snapshot": {"adherencePct": 0.85},
        },
    )
    if keep.get("plan") is not None:
        errors.append("adapt keep should return plan=null")
    if keep.get("adaptation", {}).get("decision") != "keep":
        errors.append(f"adapt keep decision: {keep.get('adaptation')}")

    print(f"OK  POST /plan/adapt keep -> applied={keep.get('adaptation', {}).get('applied')}")

    micro = post(
        "/plan/adapt",
        {
            "userId": "00000000-0000-4000-8000-000000000001",
            "contextBundle": BUNDLE,
            "decisionHint": "micro",
        },
    )
    if not micro.get("plan"):
        errors.append("adapt micro should return plan")
    if micro.get("adaptation", {}).get("decision") != "micro":
        errors.append(f"adapt micro: {micro.get('adaptation')}")

    print(f"OK  POST /plan/adapt micro -> source={micro.get('source')}")

    if errors:
        print("\nC1 verify FAILED:")
        for e in errors:
            print(f"  - {e}")
        return 1

    print("\nC1 verify PASSED (all checks)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
