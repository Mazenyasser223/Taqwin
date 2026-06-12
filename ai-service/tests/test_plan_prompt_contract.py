"""Tests for shared plan-prompt-contract.json loading."""

from app.prompts import plan_prompts


def test_contract_file_exists() -> None:
    assert plan_prompts.contract_path().is_file()


def test_hard_rules_loaded_from_contract() -> None:
    contract = plan_prompts._load_contract()
    assert plan_prompts.hard_rules() == contract["hardRules"]
    assert len(plan_prompts.HARD_RULES) >= 5


def test_schema_hint_loaded_from_contract() -> None:
    contract = plan_prompts._load_contract()
    assert plan_prompts.schema_hint() == contract["schemaHint"]
    assert "dailyTargets" in plan_prompts.SCHEMA_HINT


def test_build_plan_system_prompt_uses_contract() -> None:
    prompt = plan_prompts.build_plan_system_prompt(locale="ar")
    contract = plan_prompts._load_contract()
    assert contract["systemPromptIntro"] in prompt
    assert "HARD RULES:" in prompt
    assert contract["hardRules"][0] in prompt
    assert "Arabic" in prompt
