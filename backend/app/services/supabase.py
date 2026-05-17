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
