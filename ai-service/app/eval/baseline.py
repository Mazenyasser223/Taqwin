"""RAG eval baseline — record scores and gate regressions (Tier 3)."""

from __future__ import annotations

import json
from dataclasses import is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

DEFAULT_BASELINE_PATH = Path(__file__).resolve().parents[2] / "eval" / "baseline.json"

# Floors for `--check-baseline` (retrieval-focused custom metrics).
DEFAULT_MIN_CUSTOM: dict[str, float] = {
    "intent_accuracy": 0.58,
    "level_recall_avg": 0.65,
    "reference_overlap_avg": 0.48,
    "retrieval_hit_rate": 0.88,
    "p95_retrieval_ms": 5000.0,
}

# RAGAS floors — gated in end-to-end mode; context metrics need real LLM answers.
DEFAULT_MIN_RAGAS: dict[str, float] = {
    "context_precision": 0.35,
    "faithfulness": 0.35,
    "context_recall": 0.55,
}

# Regression tolerance vs recorded baseline (end-to-end RAGAS).
RAGAS_REGRESSION_RATIO = 0.85


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
    min_ragas: dict[str, float] | None = None,
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
        "min_ragas": min_ragas or dict(DEFAULT_MIN_RAGAS),
        "notes": notes
        or "Tier 3: gates context_precision, faithfulness, p95 latency vs floors + regression.",
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
    min_ragas: dict[str, float] | None = None,
) -> list[str]:
    """Return human-readable failures when current scores fall below baseline floors."""
    baseline = load_baseline(path)
    _, current_custom = _report_scores(report)
    floors = min_custom or dict(baseline.get("min_custom") or DEFAULT_MIN_CUSTOM)
    ragas_floors = min_ragas or dict(baseline.get("min_ragas") or DEFAULT_MIN_RAGAS)

    failures: list[str] = []
    for key, floor in floors.items():
        value = current_custom.get(key)
        if value is None:
            failures.append(f"custom.{key}: missing (floor {floor})")
        elif key == "p95_retrieval_ms":
            if float(value) > float(floor):
                failures.append(f"custom.{key}: {value} > budget {floor}")
        elif float(value) < float(floor):
            failures.append(f"custom.{key}: {value} < floor {floor}")

    ragas, _ = _report_scores(report)
    for key, floor in ragas_floors.items():
        if retrieval_only and key in (
            "answer_relevancy",
            "faithfulness",
            "context_precision",
            "context_recall",
        ):
            continue
        value = ragas.get(key)
        if value is not None and float(value) < float(floor):
            failures.append(f"ragas.{key}: {value} < floor {floor}")

    if not retrieval_only:
        baseline_ragas = (baseline.get("scores") or {}).get("ragas") or {}
        for key, ref in baseline_ragas.items():
            if key in ("answer_relevancy",) and baseline.get("mode") == "retrieval-only":
                continue
            value = ragas.get(key)
            if value is not None and ref and float(value) < float(ref) * RAGAS_REGRESSION_RATIO:
                failures.append(f"ragas.{key}: {value} < 85% of baseline {ref}")

    return failures
