#!/usr/bin/env python3
"""
Block B6 verification — FastAPI retriever → Node B5 rag/search.

Requires:
  - backend-node running (default http://localhost:4000)
  - AI_INTERNAL_KEY set in ai-service/.env (same as backend-node)
  - Embeddings configured on Node (OPENAI_API_KEY)

  cd ai-service && python scripts/verify_b6.py
"""

from __future__ import annotations

import os
import sys

# Allow `python scripts/verify_b6.py` from ai-service/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.clients.node_internal import NodeInternalError, rag_search
from app.config import get_settings
from app.intent.rules import classify_intent
from app.rag.retriever import retrieve_rag


CASES = [
    ("workout", "bench press chest exercise", "L2_EXERCISE"),
    ("nutrition", "high protein chicken meal", "L3_NUTRITION"),
    ("platform_help", "Taqwin onboarding how it works", "L1_INTERNAL"),
    ("scientific", "three laws of muscle growth progressive overload", "L5_BOOKS"),
]


def main() -> int:
    settings = get_settings()
    print("Block B6 — FastAPI RAG retriever verification")
    print(f"Node URL: {settings.node_internal_api_url}")

    if not settings.ai_internal_key:
        print("FAIL: AI_INTERNAL_KEY not set in ai-service/.env")
        return 1

    failed = False

    # Direct Node ping
    try:
        payload = rag_search(query="test", levels=["L1_INTERNAL"], limit=1)
        print(f"OK: Node rag/search reachable ({len(payload.get('results') or [])} hit(s))")
    except NodeInternalError as exc:
        print(f"FAIL: Node rag/search: {exc}")
        return 1

    for intent, query, expected_level in CASES:
        detected = classify_intent(query)
        if detected != intent:
            print(f"  WARN: intent {detected} != expected {intent} for: {query[:40]}")

        try:
            resolved, levels, hits = retrieve_rag(query=query, locale="en", intent=intent)
        except NodeInternalError as exc:
            print(f"FAIL [{intent}]: {exc}")
            failed = True
            continue

        if not hits:
            print(f"FAIL [{intent}]: no hits for {query!r}")
            failed = True
            continue

        prompt_top = hits[0]
        level_hits = [h for h in hits if h.level == expected_level]
        if not level_hits:
            print(
                f"FAIL [{intent}]: no {expected_level} hit; prompt_top={prompt_top.level} "
                f"({prompt_top.title})"
            )
            failed = True
            continue

        best = max(level_hits, key=lambda h: h.score)
        print(
            f"OK [{intent}]: {len(hits)} hit(s), {expected_level}={best.title!r} "
            f"score={best.score:.3f}; prompt_top={prompt_top.level}"
        )

    if failed:
        print("\nFAILED")
        return 1
    print("\nBlock B6 verification passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
