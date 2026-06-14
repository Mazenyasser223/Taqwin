#!/usr/bin/env python3
"""
Block B7 verification — intent router (rules + optional LLM).

  cd ai-service && python scripts/verify_b7.py
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.intent.router import route_intent

CASES = [
    ("nutrition", "high protein chicken meal", True, False),
    ("workout", "bench press program sets reps", True, False),
    ("platform_help", "how does Taqwin onboarding work", True, False),
    ("scientific", "three laws of muscle growth", True, False),
    ("execute_action", "log 150g chicken for lunch", False, False),
    ("personal_status", "how is my weight progress today", False, False),
    ("unclear", "?", False, True),
    ("exercise_alternative", "بديل لتمرين البنش", True, False),
]


def main() -> int:
    print("Block B7 — Intent router verification\n")
    failed = 0

    for expected, message, needs_rag, needs_clarify in CASES:
        r = route_intent(message, locale="en")
        ok = r.intent == expected and r.needs_rag == needs_rag and r.needs_clarify == needs_clarify
        status = "OK" if ok else "FAIL"
        if not ok:
            failed += 1
        print(
            f"{status} [{expected}] got={r.intent} source={r.source} "
            f"rag={r.needs_rag} clarify={r.needs_clarify} levels={r.levels}"
        )

    if failed:
        print(f"\nFAILED ({failed} case(s))")
        return 1
    print("\nBlock B7 verification passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
