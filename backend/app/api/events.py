"""
Endpoints de eventos del calendario — E9.

  GET    /api/events                  → lista eventos del usuario + globales (feriados AR + comerciales)
  POST   /api/events                  → crea un evento propio
  PATCH  /api/events/{id}             → edita un evento propio
  DELETE /api/events/{id}             → elimina un evento propio
  GET    /api/events/as-features      → convierte eventos a features binarias para LightGBM
"""

from __future__ import annotations

import re
from datetime import date
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.services.events import (
    create_event,
    delete_event,
    events_to_features_df,
    get_ar_commercial_events,
    get_ar_holidays,
    list_events,
    update_event,
)

router = APIRouter(prefix="/api/events", tags=["events"])


def _col_name(event_name: str) -> str:
    """Sanitiza un nombre de evento a nombre de columna: is_black_friday."""
    slug = event_name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "_", slug)
    return f"is_{slug.strip('_')}"


# ── Schemas ───────────────────────────────────────────────────────────────────

EVENT_TYPES = ("holiday", "promotion", "seasonal", "other")


class EventCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    type: str = Field(..., pattern="^(holiday|promotion|seasonal|other)$")
    start_date: date
    end_date: date
    impact_pct: float | None = Field(default=None, ge=-100.0, le=500.0)
    dataset_id: str | None = None  # None = aplica a todos los datasets del usuario

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Black Friday",
                "type": "promotion",
                "start_date": "2024-11-29",
                "end_date": "2024-11-29",
                "impact_pct": 20.0,
                "dataset_id": None,
            }
        }
    }


class EventUpdateRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    type: str | None = Field(default=None, pattern="^(holiday|promotion|seasonal|other)$")
    start_date: date | None = None
    end_date: date | None = None
    impact_pct: float | None = Field(default=None, ge=-100.0, le=500.0)


class EventResponse(BaseModel):
    id: str
    name: str
    type: str
    start_date: str
    end_date: str
    impact_pct: float | None
    is_global: bool
    user_id: str | None
    dataset_id: str | None = None
    source: str = "manual"  # "manual" | "auto" (auto = generado algorítmicamente)


class EventListResponse(BaseModel):
    events: list[EventResponse]
    total: int


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("", response_model=EventListResponse)
async def list_user_events(
    year: int | None = None,
    include_holidays: bool = True,
) -> EventListResponse:
    """
    Retorna eventos propios del usuario + eventos globales.
    Si include_holidays=True agrega automáticamente los feriados AR del año indicado.
    """
    # Por ahora sin autenticación (Phase 5) — user_id hardcodeado como None
    # En Phase 5 se inyecta desde el JWT
    user_id: str | None = None

    rows = list_events(user_id=user_id)
    events: list[EventResponse] = [_row_to_response(r) for r in rows]

    # Feriados AR automáticos + eventos comerciales
    if include_holidays:
        target_year = year or date.today().year
        for h in get_ar_holidays(target_year):
            events.append(_row_to_response(h))
        for c in get_ar_commercial_events(target_year):
            events.append(_row_to_response(c))

    return EventListResponse(events=events, total=len(events))


@router.post("", response_model=EventResponse, status_code=201)
async def create_user_event(body: EventCreateRequest) -> EventResponse:
    """Crea un evento propio del usuario."""
    if body.end_date < body.start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date debe ser mayor o igual a start_date.",
        )

    user_id: str | None = None  # Phase 5: reemplazar con JWT uid

    row = create_event(
        user_id=user_id,
        name=body.name,
        event_type=body.type,
        start_date=body.start_date,
        end_date=body.end_date,
        impact_pct=body.impact_pct,
        dataset_id=body.dataset_id,
    )
    return _row_to_response(row)


@router.patch("/{event_id}", response_model=EventResponse)
async def update_user_event(event_id: str, body: EventUpdateRequest) -> EventResponse:
    """Edita campos de un evento propio. Solo el dueño puede editar."""
    user_id: str | None = None  # Phase 5: reemplazar con JWT uid

    if body.end_date and body.start_date and body.end_date < body.start_date:
        raise HTTPException(
            status_code=400,
            detail="end_date debe ser mayor o igual a start_date.",
        )

    row = update_event(
        event_id=event_id,
        user_id=user_id,
        name=body.name,
        event_type=body.type,
        start_date=body.start_date,
        end_date=body.end_date,
        impact_pct=body.impact_pct,
    )
    if row is None:
        raise HTTPException(
            status_code=404,
            detail=f"Evento '{event_id}' no encontrado o no pertenece al usuario.",
        )
    return _row_to_response(row)


@router.delete("/{event_id}", status_code=204)
async def delete_user_event(event_id: str) -> None:
    """Elimina un evento propio. No se pueden borrar eventos globales."""
    user_id: str | None = None  # Phase 5: reemplazar con JWT uid

    deleted = delete_event(event_id=event_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Evento '{event_id}' no encontrado o no pertenece al usuario.",
        )


# ── Helpers ───────────────────────────────────────────────────────────────────


class EventFeatureColumn(BaseModel):
    """Metadata de una columna de feature de evento."""

    column: str  # nombre de la columna, ej: is_black_friday
    event_name: str  # nombre original del evento
    event_type: str  # holiday | promotion | seasonal | other
    n_active: int  # cuántas fechas del dataset tienen este evento activo
    source: str  # manual | auto


class EventFeaturesResponse(BaseModel):
    """Respuesta del endpoint as-features."""

    dataset_id: str
    freq: str
    n_dates: int  # total de fechas en el rango
    n_events: int  # eventos únicos incluidos
    columns: list[EventFeatureColumn]  # metadata de cada columna
    # Datos como lista de registros: [{"date": "2024-11-29", "is_black_friday": 1, ...}]
    records: list[dict[str, object]]


@router.get("/as-features", response_model=EventFeaturesResponse)
async def get_events_as_features(
    dataset_id: str = Query(..., description="ID del dataset para alinear las fechas"),
    freq: str = Query(
        "MS", description="Frecuencia pandas: MS (mensual), W-MON (semanal), D (diario)"
    ),
    start: str | None = Query(None, description="Fecha inicio ISO, ej: 2022-01-01"),
    end: str | None = Query(None, description="Fecha fin ISO, ej: 2025-12-01"),
    include_holidays: bool = Query(
        True, description="Incluir feriados AR y eventos comerciales automáticos"
    ),
    years_ahead: int = Query(
        2, ge=1, le=5, description="Años futuros a incluir (para el forecast)"
    ),
) -> EventFeaturesResponse:
    """
    Convierte los eventos del usuario en un DataFrame de features binarias.

    Cada evento se convierte en una columna `is_<nombre>` con valor 1 en las
    fechas que coinciden con el rango del evento, 0 en el resto.

    Este endpoint es consumido por LightGBM antes del entrenamiento para
    incorporar eventos como variables explicativas (features externas).

    El rango de fechas puede ser:
      - Explícito con start/end
      - Inferido desde el dataset (carga el dataset para obtener min/max fecha)

    La respuesta incluye tanto metadata (columnas, n_active) como los datos
    en formato de registros para serialización JSON eficiente.
    """
    from app.services.storage import load_dataset

    user_id: str | None = None  # Phase 5: reemplazar con JWT uid

    # 1. Determinar rango de fechas
    if start and end:
        date_index = pd.date_range(start=start, end=end, freq=freq)
    else:
        # Infiere rango desde el dataset
        try:
            df = load_dataset(dataset_id)
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=404,
                detail=f"Dataset '{dataset_id}' no encontrado.",
            ) from exc

        # Detecta la columna de fecha (primera columna datetime o que tenga 'date' en el nombre)
        date_col: str | None = None
        for col in df.columns:
            if "date" in col.lower() or "fecha" in col.lower():
                date_col = col
                break
        if date_col is None:
            # Intenta parsear la primera columna
            date_col = df.columns[0]

        try:
            dates_parsed = pd.to_datetime(df[date_col], errors="coerce").dropna()
            ds_start = dates_parsed.min()
            # Extiende hasta years_ahead años desde hoy o desde el fin del dataset
            ds_end_data = dates_parsed.max()
            ds_end_future = pd.Timestamp.now() + pd.DateOffset(years=years_ahead)
            ds_end = max(ds_end_data, ds_end_future)
            date_index = pd.date_range(start=ds_start, end=ds_end, freq=freq)
        except Exception as exc:
            raise HTTPException(
                status_code=422,
                detail="No se pudo inferir el rango de fechas del dataset. Usá los parámetros start= y end=.",
            ) from exc

    if len(date_index) == 0:
        raise HTTPException(status_code=422, detail="El rango de fechas resultó vacío.")

    # 2. Recopilar todos los eventos del usuario + automáticos
    db_events = list_events(user_id=user_id)
    all_events: list[dict[str, Any]] = list(db_events)

    if include_holidays:
        # Cubre todos los años del rango
        years_in_range = range(date_index.min().year, date_index.max().year + 1)
        for yr in years_in_range:
            all_events.extend(get_ar_holidays(yr))
            all_events.extend(get_ar_commercial_events(yr))

    # 3. Construir DataFrame de features
    feat_df = events_to_features_df(all_events, date_index)

    # 4. Construir metadata de columnas
    feature_cols = [c for c in feat_df.columns if c != "date"]

    # Mapa nombre_columna → evento original para la metadata
    col_meta: dict[str, dict[str, str]] = {}
    for ev in all_events:
        col = _col_name(str(ev["name"]))
        if col not in col_meta:
            col_meta[col] = {
                "event_name": ev["name"],
                "event_type": ev.get("type", "other"),
                "source": str(ev.get("source", "manual")),
            }

    columns_meta: list[EventFeatureColumn] = []
    for col in feature_cols:
        meta = col_meta.get(col, {"event_name": col, "event_type": "other", "source": "manual"})
        columns_meta.append(
            EventFeatureColumn(
                column=col,
                event_name=str(meta["event_name"]),
                event_type=str(meta["event_type"]),
                n_active=int(feat_df[col].sum()),
                source=str(meta["source"]),
            )
        )

    # 5. Serializar registros (date como string ISO para JSON)
    feat_df["date"] = feat_df["date"].dt.strftime("%Y-%m-%d")
    records: list[dict[str, object]] = feat_df.to_dict(orient="records")

    return EventFeaturesResponse(
        dataset_id=dataset_id,
        freq=freq,
        n_dates=len(date_index),
        n_events=len(all_events),
        columns=columns_meta,
        records=records,
    )


# ── Helpers ───────────────────────────────────────────────────────────────────


def _row_to_response(row: dict[str, Any]) -> EventResponse:
    return EventResponse(
        id=str(row["id"]),
        name=row["name"],
        type=row["type"],
        start_date=str(row["start_date"]),
        end_date=str(row["end_date"]),
        impact_pct=row.get("impact_pct"),
        is_global=row.get("is_global", False),
        user_id=str(row["user_id"]) if row.get("user_id") else None,
        dataset_id=str(row["dataset_id"]) if row.get("dataset_id") else None,
        source=str(row.get("source", "manual")),
    )
