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


class TierConstraintsResponse(BaseModel):
    """Restricciones operacionales por tier — el frontend las usa para deshabilitar
    opciones específicas con tooltip explicativo en lugar de error generico."""

    benchmark_parallel: bool  # True = paralelismo, False = secuencial (EC2)
    sarima_cv_allowed: bool  # False en EC2 por riesgo de OOM
    lightgbm_allowed: bool  # False en EC2, True en local
    max_benchmark_workers: int  # 1 en EC2, 4 en local


class CapabilitiesResponse(BaseModel):
    tier: str  # "local" | "ec2" | "cloud"
    tier_label: str  # etiqueta legible para el header del frontend
    hardware_label: str  # specs de hardware — configurado via SERVER_HARDWARE_LABEL
    backend_online: bool  # siempre True cuando el endpoint responde
    models_available: list[str]
    features: FeaturesResponse
    constraints: TierConstraintsResponse  # restricciones operacionales por tier
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
        "local": "PC Local",
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

    # hardware_label: env var o default segun tier
    default_hw = {
        "ec2": "t3.micro · 1 GB RAM · 1 vCPU",
        "local": "",  # el usuario configura SERVER_HARDWARE_LABEL en .env
        "cloud": "",
    }
    hardware_label = settings.server_hardware_label or default_hw.get(tier, "")

    return CapabilitiesResponse(
        tier=tier,
        tier_label=tier_label,
        hardware_label=hardware_label,
        backend_online=True,
        models_available=models,
        features=FeaturesResponse(
            lightgbm=has_lgbm and tier != "ec2",
            optuna_hpo=has_lgbm and tier != "ec2",
            nixtla_batch=has_nixtla,
            demo_dataset=True,
            db_connect=True,
        ),
        constraints=TierConstraintsResponse(
            benchmark_parallel=(tier != "ec2"),
            sarima_cv_allowed=(tier != "ec2"),
            lightgbm_allowed=(tier != "ec2"),
            max_benchmark_workers=1 if tier == "ec2" else 4,
        ),
        message=message,
    )
