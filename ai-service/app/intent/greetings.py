"""
Small-talk greetings — short hi/hello/how-are-you turns (EN + AR).
"""

from __future__ import annotations

import re

_GREETING_ONLY = re.compile(
    r"^\s*("
    r"hi|hello|hey|hiya|yo|sup|what'?s\s*up|wassup|good\s*(morning|afternoon|evening|night)|"
    r"how\s*(are|r)\s*(you|u)|how\s*do\s*you\s*do|greetings"
    r"|salam|assalamu?\s*alaikum|marhaba|marhaban"
    r"|مرحبا|مرحباً|أهلا|اهلا|السلام\s*عليكم|سلام|صباح\s*ال?خير|مساء\s*ال?خير|هلا|هاي"
    r"|ازيك|إزيك|إزيك\s*عامل\s*ا?يه|عامل\s*ا?يه|عاملة\s*ا?يه|"
    r"إيه\s*ال?أ?خبار|ايه\s*ال?أ?خبار|اخبارك|أخبارك|كيف\s*حالك|شلونك"
    r")(?:[\s,!.?…]*(?:there|coach|taqwin|تكوين|مدرب)?)?[\s!.?…]*$",
    re.I,
)


def is_greeting_message(message: str) -> bool:
    text = (message or "").strip()
    if not text:
        return False
    if len(text.split()) > 8:
        return False
    return bool(_GREETING_ONLY.match(text))


def build_greeting_reply(*, locale: str, display_name: str | None = None) -> str:
    name = (display_name or "").strip()
    first = name.split()[0] if name else ""

    if locale == "ar":
        if first:
            return (
                f"أهلاً {first}! الحمد لله كويس. إزيك؟ "
                "تحب أساعدك في التمرين، التغذية، ولا أي حاجة في تكوين؟"
            )
        return (
            "أهلاً! الحمد لله كويس. إزيك؟ "
            "تحب أساعدك في التمرين، التغذية، ولا أي حاجة في تكوين؟"
        )

    if first:
        return (
            f"Hey {first}! I'm doing great — thanks for checking in. "
            "How are you? I can help with training, nutrition, or anything in the Taqwin app."
        )
    return (
        "Hey! I'm doing great — thanks for checking in. "
        "How are you? I can help with training, nutrition, or anything in the Taqwin app."
    )
