"""Smoke test Tier 2 rerank (Cohere) — run from ai-service root."""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.rag.rerank import rerank_hits
from app.rag.retriever import RagHit


def main() -> int:
    settings = get_settings()
    print("Tier 2 rerank smoke test")
    print(f"  provider={settings.rag_rerank_provider}")
    print(f"  enabled={settings.rag_rerank_enabled}")
    print(f"  cohere_key={'set' if settings.cohere_api_key else 'missing'}")

    hits = [
        RagHit("1", "d", "L2", "s", "Squat", "en", "Barbell squat legs compound exercise", 0.4, None),
        RagHit("2", "d", "L2", "s", "Bench", "en", "Barbell bench press chest exercise alternative", 0.35, None),
        RagHit("3", "d", "L2", "s", "Curl", "en", "Dumbbell biceps curl arms", 0.5, None),
    ]
    out = rerank_hits(query="bench press chest alternative", hits=hits, top_n=2)
    if len(out) < 1:
        print("FAIL: rerank returned no hits")
        return 1
    top = out[0]
    print(f"  top hit: {top.title} (score={top.score:.3f})")
    meta = top.metadata or {}
    if meta.get("rerankScore") is not None:
        print("  rerankScore present — Cohere path active")
    elif settings.rag_rerank_provider == "none" or not settings.cohere_api_key:
        print("  OK: fallback order (rerank disabled or no key)")
    else:
        print("  WARN: expected rerankScore with cohere provider")
    print("PASS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
