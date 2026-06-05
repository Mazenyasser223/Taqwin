import logging
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.clients.node_internal import NodeInternalError
from app.intent.router import IntentResult, route_intent
from app.prompts.coach_system import build_coach_system_prompt
from app.rag.retriever import format_rag_context, retrieve_rag
from app.services.llm_chat import complete_coach_chat, format_context_bundle, is_llm_configured

logger = logging.getLogger(__name__)
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


def _last_user_message(messages: list[ChatMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user" and msg.content.strip():
            return msg.content.strip()
    return ""


def _clarify_reply(locale: str) -> str:
    if locale == "ar":
        return (
            "محتاج أوضح شوية — تقصد تغذية (أكل/سعرات)، تمرين، مساعدة في التطبيق، "
            "ولا حاجة تانية؟ اكتب سؤالك بجملة أوضح."
        )
    return (
        "I need a bit more detail — are you asking about nutrition, workouts, "
        "the Taqwin app, or something else? Please rephrase in one clear sentence."
    )


def _tool_stubs(routing: IntentResult) -> list[ToolCallStub]:
    if routing.intent != "execute_action" or not routing.tool_hints:
        return []
    return [ToolCallStub(name=name, input={"preview": True}) for name in routing.tool_hints[:3]]


def _scaffold_reply(
    *,
    user_message: str,
    routing: IntentResult,
    rag_context: str,
    locale: str,
) -> str:
    """Fallback when ANTHROPIC_API_KEY is not set (dev / CI)."""
    lines: list[str] = []
    if locale == "ar":
        lines.append("المدرب الذكي في تكوين (وضع تجريبي — ضع ANTHROPIC_API_KEY لتفعيل Claude).")
    else:
        lines.append("Taqwin AI coach (scaffold — set ANTHROPIC_API_KEY for Claude).")

    lines.append(f"Intent: {routing.intent} ({routing.source}, conf={routing.confidence:.2f})")

    if rag_context:
        if locale == "ar":
            lines.append("\n**مقتطفات من قاعدة المعرفة:**")
        else:
            lines.append("\n**Knowledge retrieved:**")
        for block_line in rag_context.split("\n"):
            if block_line.startswith("- **") and "(score" in block_line:
                lines.append(block_line.replace("**", ""))

    lines.append(f"\nYour message: {user_message}")
    return "\n".join(lines)


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    """B7 intent + RAG + Claude coach (pre-E)."""
    last_user = _last_user_message(body.messages)
    bundle = body.context_bundle or {}
    locale = bundle.get("locale") or body.locale or "en"
    if locale not in ("en", "ar"):
        locale = "en"

    if not last_user:
        return ChatResponse(reply="[taqwin-ai] No user message in request.", intent="unclear")

    routing = route_intent(last_user, locale=locale)

    if routing.needs_clarify:
        return ChatResponse(
            reply=_clarify_reply(locale),
            intent=routing.intent,
            toolCalls=_tool_stubs(routing),
        )

    rag_context = ""
    try:
        _intent, _levels, hits = retrieve_rag(
            query=last_user,
            locale=locale,
            routing=routing,
        )
        rag_context = format_rag_context(hits, locale=locale)
        logger.info(
            "chat intent=%s source=%s levels=%s hits=%d",
            routing.intent,
            routing.source,
            _levels,
            len(hits),
        )
    except NodeInternalError as exc:
        logger.warning("RAG retrieve failed: %s", exc)
        reply = (
            f"[taqwin-ai] RAG unavailable ({exc}). "
            f"Ensure backend-node is running and AI_INTERNAL_KEY matches.\n\n"
            f"Intent: {routing.intent} ({routing.source})\n"
            f"Your message: {last_user}"
        )
        return ChatResponse(
            reply=reply,
            intent=routing.intent,
            toolCalls=_tool_stubs(routing),
        )

    user_context = format_context_bundle(bundle)
    system = build_coach_system_prompt(
        user_context=user_context,
        rag_context=rag_context,
        locale=locale,
    )

    llm_messages = [
        {"role": m.role, "content": m.content}
        for m in body.messages
        if m.content.strip()
    ][-30:]

    if is_llm_configured():
        try:
            reply = await complete_coach_chat(system=system, messages=llm_messages)
            if not reply.strip():
                reply = _scaffold_reply(
                    user_message=last_user,
                    routing=routing,
                    rag_context=rag_context,
                    locale=locale,
                )
        except Exception as exc:
            logger.warning("Claude chat failed: %s", exc)
            reply = _scaffold_reply(
                user_message=last_user,
                routing=routing,
                rag_context=rag_context,
                locale=locale,
            )
    else:
        reply = _scaffold_reply(
            user_message=last_user,
            routing=routing,
            rag_context=rag_context,
            locale=locale,
        )

    return ChatResponse(
        reply=reply,
        intent=routing.intent,
        toolCalls=_tool_stubs(routing),
    )
