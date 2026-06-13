"""
Tier 2 cross-encoder reranking (Cohere, Voyage, or optional local cross-encoder).

After hybrid retrieval fetches top-K candidates per level, rerank and keep top N for the prompt.
"""

from __future__ import annotations

import logging
import time
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

_RERANK_MAX_RETRIES = 3
_RERANK_BACKOFF_SEC = 0.6


def _rerank_cohere(*, query: str, documents: list[str], top_n: int, api_key: str, model: str) -> list[tuple[int, float]]:
    last_exc: Exception | None = None
    for attempt in range(_RERANK_MAX_RETRIES):
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(
                    "https://api.cohere.com/v2/rerank",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "query": query,
                        "documents": documents,
                        "top_n": top_n,
                    },
                )
            if res.status_code == 429 and attempt < _RERANK_MAX_RETRIES - 1:
                time.sleep(_RERANK_BACKOFF_SEC * (2**attempt))
                continue
            res.raise_for_status()
            data = res.json()
            out: list[tuple[int, float]] = []
            for item in data.get("results") or []:
                idx = int(item.get("index", 0))
                score = float(item.get("relevance_score") or item.get("score") or 0)
                out.append((idx, score))
            return out
        except Exception as exc:
            last_exc = exc
            if attempt < _RERANK_MAX_RETRIES - 1:
                time.sleep(_RERANK_BACKOFF_SEC * (2**attempt))
                continue
            raise last_exc from exc
    raise RuntimeError("Cohere rerank failed after retries")


def _rerank_voyage(*, query: str, documents: list[str], top_n: int, api_key: str, model: str) -> list[tuple[int, float]]:
    with httpx.Client(timeout=30.0) as client:
        res = client.post(
            "https://api.voyageai.com/v1/rerank",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": model,
                "query": query,
                "documents": documents,
                "top_k": top_n,
            },
        )
    res.raise_for_status()
    data = res.json()
    out: list[tuple[int, float]] = []
    for item in data.get("data") or data.get("results") or []:
        idx = int(item.get("index", 0))
        score = float(item.get("relevance_score") or item.get("score") or 0)
        out.append((idx, score))
    return out


def _rerank_local(*, query: str, documents: list[str], top_n: int, model: str) -> list[tuple[int, float]]:
    try:
        from sentence_transformers import CrossEncoder  # type: ignore[import-untyped]
    except ImportError as exc:
        raise RuntimeError(
            "Local rerank requires sentence-transformers: pip install sentence-transformers"
        ) from exc

    encoder = CrossEncoder(model)
    pairs = [[query, doc] for doc in documents]
    scores = encoder.predict(pairs)
    ranked = sorted(enumerate(scores), key=lambda x: float(x[1]), reverse=True)
    return [(idx, float(score)) for idx, score in ranked[:top_n]]


def rerank_hits(
    *,
    query: str,
    hits: list[Any],
    top_n: int | None = None,
) -> list[Any]:
    """
    Rerank RagHit-like objects by cross-encoder relevance.
    Falls back to original order when reranking is disabled or unavailable.
    """
    if not hits:
        return hits

    settings = get_settings()
    if not settings.rag_rerank_enabled:
        return hits[: top_n or len(hits)]

    keep = top_n or settings.rag_rerank_keep_per_level
    documents = [str(getattr(h, "content", "") or "")[:4000] for h in hits]
    if not any(documents):
        return hits[:keep]

    provider = (settings.rag_rerank_provider or "none").lower()
    ranked: list[tuple[int, float]] = []

    try:
        if provider == "cohere" and settings.cohere_api_key:
            ranked = _rerank_cohere(
                query=query,
                documents=documents,
                top_n=min(keep, len(documents)),
                api_key=settings.cohere_api_key,
                model=settings.cohere_rerank_model,
            )
        elif provider == "voyage" and settings.voyage_api_key:
            ranked = _rerank_voyage(
                query=query,
                documents=documents,
                top_n=min(keep, len(documents)),
                api_key=settings.voyage_api_key,
                model=settings.voyage_rerank_model,
            )
        elif provider == "local":
            ranked = _rerank_local(
                query=query,
                documents=documents,
                top_n=min(keep, len(documents)),
                model=settings.local_rerank_model,
            )
        else:
            return hits[:keep]
    except Exception as exc:
        logger.warning("Rerank failed (%s): %s — using retrieval order", provider, exc)
        return hits[:keep]

    reranked = []
    for idx, score in ranked:
        if idx < 0 or idx >= len(hits):
            continue
        hit = hits[idx]
        if hasattr(hit, "__dataclass_fields__"):
            reranked.append(
                type(hit)(
                    chunk_id=hit.chunk_id,
                    document_id=hit.document_id,
                    level=hit.level,
                    source=hit.source,
                    title=hit.title,
                    locale=hit.locale,
                    content=hit.content,
                    score=score,
                    metadata={
                        **(hit.metadata or {}),
                        "rerankScore": score,
                        "retrievalScore": hit.score,
                    },
                )
            )
    return reranked or hits[:keep]
