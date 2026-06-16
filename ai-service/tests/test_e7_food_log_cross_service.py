"""
E7 cross-service — ai-service → Node internal API → Postgres FoodLog.

Requires live Node API (E7_NODE_INTERNAL_URL) and DATABASE_URL for row verification.
CI: npm run verify:e7-cross-service (starts Node + runs this file).
"""

from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import httpx
import pytest

pytestmark = pytest.mark.integration

BACKEND_ROOT = Path(__file__).resolve().parents[2] / "backend-node"
TEST_FOOD_NAME = "CI E7 Chicken Breast"
TEST_GRAMS = 212


def _node_internal_url() -> str:
    return (os.environ.get("E7_NODE_INTERNAL_URL") or os.environ.get("NODE_INTERNAL_API_URL") or "").rstrip("/")


def _internal_key() -> str:
    return os.environ.get("AI_INTERNAL_KEY") or "test-internal-key-min-16-chars"


def _skip_unless_live_node():
    if not _node_internal_url():
        pytest.skip("E7_NODE_INTERNAL_URL not set — start Node via verify:e7-cross-service")


def _food_log_count(user_id: str, food_item_id: str, grams: float) -> int:
    db_url = os.environ.get("DATABASE_URL", "").strip()
    if not db_url:
        pytest.skip("DATABASE_URL not set for FoodLog row verification")

    script = f"""
const {{ prisma }} = require('./src/db');
(async () => {{
  const n = await prisma.foodLog.count({{
    where: {{ userId: '{user_id}', foodItemId: '{food_item_id}', grams: {grams} }},
  }});
  console.log(n);
  await prisma.$disconnect();
}})().catch((e) => {{ console.error(e); process.exit(1); }});
"""
    r = subprocess.run(
        [os.environ.get("NODE_BIN", "node"), "-e", script],
        cwd=str(BACKEND_ROOT),
        capture_output=True,
        text=True,
        env={**os.environ, "NODE_ENV": "test", "LOG_LEVEL": "silent"},
        timeout=30,
        check=False,
    )
    if r.returncode != 0:
        raise RuntimeError(r.stderr or r.stdout or "FoodLog count failed")
    return int(r.stdout.strip())


@pytest.fixture(scope="module")
def e7_user_and_food():
    _skip_unless_live_node()
    script = """
const { ensureFixtures } = require('./tests/helpers/e7Fixtures.cjs');
const { prisma } = require('./src/db');
(async () => {
  const { user, food } = await ensureFixtures(prisma);
  console.log(JSON.stringify({ userId: user.id, foodItemId: food.id, foodName: food.name }));
  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
"""
    r = subprocess.run(
        [os.environ.get("NODE_BIN", "node"), "-e", script],
        cwd=str(BACKEND_ROOT),
        capture_output=True,
        text=True,
        env={**os.environ, "NODE_ENV": "test", "JWT_SECRET": os.environ.get("JWT_SECRET", "test-secret-for-ci")},
        timeout=45,
        check=False,
    )
    if r.returncode != 0:
        pytest.fail(r.stderr or r.stdout)
    import json

    return json.loads(r.stdout.strip())


def test_node_internal_log_food_writes_food_log(e7_user_and_food) -> None:
    """FastAPI-side client path: execute_tool → Node → Postgres."""
    os.environ["NODE_INTERNAL_API_URL"] = _node_internal_url()
    os.environ["AI_INTERNAL_KEY"] = _internal_key()
    from app.config import get_settings

    get_settings.cache_clear()
    from app.clients.node_internal import execute_tool

    user_id = e7_user_and_food["userId"]
    food_id = e7_user_and_food["foodItemId"]
    before = _food_log_count(user_id, food_id, TEST_GRAMS)

    result = execute_tool(
        user_id=user_id,
        tool_name="log_food",
        input={
            "foodName": TEST_FOOD_NAME,
            "grams": TEST_GRAMS,
            "rawText": f"log {TEST_GRAMS}g {TEST_FOOD_NAME}",
        },
        thread_id="pytest-e7-internal",
    )

    assert result.get("success") is True
    log = (result.get("output") or {}).get("log") or {}
    assert log.get("grams") == TEST_GRAMS
    assert log.get("id")

    after = _food_log_count(user_id, food_id, TEST_GRAMS)
    assert after == before + 1


def test_live_fastapi_chat_proposes_log_food(e7_user_and_food) -> None:
    """Real ai-service /chat (no LLM) proposes log_food confirmation."""
    ai_url = (os.environ.get("E7_AI_SERVICE_URL") or os.environ.get("AI_SERVICE_URL") or "").rstrip("/")
    if not ai_url:
        pytest.skip("E7_AI_SERVICE_URL not set")

    user_id = e7_user_and_food["userId"]
    msg = f"log {TEST_GRAMS}g {TEST_FOOD_NAME}"

    with httpx.Client(timeout=30.0) as client:
        res = client.post(
            f"{ai_url}/chat",
            json={
                "userId": user_id,
                "messages": [{"role": "user", "content": msg}],
                "locale": "en",
            },
        )

    assert res.status_code == 200, res.text[:400]
    data = res.json()
    assert data.get("confirmationRequired") is True
    assert data.get("intent") == "execute_action"
    tool_calls = data.get("toolCalls") or []
    assert tool_calls and tool_calls[0].get("name") == "log_food"


# Node chat → confirm → FoodLog with live FastAPI is covered by
# backend-node `verify:e7-confirm-food --db --live-fastapi` (scenario 10).
