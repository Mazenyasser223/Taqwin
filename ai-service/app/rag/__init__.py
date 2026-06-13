"""Block B6 — RAG retrieval via Node pgvector search."""

from app.rag.types import RagHit
from app.rag.retriever import format_rag_context, retrieve_rag

__all__ = ["RagHit", "RetrievalStats", "format_rag_context", "retrieve_rag"]

from app.rag.types import RetrievalStats  # noqa: E402 — re-export
