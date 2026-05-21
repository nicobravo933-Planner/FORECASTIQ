"""
upload_dataset_to_supabase.py
==============================
Sube data/ventas_25k_skus.parquet al bucket 'datasets' de Supabase Storage.

Uso:
    cd forecastiq/
    python scripts/upload_dataset_to_supabase.py

    # Para un archivo distinto:
    python scripts/upload_dataset_to_supabase.py --file data/ventas_25k_skus.parquet

Requisitos:
    pip install supabase python-dotenv
"""

import argparse
import os
import time
from pathlib import Path

from dotenv import load_dotenv

# Leer credenciales desde backend/.env
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
BUCKET = "datasets"
STORAGE_PATH = "ventas_25k_skus.parquet"  # ruta dentro del bucket


def upload(file_path: str) -> None:
    from supabase import create_client

    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {file_path}")

    size_mb = path.stat().st_size / (1024 ** 2)
    print(f"\n{'='*55}")
    print(f"  ForecastIQ — Upload a Supabase Storage")
    print(f"{'='*55}")
    print(f"  Archivo:  {path}")
    print(f"  Tamaño:   {size_mb:.1f} MB")
    print(f"  Bucket:   {BUCKET}/{STORAGE_PATH}")
    print(f"  URL:      {SUPABASE_URL}")
    print(f"{'='*55}\n")

    # Usar service key para saltear RLS en Storage
    client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    print("  Subiendo... (puede tardar 1-3 min para 255 MB)")
    t0 = time.time()

    with open(path, "rb") as f:
        data = f.read()

    # Intentar upload; si ya existe, hacer upsert con update
    try:
        client.storage.from_(BUCKET).upload(
            path=STORAGE_PATH,
            file=data,
            file_options={"content-type": "application/octet-stream", "upsert": "true"},
        )
    except Exception as e:
        # Algunos clientes no soportan upsert directo — intentar remove + upload
        if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
            print("  Archivo ya existe — reemplazando...")
            client.storage.from_(BUCKET).remove([STORAGE_PATH])
            with open(path, "rb") as f:
                data = f.read()
            client.storage.from_(BUCKET).upload(
                path=STORAGE_PATH,
                file=data,
                file_options={"content-type": "application/octet-stream"},
            )
        else:
            raise

    t1 = time.time()

    # Verificar que subió correctamente
    files = client.storage.from_(BUCKET).list()
    uploaded = next((f for f in files if f["name"] == STORAGE_PATH), None)

    if uploaded:
        print(f"\n{'='*55}")
        print(f"  ✅ Upload exitoso")
        print(f"  Ruta:    {BUCKET}/{STORAGE_PATH}")
        print(f"  Tiempo:  {t1 - t0:.1f}s")
        print(f"  ID:      {uploaded.get('id', 'n/a')}")
        print(f"{'='*55}\n")
    else:
        print("  ⚠️  Upload completado pero no se pudo verificar en el listado.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Sube el dataset Parquet a Supabase Storage")
    parser.add_argument(
        "--file",
        type=str,
        default="data/ventas_25k_skus.parquet",
        help="Ruta local del archivo Parquet (default: data/ventas_25k_skus.parquet)",
    )
    args = parser.parse_args()
    upload(args.file)
