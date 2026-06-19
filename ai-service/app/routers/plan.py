"""
Block C1 — POST /plan/generate and POST /plan/adapt.
"""

from __future__ import annotations

import logging
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.plan_generate import generate_plan
from app.services.plan_adapt import adapt_plan
from app.services.plan_retrieve import retrieve_plan_context
from app.services.plan_fill_template import fill_coach_template

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plan", tags=["plan"])


class PlanGenerateRequest(BaseModel):
    user_id: str = Field(alias="userId")
    context_bundle: dict[str, Any] = Field(default_factory=dict, alias="contextBundle")
    week_start: str | None = Field(default=None, alias="weekStart")
    foods: list[dict[str, Any]] | None = None
    exercises: list[dict[str, Any]] | None = None
    book_chunks: list[dict[str, Any]] | None = Field(default=None, alias="bookChunks")
    regeneration_reason: str = Field(default="", alias="regenerationReason")
    validation_feedback: str = Field(default="", alias="validationFeedback")

    model_config = {"populate_by_name": True}


class PlanMeta(BaseModel):
    user_id: str | None = Field(default=None, alias="userId")
    week_start: str | None = Field(default=None, alias="weekStart")
    locale: str = "ar"
    model: str = "scaffold"
    latency_ms: int = Field(default=0, alias="latencyMs")
    food_candidates: int = Field(default=0, alias="foodCandidates")
    exercise_candidates: int = Field(default=0, alias="exerciseCandidates")

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class PlanGenerateResponse(BaseModel):
    plan: dict[str, Any]
    explainability_text: str = Field(alias="explainabilityText")
    source: Literal["ai", "scaffold"] = "scaffold"
    meta: PlanMeta = Field(default_factory=PlanMeta)

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class PlanAdaptRequest(BaseModel):
    user_id: str = Field(alias="userId")
    context_bundle: dict[str, Any] = Field(default_factory=dict, alias="contextBundle")
    snapshot: dict[str, Any] | None = None
    decision_hint: str = Field(default="keep", alias="decisionHint")

    model_config = {"populate_by_name": True}


class PlanAdaptResponse(BaseModel):
    plan: dict[str, Any] | None = None
    explainability_text: str = Field(alias="explainabilityText")
    adaptation: dict[str, Any] = Field(default_factory=dict)
    source: Literal["stub", "ai", "scaffold"] = "stub"

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class PlanRetrieveRequest(BaseModel):
    user_id: str = Field(alias="userId")
    context_bundle: dict[str, Any] = Field(default_factory=dict, alias="contextBundle")
    targets: dict[str, Any] = Field(default_factory=dict)
    program_summaries: dict[str, Any] = Field(default_factory=dict, alias="programSummaries")
    book_candidates: list[dict[str, Any]] | None = Field(default=None, alias="bookCandidates")
    food_candidates: list[dict[str, Any]] | None = Field(default=None, alias="foodCandidates")
    exercise_candidates: list[dict[str, Any]] | None = Field(default=None, alias="exerciseCandidates")

    model_config = {"populate_by_name": True}


class PlanRetrieveResponse(BaseModel):
    retrieval: dict[str, Any]
    book_chunks: list[dict[str, Any]] = Field(default_factory=list, alias="bookChunks")
    foods: list[dict[str, Any]] = Field(default_factory=list)
    exercises: list[dict[str, Any]] = Field(default_factory=list)

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


class PlanFillTemplateRequest(BaseModel):
    user_id: str = Field(alias="userId")
    context_bundle: dict[str, Any] = Field(default_factory=dict, alias="contextBundle")
    template_plan: dict[str, Any] = Field(alias="templatePlan")
    book_chunks: list[dict[str, Any]] | None = Field(default=None, alias="bookChunks")
    retrieval: dict[str, Any] = Field(default_factory=dict)
    validation_feedback: str = Field(default="", alias="validationFeedback")
    locale: str = "ar"

    model_config = {"populate_by_name": True}


class PlanFillTemplateResponse(BaseModel):
    plan: dict[str, Any]
    source: Literal["ai", "template"] = "template"

    model_config = {"populate_by_name": True, "serialize_by_alias": True}


@router.post("/generate", response_model=PlanGenerateResponse)
async def plan_generate(body: PlanGenerateRequest) -> PlanGenerateResponse:
    """Generate 7-day diet + 4-week workout JSON. Node validates and persists (C2+)."""
    result = await generate_plan(
        user_id=body.user_id,
        context_bundle=body.context_bundle,
        week_start=body.week_start or "",
        foods=body.foods,
        exercises=body.exercises,
        book_chunks=body.book_chunks,
        regeneration_reason=body.regeneration_reason,
        validation_feedback=body.validation_feedback,
    )
    meta_raw = result.get("meta") or {}
    return PlanGenerateResponse(
        plan=result["plan"],
        explainabilityText=result["explainabilityText"],
        source=result["source"],
        meta=PlanMeta(**meta_raw),
    )


@router.post("/adapt", response_model=PlanAdaptResponse)
async def plan_adapt(body: PlanAdaptRequest) -> PlanAdaptResponse:
    """Block C9 — adaptation plan JSON (Claude + RAG) for Node validation/persist."""
    result = await adapt_plan(
        user_id=body.user_id,
        context_bundle=body.context_bundle or {},
        snapshot=body.snapshot,
        decision_hint=body.decision_hint or "keep",
    )
    src = result.get("source") or "stub"
    if src not in ("stub", "ai", "scaffold"):
        src = "ai"
    return PlanAdaptResponse(
        plan=result.get("plan"),
        explainabilityText=result.get("explainabilityText") or "",
        adaptation=result.get("adaptation") or {},
        source=src,
    )


@router.post("/retrieve", response_model=PlanRetrieveResponse)
async def plan_retrieve(body: PlanRetrieveRequest) -> PlanRetrieveResponse:
    """Step 1 — Haiku picks coach programs + filters RAG candidates."""
    result = await retrieve_plan_context(
        context_bundle=body.context_bundle,
        targets=body.targets,
        program_summaries=body.program_summaries,
        book_candidates=body.book_candidates,
        food_candidates=body.food_candidates,
        exercise_candidates=body.exercise_candidates,
    )
    return PlanRetrieveResponse(
        retrieval=result["retrieval"],
        bookChunks=result["bookChunks"],
        foods=result["foods"],
        exercises=result["exercises"],
    )


@router.post("/fill-template", response_model=PlanFillTemplateResponse)
async def plan_fill_template_route(body: PlanFillTemplateRequest) -> PlanFillTemplateResponse:
    """Step 3 — Sonnet personalizes coach template plan JSON."""
    locale = body.locale if body.locale in ("en", "ar") else "ar"
    result = await fill_coach_template(
        context_bundle=body.context_bundle,
        template_plan=body.template_plan,
        book_chunks=body.book_chunks,
        retrieval=body.retrieval,
        validation_feedback=body.validation_feedback,
        locale=locale,
    )
    src = result.get("source") or "template"
    if src not in ("ai", "template"):
        src = "template"
    return PlanFillTemplateResponse(plan=result["plan"], source=src)
