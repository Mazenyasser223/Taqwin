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
    service_version: str = "0.1.0-a2"

    # Used in later blocks (A3+); optional for A2 skeleton
    ai_internal_key: str | None = None
    node_internal_api_url: str = "http://localhost:4000"
    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-4-5"
    mongodb_uri: str | None = None
    mongodb_db: str = "taqwin_ai"
    redis_url: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()
