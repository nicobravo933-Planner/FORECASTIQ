"""
Servicio de eventos — CRUD en Supabase + feriados AR automáticos (holidays library).
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any, cast

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
    rows: list[dict[str, Any]] = cast(list[dict[str, Any]], q.execute().data or [])

    # Eventos propios del usuario (si está autenticado)
    if user_id:
        user_rows: list[dict[str, Any]] = cast(
            list[dict[str, Any]],
            client.table("events").select("*").eq("user_id", user_id).execute().data or [],
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
    dataset_id: str | None = None,
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
        "dataset_id": dataset_id,
    }
    response = client.table("events").insert(payload).execute()
    data: list[dict[str, Any]] = cast(list[dict[str, Any]], response.data or [])
    if not data:
        raise RuntimeError("Error al crear evento en Supabase — respuesta vacía.")
    return data[0]


def update_event(
    event_id: str,
    user_id: str | None,
    name: str | None = None,
    event_type: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
    impact_pct: float | None = None,
) -> dict[str, Any] | None:
    """
    Actualiza campos de un evento propio (PATCH parcial).
    Retorna la fila actualizada, o None si no existe / no pertenece al usuario.
    """
    client = get_supabase()
    patch: dict[str, Any] = {}
    if name is not None:
        patch["name"] = name
    if event_type is not None:
        patch["type"] = event_type
    if start_date is not None:
        patch["start_date"] = str(start_date)
    if end_date is not None:
        patch["end_date"] = str(end_date)
    if impact_pct is not None:
        patch["impact_pct"] = impact_pct

    if not patch:
        # Nada que actualizar — retorna el evento actual
        rows = cast(
            list[dict[str, Any]],
            client.table("events").select("*").eq("id", event_id).execute().data or [],
        )
        return rows[0] if rows else None

    q = client.table("events").update(patch).eq("id", event_id)
    if user_id:
        q = q.eq("user_id", user_id)
    else:
        q = q.is_("user_id", "null")

    response = q.execute()
    updated: list[dict[str, Any]] = cast(list[dict[str, Any]], response.data or [])
    return updated[0] if updated else None


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
    deleted: list[dict[str, Any]] = cast(list[dict[str, Any]], response.data or [])
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

    ar = holidays_lib.country_holidays("AR", years=year)
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


# ── Eventos comerciales AR automáticos ───────────────────────────────────────


def _nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """
    Retorna la fecha del n-ésimo `weekday` del mes indicado.
    weekday: 0=lunes … 6=domingo (convención Python datetime).
    n: 1=primero, 2=segundo, 3=tercero, 4=cuarto.
    """
    from calendar import monthcalendar

    weeks = monthcalendar(year, month)
    # monthcalendar devuelve semanas con 0 donde el día no existe en ese mes
    candidates = [w[weekday] for w in weeks if w[weekday] != 0]
    return date(year, month, candidates[n - 1])


# Fechas aproximadas de Hot Sale y CyberWeek por año (CACE las publica con pocas semanas
# de anticipación — actualizamos cuando se confirman, mientras tanto usamos histórico).
_HOT_SALE_DATES: dict[int, tuple[str, str]] = {
    2023: ("2023-05-08", "2023-05-10"),
    2024: ("2024-05-13", "2024-05-15"),
    2025: ("2025-05-12", "2025-05-14"),
    2026: ("2026-05-11", "2026-05-13"),  # estimado
}
_CYBER_WEEK_DATES: dict[int, tuple[str, str]] = {
    2023: ("2023-06-05", "2023-06-11"),
    2024: ("2024-06-03", "2024-06-09"),
    2025: ("2025-06-02", "2025-06-08"),
    2026: ("2026-06-01", "2026-06-07"),  # estimado
}


def events_to_features_df(
    events: list[dict[str, Any]],
    date_index: Any,
) -> Any:
    """
    Convierte una lista de eventos en un DataFrame de features binarias.

    Por cada evento se genera una columna `is_<nombre_sanitizado>` con valor 1
    en las fechas que caen dentro del rango [start_date, end_date] del evento,
    y 0 en el resto.

    Ejemplo de salida:
      date        is_black_friday  is_hot_sale  is_feriado_navidad
      2024-11-29       1               0               0
      2024-12-25       0               0               1

    Parámetros:
      events     → lista de dicts con keys: name, start_date, end_date
      date_index → DatetimeIndex con las fechas del dataset (puede ser mensual,
                   semanal o diario — la función alinea correctamente)

    Retorna un DataFrame con una fila por fecha del date_index.
    Si no hay eventos, retorna un DataFrame vacío con solo la columna 'date'.
    """
    import re

    import numpy as np
    import pandas as pd

    df = pd.DataFrame({"date": date_index})
    df["date"] = pd.to_datetime(df["date"])

    if not events:
        return df

    def _sanitize(name: str) -> str:
        """Convierte nombre de evento en nombre de columna válido: is_black_friday."""
        slug = name.lower().strip()
        slug = re.sub(r"[^a-z0-9]+", "_", slug)  # reemplaza no-alfanumérico con _
        slug = slug.strip("_")
        return f"is_{slug}"

    # Construye máscara para cada evento
    for ev in events:
        col = _sanitize(str(ev["name"]))
        start = pd.to_datetime(str(ev["start_date"]))
        end = pd.to_datetime(str(ev["end_date"]))

        # Para frecuencias mensuales/semanales: el evento se activa si ALGÚN
        # día del período cae dentro del rango del evento.
        # La lógica: el período comienza antes del fin del evento Y termina
        # después del inicio del evento (overlap).
        mask = (df["date"] <= end) & (df["date"] >= start)

        # Si la columna ya existe (dos eventos con nombre similar), hace OR
        if col in df.columns:
            df[col] = (df[col].astype(bool) | mask).astype(np.int8)
        else:
            df[col] = mask.astype(np.int8)

    return df


def get_ar_commercial_events(year: int) -> list[dict[str, Any]]:
    """
    Retorna eventos comerciales relevantes de Argentina para el año indicado.
    Calculados algorítmicamente — no requieren base de datos.

    Incluye:
      - Black Friday (4to viernes de noviembre)
      - Cyber Monday (lunes siguiente al Black Friday)
      - Día del Niño AR (3er domingo de agosto)
      - Hot Sale AR (fechas CACE, aproximadas si no confirmadas)
      - CyberWeek AR (fechas CACE, aproximadas si no confirmadas)

    Navidad y Año Nuevo ya están cubiertos por get_ar_holidays().
    """
    result: list[dict[str, Any]] = []

    # Black Friday — 4to viernes de noviembre
    bf_date = _nth_weekday(year, 11, 4, 4)  # mes=11, viernes=4, 4to
    result.append(
        {
            "id": f"ar-commercial-black-friday-{year}",
            "user_id": None,
            "name": "Black Friday",
            "type": "promotion",
            "start_date": str(bf_date),
            "end_date": str(bf_date),
            "impact_pct": None,  # LightGBM aprende el impacto real de los datos
            "is_global": True,
            "source": "auto",
        }
    )

    # Cyber Monday — lunes siguiente al Black Friday
    from datetime import timedelta

    cm_date = bf_date + timedelta(days=3)  # viernes + 3 = lunes
    result.append(
        {
            "id": f"ar-commercial-cyber-monday-{year}",
            "user_id": None,
            "name": "Cyber Monday",
            "type": "promotion",
            "start_date": str(cm_date),
            "end_date": str(cm_date),
            "impact_pct": None,
            "is_global": True,
            "source": "auto",
        }
    )

    # Día del Niño AR — 3er domingo de agosto
    dia_nino = _nth_weekday(year, 8, 6, 3)  # mes=8, domingo=6, 3ro
    result.append(
        {
            "id": f"ar-commercial-dia-nino-{year}",
            "user_id": None,
            "name": "Día del Niño",
            "type": "seasonal",
            "start_date": str(dia_nino),
            "end_date": str(dia_nino),
            "impact_pct": None,
            "is_global": True,
            "source": "auto",
        }
    )

    # Hot Sale AR — fechas CACE (tabla estática, se actualiza cada año)
    if year in _HOT_SALE_DATES:
        hs_start, hs_end = _HOT_SALE_DATES[year]
        result.append(
            {
                "id": f"ar-commercial-hot-sale-{year}",
                "user_id": None,
                "name": "Hot Sale",
                "type": "promotion",
                "start_date": hs_start,
                "end_date": hs_end,
                "impact_pct": None,
                "is_global": True,
                "source": "auto",
            }
        )

    # CyberWeek AR — fechas CACE (tabla estática)
    if year in _CYBER_WEEK_DATES:
        cw_start, cw_end = _CYBER_WEEK_DATES[year]
        result.append(
            {
                "id": f"ar-commercial-cyber-week-{year}",
                "user_id": None,
                "name": "CyberWeek",
                "type": "promotion",
                "start_date": cw_start,
                "end_date": cw_end,
                "impact_pct": None,
                "is_global": True,
                "source": "auto",
            }
        )

    return result
