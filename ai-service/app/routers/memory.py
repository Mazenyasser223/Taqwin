"""
Block E4 — POST /internal/memory/summarize (Node BullMQ worker → ai-service LLM).
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.memory_summarize import summarize_chat_transcript

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal/memory", tags=["memory"])


class MemorySummarizeRequest(BaseModel):
    transcript: str = Field(min_length=1, max_length=12000)
    locale: Literal["ar", "en"] = "ar"
    temperature: float = Field(default=0.2, ge=0.0, le=1.0)
    max_tokens: int = Field(default=900, alias="maxTokens", ge=64, le=4096)

    model_config = {"populate_by_name": True}


class MemoryItem(BaseModel):
    key: str
    summary: str
    confidence: float = 0.75


class MemorySummarizeResponse(BaseModel):
    raw: str = ""
    memories: list[MemoryItem] = Field(default_factory=list)
    locale: Literal["ar", "en"] = "ar"
    skipped: bool = False
    reason: str | None = None

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


@router.post("/summarize", response_model=MemorySummarizeResponse)
async def memory_summarize(body: MemorySummarizeRequest) -> MemorySummarizeResponse:
    """Summarize recent chat transcript into durable memory keys (Node persists to Postgres)."""
    try:
        result = await summarize_chat_transcript(
            transcript=body.transcript,
            locale=body.locale,
            temperature=body.temperature,
            max_tokens=body.max_tokens,
        )
    except RuntimeError as err:
        logger.warning("memory summarize LLM failed: %s", err)
        raise HTTPException(status_code=503, detail=str(err)) from err

    return MemorySummarizeResponse(
        raw=result.get("raw") or "",
        memories=result.get("memories") or [],
        locale=result.get("locale") or body.locale,
        skipped=bool(result.get("skipped")),
        reason=result.get("reason"),
    )
