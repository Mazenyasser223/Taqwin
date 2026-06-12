from app.agent.tools.step_up_config import load_step_up_config, step_up_tool_names


def test_step_up_config_loads_shared_tools() -> None:
    cfg = load_step_up_config()
    tools = step_up_tool_names()
    assert "adapt_plan" in tools
    assert "set_life_mode" in tools
    assert "update_fitness_goal" in tools
    assert "log_food" not in tools
    assert int(cfg.get("idleMs") or 0) >= 60_000


def test_step_up_env_overrides(monkeypatch) -> None:
    from app.agent.tools import step_up_config

    step_up_config.load_step_up_config.cache_clear()
    monkeypatch.setenv("STEP_UP_IDLE_MS", "120000")
    monkeypatch.setenv("STEP_UP_MAX_FAILS", "3")
    monkeypatch.setenv("STEP_UP_LOCKOUT_MS", "600000")
    cfg = step_up_config.load_step_up_config()
    assert cfg["idleMs"] == 120_000
    assert cfg["maxFailedAttempts"] == 3
    assert cfg["lockoutMs"] == 600_000
    assert step_up_config.step_up_idle_ms() == 120_000
    step_up_config.load_step_up_config.cache_clear()
