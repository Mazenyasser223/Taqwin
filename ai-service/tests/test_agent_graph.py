import asyncio
from unittest.mock import AsyncMock, patch


def test_run_tool_agent_graph_returns_results() -> None:
    async def _run() -> None:
        with patch("app.agent.graph.get_tool_agent_graph", side_effect=ImportError("no langgraph")):
            with patch("app.agent.runner.run_tool_agent", new_callable=AsyncMock) as mock_run:
                mock_run.return_value = [{"tool": "log_food", "success": True, "output": {}}]
                from app.agent.graph import run_tool_agent_graph

                results = await run_tool_agent_graph(
                    user_id="user-1",
                    tool_names=["log_food"],
                    user_message="log 200g chicken",
                    locale="en",
                )
                assert len(results) == 1
                assert results[0]["success"] is True
                mock_run.assert_called_once()

    asyncio.run(_run())
