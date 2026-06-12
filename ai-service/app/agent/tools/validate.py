"""JSON Schema validation for coach tool inputs before Node execution."""

from __future__ import annotations

import copy
from typing import Any

import jsonschema
from jsonschema import Draft202012Validator

from app.agent.tools.registry import TOOL_BY_NAME

# Universal passthrough keys the coach may attach even when omitted from a tool schema.
PASSTHROUGH_KEYS: frozenset[str] = frozenset({"message", "rawText", "request", "reason"})

# Node resolvers can derive structured args from free-text when required fields are absent.
MESSAGE_RESOLVER_TOOLS: frozenset[str] = frozenset(
    {
        "log_food",
        "replace_exercise_today",
        "set_life_mode",
        "adapt_plan",
        "replace_meal_today",
        "update_medical_notes",
        "log_workout",
        "skip_day",
        "swap_rest_day",
        "search_gyms",
        "search_products",
        "search_trainers",
        "request_booking",
        "create_support_ticket",
        "search_food_catalog",
        "search_exercises",
        "get_exercise_details",
        "suggest_exercise_alternatives",
        "set_training_goal",
        "suggest_meal_plan_swap",
        "generate_weekly_workout",
        "generate_weekly_diet",
        "record_readiness",
    }
)

# Tools that require explicit IDs/numbers — message passthrough cannot satisfy required fields.
STRICT_STRUCTURED_TOOLS: frozenset[str] = frozenset(
    {
        "update_food_log",
        "delete_food_log",
    }
)


def _passthrough_text(input_data: dict[str, Any]) -> str:
    for key in PASSTHROUGH_KEYS:
        val = input_data.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def write_step_requires_plan_inputs(tool_name: str) -> bool:
    """Write steps must ship structured inputs at plan time unless Node resolves from message."""
    if tool_name in MESSAGE_RESOLVER_TOOLS:
        return False
    if tool_name in STRICT_STRUCTURED_TOOLS:
        return True
    tool = TOOL_BY_NAME.get(tool_name)
    if not tool:
        return True
    schema = tool.get("input_schema") or {}
    return bool(schema.get("required"))


def _effective_schema(
    tool_name: str,
    input_data: dict[str, Any],
    *,
    relax_passthrough: bool = True,
) -> dict[str, Any] | None:
    tool = TOOL_BY_NAME.get(tool_name)
    if not tool:
        return None

    schema = copy.deepcopy(tool["input_schema"])
    props = dict(schema.get("properties") or {})
    for key in PASSTHROUGH_KEYS:
        if key not in props:
            props[key] = {"type": "string"}
    schema["properties"] = props

    if relax_passthrough and tool_name not in STRICT_STRUCTURED_TOOLS:
        if tool_name in MESSAGE_RESOLVER_TOOLS and _passthrough_text(input_data):
            schema.pop("required", None)

    return schema


def _clean_input(input_data: dict[str, Any]) -> dict[str, Any]:
    """Drop explicit nulls so optional fields do not fail type checks."""
    return {k: v for k, v in input_data.items() if v is not None}


def _format_error(error: jsonschema.ValidationError) -> str:
    path = ".".join(str(part) for part in error.path) if error.path else "root"
    return f"{path}:{error.message}"


def validate_tool_input(
    tool_name: str,
    input_data: Any,
    *,
    relax_passthrough: bool = True,
) -> tuple[bool, list[str]]:
    """
    Validate tool input against the registry JSON Schema.

    Returns (ok, errors). Unknown tools and non-object inputs fail closed.
    """
    if not isinstance(input_data, dict):
        return False, ["input_must_be_object"]

    cleaned = _clean_input(input_data)
    schema = _effective_schema(tool_name, cleaned, relax_passthrough=relax_passthrough)
    if schema is None:
        return False, [f"unknown_tool:{tool_name}"]

    validator = Draft202012Validator(schema)
    validation_errors = sorted(validator.iter_errors(cleaned), key=lambda err: list(err.path))
    if not validation_errors:
        return True, []

    return False, [_format_error(err) for err in validation_errors]


def validate_plan_step_inputs(tool_name: str, inputs: Any) -> tuple[bool, list[str]]:
    """
    Validate write-step inputs at compound-plan time.

    Message-resolver writes may omit inputs (filled from user text at execution).
    Other writes must include structured fields that satisfy the schema.
    """
    if not isinstance(inputs, dict):
        return False, ["inputs_must_be_object"]

    if write_step_requires_plan_inputs(tool_name):
        if not inputs:
            return False, ["missing_structured_inputs"]
        return validate_tool_input(tool_name, inputs, relax_passthrough=False)

    if inputs:
        return validate_tool_input(tool_name, inputs, relax_passthrough=True)
    return True, []
