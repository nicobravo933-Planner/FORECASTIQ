"""
Configuración central — todas las variables de entorno en un solo lugar.
Usa pydantic-settings: lee desde .env automáticamente.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── App ──────────────────────────────────────────────────────
    environment: str = "development"
    debug: bool = False
    app_version: str = "0.1.0"

    # CORS — lista separada por comas en .env
    cors_origins: list[str] = ["http://localhost:3000"]

    # ── Supabase ─────────────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_key: str = ""
    database_url: str = ""

    # ── Redis (Upstash) ──────────────────────────────────────────
    upstash_redis_url: str = ""
    upstash_redis_token: str = ""

    # ── Celery ───────────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    celery_task_always_eager: bool = False  # True en dev → sin worker separado

    # ── LLM ──────────────────────────────────────────────────────
    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-v4-flash:free"
    llm_provider: str = "openrouter"
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    # ── Auth ─────────────────────────────────────────────────────
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    better_auth_url: str = "http://localhost:3000"  # URL del frontend Next.js
    google_client_id: str = ""
    google_client_secret: str = ""
    github_client_id: str = ""
    github_client_secret: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
