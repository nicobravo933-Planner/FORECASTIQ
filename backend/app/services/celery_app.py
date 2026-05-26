"""
Celery app + tarea de forecast — Phase 2.

En desarrollo: CELERY_TASK_ALWAYS_EAGER=True corre la tarea síncronamente
en el mismo proceso FastAPI, sin necesidad de worker separado.

En producción:
  celery -A app.services.celery_app worker --loglevel=info --concurrency=2
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, cast

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
    # Concurrencia: 1 en EC2 t3.micro (1 vCPU, 1 GB RAM)
    # En local puede subirse a 2-4 con CELERYD_CONCURRENCY en .env
    worker_concurrency=settings.celeryd_concurrency,
)


# -- Helpers ------------------------------------------------------------------


def _extract_model_params(model: Any, model_name: str) -> dict[str, Any]:
    """
    Extrae los parámetros usados por el modelo post-fit.
    Retorna un dict serializable (JSON-safe) para persistir en el resultado.

    Estructura por modelo:
      moving_average → {window_effective}
      holt_winters   → {alpha, beta, gamma, seasonal_periods, use_seasonal}
      sarima         → {order (p,d,q), seasonal_order (P,D,Q,s)}
      lightgbm       → {best_params (Optuna), used_cache, max_lag}
    """
    try:
        if model_name == "moving_average":
            # Ventana efectiva calculada durante el fit
            series = getattr(model, "_series", None)
            window_effective = 6
            if series is not None:
                n = len(series)
                window_effective = min(getattr(model, "window", 6), max(2, n // 3))
            return {"window": window_effective}

        if model_name == "holt_winters":
            fit = getattr(model, "_model_fit", None)
            sp = getattr(model, "_seasonal_periods", 12)
            if fit is None:
                return {"seasonal_periods": sp}
            # statsmodels expone los parámetros optimizados en params_
            params = getattr(fit, "params", {})
            alpha = float(params.get("smoothing_level", params.get("alpha", 0.0)))
            beta = float(params.get("smoothing_trend", params.get("beta", 0.0)))
            gamma = float(params.get("smoothing_seasonal", params.get("gamma", 0.0)))
            use_seasonal = getattr(fit.model, "seasonal", None) is not None
            return {
                "alpha": round(alpha, 4),
                "beta": round(beta, 4),
                "gamma": round(gamma, 4),
                "seasonal_periods": sp,
                "use_seasonal": use_seasonal,
            }

        if model_name == "sarima":
            fit = getattr(model, "_model_fit", None)
            if fit is None:
                return {}
            order = tuple(int(x) for x in fit.order)
            seasonal_order = tuple(int(x) for x in fit.seasonal_order)
            return {
                "order": list(order),  # [p, d, q]
                "seasonal_order": list(seasonal_order),  # [P, D, Q, s]
            }

        if model_name == "linear_splines":
            return {
                "n_knots": int(getattr(model, "n_knots", 5)),
                "degree": int(getattr(model, "degree", 3)),
                "alpha": float(getattr(model, "alpha", 1e-3)),
                "add_dummies": bool(getattr(model, "add_dummies", True)),
                "season_len": int(getattr(model, "_season_len", 12)),
            }

        if model_name == "ses":
            fit = getattr(model, "_model_fit", None)
            if fit is None:
                return {}
            params = getattr(fit, "params", {})
            return {
                "alpha": round(float(params.get("smoothing_level", 0.3)), 4),
            }

        if model_name == "holt_simple":
            fit = getattr(model, "_model_fit", None)
            if fit is None:
                return {}
            params = getattr(fit, "params", {})
            return {
                "alpha": round(float(params.get("smoothing_level", 0.3)), 4),
                "beta": round(float(params.get("smoothing_trend", 0.1)), 4),
            }

        if model_name == "lightgbm":
            best = getattr(model, "_best_params", {})
            # Serializa solo valores primitivos — los Booster objects no son JSON-safe
            safe_params = {
                k: float(v) if isinstance(v, float) else int(v) if isinstance(v, int) else str(v)
                for k, v in best.items()
            }
            return {
                "best_params": safe_params,
                "used_cache": bool(getattr(model, "used_cache", False)),
                "max_lag": int(getattr(model, "max_lag", 13)),
                "n_trials": int(getattr(model, "n_trials", 30)),
                # E9: columnas de eventos usadas en el training
                "event_cols": list(getattr(model, "_event_cols", [])),
            }
    except Exception:
        pass  # Nunca romper el forecast por falla en extracción de params

    return {}


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
    force_reoptimize: bool = False,
    test_periods: int = 0,
    cv_folds: int = 0,
    manual_params: dict[str, object] | None = None,
    train_start_date: str | None = None,
) -> dict[str, Any]:
    """
    Pipeline completo de forecasting:
      1. Descarga CSV desde Supabase Storage
      2. Parsea y prepara la serie temporal
      3. Winsorización p5/p95
      4. Selecciona o usa el modelo indicado
      5. Entrena y genera predicciones
      6. Calcula métricas — si test_periods > 0 usa hold-out manual,
         sino hold-out automático 20%
      7. Guarda resultado en Supabase DB

    test_periods: número de períodos finales a reservar como hold-out manual.
      0  → comportamiento anterior: hold-out automático 20%.
      N  → reserva los últimos N períodos como test explícito.
           El resultado incluye test_actual, test_predicted, train_end_date,
           test_start_date para visualizar las 3 zonas en el gráfico.

    cv_folds: número de folds de rolling cross-validation (0 = desactivado).
      0     → sin CV (comportamiento anterior).
      2–5   → ejecuta TimeSeriesSplit con k folds, retorna WAPE media ± std.
             Se corre sobre la serie completa ANTES del forecast final.
             Requiere sklearn. Series demasiado cortas reciben advertencia.
    """
    from app.core.telemetry import forecast_span
    from app.ml.detector import detect_best_model
    from app.ml.models.holt_model import HoltSimpleModel
    from app.ml.models.holt_winters import HoltWintersModel
    from app.ml.models.linear_splines_model import LinearSplinesModel
    from app.ml.models.moving_average import MovingAverageModel
    from app.ml.models.sarima import SarimaModel
    from app.ml.models.ses_model import SESModel
    from app.services.storage import load_dataset as _load_dataset
    from app.services.supabase import save_forecast_result

    # LightGBM solo disponible en tier local (worker con heavy-ml instalado)
    _lgbm_cls: type | None = None
    _lgbm_available = False
    try:
        from app.ml.models.lightgbm_model import LightGBMModel as _LgbmCls

        _lgbm_cls = _LgbmCls
        _lgbm_available = True
    except ImportError:
        pass

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
            # 1. Carga y parseo
            _update(5, "Descargando datos")
            df = _load_dataset(dataset_id)
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

            # 3. F2.3: recortar serie si el usuario definió ventana de entrenamiento
            if train_start_date:
                cutoff = pd.Timestamp(train_start_date)
                series = series[series.index >= cutoff]
                if len(series) < 4:
                    raise ValueError(
                        f"La ventana de entrenamiento desde {train_start_date} deja menos de 4 "
                        "observaciones. Elegió una fecha de inicio más antigua o usá 'Auto'."
                    )

            # 3→(4). Detección / selección de modelo
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
                "linear_splines": LinearSplinesModel(),
                "ses": SESModel(),
                "holt_simple": HoltSimpleModel(),
            }
            # E4: si hay parámetros manuales del usuario, sobreescribe los defaults
            if manual_params:
                mp = manual_params
                # Holt-Winters: alpha / beta / gamma opcionales
                if model_name == "holt_winters":
                    hw_kwargs: dict[str, Any] = {}
                    if "hw_alpha" in mp:
                        hw_kwargs["alpha"] = float(mp["hw_alpha"])  # type: ignore[arg-type]
                    if "hw_beta" in mp:
                        hw_kwargs["beta"] = float(mp["hw_beta"])  # type: ignore[arg-type]
                    if "hw_gamma" in mp:
                        hw_kwargs["gamma"] = float(mp["hw_gamma"])  # type: ignore[arg-type]
                    if hw_kwargs:
                        model_map["holt_winters"] = HoltWintersModel(**hw_kwargs)
                # SARIMA: order y seasonal_order opcionales
                if model_name == "sarima":
                    sarima_kwargs: dict[str, Any] = {}
                    if "sarima_order" in mp:
                        raw_order = cast(list[Any], mp["sarima_order"])
                        sarima_kwargs["order"] = tuple(int(x) for x in raw_order)
                    if "sarima_seasonal_order" in mp:
                        raw_seasonal = cast(list[Any], mp["sarima_seasonal_order"])
                        sarima_kwargs["seasonal_order"] = tuple(int(x) for x in raw_seasonal)
                    if sarima_kwargs:
                        model_map["sarima"] = SarimaModel(**sarima_kwargs)
            # LightGBM solo si está disponible (tier local)
            if _lgbm_available and _lgbm_cls is not None:
                # E9: cargar features de eventos para LightGBM
                # Si falla (Supabase no disponible, dataset sin fechas, etc.) el forecast
                # sigue funcionando sin eventos — nunca romper el pipeline por esto.
                _event_features_df: pd.DataFrame | None = None
                try:
                    from app.services.events import (
                        events_to_features_df,
                        get_ar_commercial_events,
                        get_ar_holidays,
                        list_events,
                    )

                    _all_events = list_events(user_id=user_id)
                    _years = range(series.index.min().year, series.index.max().year + 3)
                    for _yr in _years:
                        _all_events.extend(get_ar_holidays(_yr))
                        _all_events.extend(get_ar_commercial_events(_yr))

                    if _all_events:
                        _event_features_df = events_to_features_df(
                            _all_events,
                            pd.DatetimeIndex(series.index),
                        )
                except Exception as _ev_err:
                    import structlog as _sl2

                    _sl2.get_logger().warning(
                        "event_features_load_failed",
                        dataset_id=dataset_id,
                        error=str(_ev_err),
                    )

                model_map["lightgbm"] = _lgbm_cls(
                    dataset_id=dataset_id,
                    user_id=user_id,
                    force_reoptimize=force_reoptimize,
                    event_features=_event_features_df,
                )
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

            # 4. Split train/test
            n = len(series)
            if test_periods > 0:
                # Hold-out manual: los últimos test_periods períodos son test
                tp = min(test_periods, n - 4)  # mínimo 4 puntos de train
                split = n - tp
            else:
                # Hold-out automático 20% (comportamiento original)
                split = max(int(n * 0.8), n - horizon)
                tp = 0

            train = series.iloc[:split]
            test = series.iloc[split:]

            # 5. Entrenamiento sobre train
            _update(40, f"Entrenando {model_name}")
            model.fit(train)

            # 6. Métricas sobre test
            _update(75, "Calculando métricas")
            metrics: dict[str, Any] = model.evaluate(test) if len(test) > 0 else {}

            if metrics:
                span.set_attribute("forecast.wape", float(metrics.get("wape") or 0))
                span.set_attribute("forecast.mae", float(metrics.get("mae") or 0))

            # Predicciones sobre el período de test (para visualizar zona test)
            test_actual_pts: list[dict[str, Any]] = []
            test_predicted_pts: list[dict[str, Any]] = []
            train_end_date: str | None = None
            test_start_date: str | None = None

            if tp > 0 and len(test) > 0:
                train_end_date = str(train.index[-1].date())
                test_start_date = str(test.index[0].date())

                # Predicción sobre la ventana de test
                try:
                    test_fc_df = model.predict(tp)
                    test_predicted_pts = [
                        {
                            "date": str(row["date"].date())
                            if hasattr(row["date"], "date")
                            else str(row["date"]),
                            "predicted": round(float(row["predicted"]), 4),
                            "lower": round(float(row["lower"]), 4),
                            "upper": round(float(row["upper"]), 4),
                        }
                        for _, row in test_fc_df.iterrows()
                    ]
                except Exception:
                    test_predicted_pts = []

                test_actual_pts = [
                    {"date": str(d.date()), "value": float(v)}
                    for d, v in zip(test.index, test.values, strict=False)
                ]

            # Re-entrena con toda la serie para la proyección futura
            model.fit(series)

            # Extrae parámetros del modelo post-fit (para E4 ParameterExplorer)
            model_params: dict[str, Any] = _extract_model_params(model, model_name)

            # 7. Rolling CV (opcional, solo si cv_folds > 0)
            _update(88, "Cross-validación rolling")
            cv_summary_dict: dict[str, Any] | None = None
            cv_warning: str | None = None

            if cv_folds > 0:
                # SARIMA en EC2 (1 GB RAM): 5 folds × SARIMA fit puede superar 800 MB.
                # Se bloquea preventivamente para evitar el OOM killer del kernel.
                # El usuario puede correr CV con SARIMA en modo local sin restricción.
                if settings.server_tier == "ec2" and model_name == "sarima":
                    cv_warning = (
                        "Rolling CV con SARIMA no está disponible en EC2 "
                        "(memoria insuficiente para múltiples fits simultáneos). "
                        "Usá modo local para esta operación."
                    )
                    cv_folds = 0  # cancela el CV sin romper el job
                else:
                    from app.ml.evaluator import rolling_cv

                    # Mapeo modelo_name → clase + kwargs sin contaminación de estado
                    _cv_cls_map: dict[str, tuple[type, dict[str, Any]]] = {
                        "moving_average": (MovingAverageModel, {}),
                        "holt_winters": (HoltWintersModel, {}),
                        "sarima": (SarimaModel, {}),
                        "linear_splines": (LinearSplinesModel, {}),
                        "ses": (SESModel, {}),
                        "holt_simple": (HoltSimpleModel, {}),
                    }
                    if _lgbm_available and _lgbm_cls is not None:
                        _cv_cls_map["lightgbm"] = (
                            _lgbm_cls,
                            {
                                "dataset_id": dataset_id,
                                "user_id": user_id,
                                "force_reoptimize": False,
                            },
                        )

                    cv_cls, cv_kwargs = _cv_cls_map.get(model_name, (HoltWintersModel, {}))

                    try:
                        cv_result = rolling_cv(
                            series=series,
                            model_cls=cv_cls,
                            model_kwargs=cv_kwargs,
                            horizon=horizon,
                            k_folds=cv_folds,
                        )
                        cv_summary_dict = cv_result.to_dict()
                    except ValueError as cv_err:
                        # Serie demasiado corta — no falla el job, solo avisa
                        cv_warning = str(cv_err)
                    except Exception as cv_err:
                        cv_warning = f"CV falló: {cv_err}"

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
                "test_periods": tp,
                "cv_folds": cv_folds,
                "metrics": metrics,
                "model_params": model_params,
                "historical": historical,
                "predictions": predictions,
                "test_actual": test_actual_pts,
                "test_predicted": test_predicted_pts,
                "train_end_date": train_end_date,
                "test_start_date": test_start_date,
                "cv_summary": cv_summary_dict,
                "cv_warning": cv_warning,
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
