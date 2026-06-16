"""
Taqwin AI Coach — FastAPI service (Phase 0–1).

Node.js owns auth, Postgres, and tools. This service owns AI reasoning (future phases).
"""
import os
from typing import Annotated

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from schemas import ChatRequest, ChatResponse

load_dotenv()

app = FastAPI(title="Taqwin AI Coach", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _verify_internal_key(x_internal_key: str | None) -> None:
    expected = (os.getenv("AI_INTERNAL_KEY") or "").strip()
    if not expected:
        return
    if not x_internal_key or x_internal_key.strip() != expected:
        raise HTTPException(status_code=401, detail="Invalid X-Internal-Key")


def _last_user_text(messages: list) -> str:
    for msg in reversed(messages):
        if msg.role in ("user", "model"):
            return (msg.content or "").strip()
    return ""


@app.get("/health")
def health() -> dict:
    return {
        "ok": True,
        "service": "taqwin-ai",
        "mode": os.getenv("AI_COACH_MODE", "echo"),
    }


@app.post("/chat", response_model=ChatResponse)
def chat(
    body: ChatRequest,
    x_internal_key: Annotated[str | None, Header()] = None,
) -> ChatResponse:
    _verify_internal_key(x_internal_key)

    mode = (os.getenv("AI_COACH_MODE") or "echo").strip().lower()
    last = _last_user_text(body.messages)
    locale = body.locale

    if mode == "echo":
        if locale == "ar":
            reply = "تم استلام رسالتك من Taqwin AI Coach."
            if last:
                preview = last[:100] + ("…" if len(last) > 100 else "")
                reply += f" (آخر رسالة: {preview})"
        else:
            reply = "Your message was received by Taqwin AI Coach."
            if last:
                preview = last[:100] + ("…" if len(last) > 100 else "")
                reply += f" (last message: {preview})"
        return ChatResponse(reply=reply, mode="echo")

    if mode == "claude":
        api_key = (os.getenv("ANTHROPIC_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(
                status_code=503,
                detail="ANTHROPIC_API_KEY not set. Use AI_COACH_MODE=echo for Phase 1.",
            )
        # Phase 2: wire Anthropic Messages API using contextBundle + messages.
        raise HTTPException(
            status_code=501,
            detail="Claude mode not implemented yet. Set AI_COACH_MODE=echo.",
        )

    raise HTTPException(status_code=503, detail=f"Unknown AI_COACH_MODE: {mode}")
