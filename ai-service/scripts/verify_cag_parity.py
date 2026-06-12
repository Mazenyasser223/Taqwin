#!/usr/bin/env python3
"""Emit sanitized CAG fixture JSON for Node/Python parity checks."""

from __future__ import annotations

import json
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.services.cag_sanitize import sanitize_cag_bundle  # noqa: E402


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: verify_cag_parity.py <fixture.json> <out.json>", file=sys.stderr)
        return 2
    fixture_path = Path(sys.argv[1])
    out_path = Path(sys.argv[2])
    fixture = json.loads(fixture_path.read_text(encoding="utf-8"))
    sanitized = sanitize_cag_bundle(fixture) or {}
    out_path.write_text(
        json.dumps(sanitized, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
