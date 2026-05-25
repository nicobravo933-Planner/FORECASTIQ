"""
Abstracción de storage para datasets de usuarios.

  STORAGE_BACKEND=supabase  → uploads van a Supabase Storage (cloud/ec2)
  STORAGE_BACKEND=local     → uploads van a disco local (dev/privado)

Todo el código de la app debe usar esta capa — nunca llamar a supabase.upload_csv()
directamente. Así cambiar de backend es un solo cambio de variable de entorno.

Modos:
  supabase:
    - save_dataset()   → upload a bucket "datasets" en Supabase Storage
    - load_dataset()   → download desde Supabase Storage
    - delete_dataset_file() → remove del bucket
    - Los archivos se guardan como Parquet comprimido (snappy) sin importar el
      formato original, para ahorrar espacio en el free tier de 1 GB.

  local:
    - save_dataset()   → escribe en LOCAL_STORAGE_PATH/{dataset_id}.parquet
    - load_dataset()   → lee desde disco
    - delete_dataset_file() → borra el archivo
    - Los datos nunca salen de la máquina del usuario.
"""

from __future__ import annotations

import io
import os
import uuid
from pathlib import Path

import pandas as pd

from app.core.config import settings

# Bucket de Supabase — solo para modo supabase
_BUCKET = "datasets"


# ── API pública ───────────────────────────────────────────────────────────────


def new_dataset_id() -> str:
    """Genera un dataset_id único (UUID v4)."""
    return str(uuid.uuid4())


def save_dataset(df: pd.DataFrame, dataset_id: str) -> None:
    """
    Persiste el DataFrame como Parquet comprimido.
    El formato original (CSV/Excel/Parquet) ya fue parseado — siempre guardamos Parquet.
    Parquet snappy es 3-5x más compacto que CSV, maximiza el free tier de 1 GB de Supabase.
    """
    parquet_bytes = _df_to_parquet_bytes(df)
    if settings.storage_backend == "local":
        _save_local(parquet_bytes, dataset_id)
    else:
        _save_supabase(parquet_bytes, dataset_id)


def load_dataset(dataset_id: str) -> pd.DataFrame:
    """
    Carga el DataFrame desde storage y lo retorna como pandas DataFrame.
    Lanza FileNotFoundError si el dataset no existe.
    """
    if settings.storage_backend == "local":
        parquet_bytes = _load_local(dataset_id)
    else:
        parquet_bytes = _load_supabase(dataset_id)
    return pd.read_parquet(io.BytesIO(parquet_bytes))


def delete_dataset_file(dataset_id: str) -> None:
    """
    Borra el archivo físico del dataset (Parquet).
    No borra la metadata de la tabla `datasets` en Supabase — eso lo hace supabase.delete_dataset().
    Silencia errores si el archivo ya no existe.
    """
    try:
        if settings.storage_backend == "local":
            _delete_local(dataset_id)
        else:
            _delete_supabase(dataset_id)
    except Exception:
        pass  # silenciar — puede que ya haya sido borrado


def dataset_exists(dataset_id: str) -> bool:
    """Verifica si el archivo del dataset existe en storage."""
    if settings.storage_backend == "local":
        return _local_path(dataset_id).exists()
    else:
        return _supabase_exists(dataset_id)


def storage_info() -> dict[str, str]:
    """Retorna info del backend activo — para el endpoint /api/capabilities."""
    if settings.storage_backend == "local":
        path = Path(settings.local_storage_path).resolve()
        return {
            "backend": "local",
            "path": str(path),
            "ttl_hours": "never",
        }
    return {
        "backend": "supabase",
        "bucket": _BUCKET,
        "ttl_hours": str(settings.dataset_ttl_hours),
    }


# ── Helpers internos ──────────────────────────────────────────────────────────


def _df_to_parquet_bytes(df: pd.DataFrame) -> bytes:
    """Serializa un DataFrame a bytes Parquet con compresión snappy."""
    buf = io.BytesIO()
    df.to_parquet(buf, index=False, compression="snappy", engine="pyarrow")
    return buf.getvalue()


def _local_path(dataset_id: str) -> Path:
    """Retorna el path local de un dataset."""
    base = Path(settings.local_storage_path)
    base.mkdir(parents=True, exist_ok=True)
    return base / f"{dataset_id}.parquet"


def _save_local(data: bytes, dataset_id: str) -> None:
    path = _local_path(dataset_id)
    path.write_bytes(data)


def _load_local(dataset_id: str) -> bytes:
    path = _local_path(dataset_id)
    if not path.exists():
        raise FileNotFoundError(f"Dataset '{dataset_id}' no encontrado en storage local.")
    return path.read_bytes()


def _delete_local(dataset_id: str) -> None:
    path = _local_path(dataset_id)
    if path.exists():
        os.remove(path)


def _save_supabase(data: bytes, dataset_id: str) -> None:
    from app.services.supabase import get_supabase

    client = get_supabase()
    storage_path = f"{dataset_id}.parquet"
    # upsert=true permite sobreescribir — necesario para archivos _etl que se
    # regeneran cada vez que el usuario cambia los parámetros del ETL.
    client.storage.from_(_BUCKET).upload(
        path=storage_path,
        file=data,
        file_options={"content-type": "application/octet-stream", "upsert": "true"},
    )


def _load_supabase(dataset_id: str) -> bytes:
    from app.services.supabase import get_supabase

    client = get_supabase()
    storage_path = f"{dataset_id}.parquet"
    response: bytes = client.storage.from_(_BUCKET).download(storage_path)
    return response


def _delete_supabase(dataset_id: str) -> None:
    from app.services.supabase import get_supabase

    client = get_supabase()
    # Intenta borrar .parquet primero, luego .csv (datasets viejos pre-migración)
    for ext in ("parquet", "csv"):
        try:
            client.storage.from_(_BUCKET).remove([f"{dataset_id}.{ext}"])
        except Exception:
            pass


def _supabase_exists(dataset_id: str) -> bool:
    from app.services.supabase import get_supabase

    client = get_supabase()
    try:
        client.storage.from_(_BUCKET).download(f"{dataset_id}.parquet")
        return True
    except Exception:
        try:
            client.storage.from_(_BUCKET).download(f"{dataset_id}.csv")
            return True
        except Exception:
            return False
