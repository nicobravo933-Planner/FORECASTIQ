"""
nixtla_forecaster.py — Scale Engine, Fase 9.

Pipeline vectorizado multi-serie usando StatsForecast (Nixtla).
Procesa N series en paralelo usando Numba/C internamente — n_jobs=-1.

Formato de entrada estándar Nixtla (panel):
    unique_id | ds         | y
    SKU-001   | 2024-01-01 | 120.5
    SKU-001   | 2024-01-08 | 98.0
    SKU-002   | 2024-01-01 | 45.0
    ...

Selección de modelo por segmento ABC-XYZ:
    A-X → AutoETS   (alto volumen, baja variabilidad)
    A-Z → AutoARIMA (alto volumen, alta variabilidad)
    B-* → AutoETS
    C-* → SeasonalNaive  (bajo volumen → baseline robusto)
    sin cluster → AutoETS por defecto

Uso:
    from app.services.nixtla_forecaster import run_batch_forecast
    results = run_batch_forecast(records, freq="W", horizon=12)
"""

from __future__ import annotations

import time
from typing import Any

import pandas as pd
import polars as pl
import structlog
from statsforecast import StatsForecast
from statsforecast.models import (
    AutoARIMA,
    AutoETS,
    SeasonalNaive,
)

log = structlog.get_logger(__name__)

# Mínimo de observaciones para entrenar un modelo
_MIN_OBS = 4


def _season_length(freq: str) -> int:
    """Retorna el período estacional más común para cada frecuencia."""
    mapping: dict[str, int] = {
        "D": 7,  # ciclo semanal
        "W": 52,  # ciclo anual en semanas
        "M": 12,  # ciclo anual en meses
        "ME": 12,
        "Q": 4,  # ciclo anual en trimestres
        "QE": 4,
        "Y": 1,
        "YE": 1,
    }
    return mapping.get(freq, 1)


def _build_panel(
    records: list[dict[str, Any]],
    date_col: str,
    target_col: str,
    id_col: str,
) -> pl.DataFrame:
    """
    Convierte registros de entrada al formato panel Nixtla usando Polars.
    Más rápido que pandas para >10k filas (columnar, zero-copy).

    Returns:
        DataFrame con columnas [unique_id, ds, y] + columnas extras que existan.
    """
    df = pl.from_dicts(records)

    rename_map: dict[str, str] = {}
    if id_col != "unique_id":
        rename_map[id_col] = "unique_id"
    if date_col != "ds":
        rename_map[date_col] = "ds"
    if target_col != "y":
        rename_map[target_col] = "y"

    if rename_map:
        df = df.rename(rename_map)

    # Tipos estrictos que exige StatsForecast
    df = df.with_columns(
        [
            pl.col("unique_id").cast(pl.Utf8),
            pl.col("ds").cast(pl.Utf8).str.to_datetime(strict=False),
            pl.col("y").cast(pl.Float64),
        ]
    )

    # StatsForecast requiere orden por serie y fecha
    return df.sort(["unique_id", "ds"])


def _filter_min_obs(panel: pl.DataFrame, min_obs: int) -> pl.DataFrame:
    """Descarta series con menos de min_obs observaciones (no entrenables)."""
    counts = panel.group_by("unique_id").agg(pl.len().alias("n_obs"))
    valid_ids = counts.filter(pl.col("n_obs") >= min_obs).select("unique_id")
    filtered = panel.join(valid_ids, on="unique_id", how="inner")

    dropped = panel["unique_id"].n_unique() - filtered["unique_id"].n_unique()
    if dropped > 0:
        log.warning("nixtla_series_dropped", reason="min_obs", dropped=dropped, threshold=min_obs)

    return filtered


def _model_for_segment(cluster_key: str, season_len: int) -> Any:
    """Retorna instancia del modelo apropiado para el segmento ABC-XYZ."""
    if cluster_key in ("A-Z", "B-Z"):
        return AutoARIMA()
    if cluster_key.startswith("C"):
        return SeasonalNaive(season_length=season_len)
    return AutoETS(season_length=season_len)


def _statsforecast_run(
    panel_pd: pd.DataFrame,
    model: Any,
    horizon: int,
    freq: str,
    season_len: int,
) -> pd.DataFrame:
    """
    Corre StatsForecast sobre un panel pandas ya limpio.
    fallback_model: SeasonalNaive por si el modelo principal falla en alguna serie.
    """
    sf = StatsForecast(
        models=[model],
        freq=freq,
        n_jobs=-1,
        fallback_model=SeasonalNaive(season_length=season_len),
    )
    result: pd.DataFrame = sf.forecast(df=panel_pd, h=horizon).reset_index()
    return result


def run_batch_forecast(
    records: list[dict[str, Any]],
    *,
    date_col: str = "ds",
    target_col: str = "y",
    id_col: str = "unique_id",
    cluster_abc_col: str | None = "cluster_abc",
    cluster_xyz_col: str | None = "cluster_xyz",
    freq: str = "W",
    horizon: int = 12,
) -> dict[str, Any]:
    """
    Pipeline principal: N series → forecast vectorizado → lista de predicciones.

    Args:
        records:         lista de dicts (panel de datos — puede venir de DuckDB/Supabase)
        date_col:        columna de fecha en los records
        target_col:      columna del valor a pronosticar
        id_col:          columna identificadora de cada serie
        cluster_abc_col: columna A/B/C (opcional — activa selección por segmento)
        cluster_xyz_col: columna X/Y/Z (opcional — activa selección por segmento)
        freq:            frecuencia pandas: 'D' | 'W' | 'ME' | 'QE'
        horizon:         períodos a pronosticar

    Returns:
        {
          "n_series":    int,
          "horizon":     int,
          "freq":        str,
          "model_used":  str,
          "duration_s":  float,
          "predictions": [{"unique_id": str, "ds": str, "predicted": float}, ...]
        }
    """
    t0 = time.perf_counter()
    season_len = _season_length(freq)

    log.info("nixtla_batch_start", n_records=len(records), freq=freq, horizon=horizon)

    # 1. Panel Polars — transformación columnar eficiente
    panel_pl = _build_panel(records, date_col, target_col, id_col)

    # 2. Descartar series con pocas observaciones
    panel_pl = _filter_min_obs(panel_pl, _MIN_OBS)

    n_series = panel_pl["unique_id"].n_unique()
    if n_series == 0:
        log.warning("nixtla_no_valid_series")
        return {
            "n_series": 0,
            "horizon": horizon,
            "freq": freq,
            "model_used": "none",
            "duration_s": 0.0,
            "predictions": [],
        }

    # 3. Decidir estrategia: segmentada por cluster vs. modelo único
    has_clusters = (
        cluster_abc_col is not None
        and cluster_xyz_col is not None
        and cluster_abc_col in panel_pl.columns
        and cluster_xyz_col in panel_pl.columns
    )

    if not has_clusters:
        # Un solo modelo para todas las series
        model = AutoETS(season_length=season_len)
        panel_pd = panel_pl.select(["unique_id", "ds", "y"]).to_pandas()
        forecast_pd = _statsforecast_run(panel_pd, model, horizon, freq, season_len)
        model_name = "AutoETS"

    else:
        # Segmentado: un modelo distinto por cluster ABC-XYZ
        # Narrowing explícito: has_clusters garantiza que no son None, pero mypy
        # no lo infiere a través del bloque — variables locales str resuelven esto.
        abc_col: str = cluster_abc_col  # type: ignore[assignment]
        xyz_col: str = cluster_xyz_col  # type: ignore[assignment]

        cluster_label = pl.concat_str([pl.col(abc_col), pl.col(xyz_col)], separator="-").alias(
            "_cluster"
        )
        panel_pl = panel_pl.with_columns(cluster_label)

        # Tabla única_id → cluster (para hacer join sin duplicar filas)
        id_cluster = panel_pl.select(["unique_id", "_cluster"]).unique("unique_id")
        panel_pl = panel_pl.join(id_cluster, on="unique_id", how="left")

        # drop_nulls: Polars incluye None en to_list() si hay filas sin cluster
        segments: list[str] = [s for s in panel_pl["_cluster"].unique().to_list() if s is not None]
        parts: list[pd.DataFrame] = []

        for seg in segments:
            seg_pl = panel_pl.filter(pl.col("_cluster") == pl.lit(seg))
            seg_pd = seg_pl.select(["unique_id", "ds", "y"]).to_pandas()
            seg_model = _model_for_segment(str(seg), season_len)
            try:
                parts.append(_statsforecast_run(seg_pd, seg_model, horizon, freq, season_len))
            except Exception as exc:
                log.warning("nixtla_segment_failed", segment=seg, error=str(exc))

        if not parts:
            return {
                "n_series": n_series,
                "horizon": horizon,
                "freq": freq,
                "model_used": "none",
                "duration_s": 0.0,
                "predictions": [],
            }

        forecast_pd = pd.concat(parts, ignore_index=True)
        model_name = "AutoETS+AutoARIMA+SeasonalNaive (ABC-XYZ)"

    # 4. Normalizar nombre de columna de predicción (StatsForecast usa el nombre del modelo)
    pred_cols = [c for c in forecast_pd.columns if c not in ("unique_id", "ds")]
    if not pred_cols:
        return {
            "n_series": n_series,
            "horizon": horizon,
            "freq": freq,
            "model_used": model_name,
            "duration_s": 0.0,
            "predictions": [],
        }

    forecast_pd = forecast_pd.rename(columns={pred_cols[0]: "predicted"})
    # Clampear negativos — demanda nunca puede ser < 0
    forecast_pd["predicted"] = forecast_pd["predicted"].clip(lower=0).round(4)
    forecast_pd["ds"] = forecast_pd["ds"].astype(str)

    duration = round(time.perf_counter() - t0, 3)
    log.info(
        "nixtla_batch_done",
        n_series=n_series,
        horizon=horizon,
        duration_s=duration,
        model=model_name,
    )

    return {
        "n_series": n_series,
        "horizon": horizon,
        "freq": freq,
        "model_used": model_name,
        "duration_s": duration,
        "predictions": (forecast_pd[["unique_id", "ds", "predicted"]].to_dict(orient="records")),
    }
