"""
Shared configuration via pydantic-settings.
Both universe/ and agent/ import from here.
"""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Postgres ──────────────────────────────────────────────────────────
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "knowledge_universe"
    postgres_user: str = "ku_user"
    postgres_password: str = "ku_password"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+asyncpg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def database_url_sync(self) -> str:
        """Sync URL for Alembic migrations."""
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    # ── Redis ─────────────────────────────────────────────────────────────
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: str | None = None

    @property
    def redis_url(self) -> str:
        auth = f":{self.redis_password}@" if self.redis_password else ""
        return f"redis://{auth}{self.redis_host}:{self.redis_port}/{self.redis_db}"

    # ── LLM ──────────────────────────────────────────────────────────────
    openai_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"
    embedding_dimensions: int = 1536

    # ── Worker concurrency limits ─────────────────────────────────────────
    worker_max_jobs: int = 10          # Arq global max concurrent jobs
    skill_concurrency_wikipedia: int = 10
    skill_concurrency_arxiv: int = 5
    skill_concurrency_web: int = 20
    skill_concurrency_pdf: int = 4
    worker_concurrency_embedding: int = 8
    worker_concurrency_llm: int = 4
    expansion_max_fanout: int = 100    # max sub-tasks per expansion event

    # ── Queue / backpressure ──────────────────────────────────────────────
    arq_queue_max_length: int = 1000   # reject new tasks beyond this

    # ── Redis Streams ─────────────────────────────────────────────────────
    stream_name: str = "universe:events"
    stream_consumer_group: str = "universe-consumers"

    # ── Cache TTLs (seconds) ──────────────────────────────────────────────
    cache_ttl_node: int = 600          # 10 min
    cache_ttl_search: int = 120        # 2 min
    cache_ttl_neighbors: int = 300     # 5 min

    # ── Distributed lock TTLs (seconds) ───────────────────────────────────
    lock_ttl_source: int = 300         # 5 min
    lock_ttl_node_merge: int = 30
    lock_ttl_expansion: int = 120

    # ── Retry / DLQ ──────────────────────────────────────────────────────
    retry_max_attempts: int = 3
    retry_delays: list[int] = [5, 30, 300]  # seconds

    # ── App meta ─────────────────────────────────────────────────────────
    environment: str = "development"
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    return Settings()
