"""
spark_benchmark.py — Fase 11: PySpark Local

Script standalone equivalente al notebook spark_forecast_pipeline.ipynb.
Útil para CI, demos por CLI, y ejecuciones headless en el servidor.

Uso:
    # Dentro del contenedor Jupyter (accede al cluster Docker):
    docker exec -it forecastiq-jupyter python /home/jovyan/scripts/spark_benchmark.py

    # Local (modo Spark standalone sin cluster):
    uv run python scripts/spark_benchmark.py --local

    # Con parámetros:
    uv run python scripts/spark_benchmark.py --local --n-skus 1000 --horizon 30

Salida:
    - Tabla de resultados benchmark en stdout (markdown)
    - Tabla de métricas LightGBM por segmento
    - Archivos PNG en data/benchmark_output/
"""

import argparse
import os
import sys
import time
import warnings
from pathlib import Path

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")

# ── Paths ─────────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = DATA_DIR / "benchmark_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

PARQUET_PATH = DATA_DIR / "ventas_25k_skus.parquet"


# ── Argparse ──────────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="ForecastIQ — PySpark Benchmark Fase 11"
    )
    parser.add_argument(
        "--local",
        action="store_true",
        default=False,
        help="Usar Spark en modo local[*] en lugar del cluster Docker",
    )
    parser.add_argument(
        "--n-skus",
        type=int,
        default=0,
        help="Limitar a N SKUs para pruebas rápidas (0 = dataset completo)",
    )
    parser.add_argument(
        "--skip-lgbm",
        action="store_true",
        default=False,
        help="Saltar entrenamiento LightGBM (solo benchmark de operaciones)",
    )
    parser.add_argument(
        "--skip-spark",
        action="store_true",
        default=False,
        help="Saltar benchmark de Spark (solo Pandas vs Polars)",
    )
    return parser.parse_args()


# ── Spark setup ───────────────────────────────────────────────────────────────
def build_spark_session(local: bool):
    """Crea SparkSession conectada al cluster Docker o en modo local."""
    from pyspark.sql import SparkSession

    if local:
        master = "local[*]"
    else:
        master = os.getenv("SPARK_MASTER", "spark://spark-master:7077")

    print(f"[Spark] Conectando a: {master}")
    spark = (
        SparkSession.builder.master(master)
        .appName("ForecastIQ-Benchmark-Fase11")
        .config("spark.driver.memory", "2g")
        .config("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
        .config("spark.sql.shuffle.partitions", "48")
        .config("spark.sql.adaptive.enabled", "true")
        .config("spark.ui.showConsoleProgress", "false")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("ERROR")
    return spark


# ── Feature engineering distribuido ──────────────────────────────────────────
def build_features_spark(df_raw, spark):
    """Genera features con Window functions de Spark."""
    from pyspark.sql import Window
    from pyspark.sql import functions as F

    w_sku = Window.partitionBy("sku_id").orderBy("fecha")
    w_7 = w_sku.rowsBetween(-6, 0)
    w_14 = w_sku.rowsBetween(-13, 0)
    w_30 = w_sku.rowsBetween(-29, 0)

    df = (
        df_raw.withColumn("lag_7", F.lag("ventas", 7).over(w_sku))
        .withColumn("lag_14", F.lag("ventas", 14).over(w_sku))
        .withColumn("lag_30", F.lag("ventas", 30).over(w_sku))
        .withColumn("rolling_7", F.mean("ventas").over(w_7))
        .withColumn("rolling_14", F.mean("ventas").over(w_14))
        .withColumn("rolling_30", F.mean("ventas").over(w_30))
        .withColumn("rolling_std_7", F.stddev("ventas").over(w_7))
        .withColumn("rolling_std_30", F.stddev("ventas").over(w_30))
        .withColumn("dia_semana", F.dayofweek("fecha"))
        .withColumn("mes", F.month("fecha"))
        .withColumn("trimestre", F.quarter("fecha"))
        .withColumn("semana_anio", F.weekofyear("fecha"))
        .withColumn(
            "es_fin_semana", F.when(F.dayofweek("fecha").isin([1, 7]), 1).otherwise(0)
        )
        .withColumn("precio_media_30d", F.mean("precio").over(w_30))
        .withColumn(
            "precio_rel_30d", F.col("precio") / (F.col("precio_media_30d") + 1e-6)
        )
        .drop("precio_media_30d")
        .withColumn("cobertura_stock", F.col("stock") / (F.col("ventas") + 1.0))
        .withColumn(
            "cluster_abc_id",
            F.when(F.col("cluster_abc") == "A", 0)
            .when(F.col("cluster_abc") == "B", 1)
            .otherwise(2),
        )
        .withColumn(
            "cluster_xyz_id",
            F.when(F.col("cluster_xyz") == "X", 0)
            .when(F.col("cluster_xyz") == "Y", 1)
            .otherwise(2),
        )
        .withColumn("categoria_id", F.dense_rank().over(Window.orderBy("categoria")))
        .withColumn("canal_id", F.dense_rank().over(Window.orderBy("canal")))
        .dropna(subset=["lag_7", "lag_14", "lag_30"])
        .fillna({"rolling_std_7": 0.0, "rolling_std_30": 0.0})
    )
    return df


# ── LightGBM por segmento ─────────────────────────────────────────────────────
FEATURE_COLS = [
    "lag_7",
    "lag_14",
    "lag_30",
    "rolling_7",
    "rolling_14",
    "rolling_30",
    "rolling_std_7",
    "rolling_std_30",
    "dia_semana",
    "mes",
    "trimestre",
    "semana_anio",
    "es_fin_semana",
    "precio_rel_30d",
    "cobertura_stock",
    "cluster_abc_id",
    "cluster_xyz_id",
    "categoria_id",
    "canal_id",
]


def train_and_eval_segment(df_train, df_test, abc: str, xyz: str) -> dict:
    """Entrena LightGBM para el segmento abc-xyz y retorna métricas."""
    import lightgbm as lgb
    from pyspark.sql import functions as F

    cond = (F.col("cluster_abc") == abc) & (F.col("cluster_xyz") == xyz)

    df_tr = df_train.filter(cond).select(FEATURE_COLS + ["ventas"]).toPandas()
    df_te = df_test.filter(cond).select(FEATURE_COLS + ["ventas"]).toPandas()

    if len(df_tr) < 100:
        return {"wape": None, "n_train": len(df_tr)}

    dtrain = lgb.Dataset(df_tr[FEATURE_COLS].values, label=df_tr["ventas"].values)
    dval = lgb.Dataset(
        df_te[FEATURE_COLS].values, label=df_te["ventas"].values, reference=dtrain
    )

    params = {
        "objective": "regression_l1",
        "metric": "mae",
        "learning_rate": 0.05,
        "num_leaves": 63,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "n_jobs": -1,
        "verbose": -1,
        "seed": 42,
    }
    booster = lgb.train(
        params,
        dtrain,
        num_boost_round=300,
        valid_sets=[dval],
        callbacks=[lgb.early_stopping(30, verbose=False), lgb.log_evaluation(-1)],
    )

    y_pred = np.maximum(booster.predict(df_te[FEATURE_COLS].values), 0)
    y_true = df_te["ventas"].values
    wape = np.sum(np.abs(y_true - y_pred)) / (np.sum(np.abs(y_true)) + 1e-6)
    mae = np.mean(np.abs(y_true - y_pred))
    bias = np.mean(y_pred - y_true) / (np.mean(np.abs(y_true)) + 1e-6)

    return {
        "wape": round(wape * 100, 2),
        "mae": round(mae, 3),
        "bias_pct": round(bias * 100, 2),
        "n_train": len(df_tr),
        "n_test": len(df_te),
        "best_iter": booster.best_iteration,
    }


# ── Benchmark helper ──────────────────────────────────────────────────────────
def timed(fn, label: str) -> float:
    t0 = time.perf_counter()
    fn()
    elapsed = time.perf_counter() - t0
    print(f"  {label:<45} {elapsed:>8.2f}s")
    return elapsed


def print_markdown_table(df: pd.DataFrame, title: str) -> None:
    print(f"\n### {title}\n")
    print(df.to_markdown(floatfmt=".2f"))
    print()


# ── Main ──────────────────────────────────────────────────────────────────────
def main() -> None:
    args = parse_args()

    if not PARQUET_PATH.exists():
        print(f"ERROR: Dataset no encontrado en {PARQUET_PATH}")
        print("Correr primero: uv run python scripts/generate_massive_dataset.py")
        sys.exit(1)

    size_mb = PARQUET_PATH.stat().st_size / 1024**2
    print(f"\n{'=' * 60}")
    print("ForecastIQ — PySpark Benchmark Fase 11")
    print(f"Dataset: {PARQUET_PATH.name}  ({size_mb:.1f} MB)")
    print(f"Modo   : {'local[*]' if args.local else 'cluster Docker'}")
    print(f"{'=' * 60}\n")

    # ── Benchmark 1 — Lectura Parquet ─────────────────────────────────────────
    print("## Benchmark: lectura Parquet completo")

    import polars as pl

    bench = {}

    bench["pandas_read"] = timed(
        lambda: pd.read_parquet(str(PARQUET_PATH)), "Pandas  read_parquet"
    )
    bench["polars_read"] = timed(
        lambda: pl.read_parquet(str(PARQUET_PATH)), "Polars  read_parquet"
    )

    df_pd = pd.read_parquet(str(PARQUET_PATH))
    df_pl = pl.read_parquet(str(PARQUET_PATH))

    # Opcional: submuestra
    if args.n_skus > 0:
        sample_skus = df_pd["sku_id"].unique()[: args.n_skus]
        df_pd = df_pd[df_pd["sku_id"].isin(sample_skus)].copy()
        df_pl = df_pl.filter(pl.col("sku_id").is_in(sample_skus.tolist()))
        print(f"  Submuestrando a {args.n_skus} SKUs: {len(df_pd):,} filas")

    # ── Benchmark 2 — GroupBy ─────────────────────────────────────────────────
    print("\n## Benchmark: GroupBy + suma ventas")
    bench["pandas_groupby"] = timed(
        lambda: df_pd.groupby("categoria")["ventas"].sum(), "Pandas  groupby"
    )
    bench["polars_groupby"] = timed(
        lambda: df_pl.group_by("categoria").agg(pl.col("ventas").sum()),
        "Polars  groupby",
    )

    # ── Benchmark 3 — Rolling 7d ──────────────────────────────────────────────
    print("\n## Benchmark: Rolling mean 7d (500k filas)")
    N_BENCH_SKUS = min(450, args.n_skus if args.n_skus > 0 else 450)
    bench_skus = list(df_pd["sku_id"].unique()[:N_BENCH_SKUS])
    df_pd_bench = df_pd[df_pd["sku_id"].isin(bench_skus)].sort_values(
        ["sku_id", "fecha"]
    )
    df_pl_bench = df_pl.filter(pl.col("sku_id").is_in(bench_skus)).sort(
        ["sku_id", "fecha"]
    )

    def pandas_rolling():
        df_pd_bench.groupby("sku_id")["ventas"].transform(
            lambda x: x.rolling(7, min_periods=1).mean()
        )

    def polars_rolling():
        df_pl_bench.with_columns(
            pl.col("ventas").rolling_mean(7, min_periods=1).over("sku_id")
        )

    bench["pandas_rolling"] = timed(
        pandas_rolling, f"Pandas  rolling 7d ({len(df_pd_bench):,} rows)"
    )
    bench["polars_rolling"] = timed(
        polars_rolling, f"Polars  rolling 7d ({len(df_pl_bench):,} rows)"
    )

    # ── Spark benchmarks ──────────────────────────────────────────────────────
    if not args.skip_spark:
        spark = build_spark_session(args.local)
        from pyspark.sql import functions as F

        print("\n## Benchmark: Spark (incluye overhead cluster)")
        df_spark = spark.read.parquet(str(PARQUET_PATH))
        if args.n_skus > 0:
            df_spark = df_spark.filter(F.col("sku_id").isin(bench_skus[: args.n_skus]))

        bench["spark_read"] = timed(
            lambda: spark.read.parquet(str(PARQUET_PATH)).count(),
            f"Spark   read_parquet ({df_spark.count():,} rows)",
        )
        bench["spark_groupby"] = timed(
            lambda: df_spark.groupBy("categoria").agg(F.sum("ventas")).collect(),
            "Spark   groupby",
        )

        from pyspark.sql import Window as W

        w_b = W.partitionBy("sku_id").orderBy("fecha").rowsBetween(-6, 0)
        df_spark_bench = df_spark.filter(F.col("sku_id").isin(bench_skus))
        bench["spark_rolling"] = timed(
            lambda: df_spark_bench.withColumn(
                "rm7", F.mean("ventas").over(w_b)
            ).count(),
            f"Spark   rolling 7d ({df_spark_bench.count():,} rows)",
        )
    else:
        spark = None
        bench.update({"spark_read": None, "spark_groupby": None, "spark_rolling": None})

    # ── Tabla resumen benchmark ────────────────────────────────────────────────
    df_bench = pd.DataFrame(
        {
            "Operación": [
                "Read Parquet (27M rows)",
                "GroupBy + sum",
                "Rolling 7d (500k rows)",
            ],
            "Pandas (s)": [
                bench["pandas_read"],
                bench["pandas_groupby"],
                bench["pandas_rolling"],
            ],
            "Polars (s)": [
                bench["polars_read"],
                bench["polars_groupby"],
                bench["polars_rolling"],
            ],
            "Spark (s)": [
                bench["spark_read"],
                bench["spark_groupby"],
                bench["spark_rolling"],
            ],
        }
    ).set_index("Operación")

    df_bench["Speedup Polars/Pandas"] = (
        df_bench["Pandas (s)"] / df_bench["Polars (s)"]
    ).round(1)
    if not args.skip_spark:
        df_bench["Speedup Spark/Pandas"] = (
            df_bench["Pandas (s)"] / df_bench["Spark (s)"]
        ).round(1)

    print_markdown_table(df_bench, "Benchmark Pandas vs Polars vs Spark")

    # ── LightGBM por segmento ─────────────────────────────────────────────────
    if not args.skip_lgbm and spark is not None:
        print("## LightGBM — entrenamiento por segmento ABC-XYZ")

        from pyspark.sql import functions as F

        df_features = build_features_spark(df_spark, spark)
        df_features.cache()

        fecha_max_str = df_features.agg(F.max("fecha").alias("fm")).collect()[0]["fm"]
        fecha_corte = (
            pd.Timestamp(str(fecha_max_str)) - pd.Timedelta(days=28)
        ).strftime("%Y-%m-%d")

        df_train = df_features.filter(F.col("fecha") < fecha_corte)
        df_test = df_features.filter(F.col("fecha") >= fecha_corte)

        seg_rows = []
        t_lgbm = time.perf_counter()
        for abc in ["A", "B", "C"]:
            for xyz in ["X", "Y", "Z"]:
                seg = f"{abc}-{xyz}"
                t0 = time.perf_counter()
                metrics = train_and_eval_segment(df_train, df_test, abc, xyz)
                metrics["elapsed_s"] = round(time.perf_counter() - t0, 1)
                metrics["segmento"] = seg
                seg_rows.append(metrics)
                if metrics["wape"] is not None:
                    print(
                        f"  {seg}  WAPE={metrics['wape']:.1f}%  "
                        f"MAE={metrics['mae']:.2f}  "
                        f"BIAS={metrics['bias_pct']:+.1f}%  "
                        f"({metrics['elapsed_s']}s)"
                    )
                else:
                    print(f"  {seg}  skipped (n_train={metrics['n_train']} < 100)")

        print(f"\n  Tiempo total LightGBM: {time.perf_counter() - t_lgbm:.1f}s")

        df_seg = pd.DataFrame(seg_rows).set_index("segmento")[
            ["wape", "mae", "bias_pct", "n_train", "n_test", "best_iter", "elapsed_s"]
        ]
        print_markdown_table(df_seg, "Métricas LightGBM por segmento ABC-XYZ")

        df_features.unpersist()

    # ── Cierre ────────────────────────────────────────────────────────────────
    if spark is not None:
        spark.stop()

    print(f"\n{'=' * 60}")
    print("Benchmark Fase 11 completado.")
    print(f"Outputs en: {OUTPUT_DIR}")
    print(f"{'=' * 60}\n")


if __name__ == "__main__":
    main()
