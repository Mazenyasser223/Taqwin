"""Tests for registry JSON Schema validation before tool execution."""

from unittest.mock import patch

import pytest

from app.agent.tools.validate import validate_tool_input
from app.clients.node_internal import NodeInternalError, execute_tool
from app.services.compound_planner import validate_plan_steps


def test_message_only_log_food_valid() -> None:
    ok, errors = validate_tool_input("log_food", {"message": "200g chicken lunch"})
    assert ok, errors


def test_log_food_rejects_unknown_property() -> None:
    ok, errors = validate_tool_input("log_food", {"message": "x", "bogus": 1})
    assert not ok
    assert any("additional" in e.lower() or "bogus" in e for e in errors)


def test_update_weight_requires_weight_kg() -> None:
    ok, errors = validate_tool_input("update_weight", {"message": "80kg"})
    assert not ok
    assert errors


def test_update_weight_accepts_structured_input() -> None:
    ok, errors = validate_tool_input("update_weight", {"weightKg": 80})
    assert ok, errors


def test_set_life_mode_rejects_invalid_enum() -> None:
    ok, errors = validate_tool_input("set_life_mode", {"lifeMode": "vacation"})
    assert not ok


def test_set_life_mode_message_passthrough_valid() -> None:
    ok, errors = validate_tool_input("set_life_mode", {"message": "travel next week"})
    assert ok, errors


def test_delete_food_log_requires_uuid_even_with_message() -> None:
    ok, errors = validate_tool_input(
        "delete_food_log",
        {"message": "delete my last meal"},
    )
    assert not ok


def test_read_tool_accepts_empty_object() -> None:
    ok, errors = validate_tool_input("get_nutrition_today", {})
    assert ok, errors


def test_unknown_tool_fails() -> None:
    ok, errors = validate_tool_input("not_a_real_tool", {})
    assert not ok
    assert any("unknown_tool" in e for e in errors)


def test_validate_plan_steps_rejects_bad_step_inputs() -> None:
    steps = [
        {
            "id": "s1",
            "tool": "set_life_mode",
            "step_type": "write",
            "depends_on": [],
            "inputs": {"lifeMode": "vacation"},
        },
    ]
    ok, errors = validate_plan_steps(steps)
    assert not ok
    assert any("invalid_inputs:s1" in e for e in errors)


def test_validate_plan_steps_allows_empty_inputs() -> None:
    steps = [
        {
            "id": "s1",
            "tool": "set_life_mode",
            "step_type": "write",
            "depends_on": [],
            "inputs": {},
        },
    ]
    ok, errors = validate_plan_steps(steps)
    assert ok, errors


def test_validate_plan_steps_rejects_empty_structured_write() -> None:
    steps = [
        {
            "id": "s1",
            "tool": "update_fitness_goal",
            "step_type": "write",
            "depends_on": [],
            "inputs": {},
        },
    ]
    ok, errors = validate_plan_steps(steps)
    assert not ok
    assert any("missing_structured_inputs" in e for e in errors)


def test_validate_plan_steps_accepts_structured_write() -> None:
    steps = [
        {
            "id": "s1",
            "tool": "update_fitness_goal",
            "step_type": "write",
            "depends_on": [],
            "inputs": {"fitnessGoal": "lose 5kg"},
        },
    ]
    ok, errors = validate_plan_steps(steps)
    assert ok, errors


def test_execute_tool_validates_before_http() -> None:
    with patch("app.clients.node_internal.httpx.Client") as mock_client:
        with pytest.raises(NodeInternalError) as exc:
            execute_tool(
                user_id="00000000-0000-4000-8000-000000000001",
                tool_name="update_weight",
                input={"message": "80kg"},
            )
        assert exc.value.status_code == 422
        mock_client.assert_not_called()
