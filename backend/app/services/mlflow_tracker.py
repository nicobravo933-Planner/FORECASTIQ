"""
MLflow tracker — Fase 8.

Wrapper para loguear experimentos de forecast en MLflow.
En dev:  MLFLOW_TRACKING_URI=./mlruns  (filesystem local, sin servidor)
En prod: MLFLOW_TRACKING_URI=https://dagshub.com/<user>/forecastiq.mlflow

Uso:
    from app.services.mlflow_tracker import log_forecast_run
    run_id = log_forecast_run(params, metrics, model_obj, dataset_id, user_id)
"""

from __future__ import annotations

import os
from typing import Any

import joblib
import mlflow
import pandas as pd
import structlog

from app.core.config import settings

log = structlog.get_logger(__name__)


def _configure_mlflow() -> None:
    """Configura MLflow tracking URI y credenciales Dagshub (una sola vez)."""
    mlflow.set_tracking_uri(settings.mlflow_tracking_uri)

    # Dagshub usa Basic Auth vía variables de entorno estándar de MLflow
    if settings.mlflow_tracking_username:
        os.environ["MLFLOW_TRACKING_USERNAME"] = settings.mlflow_tracking_username
    if settings.mlflow_tracking_password:
        os.environ["MLFLOW_TRACKING_PASSWORD"] = settings.mlflow_tracking_password


def _get_or_create_experiment(user_id: str | None) -> str:
    """
    Retorna el experiment_id para el usuario.
    Usa un experimento global si no hay user_id (modo demo).
    """
    experiment_name = (
        f"{settings.mlflow_experiment_name}/{user_id}"
        if user_id
        else settings.mlflow_experiment_name
    )
    experiment = mlflow.get_experiment_by_name(experiment_name)
    if experiment is None:
        experiment_id: str = mlflow.create_experiment(experiment_name)
    else:
        experiment_id = str(experiment.experiment_id)
    return experiment_id


def log_forecast_run(
    params: dict[str, Any],
    metrics: dict[str, float],
    model_obj: Any | None,
    dataset_id: str,
    user_id: str | None = None,
    job_id: str | None = None,
) -> str | None:
    """
    Loguea un experimento de forecast en MLflow.

    Args:
        params:     hiperparámetros del modelo {model, freq, horizon, n_obs, ...}
        metrics:    métricas de evaluación {wape, mae, bias, rmse, mape}
        model_obj:  instancia del modelo entrenado (se serializa con joblib)
        dataset_id: ID del dataset en Supabase
        user_id:    ID del usuario (None = modo demo)
        job_id:     ID del job Celery (usado como run_name)

    Returns:
        run_id: string de MLflow, o None si falló el tracking
    """
    try:
        _configure_mlflow()
        experiment_id = _get_or_create_experiment(user_id)

        with mlflow.start_run(
            experiment_id=experiment_id,
            run_name=job_id or "forecast-run",
        ) as run:
            # Tags de contexto
            mlflow.set_tags(
                {
                    "dataset_id": dataset_id,
                    "user_id": user_id or "anonymous",
                    "environment": settings.environment,
                }
            )

            # Parámetros del experimento
            safe_params = {k: str(v) for k, v in params.items()}
            mlflow.log_params(safe_params)

            # Métricas de evaluación (solo las que existen y son numéricas)
            safe_metrics = {
                k: float(v)
                for k, v in metrics.items()
                if v is not None and not (isinstance(v, float) and (v != v))  # excluye NaN
            }
            if safe_metrics:
                mlflow.log_metrics(safe_metrics)

            # Artefacto: modelo serializado con joblib
            if model_obj is not None:
                try:
                    mlflow.sklearn.log_model(
                        sk_model=model_obj,
                        artifact_path="model",
                        serialization_format=mlflow.sklearn.SERIALIZATION_FORMAT_CLOUDPICKLE,
                    )
                except Exception:
                    # Fallback: si el modelo no es sklearn-compatible, loguea joblib raw
                    import pathlib
                    import tempfile

                    with tempfile.NamedTemporaryFile(suffix=".joblib", delete=False) as f:
                        joblib.dump(model_obj, f.name)
                        mlflow.log_artifact(f.name, artifact_path="model")
                        pathlib.Path(f.name).unlink(missing_ok=True)

            run_id: str = run.info.run_id
            log.info(
                "mlflow_run_logged",
                run_id=run_id,
                experiment_id=experiment_id,
                model=params.get("model"),
                wape=metrics.get("wape"),
            )
            return run_id

    except Exception as exc:
        # MLflow no debe romper el pipeline de forecast
        log.warning("mlflow_tracking_failed", error=str(exc))
        return None


def get_recent_runs(
    user_id: str | None = None,
    max_results: int = 20,
) -> list[dict[str, Any]]:
    """
    Devuelve los últimos runs MLflow del usuario, ordenados por fecha desc.
    Usado por GET /api/experiments.
    """
    try:
        _configure_mlflow()
        experiment_name = (
            f"{settings.mlflow_experiment_name}/{user_id}"
            if user_id
            else settings.mlflow_experiment_name
        )
        experiment = mlflow.get_experiment_by_name(experiment_name)
        if experiment is None:
            return []

        runs = mlflow.search_runs(
            experiment_ids=[experiment.experiment_id],
            order_by=["start_time DESC"],
            max_results=max_results,
        )

        # search_runs retorna DataFrame cuando output_format="pandas" (default)
        # El tipo anotado es list[Run] | DataFrame — el isinstance resuelve la ambigüedad
        if not isinstance(runs, pd.DataFrame):
            return []

        result: list[dict[str, Any]] = []
        for _, row in runs.iterrows():
            result.append(
                {
                    "run_id": row.get("run_id", ""),
                    "run_name": row.get("tags.mlflow.runName", ""),
                    "status": row.get("status", ""),
                    "start_time": str(row.get("start_time", "")),
                    "model": row.get("params.model", ""),
                    "freq": row.get("params.freq", ""),
                    "horizon": row.get("params.horizon", ""),
                    "n_obs": row.get("params.n_obs", ""),
                    "wape": row.get("metrics.wape"),
                    "mae": row.get("metrics.mae"),
                    "bias": row.get("metrics.bias"),
                    "rmse": row.get("metrics.rmse"),
                    "dataset_id": row.get("tags.dataset_id", ""),
                    "dagshub_url": _dagshub_run_url(
                        experiment.experiment_id, row.get("run_id", "")
                    ),
                }
            )
        return result

    except Exception as exc:
        log.warning("mlflow_get_runs_failed", error=str(exc))
        return []


def get_run_detail(run_id: str) -> dict[str, Any] | None:
    """
    Devuelve el detalle completo de un run MLflow.
    Usado por GET /api/experiments/{run_id}.
    """
    try:
        _configure_mlflow()
        run = mlflow.get_run(run_id)
        return {
            "run_id": run.info.run_id,
            "status": run.info.status,
            "start_time": run.info.start_time,
            "end_time": run.info.end_time,
            "params": dict(run.data.params),
            "metrics": dict(run.data.metrics),
            "tags": dict(run.data.tags),
        }
    except Exception as exc:
        log.warning("mlflow_get_run_detail_failed", run_id=run_id, error=str(exc))
        return None


def _dagshub_run_url(experiment_id: str, run_id: str) -> str:
    """Construye la URL pública de Dagshub para el run (solo en prod)."""
    username = settings.mlflow_tracking_username
    if not username or not settings.is_production:
        return ""
    return f"https://dagshub.com/{username}/forecastiq/experiments/#{experiment_id}/runs/{run_id}"
