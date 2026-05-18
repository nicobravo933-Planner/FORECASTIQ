"""Supabase client wrapper — Storage + DB."""

import uuid

from supabase import Client, create_client

from app.core.config import settings

BUCKET = "datasets"


def get_supabase() -> Client:
    """Retorna un cliente Supabase usando la service key (bypasea RLS)."""
    return create_client(settings.supabase_url, settings.supabase_service_key)


def upload_csv(content: bytes, original_filename: str) -> str:
    """Sube un CSV a Supabase Storage y retorna el dataset_id (UUID)."""
    dataset_id = str(uuid.uuid4())
    # Path dentro del bucket: <uuid>.csv
    storage_path = f"{dataset_id}.csv"

    client = get_supabase()
    client.storage.from_(BUCKET).upload(
        path=storage_path,
        file=content,
        file_options={"content-type": "text/csv", "upsert": "false"},
    )
    return dataset_id


def download_csv(dataset_id: str) -> bytes:
    """Descarga el CSV desde Storage dado un dataset_id."""
    client = get_supabase()
    storage_path = f"{dataset_id}.csv"
    response: bytes = client.storage.from_(BUCKET).download(storage_path)
    return response


def delete_csv(dataset_id: str) -> None:
    """Elimina el CSV del Storage (usado en limpieza TTL futura)."""
    client = get_supabase()
    client.storage.from_(BUCKET).remove([f"{dataset_id}.csv"])


def save_forecast_result(job_id: str, result: dict) -> None:
    """
    Persiste el resultado del forecast en la tabla `forecast_jobs` de Supabase.
    Hace upsert por job_id para que sea idempotente (reintento seguro).
    """
    client = get_supabase()
    client.table("forecast_jobs").upsert(
        {
            "job_id": job_id,
            "status": result.get("status", "done"),
            "dataset_id": result.get("dataset_id"),
            "model_used": result.get("model_used"),
            "freq": result.get("freq"),
            "horizon": result.get("horizon"),
            "metrics": result.get("metrics"),
            "historical": result.get("historical"),
            "predictions": result.get("predictions"),
            "error": result.get("error"),
            "created_at": result.get("created_at"),
        },
        on_conflict="job_id",
    ).execute()


def get_forecast_result(job_id: str) -> dict | None:
    """
    Recupera el resultado de un forecast desde Supabase.
    Retorna None si no existe.
    """
    client = get_supabase()
    response = client.table("forecast_jobs").select("*").eq("job_id", job_id).single().execute()
    return response.data if response.data else None
