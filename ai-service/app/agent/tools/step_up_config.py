"""Load shared coach step-up config (shared/coach-step-up.json + STEP_UP_* env)."""

from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from typing import Final

_REPO_ROOT = Path(__file__).resolve().parents[4]
_CONFIG_PATH = _REPO_ROOT / "shared" / "coach-step-up.json"

_DEFAULT_TOOLS: Final[tuple[str, ...]] = (
    "adapt_plan",
    "set_life_mode",
    "update_fitness_goal",
    "generate_weekly_workout",
    "generate_weekly_diet",
    "replace_exercise_today",
)

_DEFAULT_IDLE_MS = 300_000
_DEFAULT_MAX_FAILS = 5
_DEFAULT_LOCKOUT_MS = 900_000


def _env_int(name: str) -> int | None:
    raw = os.environ.get(name, "").strip()
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        return None


@lru_cache(maxsize=1)
def load_step_up_config() -> dict:
    try:
        base = json.loads(_CONFIG_PATH.read_text(encoding="utf-8"))
    except OSError:
        base = {
            "stepUpTools": list(_DEFAULT_TOOLS),
            "idleMs": _DEFAULT_IDLE_MS,
            "maxFailedAttempts": _DEFAULT_MAX_FAILS,
            "lockoutMs": _DEFAULT_LOCKOUT_MS,
        }

    idle_ms = _env_int("STEP_UP_IDLE_MS")
    if idle_ms is not None:
        base["idleMs"] = idle_ms
    max_fails = _env_int("STEP_UP_MAX_FAILS")
    if max_fails is not None:
        base["maxFailedAttempts"] = max_fails
    lockout_ms = _env_int("STEP_UP_LOCKOUT_MS")
    if lockout_ms is not None:
        base["lockoutMs"] = lockout_ms
    return base


def step_up_tool_names() -> frozenset[str]:
    cfg = load_step_up_config()
    tools = cfg.get("stepUpTools") or list(_DEFAULT_TOOLS)
    return frozenset(str(t) for t in tools)


def step_up_idle_ms() -> int:
    return int(load_step_up_config().get("idleMs") or _DEFAULT_IDLE_MS)


def step_up_max_fails() -> int:
    return int(load_step_up_config().get("maxFailedAttempts") or _DEFAULT_MAX_FAILS)


def step_up_lockout_ms() -> int:
    return int(load_step_up_config().get("lockoutMs") or _DEFAULT_LOCKOUT_MS)
