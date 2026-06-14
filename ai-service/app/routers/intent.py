"""Block B7 — Intent classification debug API."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.intent.router import route_intent

router = APIRouter(prefix="/intent", tags=["intent"])


class IntentRequest(BaseModel):
    message: str = Field(min_length=0, max_length=4000)
    locale: str = "en"


class IntentResponse(BaseModel):
    intent: str
    source: str
    confidence: float
    levels: list[str]
    needs_rag: bool = Field(alias="needsRag")
    needs_clarify: bool = Field(alias="needsClarify")
    tool_hints: list[str] = Field(alias="toolHints")

    model_config = {"populate_by_name": True}


@router.post("", response_model=IntentResponse)
def classify(body: IntentRequest) -> IntentResponse:
    """Classify a single user message (rules + optional LLM fallback)."""
    result = route_intent(body.message, locale=body.locale)
    return IntentResponse(
        intent=result.intent,
        source=result.source,
        confidence=result.confidence,
        levels=result.levels,
        needsRag=result.needs_rag,
        needsClarify=result.needs_clarify,
        toolHints=result.tool_hints,
    )
