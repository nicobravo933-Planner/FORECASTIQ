"""
batch.py — API endpoints Fase 9 + MS-B1 + MS-B3: forecasting vectorizado multi-serie.

Endpoints:
  POST /api/batch/forecast               → batch Nixtla (inline records)
  POST /api/batch/forecast-dataset       → batch Nixtla desde dataset_id
  POST /api/batch/benchmark-dataset      → benchmark multi-modelo (MS-B1 + MS-B3)
  POST /api/batch/benchmark-export-xlsx  → export Excel 4 hojas (MS-EXP1)
"""

from __future__ import annotations

from typing import Annotated, Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.core.dependencies import OptionalUser, get_optional_user
from app.services.redis_cache import check_forecast_rate_limit

log = structlog.get_logger(__name__)

router = APIRouter(prefix="/api/batch", tags=["batch"])


# ── Schemas comunes ───────────────────────────────────────────────────────────


class BatchForecastRequest(BaseModel):
    records: list[dict[str, Any]] = Field(..., min_length=1)
    date_col: str = "ds"
    target_col: str = "y"
    id_col: str = "unique_id"
    cluster_abc_col: str | None = None
    cluster_xyz_col: str | None = None
    freq: str = Field(default="W", pattern="^(D|W|ME|M|QE|Q|YE|Y)$")
    horizon: int = Field(default=12, ge=1, le=365)


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


# ── /forecast (inline records) ────────────────────────────────────────────────


@router.post(
    "/forecast",
    response_model=BatchForecastResponse,
    summary="Batch multi-series forecast (Nixtla StatsForecast)",
)
async def batch_forecast(
    request: Request,
    body: BatchForecastRequest,
    current_user: Annotated[OptionalUser, Depends(get_optional_user)],
) -> BatchForecastResponse:
    client_ip = request.client.host if request.client else "unknown"
    user_id = current_user.user_id if current_user else None
    identifier = f"{client_ip}:{user_id or 'anon'}"
    rl = check_forecast_rate_limit(identifier)
    if not rl.allowed:
        raise HTTPException(
            429,
            detail=f"Límite alcanzado. Reintentá en {rl.reset_in}s.",
            headers={"Retry-After": str(rl.reset_in)},
        )
    if len(body.records) > 50_000:
        raise HTTPException(
            400, detail=f"Máximo 50.000 registros. Recibidos: {len(body.records):,}."
        )

    try:
        from app.services.nixtla_forecaster import run_batch_forecast

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
            500, detail="Error interno al ejecutar el forecast vectorizado."
        ) from exc

    return BatchForecastResponse(
        n_series=result["n_series"],
        horizon=result["horizon"],
        freq=result["freq"],
        model_used=result["model_used"],
        duration_s=result["duration_s"],
        predictions=[BatchPredictionPoint(**p) for p in result["predictions"]],
    )


# ── /forecast-dataset (desde dataset_id) ────────────────────────────────────


class BatchFromDatasetRequest(BaseModel):
    dataset_id: str
    date_col: str = "fecha"
    target_col: str = "ventas"
    id_col: str | None = None
    freq: str = Field(default="M", pattern="^(D|W|W-MON|ME|M|MS|QE|Q|QS|YE|Y)$")
    horizon: int = Field(default=12, ge=1, le=365)
    cluster_abc_col: str | None = None
    cluster_xyz_col: str | None = None
    model: str | None = Field(default=None)
    max_series: int | None = Field(default=None, ge=1)


@router.post(
    "/forecast-dataset",
    response_model=BatchForecastResponse,
    summary="Batch forecast desde dataset_id",
)
async def batch_forecast_from_dataset(
    request: Request,
    body: BatchFromDatasetRequest,
    current_user: Annotated[OptionalUser, Depends(get_optional_user)],
) -> BatchForecastResponse:
    import pandas as pd  # noqa: F401

    client_ip = request.client.host if request.client else "unknown"
    user_id = current_user.user_id if current_user else None
    identifier = f"{client_ip}:{user_id or 'anon'}"
    rl = check_forecast_rate_limit(identifier)
    if not rl.allowed:
        raise HTTPException(
            429,
            detail=f"Límite alcanzado. Reintentá en {rl.reset_in}s.",
            headers={"Retry-After": str(rl.reset_in)},
        )

    try:
        from app.services.storage import load_dataset

        df = load_dataset(body.dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, detail=f"Dataset '{body.dataset_id}' no encontrado.") from exc
    except Exception as exc:
        raise HTTPException(500, detail=f"Error al cargar el dataset: {exc}") from exc

    if df.empty:
        raise HTTPException(400, detail="El dataset está vacío.")

    for label, col in [("Fecha", body.date_col), ("Valor", body.target_col)]:
        if col not in df.columns:
            raise HTTPException(
                400,
                detail=f"Columna {label} '{col}' no encontrada. Disponibles: {list(df.columns)}",
            )

    if not body.id_col or body.id_col not in df.columns:
        df["__unique_id"] = "serie"
        id_col_eff = "__unique_id"
    else:
        id_col_eff = body.id_col

    freq_alias = {"M": "MS", "Q": "QS", "W": "W-MON"}
    freq_eff = freq_alias.get(body.freq, body.freq)

    if body.max_series and body.id_col and body.id_col in df.columns:
        unique_ids = df[body.id_col].unique()[: body.max_series]
        df = df[df[body.id_col].isin(unique_ids)]

    records: list[dict[str, Any]] = [
        {str(k): v for k, v in row.items()} for row in df.to_dict(orient="records")
    ]
    if len(records) > 50_000:
        raise HTTPException(
            400, detail=f"Máximo 50.000 registros. El dataset tiene {len(records):,}."
        )

    log.info(
        "batch_forecast_from_dataset",
        dataset_id=body.dataset_id,
        n_records=len(records),
        freq=freq_eff,
        horizon=body.horizon,
        model_requested=body.model or "AutoETS",
    )

    try:
        from app.services.nixtla_forecaster import run_batch_forecast

        result = run_batch_forecast(
            records=records,
            date_col=body.date_col,
            target_col=body.target_col,
            id_col=id_col_eff,
            cluster_abc_col=body.cluster_abc_col,
            cluster_xyz_col=body.cluster_xyz_col,
            freq=freq_eff,
            horizon=body.horizon,
        )
    except Exception as exc:
        log.error("batch_forecast_from_dataset_failed", error=str(exc))
        raise HTTPException(500, detail=f"Error al ejecutar el forecast: {exc}") from exc

    return BatchForecastResponse(
        n_series=result["n_series"],
        horizon=result["horizon"],
        freq=result["freq"],
        model_used=result["model_used"],
        duration_s=result["duration_s"],
        predictions=[BatchPredictionPoint(**p) for p in result["predictions"]],
    )


# ── Schemas benchmark (MS-B1) ─────────────────────────────────────────────────


class BenchmarkAccuracyRow(BaseModel):
    unique_id: str
    model: str
    wape: float
    bias: float
    score: float
    n_obs_test: int


class BestModelRow(BaseModel):
    unique_id: str
    best_model: str
    wape: float | None = None
    bias: float | None = None
    score: float | None = None


class ModelRankingRow(BaseModel):
    model: str
    wape_mean: float
    bias_mean: float
    n_wins: int


class BatchBenchmarkRequest(BaseModel):
    dataset_id: str
    date_col: str = "Fecha"
    target_col: str = "ventas"
    id_col: str
    freq: str = Field(default="MS", pattern="^(D|W|W-MON|ME|M|MS|QE|Q|QS|YE|Y)$")
    horizon: int = Field(default=12, ge=1, le=365)
    train_end: str = Field(..., description="ISO date, ej: '2024-12-31'")
    models: list[str] = Field(
        default=["SeasonalNaive", "AutoETS"],
        description="SeasonalNaive | AutoETS | AutoARIMA | LightGBM",
    )
    max_series: int | None = Field(default=None, ge=1)


class BatchBenchmarkResponse(BaseModel):
    n_series: int
    horizon: int
    freq: str
    duration_s: float
    train_end: str
    test_periods: int
    models_used: list[str]
    predictions: list[BatchPredictionPoint]
    accuracy: list[BenchmarkAccuracyRow]
    best_models: list[BestModelRow]
    model_ranking: list[ModelRankingRow]
    series_skipped: list[str]


# ── /benchmark-dataset (MS-B1 + MS-B3) ───────────────────────────────────────


@router.post(
    "/benchmark-dataset",
    response_model=BatchBenchmarkResponse,
    summary="Benchmark multi-modelo con train/test split (MS-B1 + MS-B3)",
)
async def batch_benchmark_from_dataset(
    request: Request,
    body: BatchBenchmarkRequest,
    current_user: Annotated[OptionalUser, Depends(get_optional_user)],
) -> BatchBenchmarkResponse:
    """MS-B1: benchmark estadístico vectorizado (Nixtla).
    MS-B3: si models=['LightGBM'], usa pipeline de lags dedicado."""
    from app.core.config import settings

    client_ip = request.client.host if request.client else "unknown"
    user_id = current_user.user_id if current_user else None
    identifier = f"{client_ip}:{user_id or 'anon'}"
    rl = check_forecast_rate_limit(identifier)
    if not rl.allowed:
        raise HTTPException(
            429,
            detail=f"Límite alcanzado. Reintentá en {rl.reset_in}s.",
            headers={"Retry-After": str(rl.reset_in)},
        )

    # Cargar dataset
    try:
        from app.services.storage import load_dataset

        df = load_dataset(body.dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(404, detail=f"Dataset '{body.dataset_id}' no encontrado.") from exc
    except Exception as exc:
        raise HTTPException(500, detail=f"Error al cargar el dataset: {exc}") from exc

    if df.empty:
        raise HTTPException(400, detail="El dataset está vacío.")

    for label, col in [
        ("Fecha", body.date_col),
        ("Valor", body.target_col),
        ("Entidad", body.id_col),
    ]:
        if col not in df.columns:
            raise HTTPException(
                400,
                detail=f"Columna {label} '{col}' no encontrada. Disponibles: {list(df.columns)}",
            )

    if body.max_series and body.max_series > 0:
        unique_ids = df[body.id_col].unique()[: body.max_series]
        df = df[df[body.id_col].isin(unique_ids)]

    df = df.rename(columns={body.date_col: "ds", body.target_col: "y", body.id_col: "unique_id"})
    df = df[["unique_id", "ds", "y"]].copy()

    freq_alias = {"M": "MS", "Q": "QS", "W": "W-MON"}
    freq_eff = freq_alias.get(body.freq, body.freq)

    # Restricciones por tier
    models_allowed = list(body.models)
    server_tier = getattr(settings, "server_tier", "local")
    if server_tier == "ec2":
        # AutoARIMA y LightGBM bloqueados en EC2
        models_allowed = [
            m for m in models_allowed if m not in ("AutoARIMA", "LightGBM", "lightgbm")
        ]
        if not models_allowed:
            models_allowed = ["SeasonalNaive", "AutoETS"]

    log.info(
        "batch_benchmark_request",
        dataset_id=body.dataset_id,
        n_records=len(df),
        freq=freq_eff,
        horizon=body.horizon,
        train_end=body.train_end,
        models=models_allowed,
    )

    # MS-B3: bifurcar si solo se pide LightGBM (pipeline dedicado con lags)
    lgbm_only = set(m.lower() for m in models_allowed) == {"lightgbm"}

    try:
        if lgbm_only:
            from app.services.nixtla_forecaster import run_batch_benchmark_lgbm

            result = run_batch_benchmark_lgbm(
                df=df,
                train_end=body.train_end,
                freq=freq_eff,
                horizon=body.horizon,
            )
        else:
            from app.services.nixtla_forecaster import run_batch_benchmark

            result = run_batch_benchmark(
                df=df,
                train_end=body.train_end,
                freq=freq_eff,
                horizon=body.horizon,
                models_to_run=models_allowed,
            )
    except ValueError as exc:
        raise HTTPException(400, detail=str(exc)) from exc
    except Exception as exc:
        log.error("batch_benchmark_failed", error=str(exc))
        raise HTTPException(500, detail=f"Error al ejecutar el benchmark: {exc}") from exc

    return BatchBenchmarkResponse(
        n_series=result["n_series"],
        horizon=result["horizon"],
        freq=result["freq"],
        duration_s=result["duration_s"],
        train_end=result["train_end"],
        test_periods=result["test_periods"],
        models_used=result["models_used"],
        predictions=[BatchPredictionPoint(**p) for p in result["predictions"]],
        accuracy=[BenchmarkAccuracyRow(**r) for r in result["accuracy"]],
        best_models=[BestModelRow(**r) for r in result["best_models"]],
        model_ranking=[ModelRankingRow(**r) for r in result["model_ranking"]],
        series_skipped=result["series_skipped"],
    )


# ── /benchmark-export-xlsx (MS-EXP1) ─────────────────────────────────────────


class MultiSerieBenchmarkExportRequest(BaseModel):
    n_series: int
    horizon: int
    freq: str
    duration_s: float
    train_end: str = ""
    test_periods: int = 0
    models_used: list[str] = []
    predictions: list[dict[str, Any]] = []
    accuracy: list[dict[str, Any]] = []
    best_models: list[dict[str, Any]] = []
    model_ranking: list[dict[str, Any]] = []
    series_skipped: list[str] = []


@router.post(
    "/benchmark-export-xlsx",
    summary="Export Excel multi-hoja del benchmark (MS-EXP1)",
    response_class=Response,
)
async def benchmark_export_xlsx(
    request: Request,
    body: MultiSerieBenchmarkExportRequest,
    current_user: Annotated[OptionalUser, Depends(get_optional_user)],
) -> Any:
    from fastapi.responses import StreamingResponse

    try:
        from app.services.forecast_exporter import generate_multi_serie_xlsx

        buf = generate_multi_serie_xlsx(body.model_dump())
    except Exception as exc:
        log.error("benchmark_export_xlsx_failed", error=str(exc))
        raise HTTPException(500, detail=f"Error al generar el Excel: {exc}") from exc

    filename = f"benchmark_multi_serie_{body.train_end or 'export'}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
