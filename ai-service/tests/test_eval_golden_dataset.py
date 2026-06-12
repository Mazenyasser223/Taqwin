"""Golden RAG eval dataset — schema checks (no RAGAS / live Node required)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

DATASET = Path(__file__).resolve().parents[1] / "eval" / "golden_dataset.json"

REQUIRED_CASE_FIELDS = (
    "id",
    "locale",
    "question",
    "expected_intent",
    "expected_levels",
    "reference_answer",
    "reference_contexts",
)

VALID_LOCALES = {"en", "ar"}
VALID_LEVELS = {"L1_INTERNAL", "L2_EXERCISE", "L3_NUTRITION", "L5_BOOKS"}
KNOWN_INTENTS = {
    "platform_help",
    "nutrition",
    "workout",
    "exercise_alternative",
    "scientific",
    "life_mode",
    "general",
}


@pytest.fixture(scope="module")
def golden() -> dict:
    assert DATASET.is_file(), f"missing {DATASET}"
    return json.loads(DATASET.read_text(encoding="utf-8"))


def test_golden_dataset_version_and_cases(golden: dict) -> None:
    assert golden.get("version")
    cases = golden.get("cases")
    assert isinstance(cases, list) and len(cases) >= 8


def test_golden_dataset_case_schema(golden: dict) -> None:
    ids: list[str] = []
    for case in golden["cases"]:
        for field in REQUIRED_CASE_FIELDS:
            assert field in case, f"{case.get('id', '?')} missing {field}"
        ids.append(case["id"])
        assert case["locale"] in VALID_LOCALES, case["id"]
        assert case["question"].strip(), case["id"]
        assert case["reference_answer"].strip(), case["id"]
        assert case["reference_contexts"], case["id"]
        for level in case["expected_levels"]:
            assert level in VALID_LEVELS, f"{case['id']} bad level {level}"
        assert case["expected_intent"] in KNOWN_INTENTS, case["id"]

    assert len(ids) == len(set(ids)), "duplicate case ids"


def test_golden_dataset_no_l4_levels(golden: dict) -> None:
    for case in golden["cases"]:
        for level in case["expected_levels"]:
            assert "L4" not in level, f"{case['id']} still references L4: {level}"


BASELINE = Path(__file__).resolve().parents[1] / "eval" / "baseline.json"
REQUIRED_BASELINE_CUSTOM = (
    "intent_accuracy",
    "level_recall_avg",
    "reference_overlap_avg",
    "retrieval_hit_rate",
)


@pytest.fixture(scope="module")
def baseline() -> dict:
    assert BASELINE.is_file(), f"missing {BASELINE}"
    return json.loads(BASELINE.read_text(encoding="utf-8"))


def test_baseline_schema(baseline: dict) -> None:
    assert baseline.get("mode")
    assert baseline.get("dataset_version")
    scores = baseline.get("scores") or {}
    custom = scores.get("custom") or {}
    min_custom = baseline.get("min_custom") or {}
    for key in REQUIRED_BASELINE_CUSTOM:
        assert key in custom, f"baseline scores.custom missing {key}"
        assert key in min_custom, f"baseline min_custom missing {key}"
        assert float(min_custom[key]) <= float(custom[key])
