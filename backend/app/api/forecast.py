"""
Endpoints de forecast — Phase 2.

  POST /api/forecast/run              → lanza job Celery, retorna job_id
  GET  /api/forecast/{job_id}/status  → estado + progreso del job
  GET  /api/forecast/{job_id}/result  → resultado completo cuando status=done
"""

from __future__ import annotations

from typing import Any, cast

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from app.core.config import settings
from app.core.dependencies import OptionalUser
from app.services.celery_app import run_forecast_task
from app.services.events import get_ar_holidays, list_events
from app.services.redis_cache import check_forecast_rate_limit
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
    force_reoptimize: bool = False  # True → ignora cache HPO y corre Optuna desde cero
    test_periods: int = Field(
        default=0, ge=0, le=24
    )  # 0 = hold-out auto 20%; N = hold-out manual N períodos
    cv_folds: int = Field(default=0, ge=0, le=5)  # 0 = sin CV; 2–5 = TimeSeriesSplit k folds
    manual_params: dict[str, object] | None = None  # E4: parámetros manuales del usuario
    # F2.3: fecha de inicio del train (None = historia completa)
    train_start_date: str | None = None


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


class CvFold(BaseModel):
    """Resultado de un fold individual de rolling CV."""

    fold: int
    train_size: int
    test_size: int
    train_start: str
    train_end: str
    test_start: str
    test_end: str
    wape: float | None = None
    mae: float | None = None
    bias: float | None = None
    rmse: float | None = None


class CvSummaryResponse(BaseModel):
    """Resumen de todos los folds de rolling CV."""

    n_folds: int
    wape_mean: float | None = None
    wape_std: float | None = None
    mae_mean: float | None = None
    mae_std: float | None = None
    bias_mean: float | None = None
    folds: list[CvFold] = []


class ForecastResultResponse(BaseModel):
    job_id: str
    status: str
    dataset_id: str
    model_used: str
    freq: str
    horizon: int
    test_periods: int = 0
    cv_folds: int = 0
    metrics: ForecastMetrics
    model_params: dict[str, object] = {}  # parámetros usados por el modelo (E4)
    historical: list[HistoricalPoint]
    predictions: list[PredictionPoint]
    # Hold-out manual (Paso 2) — empty when test_periods == 0
    test_actual: list[HistoricalPoint] = []
    test_predicted: list[PredictionPoint] = []
    train_end_date: str | None = None
    test_start_date: str | None = None
    # Rolling CV (Paso 3) — None when cv_folds == 0
    cv_summary: CvSummaryResponse | None = None
    cv_warning: str | None = None
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
            return str(data.get("status", "done"))
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
async def run_forecast(
    request: Request, body: ForecastRunRequest, user: OptionalUser = None
) -> ForecastRunResponse:
    """
    Lanza el forecast. En modo eager (dev) corre síncronamente y retorna
    job_id inmediatamente — el resultado ya está en Supabase al responder.

    Rate limit: 10 jobs por hora por IP+usuario.
    """
    ip = request.client.host if request.client else "unknown"
    # Clave compuesta: si hay usuario autenticado incluye su ID para mayor granularidad
    rl_key = f"{ip}:{user.user_id}" if user else ip
    rl = check_forecast_rate_limit(rl_key)
    if not rl.allowed:
        from fastapi.responses import JSONResponse

        return JSONResponse(  # type: ignore[return-value]
            status_code=429,
            content={
                "detail": f"Demasiados forecasts. Límite: 10 por hora. "
                f"Podés volver a intentar en {rl.reset_in // 60} minutos."
            },
            headers={"Retry-After": str(rl.reset_in)},
        )
    task = run_forecast_task.delay(
        dataset_id=body.dataset_id,
        date_column=body.date_column,
        target_column=body.target_column,
        freq=body.freq,
        horizon=body.horizon,
        model_override=body.model_override,
        user_id=str(user.user_id) if user else None,
        force_reoptimize=body.force_reoptimize,
        test_periods=body.test_periods,
        cv_folds=body.cv_folds,
        manual_params=body.manual_params,
        train_start_date=body.train_start_date,
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

    # Deserializar cv_summary si existe
    raw_cv = data.get("cv_summary")
    cv_summary_obj: CvSummaryResponse | None = None
    if raw_cv and isinstance(raw_cv, dict):
        cv_summary_obj = CvSummaryResponse(
            n_folds=int(raw_cv.get("n_folds", 0)),
            wape_mean=raw_cv.get("wape_mean"),
            wape_std=raw_cv.get("wape_std"),
            mae_mean=raw_cv.get("mae_mean"),
            mae_std=raw_cv.get("mae_std"),
            bias_mean=raw_cv.get("bias_mean"),
            folds=[CvFold(**f) for f in (raw_cv.get("folds") or [])],
        )

    return ForecastResultResponse(
        job_id=data["job_id"],
        status=data["status"],
        dataset_id=data["dataset_id"],
        model_used=data["model_used"],
        freq=data["freq"],
        horizon=data["horizon"],
        test_periods=data.get("test_periods", 0),
        cv_folds=data.get("cv_folds", 0),
        metrics=ForecastMetrics(**(data.get("metrics") or {})),
        model_params=data.get("model_params") or {},
        historical=[HistoricalPoint(**p) for p in (data.get("historical") or [])],
        predictions=[PredictionPoint(**p) for p in (data.get("predictions") or [])],
        test_actual=[HistoricalPoint(**p) for p in (data.get("test_actual") or [])],
        test_predicted=[PredictionPoint(**p) for p in (data.get("test_predicted") or [])],
        train_end_date=data.get("train_end_date"),
        test_start_date=data.get("test_start_date"),
        cv_summary=cv_summary_obj,
        cv_warning=data.get("cv_warning"),
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


# ── HPO Cache endpoints ───────────────────────────────────────────────────


class HpoCacheInfo(BaseModel):
    has_cache: bool
    wape: float | None = None
    n_trials: int | None = None
    optimized_at: str | None = None


@router.get("/hpo-cache/{dataset_id}", response_model=HpoCacheInfo)
async def get_hpo_cache_info(dataset_id: str, freq: str = "ME") -> HpoCacheInfo:
    """Retorna info del cache HPO para un dataset+freq. Usado por el frontend."""
    from app.services.supabase import get_hpo_cache

    cache = get_hpo_cache(dataset_id, freq)
    if not cache:
        return HpoCacheInfo(has_cache=False)
    return HpoCacheInfo(
        has_cache=True,
        wape=cache.get("wape"),
        n_trials=cache.get("n_trials"),
        optimized_at=str(cache.get("optimized_at", ""))[:16],  # solo fecha+hora
    )


@router.delete("/hpo-cache/{dataset_id}", status_code=204)
async def invalidate_hpo_cache(dataset_id: str, freq: str = "ME") -> None:
    """Invalida el cache HPO. El próximo forecast correrá Optuna desde cero."""
    from app.services.supabase import delete_hpo_cache

    delete_hpo_cache(dataset_id, freq)


# ── E7: Benchmark multi-modelo ────────────────────────────────────────────────


class BenchmarkRunRequest(BaseModel):
    dataset_id: str
    date_column: str
    target_column: str
    freq: str = "M"
    horizon: int = Field(default=12, ge=1, le=60)
    test_periods: int = Field(default=0, ge=0, le=24)
    # Modelos a correr. Si está vacío, se eligen automáticamente según disponibilidad.
    models: list[str] = []


class BenchmarkModelResult(BaseModel):
    model: str
    label: str
    wape: float | None = None
    mae: float | None = None
    bias: float | None = None
    rmse: float | None = None
    fva: float | None = None  # FVA vs Seasonal Naive (None para el Naive mismo)
    is_winner: bool = False  # True = menor WAPE entre los no-naive
    is_baseline: bool = False  # True = Seasonal Naive
    error: str | None = None  # Si el modelo falló al correr


class BenchmarkResult(BaseModel):
    dataset_id: str
    freq: str
    horizon: int
    n_obs: int
    test_periods: int
    models: list[BenchmarkModelResult]
    winner: str | None = None  # model id del ganador (menor WAPE)
    winner_label: str | None = None
    naive_wape: float | None = None  # WAPE del Seasonal Naive (denominador del FVA)
    conclusion: str = ""  # texto educativo automático
    run_at: str = ""


@router.post("/benchmark", response_model=BenchmarkResult)
async def run_benchmark(
    body: BenchmarkRunRequest,
) -> BenchmarkResult:
    """
    E7 — Benchmarking multi-modelo.

    Corre MA + HW + SARIMA + Seasonal Naive en paralelo (ThreadPoolExecutor)
    y retorna tabla comparativa con WAPE/MAE/BIAS/RMSE/FVA.

    Seasonal Naive siempre se incluye como baseline obligatorio.
    LightGBM se agrega si está disponible en el tier local.
    FVA = (WAPE_naive - WAPE_model) / WAPE_naive * 100 — positivo = el modelo mejora.

    Timeout por modelo: 90 segundos (SARIMA puede ser lento en series largas).
    """
    import concurrent.futures
    from datetime import datetime

    import pandas as pd

    from app.ml.models.base import ForecastModel as _ForecastModel
    from app.ml.models.holt_winters import HoltWintersModel
    from app.ml.models.moving_average import MovingAverageModel
    from app.ml.models.sarima import SarimaModel
    from app.ml.models.seasonal_naive import SeasonalNaiveModel
    from app.services.storage import load_dataset as _load_dataset

    # LightGBM solo en tier local
    _lgbm_cls: type | None = None
    try:
        from app.ml.models.lightgbm_model import LightGBMModel as _LgbmCls

        _lgbm_cls = _LgbmCls
    except ImportError:
        pass

    # Normalizar frecuencia (Pandas 2.2+)
    freq_alias = {"M": "ME", "Q": "QE", "A": "YE", "Y": "YE"}
    freq = freq_alias.get(body.freq, body.freq)

    # ── Cargar y preparar serie ──────────────────────────────────────────────
    try:
        df = _load_dataset(body.dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    df[body.date_column] = pd.to_datetime(df[body.date_column])
    df = df.sort_values(body.date_column).reset_index(drop=True)
    series = pd.to_numeric(df[body.target_column], errors="coerce")
    series = series.interpolate(method="linear").ffill().bfill()
    series.index = pd.DatetimeIndex(df[body.date_column])
    series = series.asfreq(freq, method="ffill")

    # Winsorización p5/p95
    p5 = float(series.quantile(0.05))
    p95 = float(series.quantile(0.95))
    series = series.clip(lower=p5, upper=p95)

    n = len(series)

    # ── Split train/test ─────────────────────────────────────────────────────
    if body.test_periods > 0:
        tp = min(body.test_periods, n - 4)
        split = n - tp
    else:
        split = max(int(n * 0.8), n - body.horizon)
        tp = n - split

    train = series.iloc[:split]
    test = series.iloc[split:]

    # ── Definir modelos a correr ─────────────────────────────────────────────
    model_labels: dict[str, str] = {
        "seasonal_naive": "Seasonal Naive (baseline)",
        "moving_average": "Promedio Móvil",
        "holt_winters": "Holt-Winters",
        "sarima": "SARIMA",
        "lightgbm": "LightGBM",
    }

    # Siempre incluir Naive + los modelos solicitados (o todos los disponibles si lista vacía)
    default_models = ["seasonal_naive", "moving_average", "holt_winters", "sarima"]
    if _lgbm_cls is not None:
        default_models.append("lightgbm")

    model_ids = body.models if body.models else default_models
    # Naive siempre presente aunque no esté en la lista
    if "seasonal_naive" not in model_ids:
        model_ids = ["seasonal_naive"] + model_ids

    def _build_model(model_id: str) -> _ForecastModel:
        """Instancia el modelo según su id."""
        if model_id == "seasonal_naive":
            return SeasonalNaiveModel()
        if model_id == "moving_average":
            return MovingAverageModel()
        if model_id == "holt_winters":
            return HoltWintersModel()
        if model_id == "sarima":
            return SarimaModel()
        if model_id == "lightgbm" and _lgbm_cls is not None:
            instance = _lgbm_cls(dataset_id=body.dataset_id, user_id=None, force_reoptimize=False)
            return cast(_ForecastModel, instance)
        raise ValueError(f"Modelo desconocido: {model_id}")

    def _run_one(model_id: str) -> BenchmarkModelResult:
        """
        Entrena y evalúa un modelo. Retorna BenchmarkModelResult.
        En caso de fallo: retorna el resultado con campo error completado.
        """
        try:
            model = _build_model(model_id)
            model.fit(train)
            metrics = model.evaluate(test) if len(test) > 0 else {}
            return BenchmarkModelResult(
                model=model_id,
                label=model_labels.get(model_id, model_id),
                wape=metrics.get("wape"),
                mae=metrics.get("mae"),
                bias=metrics.get("bias"),
                rmse=metrics.get("rmse"),
                is_baseline=(model_id == "seasonal_naive"),
            )
        except Exception as exc:  # noqa: BLE001
            return BenchmarkModelResult(
                model=model_id,
                label=model_labels.get(model_id, model_id),
                is_baseline=(model_id == "seasonal_naive"),
                error=str(exc)[:200],
            )

    # ── Ejecutar modelos en paralelo ─────────────────────────────────────────
    results: list[BenchmarkModelResult] = []
    timeout_secs = 90  # SARIMA puede ser lento en series largas

    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        future_map = {executor.submit(_run_one, mid): mid for mid in model_ids}
        for future in concurrent.futures.as_completed(
            future_map, timeout=timeout_secs * len(model_ids)
        ):
            try:
                results.append(future.result(timeout=timeout_secs))
            except concurrent.futures.TimeoutError:
                mid = future_map[future]
                results.append(
                    BenchmarkModelResult(
                        model=mid,
                        label=model_labels.get(mid, mid),
                        is_baseline=(mid == "seasonal_naive"),
                        error="Timeout — modelo demasiado lento para esta serie.",
                    )
                )

    # ── Calcular FVA ─────────────────────────────────────────────────────────
    naive_result = next((r for r in results if r.model == "seasonal_naive"), None)
    naive_wape = naive_result.wape if naive_result else None

    for r in results:
        if r.model == "seasonal_naive" or r.wape is None:
            r.fva = None
            continue
        if naive_wape and naive_wape > 0:
            r.fva = round((naive_wape - r.wape) / naive_wape * 100, 2)
        else:
            r.fva = None

    # ── Determinar ganador (menor WAPE entre los no-naive con éxito) ─────────
    candidates = [
        r for r in results if not r.is_baseline and r.wape is not None and r.error is None
    ]
    winner_result: BenchmarkModelResult | None = None
    if candidates:
        winner_result = min(candidates, key=lambda r: r.wape or float("inf"))
        winner_result.is_winner = True

    # Ordenar: Naive primero, luego por WAPE ascendente (None al final)
    results.sort(key=lambda r: (not r.is_baseline, r.wape if r.wape is not None else float("inf")))

    # ── Conclusión educativa automática ──────────────────────────────────────
    conclusion = ""
    if winner_result and winner_result.wape is not None:
        fva_str = ""
        if winner_result.fva is not None:
            fva_sign = "+" if winner_result.fva >= 0 else ""
            fva_str = f" Mejora del {fva_sign}{winner_result.fva:.1f}% sobre el Seasonal Naive."
        conclusion = (
            f"{winner_result.label} ganó con WAPE={winner_result.wape * 100:.1f}%.{fva_str}"
        )
        if winner_result.fva is not None and winner_result.fva < 0:
            conclusion += " ⚠️ FVA negativo: el modelo pierde contra el Naive. Considerá usar Seasonal Naive directamente."
        elif naive_wape and winner_result.wape and winner_result.wape < naive_wape:
            conclusion += " El modelo agrega valor real vs el baseline."
    elif naive_result and naive_result.wape is not None:
        conclusion = (
            f"Solo el Seasonal Naive completó con éxito. WAPE={naive_result.wape * 100:.1f}%."
        )

    return BenchmarkResult(
        dataset_id=body.dataset_id,
        freq=body.freq,
        horizon=body.horizon,
        n_obs=n,
        test_periods=tp,
        models=results,
        winner=winner_result.model if winner_result else None,
        winner_label=winner_result.label if winner_result else None,
        naive_wape=naive_wape,
        conclusion=conclusion,
        run_at=datetime.utcnow().isoformat(),
    )
