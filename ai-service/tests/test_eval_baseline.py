"""Unit tests for RAG eval baseline helpers (no live Node / RAGAS)."""

from __future__ import annotations

from app.eval.baseline import check_baseline, write_baseline


class _FakeReport:
    def __init__(self, custom: dict[str, float], ragas: dict[str, float] | None = None) -> None:
        self.custom_scores = custom
        self.ragas_scores = ragas or {}
        self.case_count = 12


def test_check_baseline_passes_at_floors(tmp_path):
    baseline_path = tmp_path / "baseline.json"
    write_baseline(
        _FakeReport(
            {
                "intent_accuracy": 0.75,
                "level_recall_avg": 0.95,
                "reference_overlap_avg": 0.81,
                "retrieval_hit_rate": 1.0,
            }
        ),
        path=baseline_path,
        mode="retrieval-only",
    )
    report = _FakeReport(
        {
            "intent_accuracy": 0.72,
            "level_recall_avg": 0.86,
            "reference_overlap_avg": 0.71,
            "retrieval_hit_rate": 0.96,
        }
    )
    assert check_baseline(report, path=baseline_path, retrieval_only=True) == []


def test_check_baseline_fails_below_floor(tmp_path):
    baseline_path = tmp_path / "baseline.json"
    write_baseline(
        _FakeReport({"intent_accuracy": 0.75, "level_recall_avg": 0.95, "reference_overlap_avg": 0.81, "retrieval_hit_rate": 1.0}),
        path=baseline_path,
        mode="retrieval-only",
    )
    report = _FakeReport(
        {"intent_accuracy": 0.60, "level_recall_avg": 0.95, "reference_overlap_avg": 0.81, "retrieval_hit_rate": 1.0}
    )
    failures = check_baseline(report, path=baseline_path, retrieval_only=True)
    assert any("intent_accuracy" in f for f in failures)
