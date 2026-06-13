#!/usr/bin/env python3
"""
Run full Taqwin RAG evaluation with RAGAS.

Requires:
  - backend-node running (pgvector + embeddings)
  - AI_INTERNAL_KEY in ai-service/.env (same as backend-node)
  - OPENAI_API_KEY in backend-node/.env (RAGAS judge + embeddings)
  - ANTHROPIC_API_KEY in ai-service/.env (end-to-end coach answers)

Usage:
  cd ai-service
  python scripts/eval_rag_ragas.py
  python scripts/eval_rag_ragas.py --retrieval-only
  python scripts/eval_rag_ragas.py --retrieval-only --check-baseline
  python scripts/eval_rag_ragas.py --retrieval-only --write-baseline
  python scripts/eval_rag_ragas.py --ids platform_en_1 nutrition_en_1
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.eval.bootstrap import ensure_eval_keys, load_eval_env  # noqa: E402

load_eval_env()

from app.clients.node_internal import NodeInternalError, rag_search  # noqa: E402
from app.eval.baseline import check_baseline, write_baseline  # noqa: E402
from app.eval.ragas_runner import load_golden_dataset, run_evaluation_sync  # noqa: E402


def _ping_node() -> None:
    try:
        rag_search(query="health check", levels=["L1_INTERNAL"], limit=1)
    except NodeInternalError as exc:
        print(f"FAIL: backend-node RAG unavailable: {exc}")
        print("Start backend: cd backend-node && npm run dev")
        sys.exit(1)


def main() -> int:
    parser = argparse.ArgumentParser(description="Taqwin RAG RAGAS evaluation")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=ROOT / "eval" / "golden_dataset.json",
        help="Golden dataset JSON path",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=ROOT / "eval" / "results",
        help="Directory for JSON + markdown reports",
    )
    parser.add_argument(
        "--retrieval-only",
        action="store_true",
        help="Skip Claude generation (RAGAS retrieval metrics only)",
    )
    parser.add_argument("--ids", nargs="*", help="Run subset of case ids")
    parser.add_argument(
        "--expected-level",
        dest="expected_level",
        metavar="LEVEL",
        help="Only cases whose expected_levels include this level (e.g. L1_INTERNAL)",
    )
    parser.add_argument(
        "--rescore-only",
        action="store_true",
        help="Re-run RAGAS judge on last cached pipeline output (no retrieval/LLM)",
    )
    parser.add_argument("--judge-model", default="gpt-4o-mini", help="OpenAI model for RAGAS judge")
    parser.add_argument(
        "--write-baseline",
        action="store_true",
        help="Write scores to eval/baseline.json after a successful run",
    )
    parser.add_argument(
        "--check-baseline",
        action="store_true",
        help="Fail if custom metrics fall below eval/baseline.json floors",
    )
    parser.add_argument(
        "--baseline",
        type=Path,
        default=ROOT / "eval" / "baseline.json",
        help="Baseline JSON for --write-baseline / --check-baseline",
    )
    args = parser.parse_args()

    ok, missing = ensure_eval_keys()
    if not ok:
        print("FAIL: missing env:", ", ".join(missing))
        return 1

    if args.rescore_only:
        from app.eval.ragas_runner import rescore_from_cache

        print("Taqwin RAG RAGAS rescore (cached pipeline)")
        report = rescore_from_cache(
            output_dir=args.output_dir,
            ragas_judge_model=args.judge_model,
        )
    else:
        print("Taqwin RAG RAGAS evaluation")
        print(f"Dataset: {args.dataset}")
        print(f"Mode: {'retrieval-only' if args.retrieval_only else 'end-to-end'}")
        if args.expected_level:
            print(f"Filter: expected_levels includes {args.expected_level}")
        _ping_node()
        print("OK: Node rag/search reachable")

        report = run_evaluation_sync(
            dataset_path=args.dataset,
            output_dir=args.output_dir,
            skip_llm=args.retrieval_only,
            case_ids=args.ids,
            expected_level=args.expected_level,
            ragas_judge_model=args.judge_model,
        )

    print("\n=== RAGAS scores ===")
    for k, v in sorted(report.ragas_scores.items()):
        print(f"  {k}: {v:.4f}")

    print("\n=== Taqwin custom metrics ===")
    for k, v in sorted(report.custom_scores.items()):
        print(f"  {k}: {v}")

    if report.subset_scores:
        print("\n=== Subset metrics ===")
        for label, block in report.subset_scores.items():
            print(f"  [{label}] {block.get('case_count', '?')} cases")
            custom = block.get("custom") or {}
            for k, v in sorted(custom.items()):
                print(f"    {k}: {v}")
            ragas = block.get("ragas") or {}
            for k, v in sorted(ragas.items()):
                print(f"    ragas.{k}: {v:.4f}")

    if report.failures:
        print("\n=== Failures ===")
        for f in report.failures:
            print(f"  - {f}")

    baseline_failures: list[str] = []

    if report.report_json_path:
        print(f"\nReport JSON: {report.report_json_path}")
        print(f"Report MD:   {report.report_md_path}")

    if args.write_baseline:
        version, _ = load_golden_dataset(args.dataset)
        baseline_path = write_baseline(
            report,
            path=args.baseline,
            mode="retrieval-only" if args.retrieval_only else "end-to-end",
            dataset_version=version,
            case_count=report.case_count,
        )
        print(f"\nBaseline written: {baseline_path}")

    if args.check_baseline:
        baseline_failures = check_baseline(
            report,
            path=args.baseline,
            retrieval_only=args.retrieval_only,
        )
        if baseline_failures:
            print("\n=== Baseline regressions ===")
            for f in baseline_failures:
                print(f"  - {f}")
        else:
            print("\nOK: meets eval/baseline.json floors")

    # Also print compact JSON to stdout for CI
    summary = {
        "ragas": report.ragas_scores,
        "custom": report.custom_scores,
        "subset_scores": report.subset_scores,
        "failures": report.failures,
        "baseline_failures": baseline_failures,
        "case_count": report.case_count,
    }
    print("\n" + json.dumps(summary, indent=2))

    if report.failures and not report.ragas_scores:
        return 1
    if baseline_failures:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
