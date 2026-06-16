from unittest.mock import AsyncMock, patch

import pytest

from app.services.tool_extract import select_action_tools


@pytest.mark.asyncio
async def test_select_action_tools_single_hint() -> None:
    out = await select_action_tools(
        tool_hints=["log_food"],
        user_message="سجل 200 جرام دجاج",
        locale="ar",
    )
    assert out == ["log_food"]


@pytest.mark.asyncio
async def test_select_action_tools_llm_pick() -> None:
    with patch("app.services.tool_extract.is_llm_configured", return_value=True):
        with patch(
            "app.services.tool_extract.complete_coach_chat",
            new_callable=AsyncMock,
            return_value='{"tools": ["replace_exercise_today"]}',
        ):
            out = await select_action_tools(
                tool_hints=["log_food", "replace_exercise_today"],
                user_message="بدّل البنش برس بالدامبل",
                locale="ar",
            )
    assert out == ["replace_exercise_today"]
