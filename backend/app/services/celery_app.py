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
from datetime import datetime

import pandas as pd
from celery import Celery

from app.core.config import settings

# -- Instancia Celery ---------------------------------------------------------

celery_app = Celery(
    "forecastiq",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
)

celery_app.conf.update(
    task_always_eager=settings.celery_task_always_eager,
    task_eager_propagates=True,   # en eager mode, propaga excepciones correctamente
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="America/Argentina/Buenos_Aires",
    enable_utc=True,
    task_track_started=True,
    result_expires=3600,
)


# -- Tarea principal ----------------------------------------------------------

@celery_app.task(bind=True, name="forecast.run")  # type: ignore[misc]
def run_forecast_task(
    self,  # type: ignore[misc]
    dataset_id: str,
    date_column: str,
    target_column: str,
    freq: str,
    horizon: int,
    model_override: str | None = None,
) -> dict:
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
    from app.ml.detector import detect_best_model
    from app.ml.models.holt_winters import HoltWintersModel
    from app.ml.models.lightgbm_model import LightGBMModel
    from app.ml.models.moving_average import MovingAverageModel
    from app.ml.models.sarima import SarimaModel
    from app.services.supabase import download_csv, save_forecast_result

    job_id = self.request.id or str(uuid.uuid4())

    # Pandas 2.2+ renombró aliases de frecuencia — normalizamos antes de usar
    freq_alias = {"M": "ME", "Q": "QE", "A": "YE", "Y": "YE"}
    freq = freq_alias.get(freq, freq)

    def _update(pct: int, step: str) -> None:
        """Reporta progreso solo cuando hay Redis disponible (no en modo eager dev)."""
        if not settings.celery_task_always_eager:
            self.update_state(state="STARTED", meta={"progress_pct": pct, "step": step})

    try:
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
        p5  = float(series.quantile(0.05))
        p95 = float(series.quantile(0.95))
        series = series.clip(lower=p5, upper=p95)

        # 3. Detección / selección de modelo
        _update(25, "Seleccionando modelo")
        if model_override:
            model_name = model_override
        else:
            detection = detect_best_model(series, freq=freq)
            model_name = detection.model

        model_map = {
            "moving_average": MovingAverageModel(),
            "holt_winters":   HoltWintersModel(),
            "sarima":         SarimaModel(),
            "lightgbm":       LightGBMModel(),
        }
        model = model_map.get(model_name, HoltWintersModel())

        # 4. Split train/test 80/20
        n = len(series)
        split = max(int(n * 0.8), n - horizon)
        train = series.iloc[:split]
        test  = series.iloc[split:]

        # 5. Entrenamiento
        _update(40, f"Entrenando {model_name}")
        model.fit(train)

        # 6. Métricas sobre test
        _update(75, "Calculando métricas")
        metrics: dict = model.evaluate(test) if len(test) > 0 else {}

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
                "date":      str(row["date"].date()) if hasattr(row["date"], "date") else str(row["date"]),
                "predicted": round(float(row["predicted"]), 4),
                "lower":     round(float(row["lower"]), 4),
                "upper":     round(float(row["upper"]), 4),
            }
            for _, row in forecast_df.iterrows()
        ]

        # 8. Guarda en Supabase
        _update(95, "Guardando resultado")
        result = {
            "job_id":      job_id,
            "status":      "done",
            "dataset_id":  dataset_id,
            "model_used":  model_name,
            "freq":        freq,
            "horizon":     horizon,
            "metrics":     metrics,
            "historical":  historical,
            "predictions": predictions,
            "created_at":  datetime.utcnow().isoformat(),
        }

        save_forecast_result(job_id=job_id, result=result)
        return result

    except Exception as exc:
        raise RuntimeError(str(exc)) from exc
