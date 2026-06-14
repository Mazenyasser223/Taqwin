from unittest.mock import AsyncMock, patch

import pytest

from app.services.turn_classify import (
    classify_turn,
    classify_turn_local,
    is_cancellation,
    is_confirmation,
)


def test_classify_turn_local_ar_dialect() -> None:
    assert classify_turn_local("ايوه", locale="ar") == "confirm"
    assert classify_turn_local("تمام نفذ", locale="ar") == "confirm"
    assert classify_turn_local("مش عايز", locale="ar") == "cancel"
    assert classify_turn_local("how much protein today?", locale="ar") == "neutral"


def test_is_confirmation_en() -> None:
    assert is_confirmation("Yes, confirm", locale="en")
    assert is_confirmation("ok go ahead", locale="en")
    assert not is_confirmation("no thanks", locale="en")


def test_is_confirmation_ar() -> None:
    assert is_confirmation("نعم أكد", locale="ar")
    assert is_confirmation("موافق", locale="ar")
    assert is_confirmation("ايوه", locale="ar")


def test_is_cancellation() -> None:
    assert is_cancellation("no cancel", locale="en")
    assert is_cancellation("إلغاء", locale="ar")
    assert is_cancellation("مش عايز", locale="ar")
    assert not is_cancellation("yes", locale="en")
    assert not is_confirmation("مش عايز", locale="ar")


@pytest.mark.asyncio
async def test_classify_turn_falls_back_to_regex_when_llm_neutral() -> None:
    with patch("app.services.turn_classify.is_llm_configured", return_value=True):
        with patch(
            "app.services.turn_classify.classify_turn_llm",
            new_callable=AsyncMock,
            return_value="neutral",
        ):
            turn = await classify_turn("ايوه", locale="ar", pending_preview="Log food: chicken")
    assert turn == "confirm"

