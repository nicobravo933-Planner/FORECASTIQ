"""
generate_massive_dataset.py
============================
Genera un dataset sintético de 25.000 SKUs con historia diaria de 3 años (~27M filas).
Resultado: data/ventas_25k_skus.parquet (~180 MB, compresión Snappy)

Uso:
    cd forecastiq/
    python scripts/generate_massive_dataset.py

    # Modo rápido para testear (1.000 SKUs, 1 año):
    python scripts/generate_massive_dataset.py --skus 1000 --years 1

Requisitos (instalar en el entorno que prefieras):
    pip install pandas numpy pyarrow tqdm

Columnas del output:
    sku_id        → str  "SKU-00001" ... "SKU-25000"
    categoria     → str  Electrónica | Alimentos | Indumentaria | Hogar | Deportes
    canal         → str  Online | Tienda | Mayorista
    fecha         → date diaria desde 2022-01-01
    ventas        → float  unidades vendidas (>=0, puede ser 0 para intermitentes)
    precio        → float  precio unitario en ARS
    stock         → float  stock disponible ese día
    cluster_abc   → str  A | B | C  (por volumen de ventas total)
    cluster_xyz   → str  X | Y | Z  (por variabilidad = CV del SKU)

Clustering ABC-XYZ:
    A = top 80% del volumen acumulado
    B = siguiente 15%
    C = último 5%
    X = CV <= 0.5  (baja variabilidad, fácil de predecir)
    Y = 0.5 < CV <= 1.0
    Z = CV > 1.0   (alta variabilidad, difícil de predecir)
"""

import argparse
import os
import time
from pathlib import Path

import numpy as np
import pandas as pd

# tqdm es opcional — si no está instalado, usa un wrapper vacío
try:
    from tqdm import tqdm
    HAS_TQDM = True
except ImportError:
    HAS_TQDM = False
    def tqdm(iterable, **kwargs):  # type: ignore[misc]
        return iterable


# ---------------------------------------------------------------------------
# Configuración por categoría: define el "carácter" de cada segmento
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------
# v3: ajuste fino para Pareto ABC real y XYZ ~30/50/20
#
# Problema v2:
#   - XYZ: demasiados Z (42%) por ruido excesivo en Hogar/Indumentaria
#   - ABC: distribución todavía no Pareto (A muy alto)
#
# Fixes v3:
#   - ventas_base: distribución logarítmica implícita — base_max muy alta
#     solo en Alimentos (masivo) y muy baja en Hogar/Deportes (nicho)
#     → crea la concentración Pareto: pocos SKUs generan el 80% del volumen
#   - ruido: bajado a 0.55 Indumentaria y 0.65 Hogar (v2 tenía 0.70/0.90)
#     → CV entre 0.5 y 1.0 para la mayoría → más Y, menos Z
#   - prob_cero: mantenido alto en Hogar (0.40) pero ruido moderado
#     → intermitencia real sin explotar el CV
# ---------------------------------------------------------------------------
CATEGORIAS_CONFIG = {
    "Electronica": {
        "peso": 0.15,
        "ventas_base": (1, 80),        # rango amplio pero no extremo
        "precio_rango": (15_000, 200_000),
        "tendencia": 0.0003,
        "estac_anual": 0.35,
        "estac_semanal": 0.10,
        "ruido": 0.35,
        "prob_cero": 0.06,
        "outlier_prob": 0.008,
        "outlier_mult": (4.0, 10.0),
    },
    "Alimentos": {
        "peso": 0.30,
        "ventas_base": (2, 500),       # rango enorme → pocos SKUs masivos generan el 80%
        "precio_rango": (500, 5_000),
        "tendencia": 0.0001,
        "estac_anual": 0.15,
        "estac_semanal": 0.25,
        "ruido": 0.20,                 # ruido bajo → Alimentos masivos son X o Y, no Z
        "prob_cero": 0.03,
        "outlier_prob": 0.003,
        "outlier_mult": (1.5, 3.0),
    },
    "Indumentaria": {
        "peso": 0.20,
        "ventas_base": (1, 30),
        "precio_rango": (3_000, 50_000),
        "tendencia": 0.0001,
        "estac_anual": 0.55,
        "estac_semanal": 0.15,
        "ruido": 0.55,                 # v2=0.70 → bajado para reducir SKUs Z
        "prob_cero": 0.20,
        "outlier_prob": 0.005,
        "outlier_mult": (2.0, 5.0),
    },
    "Hogar": {
        "peso": 0.20,
        "ventas_base": (0.5, 15),
        "precio_rango": (2_000, 80_000),
        "tendencia": 0.00005,
        "estac_anual": 0.20,
        "estac_semanal": 0.20,
        "ruido": 0.65,                 # v2=0.90 → bajado; prob_cero da el Z, no el ruido solo
        "prob_cero": 0.40,             # muchos días sin venta → CV alto por zeros
        "outlier_prob": 0.004,
        "outlier_mult": (2.0, 4.0),
    },
    "Deportes": {
        "peso": 0.15,
        "ventas_base": (1, 40),
        "precio_rango": (1_500, 40_000),
        "tendencia": 0.0002,
        "estac_anual": 0.45,
        "estac_semanal": 0.20,
        "ruido": 0.40,
        "prob_cero": 0.12,
        "outlier_prob": 0.006,
        "outlier_mult": (3.0, 8.0),
    },
}

CANALES = ["Online", "Tienda", "Mayorista"]
CANAL_PESOS = [0.45, 0.40, 0.15]


def _samplear_base(rng: np.random.Generator, base_min: float, base_max: float) -> float:
    """
    Samplea la base de ventas con distribución log-uniforme (escala logarítmica).
    Esto genera la distribución power-law que se observa en retail real:
    muchos SKUs con ventas bajas, pocos con ventas muy altas (Pareto).

    Ejemplo con base_min=2, base_max=500:
        ~50% de los SKUs quedan entre 2-22 (zona baja)
        ~25% quedan entre 22-100
        ~25% quedan entre 100-500  ← los que generan el 80% del volumen
    """
    log_min = np.log(base_min)
    log_max = np.log(base_max)
    return float(np.exp(rng.uniform(log_min, log_max)))


def _generar_serie_ventas(
    n_dias: int,
    base_min: float,
    base_max: float,
    tendencia: float,
    estac_anual: float,
    estac_semanal: float,
    ruido: float,
    prob_cero: float,
    outlier_prob: float,
    outlier_mult_min: float,
    outlier_mult_max: float,
    rng: np.random.Generator,
    fechas: pd.DatetimeIndex,
) -> np.ndarray:
    """Genera un vector de ventas diarias con componentes realistas."""

    # 1. Base log-uniforme para este SKU (genera distribución Pareto entre SKUs)
    base = _samplear_base(rng, base_min, base_max)

    # 2. Tendencia lineal con pequeña variación aleatoria
    t = np.arange(n_dias)
    tend = base * (1 + tendencia * t * rng.uniform(0.5, 1.5))

    # 3. Estacionalidad anual (ciclo de 365 días, fase aleatoria por SKU)
    fase_anual = rng.uniform(0, 2 * np.pi)
    dia_del_anio = fechas.day_of_year.values
    estac_a = 1.0 + estac_anual * np.sin(2 * np.pi * dia_del_anio / 365.25 + fase_anual)

    # 4. Estacionalidad semanal (fin de semana sube o baja según categoría)
    dia_semana = fechas.day_of_week.values  # 0=lunes, 6=domingo
    # patrón: sube viernes-sábado, baja lunes
    patron_semanal = np.array([-0.1, 0.0, 0.0, 0.05, 0.15, 0.20, 0.10])
    estac_s = 1.0 + estac_semanal * patron_semanal[dia_semana]

    # 5. Ruido multiplicativo log-normal
    sigma_ruido = np.sqrt(np.log(1 + ruido**2))
    ruido_v = rng.lognormal(mean=-sigma_ruido**2 / 2, sigma=sigma_ruido, size=n_dias)

    # 6. Serie base
    ventas = tend * estac_a * estac_s * ruido_v

    # 7. Demanda intermitente (zeros)
    if prob_cero > 0:
        mask_cero = rng.random(n_dias) < prob_cero
        ventas[mask_cero] = 0.0

    # 8. Outliers (Hot Sale, CyberMonday, eventos puntuales)
    if outlier_prob > 0:
        mask_out = rng.random(n_dias) < outlier_prob
        mult = rng.uniform(outlier_mult_min, outlier_mult_max, size=n_dias)
        ventas[mask_out] *= mult[mask_out]

    return np.clip(ventas, 0.0, None)


def _calcular_abc_xyz(df_pivot: pd.DataFrame) -> pd.DataFrame:
    """
    Calcula clustering ABC-XYZ sobre el DataFrame pivot (sku_id x fechas).

    ABC: por volumen acumulado (Pareto 80/15/5)
    XYZ: por coeficiente de variación (CV = std/mean)
    """
    total_por_sku = df_pivot.sum(axis=1)
    total_global = total_por_sku.sum()
    total_ordenado = total_por_sku.sort_values(ascending=False)
    acum = total_ordenado.cumsum() / total_global

    abc = pd.Series("C", index=total_ordenado.index)
    abc[acum <= 0.80] = "A"
    abc[(acum > 0.80) & (acum <= 0.95)] = "B"

    # CV por SKU (evitar div/0 con replace)
    media = df_pivot.mean(axis=1).replace(0, np.nan)
    std = df_pivot.std(axis=1)
    cv = (std / media).fillna(999.0)

    xyz = pd.Series("Z", index=df_pivot.index)
    xyz[cv <= 0.5] = "X"
    xyz[(cv > 0.5) & (cv <= 1.0)] = "Y"

    return pd.DataFrame({"cluster_abc": abc, "cluster_xyz": xyz})


def generar_dataset(
    n_skus: int = 25_000,
    n_years: int = 3,
    fecha_inicio: str = "2022-01-01",
    output_path: str = "data/ventas_25k_skus.parquet",
    seed: int = 42,
    chunk_size: int = 500,  # SKUs por chunk para no explotar RAM
) -> None:
    """
    Genera el dataset completo y lo guarda en Parquet con compresión Snappy.

    Parámetros
    ----------
    n_skus      : cantidad de SKUs a generar
    n_years     : años de historia diaria
    fecha_inicio: primera fecha del dataset
    output_path : ruta de salida del Parquet
    seed        : semilla aleatoria para reproducibilidad
    chunk_size  : SKUs procesados por lote (controla uso de RAM)
    """
    rng = np.random.default_rng(seed)
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    fechas = pd.date_range(start=fecha_inicio, periods=365 * n_years, freq="D")
    n_dias = len(fechas)

    # --- Asignar categoría y canal a cada SKU ---
    categorias_lista = list(CATEGORIAS_CONFIG.keys())
    pesos_cat = [CATEGORIAS_CONFIG[c]["peso"] for c in categorias_lista]
    pesos_cat_norm = np.array(pesos_cat) / sum(pesos_cat)

    sku_categorias = rng.choice(categorias_lista, size=n_skus, p=pesos_cat_norm)
    sku_canales = rng.choice(CANALES, size=n_skus, p=CANAL_PESOS)
    sku_ids = [f"SKU-{i+1:05d}" for i in range(n_skus)]

    # Precio fijo por SKU (no varía por día en esta versión)
    sku_precios = np.array([
        rng.uniform(*CATEGORIAS_CONFIG[cat]["precio_rango"])
        for cat in sku_categorias
    ])

    print(f"\n{'='*60}")
    print(f"  ForecastIQ — Generador de Dataset Masivo")
    print(f"{'='*60}")
    print(f"  SKUs:        {n_skus:,}")
    print(f"  Días:        {n_dias:,}  ({fecha_inicio} → {fechas[-1].date()})")
    print(f"  Filas total: {n_skus * n_dias:,}")
    print(f"  Output:      {output_path}")
    print(f"{'='*60}\n")

    t0 = time.time()
    chunks: list[pd.DataFrame] = []
    ventas_matrix = np.zeros((n_skus, n_dias), dtype=np.float32)

    # --- Generación por chunks ---
    n_chunks = (n_skus + chunk_size - 1) // chunk_size
    iterator = range(n_chunks)
    if HAS_TQDM:
        iterator = tqdm(iterator, desc="Generando SKUs", unit="chunk")

    for chunk_idx in iterator:
        start = chunk_idx * chunk_size
        end = min(start + chunk_size, n_skus)

        for i in range(start, end):
            cat = sku_categorias[i]
            cfg = CATEGORIAS_CONFIG[cat]
            ventas_matrix[i] = _generar_serie_ventas(
                n_dias=n_dias,
                base_min=cfg["ventas_base"][0],
                base_max=cfg["ventas_base"][1],
                tendencia=cfg["tendencia"],
                estac_anual=cfg["estac_anual"],
                estac_semanal=cfg["estac_semanal"],
                ruido=cfg["ruido"],
                prob_cero=cfg["prob_cero"],
                outlier_prob=cfg["outlier_prob"],
                outlier_mult_min=cfg["outlier_mult"][0],
                outlier_mult_max=cfg["outlier_mult"][1],
                rng=rng,
                fechas=fechas,
            )

    print("  Generación completada. Calculando ABC-XYZ...")

    # --- Clustering ABC-XYZ ---
    df_pivot = pd.DataFrame(
        ventas_matrix,
        index=sku_ids,
    )
    clusters = _calcular_abc_xyz(df_pivot)

    print("  Clustering OK. Construyendo DataFrame long format...")

    # --- Construir DataFrame en formato long (panel) ---
    # Repetir cada SKU n_dias veces → columnas base
    n_total = n_skus * n_dias

    sku_col = np.repeat(sku_ids, n_dias)
    cat_col = np.repeat(sku_categorias, n_dias)
    canal_col = np.repeat(sku_canales, n_dias)
    precio_col = np.repeat(sku_precios, n_dias).astype(np.float32)
    fecha_col = np.tile(fechas, n_skus)
    ventas_col = ventas_matrix.ravel()

    # Stock: ventas + buffer aleatorio (simulación simple)
    stock_buffer = rng.uniform(0.5, 3.0, size=n_total).astype(np.float32)
    stock_col = (ventas_col * stock_buffer).astype(np.float32)

    # ABC/XYZ: repetir n_dias veces
    abc_col = np.repeat(clusters["cluster_abc"].loc[sku_ids].values, n_dias)
    xyz_col = np.repeat(clusters["cluster_xyz"].loc[sku_ids].values, n_dias)

    df = pd.DataFrame({
        "sku_id":      sku_col,
        "categoria":   cat_col,
        "canal":       canal_col,
        "fecha":       fecha_col,
        "ventas":      ventas_col.astype(np.float32),
        "precio":      precio_col,
        "stock":       stock_col,
        "cluster_abc": abc_col,
        "cluster_xyz": xyz_col,
    })

    print(f"  DataFrame: {len(df):,} filas × {len(df.columns)} columnas")
    print("  Guardando en Parquet (Snappy)...")

    df.to_parquet(output_path, engine="pyarrow", compression="snappy", index=False)

    t1 = time.time()
    size_mb = Path(output_path).stat().st_size / (1024 ** 2)

    print(f"\n{'='*60}")
    print(f"  ✅ Dataset generado exitosamente")
    print(f"  Archivo:   {output_path}")
    print(f"  Tamaño:    {size_mb:.1f} MB")
    print(f"  Filas:     {len(df):,}")
    print(f"  Tiempo:    {t1 - t0:.1f}s")
    print(f"\n  Distribución ABC:")
    for label, count in df.drop_duplicates("sku_id")["cluster_abc"].value_counts().items():
        print(f"    {label}: {count:,} SKUs")
    print(f"\n  Distribución XYZ:")
    for label, count in df.drop_duplicates("sku_id")["cluster_xyz"].value_counts().items():
        print(f"    {label}: {count:,} SKUs")
    print(f"\n  Distribución por categoría:")
    for cat, count in df.drop_duplicates("sku_id")["categoria"].value_counts().items():
        print(f"    {cat}: {count:,} SKUs")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Genera dataset sintético masivo de ventas para ForecastIQ"
    )
    parser.add_argument("--skus", type=int, default=25_000, help="Número de SKUs (default: 25000)")
    parser.add_argument("--years", type=int, default=3, help="Años de historia (default: 3)")
    parser.add_argument("--output", type=str, default="data/ventas_25k_skus.parquet", help="Ruta de salida")
    parser.add_argument("--seed", type=int, default=42, help="Semilla aleatoria")
    parser.add_argument("--chunk", type=int, default=500, help="SKUs por chunk (RAM control)")
    args = parser.parse_args()

    generar_dataset(
        n_skus=args.skus,
        n_years=args.years,
        output_path=args.output,
        seed=args.seed,
        chunk_size=args.chunk,
    )
