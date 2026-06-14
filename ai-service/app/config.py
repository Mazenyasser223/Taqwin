from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    log_level: str = "info"
    service_name: str = "taqwin-ai"
    service_version: str = "0.2.0-c1"

    # Block A4/B5 — Node internal API (must match backend-node AI_INTERNAL_KEY)
    ai_internal_key: str | None = None
    node_internal_api_url: str = "http://localhost:4000"
    node_internal_timeout_seconds: float = 30.0

    # Block B6 — RAG retriever tuning
    rag_limit_per_level: int = 6
    rag_max_total_chunks: int = 18
    rag_min_score: float = 0.0
    rag_min_score_l1: float = 0.28
    rag_min_score_l2: float = 0.35
    rag_min_score_l3: float = 0.35
    rag_min_score_l5: float = 0.25
    rag_min_score_l5_light: float = 0.32
    rag_philosophy_limit: int = 5
    rag_l5_light_limit: int = 2
    rag_l5_skip_when_catalog_score: float = 0.42
    rag_platform_l1_only_confidence: float = 0.55
    coach_always_l5: bool = True

    # Tier 2 — hybrid fetch + cross-encoder reranking
    rag_rerank_enabled: bool = True
    rag_rerank_provider: str = "cohere"  # cohere | voyage | local | none
    rag_rerank_fetch_k: int = 25
    rag_rerank_keep_per_level: int = 6
    cohere_api_key: str | None = None
    cohere_rerank_model: str = "rerank-v3.5"
    voyage_api_key: str | None = None
    voyage_rerank_model: str = "rerank-2"
    local_rerank_model: str = "cross-encoder/ms-marco-MiniLM-L-6-v2"

    # Block E (chat) — Claude
    llm_temperature: float = 0.7
    llm_max_tokens: int = 1024
    llm_timeout_seconds: float = 60.0

    # Block C1 — plan generation
    plan_llm_temperature: float = 0.2
    plan_llm_max_tokens: int = 12000
    plan_timeout_seconds: float = 120.0

    # Block B7 — intent router
    intent_llm_fallback: bool = True
    intent_llm_min_confidence: float = 0.55
    intent_llm_timeout_seconds: float = 15.0

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-5"
    mongodb_uri: str | None = None
    mongodb_db: str = "taqwin_ai"
    redis_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
