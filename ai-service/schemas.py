"""Request/response contract between Node.js and FastAPI (see CONTRACT.md)."""
from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "model", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    userId: str
    locale: Literal["en", "ar"] = "ar"
    messages: list[ChatMessage] = Field(min_length=1, max_length=40)
    contextBundle: dict[str, Any] = Field(default_factory=dict)
    threadId: str | None = None


class ChatResponse(BaseModel):
    reply: str
    mode: str = "echo"
