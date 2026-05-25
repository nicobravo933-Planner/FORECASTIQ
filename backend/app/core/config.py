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
    # Tier determina qué features ML están habilitados:
    #   "cloud"  → EC2 t3.micro: MA, Holt-Winters, SARIMA (modelos livianos)
    #   "local"  → PC del developer: + LightGBM, Optuna HPO, Nixtla batch
    server_tier: str = "cloud"  # cloud | local
    # Etiqueta de hardware para el badge del header (configurable por máquina)
    # EC2:   "t3.micro · 1 GB RAM · 1 vCPU"
    # Local: "16 GB · Ryzen 5 3600 · RTX 3060"
    server_hardware_label: str = ""

    # CORS — lista separada por comas en .env
    cors_origins: list[str] = ["http://localhost:3000"]

    # ── Logging ──────────────────────────────────────────────────
    log_level: str = "INFO"  # DEBUG | INFO | WARNING | ERROR
    log_format: str = "pretty"  # pretty (dev) | json (prod)

    # ── OpenTelemetry ─────────────────────────────────────────────
    otel_enabled: bool = False  # False en dev, True en prod (Railway)
    otel_service_name: str = "forecastiq"
    otel_otlp_endpoint: str = ""  # https://otlp-gateway-...grafana.net/otlp
    otel_otlp_headers: str = ""  # Authorization=Basic <base64token>

    # ── Alloy (Loki push) ───────────────────────────────────────
    alloy_loki_url: str = ""  # http://alloy:3100/loki/api/v1/push (Railway internal)

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
    # Concurrencia del worker — EC2 t3.micro: 1 (1 vCPU, 1 GB RAM)
    # Local PC: 2-4 según RAM disponible
    celeryd_concurrency: int = 1

    # ── Storage ──────────────────────────────────────────────────
    # "supabase" → uploads van a Supabase Storage (modo cloud/ec2)
    # "local"    → uploads van a disco local, nunca salen de la máquina
    storage_backend: str = "supabase"
    local_storage_path: str = "./data/user_uploads"
    # Horas hasta que se borran los datasets de usuarios en modo cloud (0 = no borrar)
    dataset_ttl_hours: int = 24
    # Tamaño máximo de archivo en MB — EC2: 5, Local: 50
    max_file_size_mb: int = 5

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

    # ── MLflow (Fase 8) ────────────────────────────────────────
    mlflow_tracking_uri: str = "./mlruns"  # local: ./mlruns | prod: dagshub URL
    mlflow_tracking_username: str = ""  # dagshub username
    mlflow_tracking_password: str = ""  # dagshub token
    mlflow_experiment_name: str = "forecastiq"

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
