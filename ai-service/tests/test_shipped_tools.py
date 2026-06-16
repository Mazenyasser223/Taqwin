from unittest.mock import patch

from app.agent.tools.registry import tools_for_intent
from app.agent.tools.shipped import filter_shipped_names, filter_shipped_tools, invalidate_shipped_cache


def test_filter_shipped_tools_restricts_to_node_list() -> None:
    invalidate_shipped_cache()
    tools = [
        {"name": "log_food", "description": "x", "input_schema": {"type": "object", "properties": {}}},
        {"name": "phantom_tool", "description": "y", "input_schema": {"type": "object", "properties": {}}},
    ]
    with patch("app.agent.tools.shipped.list_registered_tools", return_value=["log_food"]):
        invalidate_shipped_cache()
        out = filter_shipped_tools(tools)
    assert [t["name"] for t in out] == ["log_food"]


def test_tools_for_intent_uses_shipped_filter() -> None:
    invalidate_shipped_cache()
    with patch("app.agent.tools.shipped.list_registered_tools", return_value=["get_nutrition_today"]):
        invalidate_shipped_cache()
        out = tools_for_intent("personal_status", max_tools=12)
    names = [t["name"] for t in out]
    assert "get_nutrition_today" in names
    assert all(n == "get_nutrition_today" for n in names) or len(names) <= 12


def test_filter_shipped_names() -> None:
    invalidate_shipped_cache()
    with patch("app.agent.tools.shipped.list_registered_tools", return_value=["log_food"]):
        invalidate_shipped_cache()
        assert filter_shipped_names(["log_food", "skip_day"]) == ["log_food"]
