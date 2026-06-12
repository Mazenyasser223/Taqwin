"""RAG eval baseline — record scores and gate regressions."""

from __future__ import annotations

import json
from dataclasses import is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_BASELINE_PATH = Path(__file__).resolve().parents[2] / "eval" / "baseline.json"

# Floors for `--check-baseline` (retrieval-focused; answer RAGAS metrics skipped in retrieval-only).
DEFAULT_MIN_CUSTOM: dict[str, float] = {
    "intent_accuracy": 0.70,
    "level_recall_avg": 0.85,
    "reference_overlap_avg": 0.70,
    "retrieval_hit_rate": 0.95,
}


def _report_scores(report: Any) -> tuple[dict[str, float], dict[str, float]]:
    if is_dataclass(report):
        ragas = dict(report.ragas_scores)
        custom = dict(report.custom_scores)
    elif isinstance(report, dict):
        ragas = dict(report.get("ragas") or report.get("ragas_scores") or {})
        custom = dict(report.get("custom") or report.get("custom_scores") or {})
    else:
        ragas = dict(getattr(report, "ragas_scores", {}) or {})
        custom = dict(getattr(report, "custom_scores", {}) or {})
    return ragas, custom


def write_baseline(
    report: Any,
    *,
    path: Path | None = None,
    mode: str = "retrieval-only",
    dataset_version: str = "1.0",
    case_count: int | None = None,
    min_custom: dict[str, float] | None = None,
    notes: str = "",
) -> Path:
    """Persist current eval scores as the checked-in baseline."""
    out = path or DEFAULT_BASELINE_PATH
    ragas, custom = _report_scores(report)
    if case_count is None and is_dataclass(report):
        case_count = int(report.case_count)
    elif case_count is None and isinstance(report, dict):
        case_count = int(report.get("case_count") or 0)

    payload = {
        "recorded_at": datetime.now(timezone.utc).isoformat(),
        "mode": mode,
        "dataset_version": dataset_version,
        "case_count": case_count,
        "scores": {"ragas": ragas, "custom": custom},
        "min_custom": min_custom or dict(DEFAULT_MIN_CUSTOM),
        "notes": notes
        or "RAGAS answer_* metrics are not gated in retrieval-only mode (stub answers).",
    }
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out


def load_baseline(path: Path | None = None) -> dict[str, Any]:
    p = path or DEFAULT_BASELINE_PATH
    if not p.is_file():
        raise FileNotFoundError(f"No baseline at {p}. Run with --write-baseline after a good eval.")
    return json.loads(p.read_text(encoding="utf-8"))


def check_baseline(
    report: Any,
    *,
    path: Path | None = None,
    retrieval_only: bool = False,
    min_custom: dict[str, float] | None = None,
) -> list[str]:
    """Return human-readable failures when current scores fall below baseline floors."""
    baseline = load_baseline(path)
    _, current_custom = _report_scores(report)
    floors = min_custom or dict(baseline.get("min_custom") or DEFAULT_MIN_CUSTOM)

    failures: list[str] = []
    for key, floor in floors.items():
        value = current_custom.get(key)
        if value is None:
            failures.append(f"custom.{key}: missing (floor {floor})")
        elif float(value) < float(floor):
            failures.append(f"custom.{key}: {value} < floor {floor}")

    if not retrieval_only:
        baseline_ragas = (baseline.get("scores") or {}).get("ragas") or {}
        ragas, _ = _report_scores(report)
        for key, ref in baseline_ragas.items():
            if key in ("answer_relevancy", "faithfulness") and baseline.get("mode") == "retrieval-only":
                continue
            value = ragas.get(key)
            if value is not None and ref and float(value) < float(ref) * 0.85:
                failures.append(f"ragas.{key}: {value} < 85% of baseline {ref}")

    return failures
