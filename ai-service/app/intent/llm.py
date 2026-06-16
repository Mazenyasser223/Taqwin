"""
Lightweight LLM intent classifier (Block B7 fallback).

Uses Anthropic when rules return `general` and API key is configured.
"""

from __future__ import annotations

import json
import logging
import re

from app.config import get_settings
from app.intent.intents import VALID_INTENTS

logger = logging.getLogger(__name__)

_INTENT_LIST = ", ".join(i for i in VALID_INTENTS if i not in ("general",))


def _parse_intent_payload(text: str) -> tuple[str, float]:
    raw = (text or "").strip()
    if not raw:
        return "general", 0.0

    try:
        data = json.loads(raw)
        if isinstance(data, dict):
            intent = str(data.get("intent") or "general").strip().lower()
            conf = float(data.get("confidence", 0.7))
            if intent in VALID_INTENTS:
                return intent, max(0.0, min(1.0, conf))
    except json.JSONDecodeError:
        pass

    match = re.search(r"\b(personal_status|nutrition|workout|exercise_alternative|platform_help|execute_action|scientific|life_mode|unclear|general)\b", raw, re.I)
    if match:
        return match.group(1).lower(), 0.65
    return "general", 0.0


def classify_intent_llm(message: str, *, locale: str = "en") -> tuple[str, float]:
    settings = get_settings()
    api_key = (settings.anthropic_api_key or "").strip()
    if not api_key:
        return "general", 0.0

    locale_note = "Arabic (Egyptian)" if locale == "ar" else "English"
    system = (
        "You classify Taqwin fitness app user messages into exactly one intent. "
        f"Valid intents: {_INTENT_LIST}. "
        "Reply with ONLY a JSON object: {\"intent\": \"...\", \"confidence\": 0.0-1.0}. "
        "Paraphrases map to the SAME intent — examples: "
        "'who is Taqwin' / 'من هي تكوين' / 'what is the app' / 'app features' → platform_help; "
        "'my body type' / 'نوع جسمي' → general (profile/onboarding context); "
        "'how am I today' / 'وزني النهارده' → personal_status; "
        "'log my lunch' → execute_action. "
        "Use unclear only if truly ambiguous. Prefer platform_help for any Taqwin/app identity question."
    )
    user = f"Locale hint: {locale_note}\n\nMessage:\n{message}"

    try:
        with httpx.Client(timeout=settings.intent_llm_timeout_seconds) as client:
            res = client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": settings.anthropic_haiku_model,
                    "max_tokens": 64,
                    "temperature": 0,
                    "system": system,
                    "messages": [{"role": "user", "content": user}],
                },
            )
        if res.status_code >= 400:
            logger.warning("Anthropic intent classify %s: %s", res.status_code, res.text[:200])
            return "general", 0.0
        data = res.json()
        blocks = data.get("content") or []
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        return _parse_intent_payload(text)
    except Exception as exc:
        logger.warning("LLM intent classify failed: %s", exc)
        return "general", 0.0
