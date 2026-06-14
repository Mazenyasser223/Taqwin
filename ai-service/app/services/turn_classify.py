"""
Classify user turn when a pending action exists — confirm / cancel / neutral.
LLM-first when a pending preview exists; regex only when LLM is unavailable.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Literal

from app.services.cag_sanitize import sanitize_pending_preview, sanitize_prompt_text
from app.services.llm_chat import complete_coach_chat, is_llm_configured

logger = logging.getLogger(__name__)

TurnType = Literal["confirm", "cancel", "neutral"]

_CONFIRM_EN = re.compile(
    r"\b(yes|yeah|yep|yup|confirm|confirmed|ok(?:ay)?|go ahead|do it|proceed|sure)\b",
    re.I,
)
_CONFIRM_AR = re.compile(
    r"(نعم|أكد|تأكيد|موافق|تمام|يلا|نفّذ|نفذ|اوكي|حسنا|ايوه|آه|اه|ماشي|تمام\s*نفذ|يلا\s*نفذ)",
    re.I,
)
_CANCEL_EN = re.compile(r"\b(no|nope|cancel|cancelled|stop|never\s?mind|don't)\b", re.I)
_CANCEL_AR = re.compile(r"(لا|إلغاء|الغاء|ألغ|الغ|وقف|توقف|مش\s*عايز|مش\s*عاوز|بلاش|سيبها|الغي|الغِ)", re.I)


def classify_turn_local(message: str, *, locale: str = "en") -> TurnType:
    text = (message or "").strip()
    if not text:
        return "neutral"
    if _CANCEL_EN.search(text) or _CANCEL_AR.search(text):
        return "cancel"
    if _CONFIRM_EN.search(text) or _CONFIRM_AR.search(text):
        return "confirm"
    return "neutral"


def is_confirmation(text: str, *, locale: str = "en") -> bool:
    return classify_turn_local(text, locale=locale) == "confirm"


def is_cancellation(text: str, *, locale: str = "en") -> bool:
    return classify_turn_local(text, locale=locale) == "cancel"


async def classify_turn_llm(
    message: str,
    *,
    locale: str = "en",
    pending_preview: str | None = None,
) -> TurnType:
    if not is_llm_configured():
        return "neutral"

    preview = sanitize_pending_preview(pending_preview)
    safe_message = str(sanitize_prompt_text(message, "userMessage") or "").strip()
    system = (
        "Classify the athlete reply about a PENDING fitness-app action. "
        "Reply with ONLY JSON: {\"turnType\": \"confirm\"|\"cancel\"|\"neutral\"}. "
        "confirm = agrees to run the pending action (yes, ok, تمام, ايوه, يلا نفذ). "
        "cancel = refuses (no, لا, مش عايز, بلاش). "
        "neutral = unrelated question or new request."
    )
    user = f"Locale: {locale}\nPending action preview: {preview or '(none)'}\n\nUser reply:\n{safe_message}"
    try:
        raw = await complete_coach_chat(
            system=system,
            messages=[{"role": "user", "content": user}],
            temperature=0,
            max_tokens=64,
        )
        data = json.loads(raw.strip())
        turn = str(data.get("turnType") or "neutral").lower()
        if turn in ("confirm", "cancel"):
            return turn  # type: ignore[return-value]
    except Exception as exc:
        logger.debug("turn classify LLM failed: %s", exc)
    return "neutral"


async def classify_turn(
    message: str,
    *,
    locale: str = "en",
    pending_preview: str | None = None,
) -> TurnType:
    local = classify_turn_local(message, locale=locale)
    if not is_llm_configured():
        return local

    llm_turn = await classify_turn_llm(
        message,
        locale=locale,
        pending_preview=pending_preview,
    )
    if llm_turn != "neutral":
        return llm_turn
    return local
