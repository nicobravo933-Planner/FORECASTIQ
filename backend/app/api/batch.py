"""
batch.py — API endpoints Fase 9: forecasting vectorizado multi-serie.

POST /api/batch/forecast
    Recibe un panel de registros (N series × T períodos) y devuelve
    las predicciones para todas las series usando StatsForecast (Nixtla).

Diseño:
  - El endpoint es síncrono (no usa Celery) porque StatsForecast ya paraleliza
    internamente con n_jobs=-1. Para >10k series se puede mover a Celery Beat.
  - Rate limit: reutiliza check_forecast_rate_limit (10 jobs/hora/IP+user).
  - El body acepta JSON directamente (no multipart) para integración programática.
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.dependencies import OptionalUser, get_optional_user
from app.services.nixtla_forecaster import run_batch_forecast
from app.services.redis_cache import check_forecast_rate_limit

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/batch", tags=["batch"])


# ── Request / Response schemas ───────────────────────────────────────────────


class BatchForecastRequest(BaseModel):
    """Body del endpoint de batch forecast."""

    records: list[dict[str, Any]] = Field(
        ...,
        min_length=1,
        description="Panel de datos: lista de dicts con columnas de fecha, valor e ID de serie.",
    )
    date_col: str = Field(default="ds", description="Nombre de la columna de fecha.")
    target_col: str = Field(
        default="y", description="Nombre de la columna del valor a pronosticar."
    )
    id_col: str = Field(default="unique_id", description="Nombre de la columna de ID de serie.")
    cluster_abc_col: str | None = Field(
        default=None,
        description="Columna A/B/C para selección de modelo por segmento (opcional).",
    )
    cluster_xyz_col: str | None = Field(
        default=None,
        description="Columna X/Y/Z para selección de modelo por segmento (opcional).",
    )
    freq: str = Field(
        default="W",
        pattern="^(D|W|ME|M|QE|Q|YE|Y)$",
        description="Frecuencia: D=diario, W=semanal, ME=mensual, QE=trimestral.",
    )
    horizon: int = Field(default=12, ge=1, le=365, description="Períodos a pronosticar.")


class BatchPredictionPoint(BaseModel):
    unique_id: str
    ds: str
    predicted: float


class BatchForecastResponse(BaseModel):
    n_series: int
    horizon: int
    freq: str
    model_used: str
    duration_s: float
    predictions: list[BatchPredictionPoint]


# ── Endpoint ─────────────────────────────────────────────────────────────────


@router.post(
    "/forecast",
    response_model=BatchForecastResponse,
    summary="Batch multi-series forecast (Nixtla StatsForecast)",
    description=(
        "Acepta un panel de N series temporales y devuelve predicciones vectorizadas "
        "usando StatsForecast con selección automática de modelo. "
        "Soporta segmentación ABC-XYZ para aplicar modelos distintos por segmento."
    ),
)
async def batch_forecast(
    request: Request,
    body: BatchForecastRequest,
    current_user: Annotated[OptionalUser, Depends(get_optional_user)],
) -> BatchForecastResponse:
    # Rate limit — mismo bucket que el forecast individual
    client_ip = request.client.host if request.client else "unknown"
    user_id = current_user.user_id if current_user else None

    # check_forecast_rate_limit recibe un único identifier compuesto IP+user
    identifier = f"{client_ip}:{user_id or 'anon'}"
    rl = check_forecast_rate_limit(identifier)
    if not rl.allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Límite de forecasts alcanzado. Intentá de nuevo en {rl.reset_in} segundos.",
            headers={"Retry-After": str(rl.reset_in)},
        )

    # Validación rápida: max 50k registros por request para proteger la RAM del EC2
    max_records = 50_000
    if len(body.records) > max_records:
        raise HTTPException(
            status_code=400,
            detail=f"Máximo {max_records:,} registros por request. Recibidos: {len(body.records):,}.",
        )

    log.info(
        "batch_forecast_request",
        n_records=len(body.records),
        freq=body.freq,
        horizon=body.horizon,
        user_id=user_id,
    )

    try:
        result = run_batch_forecast(
            records=body.records,
            date_col=body.date_col,
            target_col=body.target_col,
            id_col=body.id_col,
            cluster_abc_col=body.cluster_abc_col,
            cluster_xyz_col=body.cluster_xyz_col,
            freq=body.freq,
            horizon=body.horizon,
        )
    except Exception as exc:
        log.error("batch_forecast_failed", error=str(exc))
        raise HTTPException(
            status_code=500,
            detail="Error interno al ejecutar el forecast vectorizado.",
        ) from exc

    return BatchForecastResponse(
        n_series=result["n_series"],
        horizon=result["horizon"],
        freq=result["freq"],
        model_used=result["model_used"],
        duration_s=result["duration_s"],
        predictions=[BatchPredictionPoint(**p) for p in result["predictions"]],
    )
