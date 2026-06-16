"""Standalone Tier 1 smoke tests (stdlib only; no pytest/pip required)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_module(name: str, rel_path: str):
    path = ROOT / rel_path
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


rewrite_mod = _load_module("app.rag.query_rewrite", "app/rag/query_rewrite.py")
rewrite_retrieval_query = rewrite_mod.rewrite_retrieval_query


def test_ar_exercise_alternative() -> None:
    q = rewrite_retrieval_query(
        user_message="بديل للبنش",
        intent="exercise_alternative",
        locale="ar",
    )
    assert "bench press" in q.lower(), q
    assert "alternative" in q.lower(), q


def test_english_preserved() -> None:
    q = rewrite_retrieval_query(
        user_message="bench press alternative",
        intent="exercise_alternative",
        locale="en",
    )
    assert "bench press" in q


def test_cag_hints() -> None:
    q = rewrite_retrieval_query(
        user_message="وجبة غداء",
        intent="nutrition",
        locale="ar",
        context_bundle={"profile": {"fitnessGoal": "muscle gain"}},
    )
    assert "muscle gain" in q


def main() -> int:
    tests = [
        test_ar_exercise_alternative,
        test_english_preserved,
        test_cag_hints,
    ]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASS {fn.__name__}")
        except Exception as exc:
            failed += 1
            print(f"FAIL {fn.__name__}: {exc}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
