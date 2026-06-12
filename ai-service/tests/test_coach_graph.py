import asyncio
from unittest.mock import AsyncMock, patch

from app.agent.coach_graph import run_coach_resume


def test_run_coach_resume_invokes_subgraph() -> None:
    async def _run() -> None:
        with patch("app.agent.coach_graph.get_coach_graph") as mock_graph:
            mock_graph.return_value.ainvoke = AsyncMock(
                return_value={
                    "reply": "Done",
                    "intent": "execute_action",
                    "tool_results": [{"tool": "log_food", "success": True}],
                    "tool_calls_out": [{"name": "log_food", "input": {}}],
                    "nodes_trace": [],
                }
            )
            result = await run_coach_resume(
                user_id="user-1",
                tools=["log_food"],
                inputs_by_tool={"log_food": {"foodName": "chicken", "grams": 200}},
                user_message="log chicken",
                locale="en",
            )
            assert result["reply"] == "Done"
            assert result["tool_results"][0]["success"] is True
            mock_graph.return_value.ainvoke.assert_called_once()

    asyncio.run(_run())
