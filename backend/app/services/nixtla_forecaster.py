"""
nixtla_forecaster.py — Scale Engine, Fase 9 + MS-B1.

Pipeline vectorizado multi-serie usando StatsForecast (Nixtla).
Procesa N series en paralelo usando Numba/C internamente — n_jobs=-1.

Formato de entrada estándar Nixtla (panel):
    unique_id | ds         | y
    SKU-001   | 2024-01-01 | 120.5
    SKU-001   | 2024-01-08 | 98.0
    SKU-002   | 2024-01-01 | 45.0
    ...

Dos modos de operación:
  run_batch_forecast()   → modelo único, sin hold-out (modo rápido original)
  run_batch_benchmark()  → N modelos + train/test split + WAPE real + modelo ganador por entidad

Selección de modelo por segmento ABC-XYZ (solo en run_batch_forecast):
    A-X → AutoETS, A-Z → AutoARIMA, C-* → SeasonalNaive, resto → AutoETS
"""

from __future__ import annotations

import time
from typing import Any

import numpy as np
import pandas as pd
import structlog

log = structlog.get_logger(__name__)

# Mínimo de observaciones para entrenar un modelo
_MIN_OBS = 4

# Mínimo de observaciones en test para calcular WAPE confiable
_MIN_TEST_OBS = 3


def _check_heavy_deps() -> None:
    """Lanza ImportError descriptivo si las deps heavy-ml no están instaladas."""
    try:
        import polars  # noqa: F401
        import statsforecast  # noqa: F401
    except ImportError as exc:
        raise ImportError(
            "nixtla_forecaster requiere el grupo heavy-ml. Instalá con: uv sync --group heavy-ml"
        ) from exc


def _season_length(freq: str) -> int:
    """Retorna el período estacional más común para cada frecuencia."""
    mapping: dict[str, int] = {
        "D": 7,
        "W": 52,
        "M": 12,
        "MS": 12,
        "ME": 12,
        "Q": 4,
        "QS": 4,
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
) -> Any:  # polars.DataFrame
    """
    Convierte registros de entrada al formato panel Nixtla usando Polars.
    Más rápido que pandas para >10k filas (columnar, zero-copy).
    """
    import polars as pl

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

    return df.sort(["unique_id", "ds"])


def _filter_min_obs(panel: Any, min_obs: int) -> Any:  # polars.DataFrame
    """Descarta series con menos de min_obs observaciones (no entrenables)."""
    import polars as pl

    counts = panel.group_by("unique_id").agg(pl.len().alias("n_obs"))
    valid_ids = counts.filter(pl.col("n_obs") >= min_obs).select("unique_id")
    filtered = panel.join(valid_ids, on="unique_id", how="inner")

    dropped = panel["unique_id"].n_unique() - filtered["unique_id"].n_unique()
    if dropped > 0:
        log.warning("nixtla_series_dropped", reason="min_obs", dropped=dropped, threshold=min_obs)

    return filtered


def _model_for_segment(cluster_key: str, season_len: int) -> Any:
    """Retorna instancia del modelo apropiado para el segmento ABC-XYZ."""
    from statsforecast.models import AutoARIMA, AutoETS, SeasonalNaive

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
    """Corre StatsForecast con un modelo sobre un panel pandas ya limpio."""
    from statsforecast import StatsForecast
    from statsforecast.models import SeasonalNaive

    sf = StatsForecast(
        models=[model],
        freq=freq,
        n_jobs=-1,
        fallback_model=SeasonalNaive(season_length=season_len),
    )
    result: pd.DataFrame = sf.forecast(df=panel_pd, h=horizon).reset_index()
    return result


def _statsforecast_run_multi(
    panel_pd: pd.DataFrame,
    models: list[Any],
    horizon: int,
    freq: str,
    season_len: int,
) -> pd.DataFrame:
    """
    Corre StatsForecast con MÚLTIPLES modelos en un solo pass.
    StatsForecast paraleliza internamente todos los modelos × todas las series.
    Retorna DataFrame con columnas: unique_id, ds, ModelName1, ModelName2, ...
    """
    from statsforecast import StatsForecast
    from statsforecast.models import SeasonalNaive

    sf = StatsForecast(
        models=models,
        freq=freq,
        n_jobs=-1,
        fallback_model=SeasonalNaive(season_length=season_len),
    )
    result: pd.DataFrame = sf.forecast(df=panel_pd, h=horizon).reset_index()
    return result


def _calc_wape(real: pd.Series, predicted: pd.Series) -> float:
    """
    WAPE = sum(|real - pred|) / sum(|real|).
    Robusto a ceros: si sum(|real|) == 0 retorna 1.0 (100% error).
    """
    denom = real.abs().sum()
    if denom == 0:
        return 1.0
    return float((real - predicted).abs().sum() / denom)


def _calc_bias(real: pd.Series, predicted: pd.Series) -> float:
    """
    BIAS = (sum(pred) - sum(real)) / sum(real) * 100.
    Positivo = sobreestimación, negativo = subestimación.
    """
    denom = real.sum()
    if denom == 0:
        return 0.0
    return float((predicted.sum() - real.sum()) / denom * 100)


def _winner_score(wape: float, bias: float) -> float:
    """
    Score para elegir modelo ganador.
    Mismo criterio que el Streamlit de referencia:
      score = WAPE + penalidad si |BIAS| > 10%
    Menor es mejor.
    """
    bias_penalty = max(0.0, abs(bias) - 10.0) * 0.5
    return wape + bias_penalty / 100.0  # WAPE ya está en [0,1]; BIAS en %


# ─────────────────────────────────────────────────────────────────────────────
# Función original — modo rápido sin hold-out (compatible con código existente)
# ─────────────────────────────────────────────────────────────────────────────


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
    Pipeline rápido: modelo único sobre todos los datos → forecast futuro.
    Sin train/test split — para exploración inicial o cuando no se necesitan métricas.

    Returns dict con keys: n_series, horizon, freq, model_used, duration_s, predictions
    """
    t0 = time.perf_counter()
    season_len = _season_length(freq)

    _check_heavy_deps()
    import polars as pl
    from statsforecast.models import AutoETS

    log.info("nixtla_batch_start", n_records=len(records), freq=freq, horizon=horizon)

    panel_pl = _build_panel(records, date_col, target_col, id_col)
    panel_pl = _filter_min_obs(panel_pl, _MIN_OBS)

    n_series = panel_pl["unique_id"].n_unique()
    if n_series == 0:
        return {
            "n_series": 0,
            "horizon": horizon,
            "freq": freq,
            "model_used": "none",
            "duration_s": 0.0,
            "predictions": [],
        }

    has_clusters = (
        cluster_abc_col is not None
        and cluster_xyz_col is not None
        and cluster_abc_col in panel_pl.columns
        and cluster_xyz_col in panel_pl.columns
    )

    if not has_clusters:
        model = AutoETS(season_length=season_len)
        panel_pd = panel_pl.select(["unique_id", "ds", "y"]).to_pandas()
        forecast_pd = _statsforecast_run(panel_pd, model, horizon, freq, season_len)
        model_name = "AutoETS"
    else:
        abc_col: str = cluster_abc_col  # type: ignore[assignment]
        xyz_col: str = cluster_xyz_col  # type: ignore[assignment]

        cluster_label = pl.concat_str([pl.col(abc_col), pl.col(xyz_col)], separator="-").alias(
            "_cluster"
        )
        panel_pl = panel_pl.with_columns(cluster_label)
        id_cluster = panel_pl.select(["unique_id", "_cluster"]).unique("unique_id")
        panel_pl = panel_pl.join(id_cluster, on="unique_id", how="left")

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
        "predictions": forecast_pd[["unique_id", "ds", "predicted"]].to_dict(orient="records"),
    }


# ─────────────────────────────────────────────────────────────────────────────
# MS-B1: Benchmark con train/test split — modelo ganador por entidad
# ─────────────────────────────────────────────────────────────────────────────


def run_batch_benchmark(
    df: pd.DataFrame,
    *,
    train_end: str,
    freq: str = "MS",
    horizon: int = 12,
    models_to_run: list[str] | None = None,
) -> dict[str, Any]:
    """
    Pipeline de benchmarking multi-modelo con train/test split.

    Flujo:
      1. Cortar el panel en train (≤ train_end) y test (> train_end)
      2. Correr todos los modelos sobre train con StatsForecast (un solo pass vectorizado)
      3. Predecir horizonte = len(test) sobre el panel train
      4. Calcular WAPE/BIAS por entidad por modelo
      5. Elegir modelo ganador por entidad (score = WAPE + penalidad BIAS)
      6. Re-entrenar el ganador de cada entidad sobre train+test → forecast futuro real
      7. Retornar métricas de accuracy + predicciones futuras + ranking global

    Args:
        df:             DataFrame con columnas [unique_id, ds, y] (panel ya normalizado)
        train_end:      Fecha de corte del train en formato ISO, ej: "2024-12-31"
        freq:           Frecuencia pandas: "MS" | "W-MON" | "QS" | "D"
        horizon:        Períodos futuros a pronosticar (después del test)
        models_to_run:  Lista de nombres de modelos: ["SeasonalNaive", "AutoETS", "AutoARIMA"]
                        Si None → usa todos los disponibles según tier.

    Returns dict con keys:
        n_series         int
        horizon          int
        freq             str
        duration_s       float
        train_end        str
        test_periods     int   — cuántos períodos tiene el test real
        predictions      list[{unique_id, ds, predicted}]  — forecast futuro real
        accuracy         list[{unique_id, model, wape, bias, n_obs_test}]
        best_models      list[{unique_id, best_model, wape, bias, score}]
        model_ranking    list[{model, wape_mean, bias_mean, n_wins}]
        series_skipped   list[str]  — entidades con datos insuficientes
    """
    t0 = time.perf_counter()
    _check_heavy_deps()

    from statsforecast.models import AutoARIMA, AutoETS, SeasonalNaive

    season_len = _season_length(freq)

    # Modelos disponibles según el parámetro
    # En EC2 AutoARIMA está bloqueado (se maneja desde el endpoint, no acá)
    _ALL_MODELS = {  # noqa: N806
        "SeasonalNaive": SeasonalNaive(season_length=season_len),
        "AutoETS": AutoETS(season_length=season_len),
        "AutoARIMA": AutoARIMA(),
    }

    if models_to_run is None:
        models_to_run = ["SeasonalNaive", "AutoETS", "AutoARIMA"]

    # Filtrar solo modelos válidos
    active_model_names = [m for m in models_to_run if m in _ALL_MODELS]
    if not active_model_names:
        raise ValueError(f"Ningún modelo válido en {models_to_run}. Opciones: {list(_ALL_MODELS)}")

    # Reconstruir instancias frescas (evitar estado compartido entre entidades)
    def _fresh_models() -> list[Any]:
        return [
            SeasonalNaive(season_length=season_len)
            if n == "SeasonalNaive"
            else AutoETS(season_length=season_len)
            if n == "AutoETS"
            else AutoARIMA()
            for n in active_model_names
        ]

    log.info(
        "nixtla_benchmark_start",
        n_records=len(df),
        freq=freq,
        horizon=horizon,
        train_end=train_end,
        models=active_model_names,
    )

    # ── 1. Validar y parsear fecha de corte ───────────────────────────────────
    train_end_ts = pd.Timestamp(train_end)

    # ── 2. Asegurar tipos correctos en el panel ───────────────────────────────
    df = df.copy()
    df["ds"] = pd.to_datetime(df["ds"], errors="coerce")
    df["y"] = pd.to_numeric(df["y"], errors="coerce").fillna(0).clip(lower=0)
    df = df.dropna(subset=["ds"])
    df = df.sort_values(["unique_id", "ds"])

    # ── 3. Split train / test ─────────────────────────────────────────────────
    train_df = df[df["ds"] <= train_end_ts].copy()
    test_df = df[df["ds"] > train_end_ts].copy()

    if train_df.empty:
        raise ValueError(
            f"No hay datos de train antes de {train_end}. "
            "Verificá que train_end sea anterior a los datos disponibles."
        )

    # Períodos de test inferidos del dataset (puede ser 0 si train_end está al final)
    test_periods_global = int(test_df["ds"].nunique()) if not test_df.empty else 0

    # ── 4. Filtrar series con suficientes observaciones de train ──────────────
    min_obs_train = max(_MIN_OBS, season_len + 1)  # al menos 1 ciclo completo
    train_counts = train_df.groupby("unique_id")["ds"].count()
    valid_ids = train_counts[train_counts >= min_obs_train].index.tolist()
    skipped = [uid for uid in df["unique_id"].unique() if uid not in valid_ids]

    if skipped:
        log.warning("nixtla_benchmark_series_skipped", n=len(skipped), reason="insufficient_train")

    train_valid = train_df[train_df["unique_id"].isin(valid_ids)].copy()
    n_series = len(valid_ids)

    if n_series == 0:
        raise ValueError(
            f"Todas las series tienen menos de {min_obs_train} observaciones de train. "
            f"Mové train_end a una fecha más tardía."
        )

    # ── 5. Benchmark sobre test (si hay test real) ────────────────────────────
    accuracy_rows: list[dict[str, Any]] = []
    best_model_per_entity: dict[str, str] = {}

    if test_periods_global >= _MIN_TEST_OBS:
        test_valid = test_df[test_df["unique_id"].isin(valid_ids)].copy()

        # StatsForecast requiere el panel en formato {unique_id, ds, y}
        train_panel = train_valid[["unique_id", "ds", "y"]].copy()
        train_panel["ds"] = (
            train_panel["ds"].dt.to_period(_freq_to_period_alias(freq)).dt.to_timestamp()
        )

        # Horizonte = número de períodos en el test (igual para todas las series)
        # Usamos el máximo de períodos disponibles por entidad en test
        test_horizon_per_entity = test_valid.groupby("unique_id")["ds"].count().to_dict()
        # Para el forecast multi-modelo usamos el horizonte máximo
        benchmark_horizon = max(test_horizon_per_entity.values()) if test_horizon_per_entity else 1

        try:
            forecast_test_pd = _statsforecast_run_multi(
                panel_pd=train_panel,
                models=_fresh_models(),
                horizon=benchmark_horizon,
                freq=freq,
                season_len=season_len,
            )
        except Exception as exc:
            log.error("nixtla_benchmark_forecast_test_failed", error=str(exc))
            # Fallback: sin métricas, solo forecast futuro
            forecast_test_pd = pd.DataFrame()

        if not forecast_test_pd.empty:
            # Normalizar fechas del forecast a timestamp de inicio de período
            forecast_test_pd["ds"] = pd.to_datetime(forecast_test_pd["ds"])

            # Normalizar fechas del test de la misma forma
            test_valid = test_valid.copy()
            test_valid["ds"] = (
                test_valid["ds"].dt.to_period(_freq_to_period_alias(freq)).dt.to_timestamp()
            )

            # Calcular WAPE/BIAS por entidad × modelo
            model_cols = [c for c in forecast_test_pd.columns if c not in ("unique_id", "ds")]

            for uid in valid_ids:
                uid_test = test_valid[test_valid["unique_id"] == uid].set_index("ds")["y"]
                uid_fcst = forecast_test_pd[forecast_test_pd["unique_id"] == uid].set_index("ds")

                if uid_test.empty or uid_fcst.empty:
                    continue

                # Alinear por fecha (el test puede tener más períodos que el forecast)
                common_dates = uid_test.index.intersection(uid_fcst.index)
                if len(common_dates) < _MIN_TEST_OBS:
                    continue

                real_aligned = uid_test.loc[common_dates]
                best_score_uid = float("inf")
                best_model_uid = active_model_names[0]

                for model_col in model_cols:
                    pred_series = uid_fcst.loc[common_dates, model_col]
                    wape = _calc_wape(real_aligned, pred_series)
                    bias = _calc_bias(real_aligned, pred_series)
                    score = _winner_score(wape, bias)

                    accuracy_rows.append(
                        {
                            "unique_id": uid,
                            "model": model_col,
                            "wape": round(wape, 4),
                            "bias": round(bias, 2),
                            "score": round(score, 4),
                            "n_obs_test": len(common_dates),
                        }
                    )

                    if score < best_score_uid:
                        best_score_uid = score
                        best_model_uid = model_col

                best_model_per_entity[uid] = best_model_uid

            log.info(
                "nixtla_benchmark_accuracy_done",
                n_series_evaluated=len(best_model_per_entity),
                n_accuracy_rows=len(accuracy_rows),
            )

        # Construir test_vs_real usando el modelo ganador de cada entidad
        # Se usa despues del loop para respetar best_model_per_entity ya completo
        test_vs_real_rows: list[dict[str, Any]] = []
        if not forecast_test_pd.empty:
            for uid in valid_ids:
                best_m = best_model_per_entity.get(uid)
                if best_m is None or best_m not in forecast_test_pd.columns:
                    continue
                uid_test_r = test_valid[test_valid["unique_id"] == uid].set_index("ds")["y"]
                uid_fcst_r = forecast_test_pd[forecast_test_pd["unique_id"] == uid].set_index("ds")
                common_d = uid_test_r.index.intersection(uid_fcst_r.index)
                if len(common_d) < _MIN_TEST_OBS:
                    continue
                sum_real_uid = float(uid_test_r.loc[common_d].abs().sum()) or 1.0
                bias_acum_uid = 0.0
                for date in sorted(common_d):
                    real_val = float(uid_test_r.loc[date])
                    pred_val = float(uid_fcst_r.loc[date, best_m])
                    err_pct = (
                        round((pred_val - real_val) / abs(real_val) * 100, 2)
                        if real_val != 0
                        else None
                    )
                    bias_acum_uid += (pred_val - real_val) / sum_real_uid * 100
                    test_vs_real_rows.append(
                        {
                            "unique_id": uid,
                            "ds": str(date.date()),
                            "real": round(real_val, 4),
                            "predicted": round(pred_val, 4),
                            "error_pct": err_pct,
                            "bias_acum_pct": round(bias_acum_uid, 2),
                        }
                    )

    # Para entidades sin test suficiente → usar AutoETS como ganador default
    for uid in valid_ids:
        if uid not in best_model_per_entity:
            best_model_per_entity[uid] = "AutoETS"

    # ── 6. Re-entrenar el ganador de cada entidad sobre train+test → forecast futuro ──
    # Agrupar entidades por modelo ganador para hacer el forecast vectorizado por lotes
    from collections import defaultdict

    groups: dict[str, list[str]] = defaultdict(list)
    for uid, model_name in best_model_per_entity.items():
        groups[model_name].append(uid)

    all_future_predictions: list[dict[str, Any]] = []

    # Panel completo (train + test) para re-entrenamiento
    full_panel = df[df["unique_id"].isin(valid_ids)].copy()
    full_panel["ds"] = full_panel["ds"].dt.to_period(_freq_to_period_alias(freq)).dt.to_timestamp()
    full_panel = full_panel.sort_values(["unique_id", "ds"])

    for model_name, uids in groups.items():
        group_panel = full_panel[full_panel["unique_id"].isin(uids)][
            ["unique_id", "ds", "y"]
        ].copy()

        if group_panel.empty:
            continue

        # Instancia fresca del modelo ganador
        if model_name == "SeasonalNaive":
            winner_model = SeasonalNaive(season_length=season_len)
        elif model_name == "AutoARIMA":
            winner_model = AutoARIMA()
        else:
            winner_model = AutoETS(season_length=season_len)

        try:
            future_pd = _statsforecast_run(
                panel_pd=group_panel,
                model=winner_model,
                horizon=horizon,
                freq=freq,
                season_len=season_len,
            )

            pred_col = [c for c in future_pd.columns if c not in ("unique_id", "ds")]
            if pred_col:
                future_pd = future_pd.rename(columns={pred_col[0]: "predicted"})
                future_pd["predicted"] = future_pd["predicted"].clip(lower=0).round(4)
                future_pd["ds"] = future_pd["ds"].astype(str)
                all_future_predictions.extend(
                    [
                        {str(k): v for k, v in row.items()}
                        for row in future_pd[["unique_id", "ds", "predicted"]].to_dict(
                            orient="records"
                        )
                    ]
                )

        except Exception as exc:
            log.warning(
                "nixtla_benchmark_future_failed", model=model_name, n_uids=len(uids), error=str(exc)
            )

    # ── 7. Ranking global de modelos ──────────────────────────────────────────
    model_ranking: list[dict[str, Any]] = []
    if accuracy_rows:
        acc_df = pd.DataFrame(accuracy_rows)
        for model_name in active_model_names:
            model_rows = acc_df[acc_df["model"] == model_name]
            if model_rows.empty:
                continue
            wins = sum(1 for uid, m in best_model_per_entity.items() if m == model_name)
            model_ranking.append(
                {
                    "model": model_name,
                    "wape_mean": round(float(model_rows["wape"].mean()), 4),
                    "bias_mean": round(float(model_rows["bias"].mean()), 2),
                    "n_wins": wins,
                }
            )
        model_ranking.sort(key=lambda r: r["wape_mean"])

    # ── 8. best_models list para el frontend ─────────────────────────────────
    best_models_list: list[dict[str, Any]] = []
    if accuracy_rows:
        acc_df = pd.DataFrame(accuracy_rows)
        for uid in valid_ids:
            uid_rows = acc_df[acc_df["unique_id"] == uid]
            best_m = best_model_per_entity.get(uid, "AutoETS")
            best_row = uid_rows[uid_rows["model"] == best_m]
            if not best_row.empty:
                r = best_row.iloc[0]
                best_models_list.append(
                    {
                        "unique_id": uid,
                        "best_model": best_m,
                        "wape": round(float(r["wape"]), 4),
                        "bias": round(float(r["bias"]), 2),
                        "score": round(float(r["score"]), 4),
                    }
                )
            else:
                best_models_list.append(
                    {
                        "unique_id": uid,
                        "best_model": best_m,
                        "wape": None,
                        "bias": None,
                        "score": None,
                    }
                )
    else:
        # Sin test → solo el modelo default
        for uid in valid_ids:
            best_models_list.append(
                {
                    "unique_id": uid,
                    "best_model": best_model_per_entity.get(uid, "AutoETS"),
                    "wape": None,
                    "bias": None,
                    "score": None,
                }
            )

    duration = round(time.perf_counter() - t0, 3)
    log.info(
        "nixtla_benchmark_done",
        n_series=n_series,
        horizon=horizon,
        test_periods=test_periods_global,
        duration_s=duration,
        n_predictions=len(all_future_predictions),
    )

    # test_vs_real_rows se construye dentro del bloque test_periods_global >= _MIN_TEST_OBS
    # Si el bloque no se ejecuto, la variable puede no existir
    if "test_vs_real_rows" not in dir():
        test_vs_real_rows = []

    return {
        "n_series": n_series,
        "horizon": horizon,
        "freq": freq,
        "duration_s": duration,
        "train_end": train_end,
        "test_periods": test_periods_global,
        "models_used": active_model_names,
        "predictions": all_future_predictions,
        "accuracy": accuracy_rows,
        "best_models": best_models_list,
        "model_ranking": model_ranking,
        "series_skipped": skipped,
        "test_vs_real": test_vs_real_rows,
    }


def _freq_to_period_alias(freq: str) -> str:
    """
    Convierte alias de frecuencia pandas a alias de Period.
    Necesario para truncar fechas al inicio del período antes del merge.
    """
    mapping = {
        "MS": "M",
        "M": "M",
        "ME": "M",
        "QS": "Q",
        "Q": "Q",
        "QE": "Q",
        "W-MON": "W",
        "W": "W",
        "D": "D",
        "YS": "Y",
        "Y": "Y",
        "YE": "Y",
    }
    return mapping.get(freq, "M")


# ───────────────────────────────────────────────────────────────────
# MS-B3: LightGBM vectorizado multi-serie (sin Optuna, features del Streamlit)
# ───────────────────────────────────────────────────────────────────

_LGBM_FEATURE_COLS = [
    "mes",
    "año",
    "data_count",
    "data_quality",
    "lag_1",
    "lag_2",
    "lag_3",
    "lag_12",
]


def _build_lgbm_features(series: pd.Series) -> pd.DataFrame:
    """
    Construye el DataFrame de features para LightGBM multi-serie.
    Igual que create_features() del Streamlit de referencia:
      mes, año, data_count, data_quality, lag_1, lag_2, lag_3, lag_12.

    No incluye rolling stats ni eventos para mantener el pipeline simple
    y veloz (sin contaminación entre series).
    """
    df = pd.DataFrame({"y": series.values}, index=series.index)
    df["mes"] = pd.DatetimeIndex(series.index).month
    df["año"] = pd.DatetimeIndex(series.index).year
    n = len(series)
    df["data_count"] = n
    df["data_quality"] = 2 if n >= 36 else 1 if n >= 24 else 0
    for lag in [1, 2, 3, 12]:
        df[f"lag_{lag}"] = df["y"].shift(lag)
    return df.dropna()


def _lgbm_predict_future(
    model: Any,
    history: list[float],
    n_train: int,
    freq: str,
    last_date: pd.Timestamp,
    horizon: int,
) -> list[float]:
    """
    Predice `horizon` pasos futuros propagando lags mes a mes.
    Mismo algoritmo que _predict_future_ml() del Streamlit.
    """
    future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=freq)[1:]
    data_count = n_train
    data_quality = 2 if data_count >= 36 else 1 if data_count >= 24 else 0
    preds: list[float] = []

    for fecha in future_dates:
        n = len(history)
        row = {
            "mes": fecha.month,
            "año": fecha.year,
            "data_count": data_count,
            "data_quality": data_quality,
            "lag_1": history[n - 1] if n >= 1 else 0.0,
            "lag_2": history[n - 2] if n >= 2 else 0.0,
            "lag_3": history[n - 3] if n >= 3 else 0.0,
            "lag_12": history[n - 12] if n >= 12 else 0.0,
        }
        X = pd.DataFrame([row])[_LGBM_FEATURE_COLS]  # noqa: N806
        pred = float(model.predict(X)[0])
        pred = max(0.0, pred)
        preds.append(pred)
        history.append(pred)

    return preds


def _run_lgbm_single(
    series: pd.Series,
    train: pd.Series,
    test: pd.Series | None,
    freq: str,
    horizon: int,
) -> tuple[list[float], float | None, float | None, list[float]]:
    """
    Entrena un LightGBM sobre `train` y devuelve:
      (predicciones_futuras_sobre_serie_completa, wape_test, bias_test, preds_test_list)

    Si test is None, wape/bias/preds_test_list serán None/None/[].
    Internamente re-entrena sobre train+test para el forecast futuro.
    """
    import lightgbm as lgb

    # 1. Entrenar sobre train
    df_train = _build_lgbm_features(train)
    if len(df_train) < 4:
        return [], None, None, []

    X_tr = df_train[_LGBM_FEATURE_COLS].values  # noqa: N806
    y_tr = df_train["y"].values

    params = {
        "objective": "regression",
        "metric": "rmse",
        "num_leaves": 31,
        "learning_rate": 0.1,
        "n_estimators": 100,
        "verbose": -1,
        "random_state": 42,
    }
    model_train = lgb.LGBMRegressor(**params)
    model_train.fit(X_tr, y_tr)

    # 2. Calcular WAPE/BIAS sobre test si existe
    wape_val: float | None = None
    bias_val: float | None = None
    preds_test_list: list[float] = []

    if test is not None and len(test) >= _MIN_TEST_OBS:
        history_eval = list(train.values)
        preds_test = _lgbm_predict_future(
            model_train, history_eval, len(train), freq, train.index[-1], len(test)
        )
        preds_test_list = preds_test
        real_test = np.asarray(test.values, dtype=float)
        preds_arr = np.asarray(preds_test, dtype=float)
        denom = float(np.abs(real_test).sum())
        if denom > 0:
            wape_val = float(np.abs(real_test - preds_arr).sum() / denom)
        mean_real = float(real_test.mean())
        if mean_real != 0:
            bias_val = float((preds_arr.mean() - mean_real) / mean_real * 100)

    # 3. Re-entrenar sobre train+test para forecast futuro real
    full_series = series  # train + test (serie completa)
    df_full = _build_lgbm_features(full_series)
    if len(df_full) >= 4:
        X_full = df_full[_LGBM_FEATURE_COLS].values  # noqa: N806
        y_full = df_full["y"].values
        model_full = lgb.LGBMRegressor(**params)
        model_full.fit(X_full, y_full)
    else:
        model_full = model_train  # fallback

    # 4. Predecir horizonte futuro
    history_fut = list(full_series.values)
    future_preds = _lgbm_predict_future(
        model_full, history_fut, len(full_series), freq, full_series.index[-1], horizon
    )
    return future_preds, wape_val, bias_val, preds_test_list


def run_batch_benchmark_lgbm(
    df: pd.DataFrame,
    *,
    train_end: str,
    freq: str = "MS",
    horizon: int = 12,
) -> dict[str, Any]:
    """
    MS-B3: LightGBM multi-serie con lags, idéntico al Streamlit de referencia.

    Flujo:
      1. Corta panel en train (≤ train_end) y test (> train_end)
      2. Entrena un LightGBM por entidad sobre el train
      3. Evalúa sobre el test (WAPE/BIAS reales)
      4. Re-entrena sobre train+test → forecast futuro real

    Sin Optuna: parámetros fijos robustos (igual que el Streamlit de referencia,
    que tampoco usaba HPO en el pipeline multi-serie).
    Complejidad O(n_series) secuencial; ~0.5-2s por serie mensual.

    Args:
        df:         DataFrame con columnas [unique_id, ds, y] (panel normalizado)
        train_end:  ISO date, ej: "2024-12-31"
        freq:       Alias pandas
        horizon:    Períodos futuros a pronosticar

    Returns:
        dict con las mismas claves que run_batch_benchmark() para que el
        frontend reutilice exactamente el mismo schema.
    """
    t0 = time.perf_counter()

    # Verificar que lightgbm está instalado
    try:
        import lightgbm  # noqa: F401
    except ImportError as exc:
        raise ImportError(
            "LightGBM multi-serie requiere lightgbm. Instalalo con: uv sync --group heavy-ml"
        ) from exc

    log.info("lgbm_multi_start", freq=freq, horizon=horizon, train_end=train_end)

    # Preparar datos
    df = df.copy()
    df["ds"] = pd.to_datetime(df["ds"], errors="coerce")
    df["y"] = pd.to_numeric(df["y"], errors="coerce").fillna(0).clip(lower=0)
    df = df.dropna(subset=["ds"]).sort_values(["unique_id", "ds"])

    train_end_ts = pd.Timestamp(train_end)
    train_df = df[df["ds"] <= train_end_ts]
    test_df = df[df["ds"] > train_end_ts]

    if train_df.empty:
        raise ValueError(f"No hay datos de train antes de {train_end}.")

    min_obs = 13  # necesita al menos lag_12 + 1 para entrenar
    all_ids = df["unique_id"].unique().tolist()
    valid_ids = [
        uid for uid in all_ids if (train_df[train_df["unique_id"] == uid]["ds"].count() >= min_obs)
    ]
    skipped = [uid for uid in all_ids if uid not in valid_ids]

    accuracy_rows: list[dict[str, Any]] = []
    best_models: list[dict[str, Any]] = []
    all_preds: list[dict[str, Any]] = []
    test_vs_real_rows: list[dict[str, Any]] = []  # P1: detalle real vs predicho en test

    test_periods_global = int(test_df["ds"].nunique()) if not test_df.empty else 0

    for uid in valid_ids:
        uid_train = train_df[train_df["unique_id"] == uid].set_index("ds")["y"]
        uid_test = (
            test_df[test_df["unique_id"] == uid].set_index("ds")["y"] if not test_df.empty else None
        )
        uid_full = df[df["unique_id"] == uid].set_index("ds")["y"]

        # Normalizar al inicio del período
        period_alias = _freq_to_period_alias(freq)
        uid_train = uid_train.copy()
        uid_train.index = uid_train.index.to_period(period_alias).to_timestamp()
        if uid_test is not None and len(uid_test) > 0:
            uid_test = uid_test.copy()
            uid_test.index = uid_test.index.to_period(period_alias).to_timestamp()
        uid_full = uid_full.copy()
        uid_full.index = uid_full.index.to_period(period_alias).to_timestamp()

        try:
            preds_future, wape_v, bias_v, preds_test_detail = _run_lgbm_single(
                series=uid_full,
                train=uid_train,
                test=uid_test
                if (uid_test is not None and len(uid_test) >= _MIN_TEST_OBS)
                else None,
                freq=freq,
                horizon=horizon,
            )
        except Exception as exc:
            log.warning("lgbm_multi_series_failed", uid=uid, error=str(exc))
            skipped.append(uid)
            continue

        # Predicciones futuras al payload
        future_dates = pd.date_range(start=uid_full.index[-1], periods=horizon + 1, freq=freq)[1:]
        for ds, pred in zip(future_dates, preds_future, strict=False):
            all_preds.append({"unique_id": uid, "ds": str(ds.date()), "predicted": round(pred, 4)})

        # Métricas de accuracy
        score = _winner_score(wape_v or 1.0, bias_v or 0.0)
        if wape_v is not None:
            accuracy_rows.append(
                {
                    "unique_id": uid,
                    "model": "LightGBM",
                    "wape": round(wape_v, 4),
                    "bias": round(bias_v or 0.0, 2),
                    "score": round(score, 4),
                    "n_obs_test": int(len(uid_test)) if uid_test is not None else 0,
                }
            )

            # P1: guardar detalle real vs predicho del test para la hoja Excel
            if (
                uid_test is not None
                and len(uid_test) >= _MIN_TEST_OBS
                and len(preds_test_detail) > 0
            ):
                sum_real_uid = float(uid_test.abs().sum()) or 1.0
                bias_acum_uid = 0.0
                for i_t, (dt, rv) in enumerate(uid_test.items()):
                    if i_t >= len(preds_test_detail):
                        break
                    pv = max(0.0, preds_test_detail[i_t])
                    err_pct = round((pv - rv) / abs(rv) * 100, 2) if rv != 0 else None
                    bias_acum_uid += (pv - rv) / sum_real_uid * 100
                    test_vs_real_rows.append(
                        {
                            "unique_id": uid,
                            "ds": str(dt.date()),
                            "real": round(float(rv), 4),
                            "predicted": round(float(pv), 4),
                            "error_pct": err_pct,
                            "bias_acum_pct": round(bias_acum_uid, 2),
                        }
                    )

        best_models.append(
            {
                "unique_id": uid,
                "best_model": "LightGBM",
                "wape": round(wape_v, 4) if wape_v is not None else None,
                "bias": round(bias_v, 2) if bias_v is not None else None,
                "score": round(score, 4),
            }
        )

    # Ranking global (solo 1 modelo)
    if accuracy_rows:
        wape_vals = [r["wape"] for r in accuracy_rows]
        bias_vals = [r["bias"] for r in accuracy_rows]
        model_ranking = [
            {
                "model": "LightGBM",
                "wape_mean": round(float(pd.Series(wape_vals).mean()), 4),
                "bias_mean": round(float(pd.Series(bias_vals).mean()), 2),
                "n_wins": len(accuracy_rows),
            }
        ]
    else:
        model_ranking = []

    duration = round(time.perf_counter() - t0, 3)
    log.info("lgbm_multi_done", n_series=len(valid_ids), duration_s=duration)

    return {
        "n_series": len(valid_ids),
        "horizon": horizon,
        "freq": freq,
        "duration_s": duration,
        "train_end": train_end,
        "test_periods": test_periods_global,
        "models_used": ["LightGBM"],
        "predictions": all_preds,
        "accuracy": accuracy_rows,
        "best_models": best_models,
        "model_ranking": model_ranking,
        "series_skipped": skipped,
        "test_vs_real": test_vs_real_rows,
    }
