from app.agent.tools.registry import (
    COACH_TOOLS,
    all_tool_names,
    tool_requires_confirmation,
    tool_requires_step_up,
)


def test_registry_has_40_plus_tools() -> None:
    names = all_tool_names()
    assert len(names) >= 40
    assert "log_food" in names
    assert "replace_exercise_today" in names
    assert "calculate_tdee_estimate" in names
    assert "search_exercises" in names


def test_every_tool_has_schema() -> None:
    from jsonschema import Draft202012Validator

    for tool in COACH_TOOLS:
        assert tool["name"]
        assert tool["description"]
        schema = tool["input_schema"]
        assert schema["type"] == "object"
        Draft202012Validator.check_schema(schema)


def test_confirm_flags() -> None:
    assert tool_requires_confirmation("log_food") is True
    assert tool_requires_confirmation("get_nutrition_today") is False
    assert tool_requires_confirmation("delete_food_log") is True


def test_step_up_flags() -> None:
    assert tool_requires_step_up("adapt_plan") is True
    assert tool_requires_step_up("set_life_mode") is True
    assert tool_requires_step_up("update_fitness_goal") is True
    assert tool_requires_step_up("replace_exercise_today") is True
    assert tool_requires_step_up("log_food") is False
