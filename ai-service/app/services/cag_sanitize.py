"""
CAG prompt-injection sanitization — strip/limit user-controlled strings before LLM prompts.
Rules: shared/cag-sanitize.json (keep in sync with backend-node/src/lib/cag/sanitizeCag.js).
"""

from __future__ import annotations

import json
import re
import unicodedata
from functools import lru_cache
from pathlib import Path
from typing import Any

_REPO_ROOT = Path(__file__).resolve().parents[3]
_CONFIG_PATH = _REPO_ROOT / "shared" / "cag-sanitize.json"


@lru_cache(maxsize=1)
def _load_config() -> dict[str, Any]:
    with _CONFIG_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def reset_config_cache() -> None:
    _load_config.cache_clear()


def get_field_limit(field: str = "default") -> int:
    cfg = _load_config()
    limits = cfg.get("fieldLimits") or {}
    return int(limits.get(field) or limits.get("default") or 200)


def _instruction_patterns() -> list[re.Pattern[str]]:
    cfg = _load_config()
    return [re.compile(p, re.IGNORECASE) for p in (cfg.get("instructionPatterns") or [])]


def _is_single_line(field: str) -> bool:
    cfg = _load_config()
    return field in (cfg.get("singleLineFields") or [])


def new_sanitize_stats() -> dict[str, Any]:
    return {"hits": 0, "truncated": 0, "fields": {}}


def record_sanitize_delta(
    stats: dict[str, Any] | None,
    field: str,
    before: Any,
    after: Any,
) -> None:
    if not stats:
        return
    b = str(before or "")
    a = str(after or "")
    if b == a:
        return
    stats["hits"] = int(stats.get("hits") or 0) + 1
    fields = stats.setdefault("fields", {})
    fields[field] = int(fields.get(field) or 0) + 1
    if a.endswith("…") and len(b) > len(a):
        stats["truncated"] = int(stats.get("truncated") or 0) + 1


def _normalize_nfkc(value: str) -> str:
    return unicodedata.normalize("NFKC", value)


def sanitize_cag_string(
    value: Any,
    field: str = "default",
    stats: dict[str, Any] | None = None,
) -> Any:
    if value is None:
        return value
    if isinstance(value, (int, float, bool)):
        return value
    if not isinstance(value, str):
        return value

    raw = _normalize_nfkc(value)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", raw)
    text = re.sub(r"```+", "", text)

    for pattern in _instruction_patterns():
        text = pattern.sub("[removed]", text)

    if _is_single_line(field):
        text = re.sub(r"\s+", " ", text).strip()
    else:
        text = text.replace("\r\n", "\n")
        text = re.sub(r"\n{3,}", "\n\n", text).strip()

    limit = get_field_limit(field)
    if len(text) > limit:
        text = text[: max(0, limit - 1)] + "…"

    record_sanitize_delta(stats, field, raw, text)
    return text


def sanitize_pending_preview(value: Any, stats: dict[str, Any] | None = None) -> str:
    return str(sanitize_cag_string(value, "pendingPreview", stats) or "").strip()


def sanitize_string_list(
    items: Any,
    field: str = "injuryLabel",
    stats: dict[str, Any] | None = None,
) -> list[str]:
    if not isinstance(items, list):
        return []
    out: list[str] = []
    for item in items:
        if item is None or item == "":
            continue
        s = str(sanitize_cag_string(str(item), field, stats)).strip()
        if s:
            out.append(s)
    return out


def sanitize_prompt_text(
    value: Any,
    field: str = "userMessage",
    stats: dict[str, Any] | None = None,
) -> Any:
    """Sanitize free-text prompt inputs outside the CAG bundle."""
    return sanitize_cag_string(value, field, stats)


def rag_title_field(level: str) -> str:
    if level == "L2_EXERCISE":
        return "exerciseName"
    if level == "L3_NUTRITION":
        return "foodName"
    return "default"


def sanitize_rag_title(title: str, *, level: str = "") -> str:
    field = rag_title_field(level)
    return str(sanitize_cag_string(title, field) or "").strip()


def sanitize_rag_content(content: str) -> str:
    return str(sanitize_cag_string(content, "ragContent") or "").strip()


def sanitize_chat_messages(
    messages: list[dict[str, Any]] | None,
    stats: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    if not messages:
        return []
    out: list[dict[str, Any]] = []
    for msg in messages:
        if not isinstance(msg, dict):
            continue
        role = str(msg.get("role") or "")
        content = msg.get("content")
        if role == "user" and isinstance(content, str):
            out.append({**msg, "content": str(sanitize_cag_string(content, "userMessage", stats))})
        else:
            out.append(dict(msg))
    return out


def _onboarding_field(key: str) -> str:
    cfg = _load_config()
    free_text = set(cfg.get("onboardingFreeTextKeys") or [])
    if key not in free_text:
        return "onboardingText"
    if key in ("medicalHistory", "medications"):
        return "medicalNotes"
    if key == "displayName":
        return "displayName"
    return "onboardingText"


def _onboarding_array_field(key: str) -> str:
    cfg = _load_config()
    return str((cfg.get("onboardingArrayFields") or {}).get(key) or "default")


def _sanitize_measurements(measurements: Any, stats: dict[str, Any] | None = None) -> Any:
    if not isinstance(measurements, dict):
        return measurements
    out: dict[str, Any] = {}
    for key, val in measurements.items():
        if isinstance(val, str):
            out[key] = sanitize_cag_string(val, "default", stats)
        elif isinstance(val, (int, float)):
            out[key] = val
        else:
            out[key] = val
    return out


def _sanitize_week_plan_summary(week_summary: Any, stats: dict[str, Any] | None = None) -> Any:
    if not isinstance(week_summary, dict):
        return week_summary
    out = dict(week_summary)
    if out.get("coachNotes") is not None:
        out["coachNotes"] = sanitize_cag_string(str(out["coachNotes"]), "coachNotes", stats)
    days = out.get("workoutDays")
    if isinstance(days, list):
        sanitized_days: list[Any] = []
        for d in days:
            if not isinstance(d, dict):
                sanitized_days.append(d)
                continue
            entry = dict(d)
            if entry.get("type") is not None:
                entry["type"] = sanitize_cag_string(str(entry["type"]), "exerciseName", stats)
            sanitized_days.append(entry)
        out["workoutDays"] = sanitized_days
    return out


def _sanitize_workout_day_summary(workout_day: Any, stats: dict[str, Any] | None = None) -> Any:
    if not isinstance(workout_day, dict):
        return workout_day
    out = dict(workout_day)
    if out.get("type") is not None:
        out["type"] = sanitize_cag_string(str(out["type"]), "exerciseName", stats)
    exercises = out.get("exercises")
    if isinstance(exercises, list):
        out["exercises"] = [
            {**e, "name": sanitize_cag_string(str(e.get("name") or ""), "exerciseName", stats)}
            if isinstance(e, dict)
            else e
            for e in exercises
        ]
    return out


def _sanitize_onboarding_section(section: Any, stats: dict[str, Any] | None = None) -> Any:
    if not isinstance(section, dict):
        return section
    out: dict[str, Any] = {}
    for key, val in section.items():
        if val is None or val == "":
            continue
        if isinstance(val, list):
            out[key] = sanitize_string_list(val, _onboarding_array_field(key), stats)
        elif isinstance(val, str):
            out[key] = sanitize_cag_string(val, _onboarding_field(key), stats)
        else:
            out[key] = val
    return out


def _sanitize_profile(profile: Any, stats: dict[str, Any] | None = None) -> Any:
    if not isinstance(profile, dict):
        return profile
    out = dict(profile)
    if profile.get("displayName") is not None:
        out["displayName"] = sanitize_cag_string(str(profile["displayName"]), "displayName", stats)
    if profile.get("medicalNotes") is not None:
        out["medicalNotes"] = sanitize_cag_string(str(profile["medicalNotes"]), "medicalNotes", stats)
    return out


def sanitize_cag_bundle(
    bundle: dict[str, Any] | None,
    stats: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Deep-sanitize a CAG bundle before prompt serialization."""
    if not bundle or not isinstance(bundle, dict):
        return bundle

    out: dict[str, Any] = dict(bundle)

    if out.get("profile"):
        out["profile"] = _sanitize_profile(out["profile"], stats)

    if isinstance(out.get("onboardingSummary"), dict):
        out["onboardingSummary"] = _sanitize_onboarding_section(out["onboardingSummary"], stats)

    bm = out.get("bodyMetricsLatest")
    if isinstance(bm, dict):
        out["bodyMetricsLatest"] = {
            **bm,
            "measurements": _sanitize_measurements(bm.get("measurements"), stats),
        }

    if isinstance(out.get("workoutWeek"), dict):
        out["workoutWeek"] = _sanitize_week_plan_summary(out["workoutWeek"], stats)

    obf = out.get("onboardingByFlow")
    if isinstance(obf, dict):
        out["onboardingByFlow"] = {
            k: _sanitize_onboarding_section(v, stats) for k, v in obf.items()
        }

    nt = out.get("nutritionToday")
    if isinstance(nt, dict):
        nt_copy = dict(nt)
        foods = nt_copy.get("foods")
        if isinstance(foods, list):
            nt_copy["foods"] = [
                {**f, "name": sanitize_cag_string(str(f.get("name") or "Unknown"), "foodName", stats)}
                if isinstance(f, dict)
                else f
                for f in foods
            ]
        out["nutritionToday"] = nt_copy

    nw = out.get("nutritionWeek")
    if isinstance(nw, dict):
        out["nutritionWeek"] = {
            **nw,
            "recentFoodNames": sanitize_string_list(nw.get("recentFoodNames"), "foodName", stats),
        }

    wt = out.get("workoutToday")
    if isinstance(wt, dict):
        out["workoutToday"] = _sanitize_workout_day_summary(wt, stats)

    tp = out.get("todayPlan")
    if isinstance(tp, dict):
        tp_copy = dict(tp)
        diet = tp_copy.get("diet")
        if isinstance(diet, dict) and isinstance(diet.get("meals"), list):
            tp_copy["diet"] = {
                **diet,
                "meals": [
                    {**m, "name": sanitize_cag_string(str(m.get("name") or ""), "foodName", stats)}
                    if isinstance(m, dict)
                    else m
                    for m in diet["meals"]
                ],
            }
        workout = tp_copy.get("workout")
        if isinstance(workout, dict):
            tp_copy["workout"] = _sanitize_workout_day_summary(workout, stats)
        dap = tp_copy.get("dailyAthletePlan")
        if isinstance(dap, dict) and dap.get("explainabilityText") is not None:
            tp_copy["dailyAthletePlan"] = {
                **dap,
                "explainabilityText": sanitize_cag_string(
                    str(dap["explainabilityText"]), "explainabilityText", stats
                ),
            }
        out["todayPlan"] = tp_copy

    if isinstance(out.get("weekPlanSummary"), dict):
        out["weekPlanSummary"] = _sanitize_week_plan_summary(out["weekPlanSummary"], stats)

    rl = out.get("readinessLatest")
    if isinstance(rl, dict) and rl.get("notes") is not None:
        out["readinessLatest"] = {
            **rl,
            "notes": sanitize_cag_string(str(rl["notes"]), "readinessNotes", stats),
        }

    ps = out.get("progressSnapshot")
    if isinstance(ps, dict) and ps.get("aiSummary") is not None:
        out["progressSnapshot"] = {
            **ps,
            "aiSummary": sanitize_cag_string(str(ps["aiSummary"]), "aiSummary", stats),
        }

    memories = out.get("aiMemories")
    if isinstance(memories, list):
        out["aiMemories"] = [
            {
                **m,
                "summary": sanitize_cag_string(str(m["summary"]), "memorySummary", stats),
            }
            if isinstance(m, dict) and m.get("summary") is not None
            else m
            for m in memories
        ]

    c = out.get("constraints")
    if isinstance(c, dict):
        constraints_out = dict(c)
        constraints_out["injuries"] = sanitize_string_list(c.get("injuries"), "injuryLabel", stats)
        constraints_out["foodAllergies"] = sanitize_string_list(
            c.get("foodAllergies"), "injuryLabel", stats
        )
        constraints_out["excludedExercises"] = sanitize_string_list(
            c.get("excludedExercises"), "exerciseName", stats
        )
        constraints_out["excludedFoods"] = sanitize_string_list(c.get("excludedFoods"), "foodName", stats)
        if c.get("religiousDiet") is not None:
            constraints_out["religiousDiet"] = sanitize_cag_string(
                str(c["religiousDiet"]), "default", stats
            )
        if c.get("lifeMode") is not None:
            constraints_out["lifeMode"] = sanitize_cag_string(str(c["lifeMode"]), "default", stats)
        out["constraints"] = constraints_out

    sig = out.get("behavioralSignals")
    if isinstance(sig, dict):
        out["behavioralSignals"] = {
            **sig,
            "skippedMuscleGroups": sanitize_string_list(sig.get("skippedMuscleGroups"), "default", stats),
            "preferredExercises": sanitize_string_list(sig.get("preferredExercises"), "exerciseName", stats),
            "mealSkipPatterns": sanitize_string_list(sig.get("mealSkipPatterns"), "default", stats),
        }

    g = out.get("gymTrainerOrdersSummary")
    if isinstance(g, dict):
        out["gymTrainerOrdersSummary"] = {
            **g,
            "activeGymMemberships": [
                {**m, "gymName": sanitize_cag_string(str(m.get("gymName") or ""), "gymName", stats)}
                if isinstance(m, dict)
                else m
                for m in (g.get("activeGymMemberships") or [])
            ],
            "recentOrders": [
                {
                    **o,
                    "items": [
                        {
                            **i,
                            "name": sanitize_cag_string(
                                str(i.get("name") or "Product"), "productName", stats
                            ),
                        }
                        if isinstance(i, dict)
                        else i
                        for i in (o.get("items") or [])
                    ],
                }
                if isinstance(o, dict)
                else o
                for o in (g.get("recentOrders") or [])
            ],
        }

    return out
