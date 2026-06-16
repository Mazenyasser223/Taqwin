import json
import logging
import asyncio
import contextlib
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.config import get_settings
from app.agent.coach_graph import run_coach_graph, run_coach_resume
from app.agent.coach_stream import iter_coach_stream_events
from app.clients.node_internal import fetch_context_bundle
from app.services.cag_sanitize import new_sanitize_stats, sanitize_cag_bundle, sanitize_pending_preview

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/chat", tags=["chat"])


def _chat_history_limit() -> int:
    limit = int(get_settings().coach_history_max_messages or 10)
    return max(4, min(30, limit))


class ChatMessage(BaseModel):
    role: str
    content: str


class PendingActionRef(BaseModel):
    action_id: str | None = Field(default=None, alias="actionId")
    preview: str | None = None
    tools: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


class ChatRequest(BaseModel):
    user_id: str = Field(alias="userId")
    thread_id: str | None = Field(default=None, alias="threadId")
    messages: list[ChatMessage] = Field(default_factory=list)
    context_bundle: dict[str, Any] | None = Field(default=None, alias="contextBundle")
    locale: str = "en"
    pending_action: PendingActionRef | None = Field(default=None, alias="pendingAction")

    model_config = {"populate_by_name": True}


class ChatResumeRequest(BaseModel):
    user_id: str = Field(alias="userId")
    thread_id: str | None = Field(default=None, alias="threadId")
    locale: str = "en"
    tools: list[str] = Field(default_factory=list)
    inputs_by_tool: dict[str, dict[str, Any]] = Field(default_factory=dict, alias="inputsByTool")
    plan_steps: list[dict[str, Any]] = Field(default_factory=list, alias="planSteps")
    user_message: str = Field(default="", alias="userMessage")
    intent: str = "execute_action"
    context_bundle: dict[str, Any] | None = Field(default=None, alias="contextBundle")

    model_config = {"populate_by_name": True}


class ClassifyTurnRequest(BaseModel):
    message: str
    locale: str = "en"
    pending_preview: str | None = Field(default=None, alias="pendingPreview")

    model_config = {"populate_by_name": True}


class ClassifyTurnResponse(BaseModel):
    turn_type: str = Field(alias="turnType")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class ToolCallStub(BaseModel):
    name: str
    input: dict[str, Any] = Field(default_factory=dict)
    step_id: str | None = Field(default=None, alias="stepId")
    step_type: str | None = Field(default=None, alias="stepType")

    model_config = {"populate_by_name": True}


class PlanStepStub(BaseModel):
    id: str
    tool: str
    step_type: str = Field(alias="stepType")
    depends_on: list[str] = Field(default_factory=list, alias="dependsOn")
    inputs: dict[str, Any] = Field(default_factory=dict)
    rationale: str = ""

    model_config = {"populate_by_name": True}


class ChatResponse(BaseModel):
    reply: str
    tool_calls: list[ToolCallStub] = Field(default_factory=list, alias="toolCalls")
    tool_results: list[dict[str, Any]] = Field(default_factory=list, alias="toolResults")
    confirmation_required: bool = Field(default=False, alias="confirmationRequired")
    confirmation_preview: str | None = Field(default=None, alias="confirmationPreview")
    source_user_message: str | None = Field(default=None, alias="sourceUserMessage")
    plan_steps: list[dict[str, Any]] = Field(default_factory=list, alias="planSteps")
    pending_cancelled: bool = Field(default=False, alias="pendingCancelled")
    intent: str = "general"
    turn_id: str | None = Field(default=None, alias="turnId")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


def _last_user_message(messages: list[ChatMessage]) -> str:
    for msg in reversed(messages):
        if msg.role == "user" and msg.content.strip():
            return msg.content.strip()
    return ""


async def _resolve_bundle(
    user_id: str,
    bundle: dict[str, Any] | None,
    stats_out: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if bundle and bundle.get("generatedAt"):
        return sanitize_cag_bundle(bundle, stats_out) or {}
    try:
        fresh = fetch_context_bundle(user_id)
        if fresh.get("generatedAt"):
            logger.info("CAG bundle fetched from Node for user=%s", user_id)
            return sanitize_cag_bundle(fresh, stats_out) or {}
    except Exception as exc:
        logger.warning("CAG fetch fallback failed: %s", exc)
    return sanitize_cag_bundle(bundle or {}, stats_out) or {}


def _to_graph_response(result: dict[str, Any]) -> ChatResponse:
    tool_calls = [
        ToolCallStub(
            name=t.get("name", ""),
            input=t.get("input") or {},
            stepId=t.get("stepId"),
            stepType=t.get("stepType"),
        )
        for t in result.get("tool_calls_out") or []
    ]
    return ChatResponse(
        reply=result.get("reply") or "",
        intent=result.get("intent") or "general",
        toolCalls=tool_calls,
        toolResults=result.get("tool_results") or [],
        confirmationRequired=bool(result.get("confirmation_required")),
        confirmationPreview=result.get("confirmation_preview"),
        sourceUserMessage=result.get("source_user_message"),
        planSteps=result.get("plan_steps") or [],
        pendingCancelled=bool(result.get("pending_cancelled")),
        turnId=result.get("turn_id"),
    )


@router.post("/classify-turn", response_model=ClassifyTurnResponse)
async def classify_turn_endpoint(body: ClassifyTurnRequest) -> ClassifyTurnResponse:
    from app.services.turn_classify import classify_turn

    turn = await classify_turn(
        body.message,
        locale=body.locale if body.locale in ("en", "ar") else "en",
        pending_preview=body.pending_preview,
    )
    return ClassifyTurnResponse(turnType=turn)


@router.post("/resume", response_model=ChatResponse)
async def chat_resume(body: ChatResumeRequest) -> ChatResponse:
    """Execute confirmed tools via tool execution subgraph (extract→execute→retry)."""
    sanitize_stats = new_sanitize_stats()
    bundle = await _resolve_bundle(body.user_id, body.context_bundle, sanitize_stats)
    locale = bundle.get("locale") or body.locale or "en"
    if locale not in ("en", "ar"):
        locale = "en"

    result = await run_coach_resume(
        user_id=body.user_id,
        thread_id=body.thread_id,
        tools=list(body.tools),
        inputs_by_tool=dict(body.inputs_by_tool),
        plan_steps=list(body.plan_steps),
        user_message=body.user_message,
        context_bundle=bundle,
        locale=locale,
        intent=body.intent,
        sanitize_stats=sanitize_stats,
    )
    return _to_graph_response(result)


@router.post("", response_model=ChatResponse)
async def chat(body: ChatRequest) -> ChatResponse:
    """Coach pipeline: safety → intent → RAG → bounded tool loop → confirm by actionId."""
    last_user = _last_user_message(body.messages)
    sanitize_stats = new_sanitize_stats()
    bundle = await _resolve_bundle(body.user_id, body.context_bundle, sanitize_stats)
    locale = bundle.get("locale") or body.locale or "en"
    if locale not in ("en", "ar"):
        locale = "en"

    if not last_user:
        return ChatResponse(reply="[taqwin-ai] No user message in request.", intent="unclear")

    pending_dict = None
    if body.pending_action:
        pending_dict = {
            "actionId": body.pending_action.action_id,
            "preview": sanitize_pending_preview(body.pending_action.preview),
            "tools": body.pending_action.tools,
        }

    llm_messages = [
        {"role": m.role, "content": m.content}
        for m in body.messages
        if m.content.strip()
    ][-_chat_history_limit():]

    result = await run_coach_graph(
        user_id=body.user_id,
        thread_id=body.thread_id,
        messages=llm_messages,
        user_message=last_user,
        context_bundle=bundle,
        locale=locale,
        pending_action=pending_dict,
        sanitize_stats=sanitize_stats,
    )
    return _to_graph_response(result)


def _format_sse(event: str, data: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/stream")
async def chat_stream(body: ChatRequest, request: Request) -> StreamingResponse:
    """SSE stream: phase → live Anthropic tokens → done."""
    last_user = _last_user_message(body.messages)
    sanitize_stats = new_sanitize_stats()
    bundle = await _resolve_bundle(body.user_id, body.context_bundle, sanitize_stats)
    locale = bundle.get("locale") or body.locale or "en"
    if locale not in ("en", "ar"):
        locale = "en"

    pending_dict = None
    if body.pending_action:
        pending_dict = {
            "actionId": body.pending_action.action_id,
            "preview": sanitize_pending_preview(body.pending_action.preview),
            "tools": body.pending_action.tools,
        }

    llm_messages = [
        {"role": m.role, "content": m.content}
        for m in body.messages
        if m.content.strip()
    ][-_chat_history_limit():]

    cancel_event = asyncio.Event()

    async def watch_disconnect() -> None:
        while not await request.is_disconnected():
            await asyncio.sleep(0.2)
        cancel_event.set()

    async def event_generator():
        if not last_user:
            yield _format_sse("error", {"message": "No user message in request."})
            yield _format_sse("done", {"reply": "[taqwin-ai] No user message.", "intent": "unclear"})
            return
        watcher = asyncio.create_task(watch_disconnect())
        try:
            async for item in iter_coach_stream_events(
                user_id=body.user_id,
                thread_id=body.thread_id,
                messages=llm_messages,
                user_message=last_user,
                context_bundle=bundle,
                locale=locale,
                pending_action=pending_dict,
                cancel_event=cancel_event,
                sanitize_stats=sanitize_stats,
            ):
                if cancel_event.is_set():
                    yield _format_sse("error", {"message": "cancelled"})
                    return
                yield _format_sse(item["event"], item["data"])
        except Exception as exc:
            logger.warning("chat stream failed: %s", exc)
            yield _format_sse("error", {"message": str(exc)[:300]})
        finally:
            watcher.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await watcher

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
