"""Block B6 — RAG debug / integration endpoints."""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.clients.node_internal import NodeInternalError
from app.intent.router import route_intent
from app.rag.retriever import format_rag_context, retrieve_rag

router = APIRouter(prefix="/rag", tags=["rag"])


class RagRetrieveRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    locale: str = "en"
    intent: str | None = None
    levels: list[str] | None = None


class RagRetrieveResponse(BaseModel):
    intent: str
    levels: list[str]
    hit_count: int = Field(alias="hitCount")
    hits: list[dict[str, Any]]
    context_block: str = Field(alias="contextBlock")

    model_config = {"populate_by_name": True}


@router.post("/retrieve", response_model=RagRetrieveResponse)
def rag_retrieve(body: RagRetrieveRequest) -> RagRetrieveResponse:
    """Debug endpoint: run B6 retriever without full chat LLM."""
    try:
        if body.intent or body.levels:
            intent, levels, hits = retrieve_rag(
                query=body.query,
                locale=body.locale,
                intent=body.intent,
                levels=body.levels,
            )
        else:
            routing = route_intent(body.query, locale=body.locale)
            intent, levels, hits = retrieve_rag(
                query=body.query,
                locale=body.locale,
                routing=routing,
            )
    except NodeInternalError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    context_block = format_rag_context(hits, locale=body.locale)
    return RagRetrieveResponse(
        intent=intent,
        levels=levels,
        hitCount=len(hits),
        hits=[
            {
                "chunkId": h.chunk_id,
                "level": h.level,
                "title": h.title,
                "score": h.score,
                "preview": h.content[:200],
            }
            for h in hits
        ],
        contextBlock=context_block,
    )
