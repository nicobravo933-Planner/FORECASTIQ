"""
MLOps API — Fase 8.

Endpoints para consultar experimentos MLflow y reportes de drift.

GET /api/experiments              → lista de runs del usuario
GET /api/experiments/{run_id}     → detalle de un run
GET /api/drift/{dataset_id}       → resumen de drift por dataset
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.core.dependencies import AuthUser, OptionalUser
from app.services.drift_detector import get_drift_summary
from app.services.mlflow_tracker import get_recent_runs, get_run_detail

router = APIRouter(prefix="/api/experiments", tags=["mlops"])
drift_router = APIRouter(prefix="/api/drift", tags=["mlops"])


@router.get("")
async def list_experiments(
    user: OptionalUser,
    max_results: int = 20,
) -> list[dict]:  # type: ignore[type-arg]
    """
    Lista los últimos runs MLflow del usuario autenticado.
    Sin auth → devuelve runs del experimento global (demo).
    """
    user_id = user.user_id if user else None
    runs = get_recent_runs(user_id=user_id, max_results=min(max_results, 50))
    return runs


@router.get("/{run_id}")
async def get_experiment(
    run_id: str,
    user: OptionalUser,
) -> dict:  # type: ignore[type-arg]
    """
    Detalle de un run MLflow: params + métricas + tags.
    """
    detail = get_run_detail(run_id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' no encontrado en MLflow.")
    return detail


@drift_router.get("/{dataset_id}")
async def get_drift(
    dataset_id: str,
    user: AuthUser,
) -> dict:  # type: ignore[type-arg]
    """
    Resumen de drift para un dataset: lista de reportes HTML + URL del más reciente.
    El bucket 'drift_reports' en Supabase Storage debe ser público.
    """
    summary = get_drift_summary(dataset_id)
    return summary
