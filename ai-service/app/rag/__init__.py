"""Block B6 — RAG retrieval via Node pgvector search."""

from app.rag.retriever import RagHit, format_rag_context, retrieve_rag

__all__ = ["RagHit", "format_rag_context", "retrieve_rag"]
