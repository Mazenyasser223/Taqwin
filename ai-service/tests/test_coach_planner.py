"""Coach graph planner routing tests."""

import asyncio
from unittest.mock import AsyncMock, patch

from app.agent.coach_graph import run_coach_graph


def test_compound_message_routes_to_planner() -> None:
    async def _run() -> None:
        plan_steps = [
            {
                "id": "step_1",
                "tool": "get_progress_summary",
                "step_type": "read",
                "depends_on": [],
                "inputs": {},
                "rationale": "baseline",
            },
            {
                "id": "step_2",
                "tool": "set_life_mode",
                "step_type": "write",
                "depends_on": ["step_1"],
                "inputs": {"lifeMode": "travel"},
                "rationale": "travel",
            },
        ]
        with patch("app.agent.coach_graph.get_coach_graph") as mock_graph:
            mock_graph.return_value.ainvoke = AsyncMock(
                return_value={
                    "reply": "Plan ready",
                    "intent": "execute_action",
                    "confirmation_required": True,
                    "confirmation_preview": "Action plan:\n1. ...",
                    "plan_steps": plan_steps,
                    "tool_calls_out": [{"name": "set_life_mode", "input": {"lifeMode": "travel"}}],
                    "nodes_trace": [{"node": "plan_compound", "steps": 2}],
                }
            )
            result = await run_coach_graph(
                user_id="user-1",
                messages=[{"role": "user", "content": "lose 5kg and travel next week"}],
                user_message="lose 5kg and travel next week",
                locale="en",
            )
            assert result["confirmation_required"] is True
            assert len(result["plan_steps"]) == 2

    asyncio.run(_run())
