"""
MLOps API — Fase 8.

Endpoints para consultar experimentos MLflow y reportes de drift.

GET    /api/experiments              → lista de runs del usuario
GET    /api/experiments/{run_id}     → detalle de un run
DELETE /api/experiments/{run_id}     → borra un run MLflow
GET    /api/drift/{dataset_id}       → resumen de drift por dataset
"""

from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException

from app.core.dependencies import OptionalUser
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


@router.delete("/{run_id}", status_code=204)
async def delete_experiment(
    run_id: str,
    user: OptionalUser,
) -> None:
    """
    Borra un run MLflow por run_id.
    Funciona localmente (./mlruns) y en Dagshub si el token tiene permiso.
    No requiere autenticación — los runs son por session/demo.
    """
    try:
        import mlflow  # heavy-ml — solo disponible en local

        from app.core.config import settings

        mlflow.set_tracking_uri(settings.mlflow_tracking_uri)
        if settings.mlflow_tracking_username:
            os.environ["MLFLOW_TRACKING_USERNAME"] = settings.mlflow_tracking_username
        if settings.mlflow_tracking_password:
            os.environ["MLFLOW_TRACKING_PASSWORD"] = settings.mlflow_tracking_password
        mlflow.delete_run(run_id)
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="MLflow no disponible en este tier. Requiere grupo heavy-ml.",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"No se pudo borrar el run '{run_id}': {exc}",
        ) from exc


@drift_router.get("/{dataset_id}")
async def get_drift(
    dataset_id: str,
    user: OptionalUser,
) -> dict:  # type: ignore[type-arg]
    """
    Resumen de drift para un dataset: lista de reportes HTML + URL del más reciente.
    Funciona sin autenticación (devuelve resumen vacío si no hay reportes).
    El bucket 'drift_reports' en Supabase Storage debe ser público.
    """
    summary = get_drift_summary(dataset_id)
    return summary
