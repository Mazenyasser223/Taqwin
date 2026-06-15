"""POST /meal-capture/analyze — Claude vision meal nutrition (Opus via MEAL_VISION_MODEL)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.meal_vision import analyze_meal_images

router = APIRouter(tags=["meal-capture"])


class MealImageInput(BaseModel):
    data: str = Field(description="Base64-encoded image bytes")
    media_type: str = Field(default="image/jpeg", alias="mediaType")

    model_config = {"populate_by_name": True}


class MealCaptureRequest(BaseModel):
    reference_info: str = Field(default="None (AI Guess)", alias="referenceInfo")
    images: list[MealImageInput]

    model_config = {"populate_by_name": True}


@router.post("/meal-capture/analyze")
async def meal_capture_analyze(body: MealCaptureRequest) -> dict[str, Any]:
    images = [
        {"data": img.data, "mediaType": img.media_type or "image/jpeg"}
        for img in body.images
    ]
    result = await analyze_meal_images(images, body.reference_info)
    if result.get("error"):
        code = result["error"]
        status = 503 if code == "API_KEY_INVALID" else 429 if code == "QUOTA_EXCEEDED" else 502
        raise HTTPException(
            status_code=status,
            detail={"error": code, "message": result.get("message") or code},
        )
    return result
