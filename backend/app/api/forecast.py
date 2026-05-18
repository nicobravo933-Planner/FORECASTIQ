"""
Endpoints de forecast — Phase 2.

  POST /api/forecast/run              → lanza job Celery, retorna job_id
  GET  /api/forecast/{job_id}/status  → estado + progreso del job
  GET  /api/forecast/{job_id}/result  → resultado completo cuando status=done
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.core.config import settings
from app.services.celery_app import run_forecast_task
from app.services.events import get_ar_holidays, list_events
from app.services.supabase import get_forecast_result

router = APIRouter(prefix="/api/forecast", tags=["forecast"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class ForecastRunRequest(BaseModel):
    dataset_id: str
    date_column: str
    target_column: str
    freq: str = "M"
    horizon: int = Field(default=12, ge=1, le=60)
    model_override: str | None = None


class ForecastRunResponse(BaseModel):
    job_id: str
    status: str


class ForecastStatusResponse(BaseModel):
    job_id: str
    status: str
    progress_pct: int = 0
    step: str = ""


class PredictionPoint(BaseModel):
    date: str
    predicted: float
    lower: float
    upper: float


class HistoricalPoint(BaseModel):
    date: str
    value: float


class ForecastMetrics(BaseModel):
    wape: float | None = None
    mae: float | None = None
    bias: float | None = None
    rmse: float | None = None
    mape: float | None = None
    fva: float | None = None


class ForecastResultResponse(BaseModel):
    job_id: str
    status: str
    dataset_id: str
    model_used: str
    freq: str
    horizon: int
    metrics: ForecastMetrics
    historical: list[HistoricalPoint]
    predictions: list[PredictionPoint]
    created_at: str


# ── Helpers ───────────────────────────────────────────────────────────────────


def _eager_mode() -> bool:
    """True cuando Celery corre síncronamente sin Redis (dev local)."""
    return settings.celery_task_always_eager


def _celery_state(job_id: str) -> str:
    """Lee el estado de Celery SIN tocar Redis en modo eager."""
    if _eager_mode():
        # En eager mode la tarea ya terminó — consultamos Supabase directamente
        data = get_forecast_result(job_id)
        if data:
            return data.get("status", "done")
        return "pending"
    # Producción: consulta Redis vía Celery
    task = run_forecast_task.AsyncResult(job_id)
    state_map = {
        "PENDING": "pending",
        "STARTED": "started",
        "SUCCESS": "done",
        "FAILURE": "failed",
    }
    return state_map.get(task.state, "pending")


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/run", response_model=ForecastRunResponse, status_code=202)
async def run_forecast(body: ForecastRunRequest) -> ForecastRunResponse:
    """
    Lanza el forecast. En modo eager (dev) corre síncronamente y retorna
    job_id inmediatamente — el resultado ya está en Supabase al responder.
    """
    task = run_forecast_task.delay(
        dataset_id=body.dataset_id,
        date_column=body.date_column,
        target_column=body.target_column,
        freq=body.freq,
        horizon=body.horizon,
        model_override=body.model_override,
    )
    job_id: str = str(task.id)
    return ForecastRunResponse(job_id=job_id, status="done" if _eager_mode() else "pending")


@router.get("/{job_id}/status", response_model=ForecastStatusResponse)
async def get_forecast_status(job_id: str) -> ForecastStatusResponse:
    """
    En modo eager: consulta Supabase directamente (sin Redis).
    En producción: consulta el backend de Celery (Redis).
    """
    status = _celery_state(job_id)

    progress_pct = 100 if status == "done" else 0
    step = (
        "Completado" if status == "done" else ("Error" if status == "failed" else "Procesando...")
    )

    return ForecastStatusResponse(
        job_id=job_id,
        status=status,
        progress_pct=progress_pct,
        step=step,
    )


@router.get("/{job_id}/result", response_model=ForecastResultResponse)
async def get_forecast_result_endpoint(job_id: str) -> ForecastResultResponse:
    """Retorna el resultado completo desde Supabase."""
    data = get_forecast_result(job_id)

    if not data:
        # Fallback en modo eager: el resultado puede estar en task.result
        if _eager_mode():
            raise HTTPException(
                status_code=404,
                detail=f"Resultado de '{job_id}' no encontrado en Supabase. Verificá que el forecast terminó correctamente.",
            )
        # Producción: intenta desde Celery
        task = run_forecast_task.AsyncResult(job_id)
        if task.state == "PENDING":
            raise HTTPException(status_code=404, detail=f"Job '{job_id}' no encontrado.")
        if task.state in ("STARTED", "RETRY"):
            raise HTTPException(status_code=409, detail=f"Job '{job_id}' todavía en ejecución.")
        if task.state == "FAILURE":
            raise HTTPException(status_code=500, detail=f"Job '{job_id}' falló.")
        data = task.result
        if not data:
            raise HTTPException(status_code=404, detail=f"Resultado de '{job_id}' no encontrado.")

    return ForecastResultResponse(
        job_id=data["job_id"],
        status=data["status"],
        dataset_id=data["dataset_id"],
        model_used=data["model_used"],
        freq=data["freq"],
        horizon=data["horizon"],
        metrics=ForecastMetrics(**(data.get("metrics") or {})),
        historical=[HistoricalPoint(**p) for p in (data.get("historical") or [])],
        predictions=[PredictionPoint(**p) for p in (data.get("predictions") or [])],
        created_at=data.get("created_at", ""),
    )


# ── Compare endpoint ──────────────────────────────────────────────────────────


class ComparePoint(BaseModel):
    date: str
    baseline: float
    with_events: float
    lower: float
    upper: float


class ForecastCompareResponse(BaseModel):
    job_id: str
    model_used: str
    events_applied: int
    predictions: list[ComparePoint]


@router.get("/{job_id}/compare", response_model=ForecastCompareResponse)
async def get_forecast_compare(job_id: str, year: int | None = None) -> ForecastCompareResponse:
    """
    Retorna el forecast baseline + versión ajustada por eventos activos.
    El ajuste es post-processing multiplicativo: si un punto cae dentro del
    rango de un evento con impact_pct=20, predicted *= 1.20.
    Múltiples eventos se acumulan multiplicativamente.
    """
    from datetime import date as date_type

    data = get_forecast_result(job_id)
    if not data:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' no encontrado.")

    predictions_raw: list[dict[str, Any]] = data.get("predictions") or []

    # Cargar eventos (propios + globales + feriados AR)
    user_id: str | None = None  # Phase 5: inyectar desde JWT
    target_year = year or date_type.today().year
    all_events = list_events(user_id=user_id) + get_ar_holidays(target_year)

    # Solo eventos con impact_pct definido afectan el forecast
    active_events = [e for e in all_events if e.get("impact_pct") is not None]

    compare_points: list[ComparePoint] = []
    events_applied_set: set[str] = set()

    for p in predictions_raw:
        point_date = date_type.fromisoformat(p["date"][:10])
        multiplier = 1.0

        for ev in active_events:
            start = date_type.fromisoformat(str(ev["start_date"])[:10])
            end = date_type.fromisoformat(str(ev["end_date"])[:10])
            if start <= point_date <= end:
                impact = float(ev["impact_pct"]) / 100.0
                multiplier *= 1.0 + impact
                events_applied_set.add(str(ev["id"]))

        baseline = float(p["predicted"])
        compare_points.append(
            ComparePoint(
                date=p["date"],
                baseline=baseline,
                with_events=round(baseline * multiplier, 4),
                lower=float(p["lower"]) * multiplier,
                upper=float(p["upper"]) * multiplier,
            )
        )

    return ForecastCompareResponse(
        job_id=job_id,
        model_used=data.get("model_used", ""),
        events_applied=len(events_applied_set),
        predictions=compare_points,
    )
