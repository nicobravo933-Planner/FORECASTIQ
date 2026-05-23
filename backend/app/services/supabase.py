"""Supabase client wrapper — Storage + DB."""

from __future__ import annotations

import uuid
from datetime import UTC
from typing import Any

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


def register_dataset(
    dataset_id: str,
    filename: str,
    rows: int,
    columns: list[str],
    user_id: str | None = None,
) -> None:
    """Registra metadata del dataset en la tabla `datasets`."""
    client = get_supabase()
    client.table("datasets").insert(
        {
            "dataset_id": dataset_id,
            "filename": filename,
            "rows": rows,
            "columns": columns,
            "user_id": user_id,
        }
    ).execute()


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


def save_forecast_result(job_id: str, result: dict[str, Any], user_id: str | None = None) -> None:
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
            "user_id": user_id,
            "created_at": result.get("created_at"),
        },
        on_conflict="job_id",
    ).execute()


def get_forecast_result(job_id: str) -> dict[str, Any] | None:
    """
    Recupera el resultado de un forecast desde Supabase.
    Retorna None si no existe.
    """
    client = get_supabase()
    response = client.table("forecast_jobs").select("*").eq("job_id", job_id).single().execute()
    data = response.data
    if not data or not isinstance(data, dict):
        return None
    return dict(data)


def get_forecast_history(user_id: str, page: int = 1, page_size: int = 20) -> list[dict[str, Any]]:
    """
    Retorna el historial paginado de forecasts de un usuario.
    Ordena por created_at DESC (más reciente primero).
    """
    client = get_supabase()
    offset = (page - 1) * page_size
    response = (
        client.table("forecast_jobs")
        .select("job_id, status, dataset_id, model_used, freq, horizon, metrics, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    data = response.data
    if not data or not isinstance(data, list):
        return []
    return [dict(row) for row in data if isinstance(row, dict)]


def list_user_datasets(user_id: str) -> list[dict[str, Any]]:
    """
    Lista todos los datasets de un usuario, ordenados por fecha de creación DESC.
    Usa service key (bypasea RLS) pero filtra manualmente por user_id.
    """
    client = get_supabase()
    response = (
        client.table("datasets")
        .select("dataset_id, filename, rows, columns, created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    data = response.data
    if not data or not isinstance(data, list):
        return []
    return [dict(row) for row in data if isinstance(row, dict)]


def list_recent_datasets(hours: int = 48) -> list[dict[str, Any]]:
    """
    Lista los datasets registrados en las últimas `hours` horas.
    Usado por el Celery Beat nocturno para saber qué datasets re-forecastear.

    Retorna lista de dicts con: id (=dataset_id), filename, date_column,
    target_column, freq, horizon, user_id.
    Los campos date_column/target_column/freq/horizon pueden ser None si el
    usuario no completó la configuración — el caller usa defaults.
    """
    from datetime import datetime, timedelta

    cutoff = (datetime.now(tz=UTC) - timedelta(hours=hours)).isoformat()
    client = get_supabase()
    response = (
        client.table("datasets")
        .select(
            "dataset_id, filename, date_column, target_column, freq, horizon, user_id, created_at"
        )
        .gte("created_at", cutoff)
        .order("created_at", desc=True)
        .execute()
    )
    data = response.data
    if not data or not isinstance(data, list):
        return []
    # Normaliza: usa dataset_id como clave 'id' para que el caller lo consuma limpio
    result: list[dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        item = dict(row)
        item["id"] = item.get("dataset_id", "")
        result.append(item)
    return result


# ── Chat conversations ────────────────────────────────────────────────────────


def save_conversation(
    conversation_id: str | None,
    user_id: str,
    title: str,
    messages: list[dict[str, Any]],
    model_id: str | None = None,
) -> str:
    """
    Crea o actualiza una conversación de chat.
    Retorna el id de la conversación (uuid string).
    Si conversation_id es None, crea una nueva.
    """
    client = get_supabase()
    if conversation_id:
        # Actualiza mensajes, título y modelo — updated_at lo pone el trigger
        client.table("chat_conversations").update(
            {
                "title": title,
                "messages": messages,
                "model_id": model_id,
            }
        ).eq("id", conversation_id).eq("user_id", user_id).execute()
        return conversation_id
    else:
        # Inserta nueva conversación
        response = (
            client.table("chat_conversations")
            .insert(
                {
                    "user_id": user_id,
                    "title": title,
                    "messages": messages,
                    "model_id": model_id,
                }
            )
            .execute()
        )
        data = response.data
        if data and isinstance(data, list) and isinstance(data[0], dict):
            return str(data[0]["id"])
        raise RuntimeError("Failed to create conversation — no id returned")


def list_conversations(
    user_id: str,
    page: int = 1,
    page_size: int = 30,
) -> list[dict[str, Any]]:
    """
    Lista conversaciones de un usuario, ordenadas por updated_at DESC.
    Retorna solo metadatos (sin el array messages completo para ahorrar ancho de banda).
    """
    client = get_supabase()
    offset = (page - 1) * page_size
    response = (
        client.table("chat_conversations")
        .select("id, title, model_id, created_at, updated_at")
        .eq("user_id", user_id)
        .order("updated_at", desc=True)
        .range(offset, offset + page_size - 1)
        .execute()
    )
    data = response.data
    if not data or not isinstance(data, list):
        return []
    return [dict(row) for row in data if isinstance(row, dict)]


def get_conversation(
    conversation_id: str,
    user_id: str,
) -> dict[str, Any] | None:
    """
    Retorna una conversación completa (con messages) o None si no existe
    o no pertenece al usuario.
    """
    client = get_supabase()
    response = (
        client.table("chat_conversations")
        .select("*")
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    data = response.data
    if not data or not isinstance(data, dict):
        return None
    return dict(data)


def delete_conversation(conversation_id: str, user_id: str) -> bool:
    """
    Borra una conversación. Retorna True si se borró, False si no existía
    o no pertenece al usuario.
    """
    client = get_supabase()
    response = (
        client.table("chat_conversations")
        .delete()
        .eq("id", conversation_id)
        .eq("user_id", user_id)
        .execute()
    )
    data = response.data
    return bool(data and isinstance(data, list) and len(data) > 0)
