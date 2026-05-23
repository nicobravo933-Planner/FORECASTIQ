"""
split_parquet.py
================
Parte data/ventas_25k_skus.parquet en chunks de ~45 MB
para subir a Supabase Storage free tier (límite 50 MB).

DuckDB puede leer múltiples Parquet con:
    read_parquet('datasets/chunk_*.parquet')

Uso:
    cd forecastiq/
    uv run --project backend python scripts/split_parquet.py

Output:
    data/chunks/ventas_chunk_001.parquet
    data/chunks/ventas_chunk_002.parquet
    ...
"""

import time
from pathlib import Path

import pandas as pd

INPUT = Path("data/ventas_25k_skus.parquet")
OUTDIR = Path("data/chunks")
TARGET_MB = 45  # margen sobre el límite de 50 MB de Supabase


def split() -> None:
    print(f"\n{'=' * 55}")
    print(f"  ForecastIQ — Split Parquet en chunks {TARGET_MB} MB")
    print(f"{'=' * 55}")

    t0 = time.time()
    OUTDIR.mkdir(parents=True, exist_ok=True)

    print(f"  Leyendo {INPUT} ...")
    df = pd.read_parquet(INPUT)
    total_rows = len(df)
    total_mb = INPUT.stat().st_size / (1024**2)

    # Calcular filas por chunk proporcionalmente
    n_chunks = int(total_mb / TARGET_MB) + 1
    rows_chunk = total_rows // n_chunks

    print(f"  Filas total:  {total_rows:,}")
    print(f"  Tamaño total: {total_mb:.1f} MB")
    print(f"  Chunks plan:  {n_chunks}  (~{rows_chunk:,} filas c/u)")
    print()

    archivos: list[str] = []
    for i in range(n_chunks):
        start = i * rows_chunk
        end = total_rows if i == n_chunks - 1 else (i + 1) * rows_chunk
        chunk = df.iloc[start:end]

        fname = OUTDIR / f"ventas_chunk_{i + 1:03d}.parquet"
        chunk.to_parquet(fname, engine="pyarrow", compression="snappy", index=False)

        size_mb = fname.stat().st_size / (1024**2)
        archivos.append(str(fname))
        print(
            f"  [{i + 1:02d}/{n_chunks}] {fname.name}  —  {len(chunk):,} filas  —  {size_mb:.1f} MB"
        )

    t1 = time.time()
    print(f"\n  ✅ {n_chunks} chunks guardados en {OUTDIR}/")
    print(f"  Tiempo: {t1 - t0:.1f}s")
    print("\n  Próximo paso: subir cada archivo al bucket 'datasets/' en Supabase")
    print("  DuckDB los lee con: read_parquet('datasets/ventas_chunk_*.parquet')")
    print(f"{'=' * 55}\n")


if __name__ == "__main__":
    split()
