"""
Celery app + tarea de forecast — Phase 2.

En desarrollo: CELERY_TASK_ALWAYS_EAGER=True corre la tarea síncronamente
en el mismo proceso FastAPI, sin necesidad de worker separado.

En producción:
  celery -A app.services.celery_app worker --loglevel=info --concurrency=2
"""

from __future__ import annotations

import io
import uuid
from datetime import UTC, datetime
from typing import Any

import pandas as pd
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

# -- Instancia Celery ---------------------------------------------------------

celery_app = Celery(
    "forecastiq",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=True,  # en eager mode, propaga excepciones correctamente
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,
)


# -- Tarea principal ----------------------------------------------------------


@celery_app.task(bind=True, name="forecast.run")  # type: ignore[untyped-decorator]
def run_forecast_task(
    self: Any,
    dataset_id: str,
    date_column: str,
    target_column: str,
    freq: str,
    horizon: int,
    model_override: str | None = None,
    user_id: str | None = None,
) -> dict[str, Any]:
    """
    Pipeline completo de forecasting:
      1. Descarga CSV desde Supabase Storage
      2. Parsea y prepara la serie temporal
      3. Winsorización p5/p95
      4. Selecciona o usa el modelo indicado
      5. Entrena y genera predicciones
      6. Calcula métricas con hold-out 20%
      7. Guarda resultado en Supabase DB
    """
    from app.core.telemetry import forecast_span
    from app.ml.detector import detect_best_model
    from app.ml.models.holt_winters import HoltWintersModel
    from app.ml.models.moving_average import MovingAverageModel
    from app.ml.models.sarima import SarimaModel
    from app.services.supabase import download_csv, save_forecast_result

    # LightGBM solo disponible en tier local (worker con heavy-ml instalado)
    try:
        from app.ml.models.lightgbm_model import LightGBMModel  # type: ignore[import]
        _lgbm_available = True
    except ImportError:
        LightGBMModel = None  # type: ignore[assignment,misc]
        _lgbm_available = False

    job_id = self.request.id or str(uuid.uuid4())

    # Pandas 2.2+ renombró aliases de frecuencia — normalizamos antes de usar
    freq_alias = {"M": "ME", "Q": "QE", "A": "YE", "Y": "YE"}
    freq = freq_alias.get(freq, freq)

    def _update(pct: int, step: str) -> None:
        """Reporta progreso solo cuando hay Redis disponible (no en modo eager dev)."""
        if not settings.celery_task_always_eager:
            self.update_state(state="STARTED", meta={"progress_pct": pct, "step": step})

    try:
        # OTel: span que cubre todo el pipeline de forecast
        with forecast_span(
            dataset_id=dataset_id,
            model_name=model_override or "auto",
            horizon=horizon,
            freq=freq,
        ) as span:
            # 1. Descarga y parseo
            _update(5, "Descargando datos")
            content = download_csv(dataset_id)
            df = pd.read_csv(io.BytesIO(content))
            df[date_column] = pd.to_datetime(df[date_column])
            df = df.sort_values(date_column).reset_index(drop=True)

            series = pd.to_numeric(df[target_column], errors="coerce")
            series = series.interpolate(method="linear").ffill().bfill()
            series.index = pd.DatetimeIndex(df[date_column])
            series = series.asfreq(freq, method="ffill")

            # 2. Winsorización p5/p95
            _update(15, "Preprocesando serie")
            p5 = float(series.quantile(0.05))
            p95 = float(series.quantile(0.95))
            series = series.clip(lower=p5, upper=p95)

            # 3. Detección / selección de modelo
            _update(25, "Seleccionando modelo")
            if model_override:
                model_name = model_override
            else:
                detection = detect_best_model(series, freq=freq)
                model_name = detection.model

            # Actualizar span con el modelo real seleccionado
            span.set_attribute("forecast.model", model_name)

            model_map: dict[str, Any] = {
                "moving_average": MovingAverageModel(),
                "holt_winters": HoltWintersModel(),
                "sarima": SarimaModel(),
            }
            # LightGBM solo si está disponible (tier local)
            if _lgbm_available and LightGBMModel is not None:
                model_map["lightgbm"] = LightGBMModel()
            elif model_name == "lightgbm":
                # Fallback a Holt-Winters si se pide LightGBM en cloud
                import structlog as _sl
                _sl.get_logger().warning(
                    "lightgbm_not_available_fallback",
                    tier=settings.server_tier,
                    fallback="holt_winters",
                )
                model_name = "holt_winters"
            model = model_map.get(model_name, HoltWintersModel())

            # 4. Split train/test 80/20
            n = len(series)
            split = max(int(n * 0.8), n - horizon)
            train = series.iloc[:split]
            test = series.iloc[split:]

            # 5. Entrenamiento
            _update(40, f"Entrenando {model_name}")
            model.fit(train)

            # 6. Métricas sobre test
            _update(75, "Calculando métricas")
            metrics: dict[str, Any] = model.evaluate(test) if len(test) > 0 else {}

            # Registrar métricas clave en el span para verlas en Grafana Tempo
            if metrics:
                span.set_attribute("forecast.wape", float(metrics.get("wape") or 0))
                span.set_attribute("forecast.mae", float(metrics.get("mae") or 0))

            # Re-entrena con toda la serie para la predicción final
            model.fit(series)

            # 7. Predicción
            _update(85, "Generando forecast")
            forecast_df = model.predict(horizon)

            history_window = min(len(series), horizon * 2)
            history = series.iloc[-history_window:]

            historical = [
                {"date": str(d.date()), "value": float(v)}
                for d, v in zip(history.index, history.values, strict=False)
            ]
            predictions = [
                {
                    "date": str(row["date"].date())
                    if hasattr(row["date"], "date")
                    else str(row["date"]),
                    "predicted": round(float(row["predicted"]), 4),
                    "lower": round(float(row["lower"]), 4),
                    "upper": round(float(row["upper"]), 4),
                }
                for _, row in forecast_df.iterrows()
            ]

            # 8. Guarda en Supabase
            _update(95, "Guardando resultado")
            result: dict[str, Any] = {
                "job_id": job_id,
                "status": "done",
                "dataset_id": dataset_id,
                "model_used": model_name,
                "freq": freq,
                "horizon": horizon,
                "metrics": metrics,
                "historical": historical,
                "predictions": predictions,
                "created_at": datetime.utcnow().isoformat(),
            }

            save_forecast_result(job_id=job_id, result=result, user_id=user_id)

            # 9. MLflow tracking (solo si está disponible en este tier)
            try:
                from app.services.mlflow_tracker import log_forecast_run

                mlflow_params = {
                    "model": model_name,
                    "freq": freq,
                    "horizon": horizon,
                    "n_obs": len(series),
                    "dataset_id": dataset_id,
                }
                log_forecast_run(
                    params=mlflow_params,
                    metrics={k: float(v) for k, v in metrics.items() if v is not None},
                    model_obj=model,
                    dataset_id=dataset_id,
                    user_id=user_id,
                    job_id=job_id,
                )
            except ImportError:
                pass  # mlflow no instalado en tier cloud — silencioso

            # 10. Drift detection (solo si hay suficiente historial)
            if len(series) >= 8:
                try:
                    from app.services.drift_detector import detect_drift

                    # Ventana reciente = 25% de la serie (mínimo 4 puntos)
                    recent_window = max(4, len(series) // 4)
                    series_recent = series.iloc[-recent_window:]
                    series_ref = series.iloc[:-recent_window]

                    if len(series_ref) >= 4:
                        detect_drift(
                            series_full=series_ref,
                            series_recent=series_recent,
                            dataset_id=dataset_id,
                            job_id=job_id,
                        )
                except ImportError:
                    pass  # evidently no instalado en tier cloud — silencioso

                # Alerta WAPE drift (requiere historial de runs)
                current_wape = float(metrics.get("wape") or 0)
                if current_wape > 0:
                    import structlog as _structlog

                    _log = _structlog.get_logger("celery_app")
                    _log.info(
                        "forecast_wape_logged",
                        job_id=job_id,
                        dataset_id=dataset_id,
                        wape=current_wape,
                        model=model_name,
                    )

            return result

    except Exception as exc:
        raise RuntimeError(str(exc)) from exc


# -- Celery Beat — tarea nocturna de re-forecast ------------------------------

# Activa el Beat schedule solo en producción (en dev usamos eager mode)
# Cómo arrancar Beat en producción (junto al worker):
#   celery -A app.services.celery_app beat --loglevel=info
celery_app.conf.beat_schedule = {
    "nightly-batch-reforecast": {
        "task": "forecast.batch_reforecast",
        # 02:00 hora Argentina (UTC-3). Celery usa UTC internamente → 05:00 UTC
        "schedule": crontab(hour=5, minute=0),
        "args": [],
    },
}


@celery_app.task(bind=True, name="forecast.batch_reforecast")  # type: ignore[untyped-decorator]
def batch_reforecast(self: Any) -> dict[str, Any]:  # noqa: ARG001
    """
    Tarea nocturna de Celery Beat — 02:00 hora Argentina (05:00 UTC).

    Re-ejecuta el forecast vectorizado Nixtla sobre todos los datasets
    activos del último día.

    Pipeline:
      1. Lista los datasets subidos en las últimas 48h (por si hubo demora)
      2. Por cada dataset, dispara run_forecast_task con el modelo por defecto
      3. Loguea resultado en structlog con métricas resumidas

    En Fase 12 (Airflow), este cron se reemplazará por un DAG con sensores.
    """

    import structlog as _structlog

    _log = _structlog.get_logger("celery_beat")

    job_id = self.request.id or "batch-reforecast-manual"
    _log.info("batch_reforecast_started", job_id=job_id)

    # Importación tardía para evitar circularidad con supabase.py
    from app.services.supabase import list_recent_datasets

    datasets = list_recent_datasets(hours=48)
    total = len(datasets)
    succeeded = 0
    failed_ids: list[str] = []

    _log.info("batch_reforecast_datasets_found", total=total)

    for ds in datasets:
        dataset_id = ds.get("id", "")
        if not dataset_id:
            continue

        date_col = ds.get("date_column", "date")
        target_col = ds.get("target_column", "value")
        freq = ds.get("freq", "W")
        horizon = int(ds.get("horizon", 12))
        user_id = ds.get("user_id")

        try:
            # Reutiliza la tarea de forecast individual — misma lógica, mismo tracking MLflow
            run_forecast_task.apply(
                args=[
                    dataset_id,
                    date_col,
                    target_col,
                    freq,
                    horizon,
                ],
                kwargs={"user_id": user_id},
            )
            succeeded += 1
            _log.info(
                "batch_reforecast_item_done",
                dataset_id=dataset_id,
                freq=freq,
                horizon=horizon,
            )
        except Exception as exc:
            failed_ids.append(dataset_id)
            _log.error(
                "batch_reforecast_item_failed",
                dataset_id=dataset_id,
                error=str(exc),
            )

    _log.info(
        "batch_reforecast_finished",
        total=total,
        succeeded=succeeded,
        failed=len(failed_ids),
        failed_ids=failed_ids,
    )

    return {
        "job_id": job_id,
        "total": total,
        "succeeded": succeeded,
        "failed": len(failed_ids),
        "failed_ids": failed_ids,
        "run_at": datetime.now(tz=UTC).isoformat(),
    }
