"""Shared RAG types — avoids circular imports between retriever and citations."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class RagHit:
    chunk_id: str
    document_id: str
    level: str
    source: str
    title: str
    locale: str
    content: str
    score: float
    metadata: dict[str, Any] | None

    @classmethod
    def from_node_result(cls, row: dict[str, Any]) -> RagHit:
        meta: dict[str, Any] = (
            dict(row.get("metadata") or {}) if isinstance(row.get("metadata"), dict) else {}
        )
        distance = row.get("distance")
        if distance is not None:
            try:
                meta["vectorScore"] = max(0.0, 1.0 - float(distance))
            except (TypeError, ValueError):
                pass
        if row.get("rrfScore") is not None:
            try:
                meta["rrfScore"] = float(row["rrfScore"])
            except (TypeError, ValueError):
                pass
        if row.get("retrievalSources") is not None:
            meta["retrievalSources"] = row["retrievalSources"]
        return cls(
            chunk_id=str(row.get("chunkId") or ""),
            document_id=str(row.get("documentId") or ""),
            level=str(row.get("level") or ""),
            source=str(row.get("source") or ""),
            title=str(row.get("title") or ""),
            locale=str(row.get("locale") or "en"),
            content=str(row.get("content") or ""),
            score=float(row.get("score") or 0),
            metadata=meta or None,
        )


@dataclass(frozen=True)
class RetrievalStats:
    retrieval_ms: float = 0.0
    rerank_lift_avg: float = 0.0
    purpose: str = "chat"
