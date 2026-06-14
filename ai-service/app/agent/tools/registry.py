"""Taqwin coach tool registry — Anthropic schemas + routing metadata."""

from __future__ import annotations

from typing import Any, Final

from app.agent.tools.step_up_config import step_up_tool_names

# Tools that mutate data or have irreversible effects — require user confirmation.
CONFIRM_REQUIRED: Final[frozenset[str]] = frozenset(
    {
        "log_food",
        "update_food_log",
        "delete_food_log",
        "replace_meal_today",
        "log_workout",
        "log_exercise_set",
        "replace_exercise_today",
        "add_exercise",
        "remove_exercise",
        "update_weight",
        "update_height",
        "update_fitness_goal",
        "update_level",
        "update_medical_notes",
        "generate_weekly_workout",
        "generate_weekly_diet",
        "generate_today",
        "adapt_plan",
        "skip_day",
        "swap_rest_day",
        "set_life_mode",
        "record_body_metric",
        "create_progress_snapshot",
        "request_booking",
        "create_support_ticket",
        "set_training_goal",
        "suggest_meal_plan_swap",
    }
)

# High-impact plan mutations — step-up phrase/password after stale pending (enforced in Node).
STEP_UP_REQUIRED: Final[frozenset[str]] = step_up_tool_names()

# Registered in Node but not offered to the coach LLM (use plan API or support flow instead).
CHAT_DISABLED: Final[frozenset[str]] = frozenset(
    {
        "generate_weekly_workout",
        "generate_weekly_diet",
        "request_booking",
        "search_trainers",
    }
)

READ_TOOLS: Final[frozenset[str]] = frozenset(
    {
        "ping",
        "echo",
        "get_nutrition_today",
        "get_nutrition_week",
        "get_workout_today",
        "get_today_plan",
        "get_progress_summary",
        "get_weekly_adherence",
        "get_macro_targets",
        "search_food_catalog",
        "search_exercises",
        "get_exercise_details",
        "suggest_exercise_alternatives",
        "search_gyms",
        "search_products",
        "search_trainers",
        "get_recovery_score",
        "calculate_tdee_estimate",
        "record_readiness",
        "log_water_intake",
        "log_cardio_session",
        "log_stretching_session",
        "log_sleep",
        "log_stress_level",
    }
)


def _schema(**properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "object", "properties": properties, "additionalProperties": False}


def _tool(
    name: str,
    description: str,
    *,
    properties: dict[str, Any] | None = None,
    required: list[str] | None = None,
    category: str = "general",
    intents: tuple[str, ...] = (),
) -> dict[str, Any]:
    schema = _schema(**(properties or {"message": {"type": "string", "description": "User text"}}))
    if required:
        schema["required"] = required
    return {
        "name": name,
        "description": description,
        "input_schema": schema,
        "category": category,
        "intents": intents,
        "requires_confirm": name in CONFIRM_REQUIRED,
        "requires_step_up": name in STEP_UP_REQUIRED,
        "is_read": name in READ_TOOLS,
    }


COACH_TOOLS: Final[list[dict[str, Any]]] = [
    _tool("ping", "Health check for AI tool bridge.", category="system"),
    _tool("echo", "Echo input for integration tests.", category="system"),
    # Profile
    _tool(
        "update_weight",
        "Update athlete weight (kg) in profile and log body metric.",
        properties={"weightKg": {"type": "number", "description": "Weight in kilograms"}},
        required=["weightKg"],
        category="profile",
        intents=("personal_status", "execute_action"),
    ),
    _tool(
        "update_height",
        "Update athlete height (cm).",
        properties={"heightCm": {"type": "number"}},
        required=["heightCm"],
        category="profile",
    ),
    _tool(
        "update_fitness_goal",
        "Update primary fitness goal (e.g. lose fat, build muscle).",
        properties={"fitnessGoal": {"type": "string"}},
        required=["fitnessGoal"],
        category="profile",
    ),
    _tool(
        "update_level",
        "Update training experience level (beginner/intermediate/advanced).",
        properties={"fitnessLevel": {"type": "string"}},
        required=["fitnessLevel"],
        category="profile",
    ),
    _tool(
        "update_medical_notes",
        "Update medical notes or injury history on profile.",
        properties={"medicalNotes": {"type": "string"}},
        required=["medicalNotes"],
        category="profile",
    ),
    # Nutrition
    _tool(
        "log_food",
        "Log a food item to today's nutrition diary.",
        properties={
            "foodName": {"type": "string"},
            "grams": {"type": "number"},
            "rawText": {"type": "string"},
            "message": {"type": "string"},
        },
        category="nutrition",
        intents=("execute_action", "nutrition"),
    ),
    _tool(
        "update_food_log",
        "Change grams on an existing food log entry.",
        properties={
            "foodLogId": {"type": "string"},
            "grams": {"type": "number"},
        },
        required=["foodLogId", "grams"],
        category="nutrition",
    ),
    _tool(
        "delete_food_log",
        "Delete a food log entry.",
        properties={"foodLogId": {"type": "string"}},
        required=["foodLogId"],
        category="nutrition",
    ),
    _tool(
        "get_nutrition_today",
        "Get today's logged meals and macro totals.",
        category="nutrition",
        intents=("personal_status", "nutrition", "execute_action"),
    ),
    _tool(
        "get_nutrition_week",
        "Get nutrition summary for the last 7 days.",
        category="nutrition",
        intents=("nutrition", "personal_status"),
    ),
    _tool(
        "replace_meal_today",
        "Swap a planned meal item on today's diet plan.",
        properties={
            "mealType": {"type": "string", "enum": ["breakfast", "lunch", "dinner", "snack"]},
            "foodName": {"type": "string"},
            "reason": {"type": "string"},
        },
        required=["foodName"],
        category="nutrition",
        intents=("nutrition", "execute_action"),
    ),
    _tool(
        "get_macro_targets",
        "Get daily calorie and macro targets for the athlete.",
        category="nutrition",
        intents=("nutrition", "personal_status"),
    ),
    _tool(
        "search_food_catalog",
        "Search Taqwin food catalog by name.",
        properties={"query": {"type": "string"}, "foodName": {"type": "string"}},
        category="nutrition",
        intents=("nutrition", "execute_action"),
    ),
    _tool(
        "log_water_intake",
        "Log water intake in milliliters.",
        properties={"ml": {"type": "number"}},
        category="nutrition",
    ),
    _tool(
        "suggest_meal_plan_swap",
        "Suggest high-protein or goal-aligned foods for a meal slot.",
        properties={"mealType": {"type": "string"}, "goal": {"type": "string"}},
        category="nutrition",
        intents=("nutrition",),
    ),
    _tool(
        "calculate_tdee_estimate",
        "Estimate BMR and maintenance calories from profile (not medical advice).",
        category="nutrition",
        intents=("nutrition", "scientific", "personal_status"),
    ),
    # Workout
    _tool(
        "log_workout",
        "Log a completed workout session note.",
        properties={"durationMin": {"type": "number"}, "notes": {"type": "string"}},
        category="workout",
    ),
    _tool(
        "log_exercise_set",
        "Log sets/reps for a specific exercise.",
        properties={
            "exerciseName": {"type": "string"},
            "exerciseId": {"type": "string"},
            "sets": {"type": "integer"},
            "reps": {"type": "string"},
            "weightKg": {"type": "number"},
            "notes": {"type": "string"},
        },
        category="workout",
    ),
    _tool(
        "get_workout_today",
        "Get today's planned workout exercises.",
        category="workout",
        intents=("workout", "personal_status", "exercise_alternative"),
    ),
    _tool(
        "replace_exercise_today",
        "Replace an exercise on today's workout plan.",
        properties={
            "oldExerciseName": {"type": "string"},
            "newExerciseName": {"type": "string"},
            "exerciseIndex": {"type": "integer"},
            "request": {"type": "string"},
            "message": {"type": "string"},
        },
        category="workout",
        intents=("execute_action", "exercise_alternative"),
    ),
    _tool(
        "add_exercise",
        "Add an exercise to today's workout.",
        properties={
            "exerciseName": {"type": "string"},
            "sets": {"type": "integer"},
            "reps": {"type": "string"},
        },
        category="workout",
    ),
    _tool(
        "remove_exercise",
        "Remove an exercise from today's workout.",
        properties={"exerciseIndex": {"type": "integer"}, "workoutPlanExerciseId": {"type": "string"}},
        category="workout",
    ),
    _tool(
        "search_exercises",
        "Search public exercise catalog.",
        properties={"query": {"type": "string"}, "exerciseName": {"type": "string"}},
        category="workout",
        intents=("workout", "exercise_alternative"),
    ),
    _tool(
        "get_exercise_details",
        "Get details for one exercise by name or ID.",
        properties={"exerciseId": {"type": "string"}, "exerciseName": {"type": "string"}},
        category="workout",
        intents=("workout", "exercise_alternative"),
    ),
    _tool(
        "suggest_exercise_alternatives",
        "Suggest alternative exercises in the same category.",
        properties={"exerciseName": {"type": "string"}},
        required=["exerciseName"],
        category="workout",
        intents=("exercise_alternative", "workout"),
    ),
    _tool(
        "log_cardio_session",
        "Log a cardio session (running, cycling, etc.).",
        properties={"activity": {"type": "string"}, "durationMin": {"type": "number"}},
        category="workout",
    ),
    _tool(
        "log_stretching_session",
        "Log mobility or stretching session.",
        properties={"durationMin": {"type": "number"}},
        category="workout",
    ),
    # Plans
    _tool(
        "get_today_plan",
        "Get today's combined workout and nutrition plan slice.",
        category="plans",
        intents=("personal_status", "workout", "nutrition"),
    ),
    _tool(
        "generate_weekly_workout",
        "Regenerate weekly workout plan (requires confirmation).",
        properties={"request": {"type": "string"}},
        category="plans",
    ),
    _tool(
        "generate_weekly_diet",
        "Regenerate weekly diet plan (requires confirmation).",
        properties={"request": {"type": "string"}},
        category="plans",
    ),
    _tool(
        "generate_today",
        "Ensure today's daily plan row exists.",
        category="plans",
    ),
    _tool(
        "adapt_plan",
        "Apply micro or mid-week plan adaptation from chat.",
        properties={"request": {"type": "string"}, "message": {"type": "string"}},
        category="plans",
        intents=("life_mode", "execute_action"),
    ),
    _tool(
        "skip_day",
        "Mark today (or a date) as skipped on the plan.",
        properties={"date": {"type": "string"}, "reason": {"type": "string"}},
        category="plans",
    ),
    _tool(
        "swap_rest_day",
        "Request rest/training day swap (meso reschedule).",
        properties={"reason": {"type": "string"}},
        category="plans",
    ),
    _tool(
        "set_life_mode",
        "Set life mode: normal, travel, sick, fasting, injury_flare.",
        properties={
            "lifeMode": {
                "type": "string",
                "enum": ["normal", "travel", "sick", "fasting", "injury_flare"],
            },
            "message": {"type": "string"},
            "reason": {"type": "string"},
        },
        category="plans",
        intents=("life_mode", "execute_action"),
    ),
    # Progress & recovery
    _tool(
        "record_body_metric",
        "Log weight and/or body fat percentage.",
        properties={"weightKg": {"type": "number"}, "bodyFatPct": {"type": "number"}},
        category="progress",
        intents=("personal_status", "execute_action"),
    ),
    _tool(
        "record_readiness",
        "Log daily readiness (sleep, soreness, RPE 1-5).",
        properties={
            "sleepQuality": {"type": "integer"},
            "soreness": {"type": "integer"},
            "rpe": {"type": "integer"},
            "notes": {"type": "string"},
        },
        category="progress",
    ),
    _tool(
        "get_progress_summary",
        "Weekly adherence and adaptation review summary.",
        category="progress",
        intents=("personal_status",),
    ),
    _tool(
        "create_progress_snapshot",
        "Persist a weekly progress snapshot.",
        properties={"weekStart": {"type": "string"}, "notes": {"type": "string"}},
        category="progress",
    ),
    _tool(
        "get_weekly_adherence",
        "Get workout and nutrition adherence percentages for current week.",
        category="progress",
        intents=("personal_status",),
    ),
    _tool(
        "get_recovery_score",
        "Compute recovery score from latest readiness log.",
        category="progress",
        intents=("personal_status", "workout"),
    ),
    _tool(
        "log_sleep",
        "Log sleep hours (maps to readiness).",
        properties={"hours": {"type": "number"}},
        category="progress",
    ),
    _tool(
        "log_stress_level",
        "Log stress level 1-5 (maps to readiness RPE).",
        properties={"stressLevel": {"type": "integer"}},
        category="progress",
    ),
    _tool(
        "set_training_goal",
        "Set a training goal for the current block.",
        properties={"trainingGoal": {"type": "string"}},
        required=["trainingGoal"],
        category="progress",
    ),
    # Gym / marketplace / support
    _tool(
        "search_gyms",
        "Search gyms on Taqwin marketplace.",
        properties={"query": {"type": "string"}},
        category="gym",
        intents=("platform_help",),
    ),
    _tool(
        "search_products",
        "Search marketplace products.",
        properties={"query": {"type": "string"}},
        category="gym",
    ),
    _tool(
        "search_trainers",
        "Search trainers (may be limited).",
        properties={"query": {"type": "string"}},
        category="gym",
    ),
    _tool(
        "request_booking",
        "Request a gym or trainer booking.",
        properties={"message": {"type": "string"}},
        category="gym",
    ),
    _tool(
        "create_support_ticket",
        "Open a support ticket for Taqwin team.",
        properties={
            "subject": {"type": "string"},
            "description": {"type": "string"},
            "category": {"type": "string"},
        },
        required=["description"],
        category="system",
        intents=("platform_help",),
    ),
]

TOOL_BY_NAME: Final[dict[str, dict[str, Any]]] = {t["name"]: t for t in COACH_TOOLS}


def is_chat_tool(name: str) -> bool:
    return name not in CHAT_DISABLED and name not in ("ping", "echo")


def anthropic_tools_for_llm(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "name": t["name"],
            "description": t["description"],
            "input_schema": t["input_schema"],
        }
        for t in tools
    ]


def tools_for_intent(intent: str, *, max_tools: int = 12) -> list[dict[str, Any]]:
    """Return chat-shipped tool defs relevant to intent (read tools for context)."""
    from app.agent.tools.shipped import filter_shipped_tools

    matched: list[dict[str, Any]] = []
    general: list[dict[str, Any]] = []
    for t in COACH_TOOLS:
        if not is_chat_tool(t["name"]):
            continue
        intents = t.get("intents") or ()
        if intent in intents:
            matched.append(t)
        elif not intents and t.get("is_read"):
            general.append(t)
    out = matched + [g for g in general if g not in matched]
    if not out:
        out = [t for t in COACH_TOOLS if is_chat_tool(t["name"])][:max_tools]
    return filter_shipped_tools(out)[:max_tools]


def shipped_tool_hints(hints: tuple[str, ...] | list[str]) -> tuple[str, ...]:
    """Intent tool hints restricted to Node-registered handlers."""
    from app.agent.tools.shipped import filter_shipped_names

    return tuple(filter_shipped_names(list(hints)))


def tool_requires_confirmation(name: str) -> bool:
    return name in CONFIRM_REQUIRED


def tool_requires_step_up(name: str) -> bool:
    return name in STEP_UP_REQUIRED


def all_tool_names() -> list[str]:
    return [t["name"] for t in COACH_TOOLS]


def chat_tool_names() -> list[str]:
    return [t["name"] for t in COACH_TOOLS if is_chat_tool(t["name"])]
