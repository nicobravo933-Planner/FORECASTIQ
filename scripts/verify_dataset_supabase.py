"""
verify_dataset_supabase.py
==========================
Verifica que los chunks Parquet subidos a Supabase Storage
son legibles con DuckDB via URL firmada.

Uso:
    cd forecastiq/
    uv run --project backend python scripts/verify_dataset_supabase.py
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "datasets"
FOLDER = "ventas_25k_skus"
N_CHUNKS = 6


def verify() -> None:
    import duckdb
    from supabase import create_client

    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print(f"\n{'=' * 55}")
    print("  ForecastIQ — Verificación dataset en Supabase")
    print(f"{'=' * 55}\n")

    # 1. Listar archivos en el bucket
    files = client.storage.from_(BUCKET).list(FOLDER)
    parquet_files = sorted([f["name"] for f in files if f["name"].endswith(".parquet")])
    print(f"  Archivos encontrados en {BUCKET}/{FOLDER}/:")
    for f in parquet_files:
        print(f"    ✔ {f}")

    if len(parquet_files) != N_CHUNKS:
        print(
            f"\n  ⚠️  Se esperaban {N_CHUNKS} chunks, se encontraron {len(parquet_files)}"
        )

    # 2. Construir URLs públicas directas (bucket público, sin signed URLs)
    base_url = f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{FOLDER}"
    signed_urls = [f"{base_url}/{fname}" for fname in parquet_files]

    print(f"\n  URLs públicas generadas: {len(signed_urls)}")
    for url in signed_urls:
        print(f"    {url.split('/')[-1]}")

    # 3. Leer con DuckDB — COUNT total + muestra de columnas
    print("\n  Leyendo con DuckDB...")
    con = duckdb.connect()

    urls_list = str(signed_urls).replace("'", '"')
    query = f"""
        SELECT
            COUNT(*)                        AS total_filas,
            COUNT(DISTINCT sku_id)          AS total_skus,
            COUNT(DISTINCT categoria)       AS categorias,
            MIN(fecha)::VARCHAR             AS fecha_min,
            MAX(fecha)::VARCHAR             AS fecha_max,
            ROUND(AVG(ventas)::DOUBLE, 2)   AS ventas_promedio
        FROM read_parquet({urls_list})
    """
    row = con.execute(query).fetchone()

    print(f"\n  {'=' * 45}")
    print("  ✅ Dataset verificado en Supabase Storage")
    print(f"  {'=' * 45}")
    print(f"  Total filas:      {row[0]:,}")
    print(f"  SKUs únicos:      {row[1]:,}")
    print(f"  Categorías:       {row[2]}")
    print(f"  Período:          {row[3]} → {row[4]}")
    print(f"  Ventas promedio:  {row[5]}")
    print(f"  {'=' * 45}\n")


if __name__ == "__main__":
    verify()
