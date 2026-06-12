"""Tests for compound request planner (Block E — planner agent B)."""

from unittest.mock import AsyncMock, patch

import pytest

from app.services.compound_planner import (
    _heuristic_plan,
    execute_plan_steps,
    format_plan_preview,
    generate_compound_plan,
    needs_compound_planner,
    topological_sort_steps,
    validate_plan_steps,
)


def test_needs_compound_planner_two_writes() -> None:
    msg = "I want to lose 5kg and set travel mode next week"
    assert needs_compound_planner(
        msg,
        ["update_fitness_goal", "set_life_mode"],
        "execute_action",
    )


def test_needs_compound_planner_single_tool_false() -> None:
    assert not needs_compound_planner("log 200g chicken", ["log_food"], "execute_action")


def test_needs_compound_planner_general_false() -> None:
    assert not needs_compound_planner(
        "lose weight and travel next week",
        ["adapt_plan"],
        "general",
    )


def test_heuristic_plan_orders_reads_before_writes() -> None:
    steps = _heuristic_plan(
        ["update_fitness_goal", "set_life_mode", "adapt_plan"],
        "lose 5kg and travel",
        "en",
    )
    assert len(steps) >= 3
    first_write_idx = next(i for i, s in enumerate(steps) if s["step_type"] == "write")
    assert all(s["step_type"] == "read" for s in steps[:first_write_idx])
    ok, errors = validate_plan_steps(steps)
    assert ok, errors
    goal_step = next(s for s in steps if s["tool"] == "update_fitness_goal")
    assert goal_step["inputs"]["fitnessGoal"] == "lose 5kg and travel"


def test_validate_plan_rejects_too_many_steps() -> None:
    steps = [
        {
            "id": f"s{i}",
            "tool": "log_food",
            "step_type": "write",
            "depends_on": [],
            "inputs": {},
        }
        for i in range(6)
    ]
    ok, errors = validate_plan_steps(steps)
    assert not ok
    assert any("too_many" in e for e in errors)


def test_validate_plan_rejects_cycle() -> None:
    steps = [
        {
            "id": "a",
            "tool": "set_life_mode",
            "step_type": "write",
            "depends_on": ["b"],
            "inputs": {},
        },
        {
            "id": "b",
            "tool": "adapt_plan",
            "step_type": "write",
            "depends_on": ["a"],
            "inputs": {},
        },
    ]
    ok, errors = validate_plan_steps(steps)
    assert not ok
    assert "cycle_in_dependencies" in errors


def test_topological_sort_respects_dependencies() -> None:
    steps = [
        {"id": "s2", "tool": "adapt_plan", "step_type": "write", "depends_on": ["s1"], "inputs": {}},
        {"id": "s1", "tool": "get_progress_summary", "step_type": "read", "depends_on": [], "inputs": {}},
    ]
    ordered = topological_sort_steps(steps)
    assert [s["id"] for s in ordered] == ["s1", "s2"]


def test_format_plan_preview_numbered() -> None:
    steps = _heuristic_plan(["set_life_mode", "adapt_plan"], "travel next week", "en")
    preview = format_plan_preview(steps, locale="en")
    assert "Action plan:" in preview
    assert "1." in preview


@pytest.mark.asyncio
async def test_generate_compound_plan_llm() -> None:
    llm_json = """{
      "steps": [
        {"id": "step_1", "tool": "get_progress_summary", "step_type": "read", "depends_on": [], "inputs": {}, "rationale": "baseline"},
        {"id": "step_2", "tool": "set_life_mode", "step_type": "write", "depends_on": ["step_1"], "inputs": {"lifeMode": "travel"}, "rationale": "travel"}
      ]
    }"""
    with patch("app.services.compound_planner.is_llm_configured", return_value=True):
        with patch(
            "app.services.compound_planner.complete_coach_chat",
            new_callable=AsyncMock,
            return_value=llm_json,
        ):
            steps = await generate_compound_plan(
                user_message="lose 5kg and travel next week",
                tool_hints=["update_fitness_goal", "set_life_mode"],
                locale="en",
            )
    assert len(steps) == 2
    assert steps[0]["tool"] == "get_progress_summary"
    assert steps[1]["tool"] == "set_life_mode"


def test_execute_plan_steps_stops_on_failure() -> None:
    plan = [
        {"id": "s1", "tool": "get_progress_summary", "step_type": "read", "depends_on": [], "inputs": {}},
        {"id": "s2", "tool": "set_life_mode", "step_type": "write", "depends_on": ["s1"], "inputs": {"lifeMode": "travel"}},
    ]
    with patch("app.clients.node_internal.execute_tool") as mock_exec:
        from app.clients.node_internal import NodeInternalError

        mock_exec.side_effect = [
            {"output": {"weightKg": 80}},
            NodeInternalError("set_life_mode failed"),
        ]
        results = execute_plan_steps(
            user_id="u1",
            plan_steps=plan,
            user_message="travel",
            inputs_by_tool={"set_life_mode": {"lifeMode": "travel"}},
        )
    assert len(results) == 2
    assert results[0]["success"] is True
    assert results[1]["success"] is False
