"""
Bootstrap RAGAS imports and environment for Taqwin eval scripts.

Must be imported before any ragas import (Vertex AI optional dep stub).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from types import ModuleType


def _stub_vertexai() -> None:
    key = "langchain_community.chat_models.vertexai"
    if key not in sys.modules:
        stub = ModuleType(key)
        stub.ChatVertexAI = type("ChatVertexAI", (), {})  # type: ignore[attr-defined]
        sys.modules[key] = stub


def load_eval_env() -> Path:
    """Load ai-service then backend-node .env (OpenAI embed key lives in Node)."""
    ai_root = Path(__file__).resolve().parents[2]
    backend_env = ai_root.parent / "backend-node" / ".env"

    try:
        from dotenv import load_dotenv

        load_dotenv(ai_root / ".env")
        if backend_env.is_file():
            load_dotenv(backend_env, override=False)
    except ImportError:
        pass

    return ai_root


def ensure_eval_keys() -> tuple[bool, list[str]]:
    missing: list[str] = []
    if not os.getenv("AI_INTERNAL_KEY"):
        missing.append("AI_INTERNAL_KEY")
    if not os.getenv("OPENAI_API_KEY"):
        missing.append("OPENAI_API_KEY (backend-node/.env for embeddings + RAGAS judge)")
    return len(missing) == 0, missing
