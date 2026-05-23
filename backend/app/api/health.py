"""
GET /health — endpoint de salud para Railway y Docker healthcheck.
GET /api/capabilities — reporta el tier del servidor y features disponibles.
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str


class CapabilitiesResponse(BaseModel):
    tier: str                    # "cloud" | "local"
    models_available: list[str]  # nombres de los modelos habilitados
    features: dict[str, bool]    # feature flags individuales
    message: str                 # descripción humana del tier


@router.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    return HealthResponse(
        status="ok",
        version=settings.app_version,
        environment=settings.environment,
    )


@router.get("/api/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities() -> CapabilitiesResponse:
    """
    Retorna el tier del servidor y qué features ML están disponibles.
    El frontend usa este endpoint para mostrar/ocultar opciones avanzadas.

    Tier "cloud" (EC2 t3.micro):
      - Modelos livianos: Moving Average, Holt-Winters, SARIMA
      - Sin HPO (Optuna demasiado pesado para 1 GB RAM)
      - Sin batch Nixtla (25k SKUs requieren >2 GB RAM)

    Tier "local" (PC del developer / worker pesado):
      - Todos los modelos incluido LightGBM + Optuna HPO
      - Batch Nixtla vectorizado (25k SKUs)
      - Dataset demo completo con selector de SKU
    """
    is_local = settings.server_tier == "local"

    if is_local:
        models = ["moving_average", "holt_winters", "sarima", "lightgbm"]
        features = {
            "lightgbm": True,
            "optuna_hpo": True,
            "nixtla_batch": True,
            "demo_dataset": True,
            "db_connect": True,
        }
        message = "Modo local — todos los modelos y features habilitados."
    else:
        models = ["moving_average", "holt_winters", "sarima"]
        features = {
            "lightgbm": False,
            "optuna_hpo": False,
            "nixtla_batch": False,
            "demo_dataset": True,   # el demo lee desde Supabase Storage, liviano
            "db_connect": True,     # conexiones DB efímeras funcionan en cloud
        }
        message = "Modo cloud (EC2) — modelos estadísticos disponibles. Montá el worker local para LightGBM y Nixtla."

    return CapabilitiesResponse(
        tier=settings.server_tier,
        models_available=models,
        features=features,
        message=message,
    )
