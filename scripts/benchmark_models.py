"""
benchmark_models.py — Fase 9: Scale Engine

Comparativa de rendimiento y exactitud entre:
  A) statsmodels (loop serie-por-serie, Holt-Winters exponential smoothing)
  B) StatsForecast/Nixtla (vectorizado, AutoETS, n_jobs=-1)

Dataset sintético: 1 000 SKUs × 104 semanas (2 años)
Patrones: tendencia leve + estacionalidad anual + ruido gaussiano

Métricas reportadas:
  - Tiempo total de entrenamiento+predicción
  - WAPE por modelo (sobre hold-out 12 semanas)
  - WAPE por segmento ABC-XYZ
  - Tabla markdown al final (lista para copiar a README/ROADMAP)

Uso:
  cd backend
  uv run python ../scripts/benchmark_models.py
  uv run python ../scripts/benchmark_models.py --n-skus 200  # prueba rápida
"""

from __future__ import annotations

import argparse
import time
import warnings
from typing import Any

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")  # statsmodels lanza warnings de convergencia

# ── Config ────────────────────────────────────────────────────────────────────

N_SKUS_DEFAULT = 1_000
N_WEEKS = 104  # 2 años de historia semanal
HORIZON = 12  # 12 semanas de forecast
HOLDOUT = 12  # hold-out para evaluar WAPE
FREQ = "W"
SEED = 42

rng = np.random.default_rng(SEED)

# Segmentos ABC-XYZ
ABC = ["A", "B", "C"]
XYZ = ["X", "Y", "Z"]
ABC_PROBS = [0.2, 0.3, 0.5]  # 20% A, 30% B, 50% C
XYZ_PROBS = [0.3, 0.4, 0.3]


# ── Generación del dataset ────────────────────────────────────────────────────


def _make_series(sku_id: int, abc: str, xyz: str) -> np.ndarray:
    """Serie sintética con tendencia + estacionalidad anual + ruido controlado por XYZ."""
    t = np.arange(N_WEEKS)

    # Nivel base depende de ABC (A > B > C)
    base = {"A": 500, "B": 150, "C": 30}[abc]

    # Tendencia sutil
    trend = base * 0.01 * t

    # Estacionalidad anual (52 semanas)
    seasonality = base * 0.25 * np.sin(2 * np.pi * t / 52)

    # Ruido: XYZ controla el CV
    cv = {"X": 0.05, "Y": 0.15, "Z": 0.35}[xyz]
    noise = rng.normal(0, base * cv, N_WEEKS)

    series = base + trend + seasonality + noise
    series = np.clip(series, 0, None)  # no negativos
    return series


def generate_panel(n_skus: int) -> pd.DataFrame:
    """Genera el panel Nixtla-compatible: unique_id | ds | y | cluster_abc | cluster_xyz."""
    print(f"Generando panel: {n_skus:,} SKUs × {N_WEEKS} semanas…")
    t0 = time.perf_counter()

    dates = pd.date_range("2022-01-03", periods=N_WEEKS, freq="W")  # lunes

    abc_labels = rng.choice(ABC, size=n_skus, p=ABC_PROBS)
    xyz_labels = rng.choice(XYZ, size=n_skus, p=XYZ_PROBS)

    rows: list[dict[str, Any]] = []
    for i in range(n_skus):
        vals = _make_series(i, abc_labels[i], xyz_labels[i])
        for d, v in zip(dates, vals):
            rows.append(
                {
                    "unique_id": f"SKU-{i:05d}",
                    "ds": d,
                    "y": round(float(v), 2),
                    "cluster_abc": abc_labels[i],
                    "cluster_xyz": xyz_labels[i],
                }
            )

    df = pd.DataFrame(rows)
    elapsed = time.perf_counter() - t0
    print(f"  Panel listo: {len(df):,} filas en {elapsed:.2f}s")
    return df


# ── WAPE helper ───────────────────────────────────────────────────────────────


def wape(actual: np.ndarray, pred: np.ndarray) -> float:
    """Weighted Absolute Percentage Error — robusto a ceros."""
    denom = np.sum(np.abs(actual))
    if denom == 0:
        return float("nan")
    return float(np.sum(np.abs(actual - pred)) / denom)


# ── Método A: statsmodels (loop) ──────────────────────────────────────────────


def run_statsmodels(panel: pd.DataFrame) -> dict[str, Any]:
    """
    Loop serie-por-serie usando ExponentialSmoothing de statsmodels.
    Referencia: lo que usaría cualquier analista sin Nixtla.
    """
    from statsmodels.tsa.holtwinters import ExponentialSmoothing

    print("\n[A] statsmodels — Holt-Winters loop…")
    t0 = time.perf_counter()

    wapes: list[float] = []
    failed = 0
    skus = panel["unique_id"].unique()

    for sku in skus:
        series = panel[panel["unique_id"] == sku]["y"].values

        train = series[:-HOLDOUT]
        test = series[-HOLDOUT:]

        try:
            model = ExponentialSmoothing(
                train,
                trend="add",
                seasonal="add",
                seasonal_periods=52,
                initialization_method="estimated",
            )
            fit = model.fit(optimized=True, remove_bias=True)
            pred = fit.forecast(HOLDOUT)
            wapes.append(wape(test, pred))
        except Exception:
            # Serie corta o no convergió — usamos naive
            naive_pred = np.full(HOLDOUT, train[-1])
            wapes.append(wape(test, naive_pred))
            failed += 1

    duration = time.perf_counter() - t0
    avg_wape = float(np.nanmean(wapes))

    print(
        f"  Tiempo: {duration:.2f}s  |  WAPE medio: {avg_wape * 100:.1f}%  |  Fallidos: {failed}"
    )
    return {
        "method": "statsmodels (loop)",
        "duration_s": round(duration, 3),
        "wape": avg_wape,
        "failed": failed,
    }


# ── Método B: StatsForecast Nixtla (vectorizado) ──────────────────────────────


def run_nixtla(panel: pd.DataFrame) -> dict[str, Any]:
    """
    StatsForecast vectorizado con AutoETS.
    n_jobs=-1 usa todos los cores disponibles.
    """
    from statsforecast import StatsForecast
    from statsforecast.models import AutoETS, SeasonalNaive

    print("\n[B] StatsForecast (Nixtla) — AutoETS vectorizado…")
    t0 = time.perf_counter()

    train = panel[
        panel.groupby("unique_id").cumcount(ascending=False) >= HOLDOUT
    ].copy()
    test_dict = (
        panel.groupby("unique_id")
        .tail(HOLDOUT)
        .groupby("unique_id")["y"]
        .apply(np.array)
        .to_dict()
    )

    sf = StatsForecast(
        models=[AutoETS(season_length=52)],
        freq=FREQ,
        n_jobs=-1,
        fallback_model=SeasonalNaive(season_length=52),
    )

    forecast_df = sf.forecast(
        df=train[["unique_id", "ds", "y"]], h=HOLDOUT
    ).reset_index()
    duration = time.perf_counter() - t0

    # Calcular WAPE por SKU
    pred_col = [c for c in forecast_df.columns if c not in ("unique_id", "ds")][0]
    wapes: list[float] = []
    for sku, grp in forecast_df.groupby("unique_id"):
        actual = test_dict.get(str(sku), np.array([]))  # type: ignore[arg-type]
        pred = grp[pred_col].values
        if len(actual) == len(pred) and len(actual) > 0:
            wapes.append(wape(actual, pred))

    avg_wape = float(np.nanmean(wapes)) if wapes else float("nan")

    print(f"  Tiempo: {duration:.2f}s  |  WAPE medio: {avg_wape * 100:.1f}%")
    return {
        "method": "StatsForecast AutoETS (Nixtla)",
        "duration_s": round(duration, 3),
        "wape": avg_wape,
        "failed": 0,
    }


# ── Método C: Nixtla segmentado por ABC-XYZ ───────────────────────────────────


def run_nixtla_segmented(panel: pd.DataFrame) -> dict[str, Any]:
    """
    StatsForecast con un modelo distinto por segmento ABC-XYZ.
    Estrategia real que usa nixtla_forecaster.py en producción.
    """
    from statsforecast import StatsForecast
    from statsforecast.models import AutoARIMA, AutoETS, SeasonalNaive

    print("\n[C] StatsForecast (Nixtla) — segmentado ABC-XYZ…")
    t0 = time.perf_counter()

    panel2 = panel.copy()
    panel2["_cluster"] = panel2["cluster_abc"] + "-" + panel2["cluster_xyz"]

    train = panel2[
        panel2.groupby("unique_id").cumcount(ascending=False) >= HOLDOUT
    ].copy()
    test_dict = (
        panel2.groupby("unique_id")
        .tail(HOLDOUT)
        .groupby("unique_id")["y"]
        .apply(np.array)
        .to_dict()
    )

    # Mapa cluster → modelo
    model_map = {
        "A-X": AutoETS(season_length=52),
        "A-Y": AutoETS(season_length=52),
        "A-Z": AutoARIMA(),
        "B-X": AutoETS(season_length=52),
        "B-Y": AutoETS(season_length=52),
        "B-Z": AutoARIMA(),
        "C-X": SeasonalNaive(season_length=52),
        "C-Y": SeasonalNaive(season_length=52),
        "C-Z": SeasonalNaive(season_length=52),
    }

    # Tabla única_id → cluster
    id_cluster = train[["unique_id", "_cluster"]].drop_duplicates("unique_id")

    parts: list[pd.DataFrame] = []
    wapes_by_seg: dict[str, list[float]] = {}

    segments = train["_cluster"].unique()
    for seg in segments:
        ids_in_seg = id_cluster[id_cluster["_cluster"] == seg]["unique_id"]
        seg_train = train[train["unique_id"].isin(ids_in_seg)][["unique_id", "ds", "y"]]

        seg_model = model_map.get(str(seg), AutoETS(season_length=52))
        sf = StatsForecast(
            models=[seg_model],
            freq=FREQ,
            n_jobs=-1,
            fallback_model=SeasonalNaive(season_length=52),
        )
        try:
            seg_fc = sf.forecast(df=seg_train, h=HOLDOUT).reset_index()
            parts.append(seg_fc)
        except Exception as exc:
            print(f"  Segmento {seg} falló: {exc}")

    duration = time.perf_counter() - t0

    if not parts:
        return {
            "method": "StatsForecast ABC-XYZ (Nixtla)",
            "duration_s": round(duration, 3),
            "wape": float("nan"),
            "failed": len(segments),
        }

    forecast_df = pd.concat(parts, ignore_index=True)
    pred_col = [c for c in forecast_df.columns if c not in ("unique_id", "ds")][0]

    # WAPE por segmento
    id_seg = id_cluster.set_index("unique_id")["_cluster"].to_dict()
    wapes_all: list[float] = []

    for sku, grp in forecast_df.groupby("unique_id"):
        actual = test_dict.get(str(sku), np.array([]))  # type: ignore[arg-type]
        pred = grp[pred_col].values
        if len(actual) == len(pred) and len(actual) > 0:
            w = wape(actual, pred)
            wapes_all.append(w)
            seg = id_seg.get(str(sku), "?")
            wapes_by_seg.setdefault(seg, []).append(w)

    avg_wape = float(np.nanmean(wapes_all)) if wapes_all else float("nan")
    print(f"  Tiempo: {duration:.2f}s  |  WAPE medio: {avg_wape * 100:.1f}%")

    # Mostrar WAPE por segmento
    print("\n  WAPE por segmento:")
    for seg_k in sorted(wapes_by_seg):
        seg_vals = wapes_by_seg[seg_k]
        print(f"    {seg_k}: {np.nanmean(seg_vals) * 100:.1f}%  (n={len(seg_vals)})")

    return {
        "method": "StatsForecast ABC-XYZ (Nixtla)",
        "duration_s": round(duration, 3),
        "wape": avg_wape,
        "failed": 0,
        "wape_by_segment": {
            k: round(float(np.nanmean(v)), 4) for k, v in wapes_by_seg.items()
        },
    }


# ── Tabla de resultados ───────────────────────────────────────────────────────


def print_markdown_table(results: list[dict[str, Any]], n_skus: int) -> None:
    """Imprime una tabla markdown lista para pegar en el ROADMAP."""
    print("\n\n" + "=" * 70)
    print(
        f"BENCHMARK RESULTS — {n_skus:,} SKUs × {N_WEEKS} semanas | hold-out {HOLDOUT}W"
    )
    print("=" * 70)
    print()
    print("| Método | Tiempo (s) | WAPE medio | Speedup vs loop |")
    print("|--------|-----------|-----------|-----------------|")

    base_time = results[0]["duration_s"]  # statsmodels es el baseline
    for r in results:
        speedup = base_time / r["duration_s"] if r["duration_s"] > 0 else float("inf")
        wape_str = f"{r['wape'] * 100:.1f}%" if not np.isnan(r["wape"]) else "N/A"
        sp_str = f"{speedup:.1f}×" if speedup != float("inf") else "—"
        print(
            f"| {r['method']:<38} | {r['duration_s']:>9.2f} | {wape_str:>9} | {sp_str:>15} |"
        )

    print()
    print(
        "*Benchmark corrido con dataset sintético — patrones: tendencia + estacionalidad anual + ruido gaussiano.*"
    )
    print()


# ── CLI ───────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark statsmodels vs Nixtla StatsForecast"
    )
    parser.add_argument(
        "--n-skus",
        type=int,
        default=N_SKUS_DEFAULT,
        help="Cantidad de SKUs a generar (default: 1000)",
    )
    parser.add_argument(
        "--skip-statsmodels",
        action="store_true",
        help="Saltear el loop de statsmodels (mucho más lento)",
    )
    args = parser.parse_args()

    print("\nforecastiq — Scale Engine Benchmark")
    print(
        f"SKUs: {args.n_skus:,}  |  Semanas: {N_WEEKS}  |  Horizon: {HORIZON}  |  Hold-out: {HOLDOUT}W\n"
    )

    panel = generate_panel(args.n_skus)

    results: list[dict[str, Any]] = []

    if not args.skip_statsmodels:
        results.append(run_statsmodels(panel))
    else:
        # Placeholder para tabla con tiempo 0 (baseline omitido)
        print("\n[A] statsmodels — omitido con --skip-statsmodels")
        results.append(
            {
                "method": "statsmodels (loop) [omitido]",
                "duration_s": 9999.0,
                "wape": float("nan"),
                "failed": 0,
            }
        )

    results.append(run_nixtla(panel))
    results.append(run_nixtla_segmented(panel))

    print_markdown_table(results, args.n_skus)


if __name__ == "__main__":
    main()
