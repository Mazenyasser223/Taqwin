"""
Claude Vision meal photo analysis — NutriLens-style nutrition estimation.
Uses MEAL_VISION_MODEL (Opus) only; coach/plan use anthropic_model (Sonnet).
"""

from __future__ import annotations

import json
import logging
import re
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

MAX_IMAGES = 6
SPREAD = {"high": 0.08, "medium": 0.15, "low": 0.25}
CONF_NUMERIC = {"high": 0.9, "medium": 0.75, "low": 0.55}


def _conf_to_numeric(conf: Any) -> float:
    return CONF_NUMERIC.get(str(conf or "medium").lower(), 0.75)


def _item_conf_numeric(conf: Any) -> float:
    if isinstance(conf, dict):
        vals = [
            _conf_to_numeric(conf.get("identification")),
            _conf_to_numeric(conf.get("portion_estimation")),
            _conf_to_numeric(conf.get("nutrition_estimation")),
        ]
        return round(sum(vals) / len(vals), 2)
    return _conf_to_numeric(conf)


def _sum_hidden_calories(items: list[dict[str, Any]]) -> int:
    total = 0
    for item in items:
        sources = item.get("hidden_calorie_sources")
        if isinstance(sources, list) and sources:
            total += int(item.get("estimated_calories") or 0)
    return total


def _normalize_same_meal_validation(raw: Any) -> dict[str, Any]:
    if not isinstance(raw, dict):
        return {"passed": True, "confidence": 0.85, "issues": []}
    passed = raw.get("passed") is not False
    confidence = raw.get("confidence")
    if not isinstance(confidence, (int, float)):
        confidence = _conf_to_numeric(confidence)
    else:
        confidence = max(0.0, min(1.0, float(confidence)))
    issues = [str(x) for x in (raw.get("issues") or [])]
    return {"passed": passed, "confidence": confidence, "issues": issues}


def enrich_meal_capture_result(result: dict[str, Any]) -> dict[str, Any]:
    if result.get("error"):
        return result
    food_items = []
    for item in result.get("food_items") or []:
        if not isinstance(item, dict):
            continue
        enriched = dict(item)
        if not isinstance(enriched.get("confidence_score"), (int, float)):
            enriched["confidence_score"] = _item_conf_numeric(enriched.get("confidence"))
        food_items.append(enriched)

    ms = dict(result.get("meal_summary") or {})
    if not isinstance(ms.get("overall_confidence"), (int, float)):
        ms["overall_confidence"] = _conf_to_numeric(ms.get("confidence"))
    if not isinstance(ms.get("possible_hidden_calories"), (int, float)):
        ms["possible_hidden_calories"] = _sum_hidden_calories(food_items)

    same_meal = _normalize_same_meal_validation(result.get("same_meal_validation"))
    return {**result, "food_items": food_items, "meal_summary": ms, "same_meal_validation": same_meal}


def same_meal_gate(result: dict[str, Any]) -> dict[str, Any] | None:
    v = result.get("same_meal_validation") or {}
    if v.get("passed") is not False:
        return None
    issues = v.get("issues") or ["Images may show different meals"]
    confidence = float(v.get("confidence") or 0)
    if confidence >= 0.65:
        return None
    return {
        "error": "SAME_MEAL_MISMATCH",
        "message": f"Photos do not appear to be the same meal: {'; '.join(issues)}",
        "same_meal_validation": v,
    }


def nutrition_prompt(reference_info: str, n_views: int) -> str:
    return f"""
You are an expert nutritionist. Provide a highly accurate nutritional analysis of the provided food image(s).

MULTI-SHOT ANALYSIS ({n_views} image(s)):
- Fuse ALL views; combine top-down area with side/oblique cues for volume.
- If views disagree, prefer the majority interpretation and lower confidence if needed.

SAME-MEAL VALIDATION (MANDATORY):
- Before estimating nutrition, verify ALL images show the SAME meal (same plate/bowl, same foods, similar setting).
- If images look like different meals or accidental mixed uploads, set same_meal_validation.passed to false and list issues.
- Set same_meal_validation.confidence 0.0–1.0 (how sure they are the same meal).

IMAGE QUALITY (per image, 1-indexed):
- Assess blur, brightness, resolution, and whether food is clearly visible.
- Set full_plate_visible to false if the plate/bowl is cropped, zoomed too close, or the full meal is not in frame.
- Use blur/brightness/resolution values: "ok", "warn", or "fail".

REFERENCE CALIBRATION:
- Reference object in photo: {reference_info}.
- Use its known size to calibrate scale when visible.
- Set "reference_found": true only if you can locate this object.

CALIBRATION ANCHORS (if reference missing):
- Rice/grains tennis-ball size ~150g boiled; protein deck-of-cards ~100–120g; pasta fist ~180g; butter dice ~10g; dinner plate ~27cm.

ESTIMATION:
1. Identify scale from anchors/reference/cutlery/hands.
2. Deconstruct every component including hidden sauces/oils.
3. Estimate volume then convert to grams; macros: protein/carbs 4 kcal/g, fat 9 kcal/g.

HIDDEN CALORIES (MANDATORY):
- Add separate items for cooking oil, butter, sauces, dressings when inferred from cooking method.
- Mark hidden sources in hidden_calorie_sources.

RULES:
- Be conservative (slight overestimate preferred).
- Break complex dishes into components.
- Classify each item category: main, side, drink, dessert, fruit, vegetable, or condiment.
- Include cooking_style and visible_ingredients when inferable (e.g. grilled, fried, basmati).
- Per-item confidence: high/medium/low for identification, portion_estimation, nutrition_estimation.
- Also set confidence_score per item (0.0–1.0) and overall_confidence on meal_summary (0.0–1.0).
- Calorie ranges: high ±8%, medium ±15%, low ±25% of estimated_calories.
- Sum hidden-calorie items into meal_summary.possible_hidden_calories (oil, butter, sauces, dressings).
- If overall confidence is low, include 1–3 specific follow_up_questions.

Reply with ONLY valid JSON (no markdown) matching:
{{
  "same_meal_validation": {{
    "passed": true,
    "confidence": 0.95,
    "issues": []
  }},
  "image_quality": [
    {{
      "index": 1,
      "blur": "ok|warn|fail",
      "brightness": "ok|warn|fail",
      "resolution": "ok|warn|fail",
      "food_visible": true,
      "full_plate_visible": true,
      "notes": "string"
    }}
  ],
  "meal_summary": {{
    "estimated_calories": integer,
    "calorie_range": {{ "min": integer, "max": integer }},
    "macros": {{ "protein": integer, "carbs": integer, "fat": integer }},
    "confidence": "low|medium|high",
    "overall_confidence": 0.9,
    "possible_hidden_calories": integer
  }},
  "food_items": [
    {{
      "name": "string",
      "category": "main|side|drink|dessert|fruit|vegetable|condiment",
      "cooking_style": "string",
      "visible_ingredients": ["string"],
      "estimated_weight_grams": integer,
      "portion_description": "string",
      "estimated_calories": integer,
      "calorie_range": {{ "min": integer, "max": integer }},
      "macros": {{ "protein": integer, "carbs": integer, "fat": integer }},
      "confidence": {{
        "identification": "low|medium|high",
        "portion_estimation": "low|medium|high",
        "nutrition_estimation": "low|medium|high"
      }},
      "confidence_score": 0.88,
      "hidden_calorie_sources": []
    }}
  ],
  "analysis_notes": ["string"],
  "follow_up_questions": [],
  "reference_found": true
}}"""


def parse_json_from_text(text: str) -> dict[str, Any] | None:
    if not text or not str(text).strip():
        return None
    trimmed = str(text).strip()
    try:
        parsed = json.loads(trimmed)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", trimmed, re.IGNORECASE)
    if fence:
        try:
            parsed = json.loads(fence.group(1).strip())
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            pass

    start = trimmed.find("{")
    if start < 0:
        return None
    depth = 0
    in_string = False
    escape = False
    quote = ""
    for i in range(start, len(trimmed)):
        ch = trimmed[i]
        if in_string:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                in_string = False
        elif ch in ('"', "'"):
            in_string = True
            quote = ch
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                try:
                    parsed = json.loads(trimmed[start : i + 1])
                    return parsed if isinstance(parsed, dict) else None
                except json.JSONDecodeError:
                    return None
    return None


def _item_conf_worst(conf: Any) -> str:
    if isinstance(conf, dict):
        vals = [
            str(conf.get("identification") or "medium").lower(),
            str(conf.get("portion_estimation") or "medium").lower(),
            str(conf.get("nutrition_estimation") or "medium").lower(),
        ]
        if "low" in vals:
            return "low"
        if "medium" in vals:
            return "medium"
        return "high"
    return str(conf or "medium").lower()


def _calorie_range(kcal: int, conf: str) -> dict[str, int]:
    spread = SPREAD.get(conf, 0.15)
    return {"min": round(kcal * (1 - spread)), "max": round(kcal * (1 + spread))}


def normalize_to_taqwin(raw: dict[str, Any]) -> dict[str, Any]:
    if "meal_summary" in raw:
        return raw

    food_items_raw = raw.get("food_items")
    if not isinstance(food_items_raw, list):
        return raw

    food_items = []
    for it in food_items_raw:
        if not isinstance(it, dict):
            continue
        kcal = int(it.get("estimated_calories") or 0)
        conf = _item_conf_worst(it.get("confidence"))
        conf_obj = it.get("confidence") if isinstance(it.get("confidence"), dict) else {
            "identification": conf,
            "portion_estimation": conf,
            "nutrition_estimation": conf,
        }
        food_items.append({
            "name": str(it.get("name") or "Unknown food"),
            "estimated_weight_grams": int(it.get("estimated_weight_grams") or 0),
            "portion_description": str(it.get("portion_description") or it.get("portion") or ""),
            "estimated_calories": kcal,
            "calorie_range": it.get("calorie_range") or _calorie_range(kcal, conf),
            "macros": it.get("macros") or {"protein": 0, "carbs": 0, "fat": 0},
            "confidence": conf_obj,
            "hidden_calorie_sources": it.get("hidden_calorie_sources")
            or (["cooking fat"] if it.get("hidden") else []),
        })

    total_kcal = int(raw.get("total_calories") or sum(i["estimated_calories"] for i in food_items))
    conf = str(raw.get("confidence") or "medium").lower()
    return {
        "meal_summary": {
            "estimated_calories": total_kcal,
            "calorie_range": raw.get("calorie_range") or _calorie_range(total_kcal, conf),
            "macros": {
                "protein": sum((i.get("macros") or {}).get("protein", 0) for i in food_items),
                "carbs": sum((i.get("macros") or {}).get("carbs", 0) for i in food_items),
                "fat": sum((i.get("macros") or {}).get("fat", 0) for i in food_items),
            },
            "confidence": conf,
        },
        "food_items": food_items,
        "analysis_notes": list(raw.get("analysis_notes") or ([str(raw["summary"])] if raw.get("summary") else [])),
        "follow_up_questions": list(raw.get("follow_up_questions") or []),
        "reference_found": raw.get("reference_found", True) is not False,
    }


async def analyze_meal_images(
    images: list[dict[str, str]],
    reference_info: str = "None (AI Guess)",
) -> dict[str, Any]:
    if not images:
        return {"error": "NO_IMAGES", "message": "Upload at least one meal photo"}
    if len(images) > MAX_IMAGES:
        return {"error": "TOO_MANY_IMAGES", "message": f"Maximum {MAX_IMAGES} images allowed"}

    settings = get_settings()
    api_key = (settings.anthropic_api_key or "").strip()
    if not api_key:
        return {"error": "API_KEY_INVALID", "message": "ANTHROPIC_API_KEY is not configured on ai-service"}

    model = (settings.meal_vision_model or settings.anthropic_model).strip()
    content: list[dict[str, Any]] = []
    for img in images:
        media_type = img.get("mediaType") or img.get("media_type") or "image/jpeg"
        data = img.get("data") or ""
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": data},
        })
    content.append({"type": "text", "text": nutrition_prompt(reference_info, len(images))})

    payload = {
        "model": model,
        "max_tokens": settings.meal_vision_max_tokens,
        "temperature": 0,
        "messages": [{"role": "user", "content": content}],
    }

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            res = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        logger.warning("Meal vision HTTP error: %s", exc)
        return {"error": str(exc)}

    if res.status_code == 401:
        return {"error": "API_KEY_INVALID"}
    if res.status_code == 429:
        return {"error": "QUOTA_EXCEEDED"}

    if res.status_code >= 400:
        try:
            err_json = res.json()
            msg = (err_json.get("error") or {}).get("message", res.text)
        except Exception:
            msg = res.text
        logger.warning("Meal vision Claude failed %s: %s", res.status_code, msg[:400])
        return {"error": f"HTTP {res.status_code}: {msg}"}

    data = res.json()
    text = "".join(
        block.get("text", "")
        for block in data.get("content", [])
        if block.get("type") == "text"
    )
    parsed = parse_json_from_text(text)
    if not parsed:
        return {"error": "Invalid JSON from model"}
    normalized = normalize_to_taqwin(parsed)
    enriched = enrich_meal_capture_result(normalized)
    gate = same_meal_gate(enriched)
    if gate:
        return gate
    return enriched
