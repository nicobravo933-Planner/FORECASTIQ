"""
GET /api/capabilities — expone el tier y las features ML disponibles en este backend.

El frontend usa este endpoint para:
  - Mostrar el chip correcto en el header ("Backend local" vs "AWS EC2" vs "Cloud")
  - Bloquear modelos no disponibles en el selector de Forecast
  - Ocultar features de análisis batch/nixtla cuando no están instaladas

server_tier se configura via env var SERVER_TIER:
  "local"  -> PC del developer, todas las features habilitadas
  "ec2"    -> AWS EC2 en produccion, features segun paquetes instalados
  "cloud"  -> Vercel/serverless, solo modelos estadisticos basicos
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings

router = APIRouter(prefix="/api", tags=["capabilities"])


class FeaturesResponse(BaseModel):
    lightgbm: bool
    optuna_hpo: bool
    nixtla_batch: bool
    demo_dataset: bool
    db_connect: bool


class CapabilitiesResponse(BaseModel):
    tier: str  # "local" | "ec2" | "cloud"
    tier_label: str  # etiqueta legible para el header del frontend
    models_available: list[str]
    features: FeaturesResponse
    message: str


def _check_lightgbm() -> bool:
    try:
        import lightgbm  # noqa: F401

        return True
    except ImportError:
        return False


def _check_nixtla() -> bool:
    try:
        from statsforecast import StatsForecast  # noqa: F401

        return True
    except ImportError:
        return False


@router.get("/capabilities", response_model=CapabilitiesResponse)
async def get_capabilities() -> CapabilitiesResponse:
    """
    Detecta en tiempo real que esta disponible en este backend.
    No requiere autenticacion — el frontend lo llama al montar el dashboard.
    """
    tier = settings.server_tier.lower()  # "local" | "ec2" | "cloud"

    has_lgbm = _check_lightgbm()
    has_nixtla = _check_nixtla()

    base_models = ["moving_average", "holt_winters", "sarima"]
    models = base_models + (["lightgbm"] if has_lgbm else [])

    tier_labels = {
        "local": "Backend local",
        "ec2": "AWS EC2",
        "cloud": "Cloud",
    }
    tier_label = tier_labels.get(tier, f"Backend ({tier})")

    messages = {
        "local": "Todas las features habilitadas.",
        "ec2": "Produccion AWS EC2. LightGBM y Nixtla disponibles segun instalacion.",
        "cloud": "Modo cloud — solo modelos estadisticos basicos disponibles.",
    }
    message = messages.get(tier, "Backend activo.")

    return CapabilitiesResponse(
        tier=tier,
        tier_label=tier_label,
        models_available=models,
        features=FeaturesResponse(
            lightgbm=has_lgbm,
            optuna_hpo=has_lgbm,  # HPO requiere LightGBM
            nixtla_batch=has_nixtla,
            demo_dataset=True,  # siempre disponible (DuckDB + httpfs)
            db_connect=True,  # siempre disponible (SQLAlchemy)
        ),
        message=message,
    )
