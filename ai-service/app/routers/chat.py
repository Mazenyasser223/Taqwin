from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    user_id: str = Field(alias="userId")
    thread_id: str | None = Field(default=None, alias="threadId")
    messages: list[ChatMessage] = Field(default_factory=list)
    context_bundle: dict[str, Any] | None = Field(default=None, alias="contextBundle")
    locale: str = "en"

    model_config = {"populate_by_name": True}


class ToolCallStub(BaseModel):
    name: str
    input: dict[str, Any] = Field(default_factory=dict)


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCallStub] = Field(default_factory=list, alias="toolCalls")
    confirmation_required: bool = Field(default=False, alias="confirmationRequired")
    confirmation_preview: str | None = Field(default=None, alias="confirmationPreview")
    intent: str = "general"

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


@router.post("", response_model=ChatResponse)
def chat(body: ChatRequest) -> ChatResponse:
    """A2 stub: echoes the last user message for Node bridge testing (A3/A5)."""
    last_user = next(
        (m.content for m in reversed(body.messages) if m.role == "user"),
        None,
    )
    if last_user:
        reply = f"[taqwin-ai stub] {last_user}"
    else:
        reply = "[taqwin-ai stub] No user message in request."

    bundle = body.context_bundle
    if bundle:
        locale = bundle.get("locale", body.locale)
        meals = (bundle.get("nutritionToday") or {}).get("logged", {}).get("mealCount")
        weight = (bundle.get("profile") or {}).get("weightKg")
        reply += f" | CAG: locale={locale}, mealsToday={meals}, weightKg={weight}"

    return ChatResponse(reply=reply)
