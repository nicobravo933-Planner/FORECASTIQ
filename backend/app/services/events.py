"""
Servicio de eventos — CRUD en Supabase + feriados AR automáticos (holidays library).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from app.services.supabase import get_supabase

# Importación lazy de holidays para no romper si no está instalado aún
try:
    import holidays as holidays_lib

    _HOLIDAYS_AVAILABLE = True
except ImportError:
    _HOLIDAYS_AVAILABLE = False


# ── CRUD Supabase ─────────────────────────────────────────────────────────────


def list_events(user_id: str | None = None) -> list[dict[str, Any]]:
    """
    Retorna eventos del usuario + eventos globales (user_id IS NULL).
    Sin autenticación (Phase 5): retorna solo globales.
    """
    client = get_supabase()
    # Eventos globales
    q = client.table("events").select("*").is_("user_id", "null")
    rows: list[dict[str, Any]] = list(q.execute().data or [])

    # Eventos propios del usuario (si está autenticado)
    if user_id:
        user_rows: list[dict[str, Any]] = list(
            client.table("events").select("*").eq("user_id", user_id).execute().data or []
        )
        rows.extend(user_rows)

    return rows


def create_event(
    user_id: str | None,
    name: str,
    event_type: str,
    start_date: date,
    end_date: date,
    impact_pct: float | None = None,
) -> dict[str, Any]:
    """Inserta un nuevo evento en Supabase y retorna la fila creada."""
    client = get_supabase()
    payload = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "name": name,
        "type": event_type,
        "start_date": str(start_date),
        "end_date": str(end_date),
        "impact_pct": impact_pct,
        "is_global": False,
    }
    response = client.table("events").insert(payload).execute()
    data: list[dict[str, Any]] = list(response.data or [])
    if not data:
        raise RuntimeError("Error al crear evento en Supabase — respuesta vacía.")
    return data[0]


def delete_event(event_id: str, user_id: str | None) -> bool:
    """
    Elimina el evento si pertenece al usuario.
    Retorna True si se borró, False si no existía o no era del usuario.
    """
    client = get_supabase()
    q = client.table("events").delete().eq("id", event_id)
    if user_id:
        q = q.eq("user_id", user_id)
    else:
        # Sin autenticación: solo permite borrar eventos sin user_id
        q = q.is_("user_id", "null")

    response = q.execute()
    deleted: list[dict[str, Any]] = list(response.data or [])
    return len(deleted) > 0


# ── Feriados AR automáticos ───────────────────────────────────────────────────


def get_ar_holidays(year: int) -> list[dict[str, Any]]:
    """
    Retorna los feriados nacionales de Argentina para el año indicado
    como lista de dicts compatibles con EventResponse.
    Requiere la librería `holidays` (uv add holidays).
    """
    if not _HOLIDAYS_AVAILABLE:
        return []

    ar = holidays_lib.country_holidays("AR", years=year)  # type: ignore[attr-defined]
    result: list[dict[str, Any]] = []
    for h_date, h_name in sorted(ar.items()):
        result.append(
            {
                "id": f"ar-holiday-{h_date}",
                "user_id": None,
                "name": h_name,
                "type": "holiday",
                "start_date": str(h_date),  # datetime.date → str ISO
                "end_date": str(h_date),
                "impact_pct": None,
                "is_global": True,
            }
        )
    return result
