#!/usr/bin/env python3
"""Patch generic 'Grounded answer for…' strings in golden_dataset.json."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from eval.reference_answers import reference_answer_for_case  # noqa: E402

DATASET = ROOT / "eval" / "golden_dataset.json"


def main() -> int:
    data = json.loads(DATASET.read_text(encoding="utf-8"))
    patched = 0
    for case in data.get("cases") or []:
        new_answer = reference_answer_for_case(case)
        if new_answer:
            case["reference_answer"] = new_answer
            patched += 1
    DATASET.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Patched {patched} reference_answer fields in {DATASET}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
