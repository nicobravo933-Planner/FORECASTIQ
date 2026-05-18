"""
Endpoints de eventos del calendario — Phase 3.

  GET    /api/events           → lista eventos del usuario + globales (feriados AR)
  POST   /api/events           → crea un evento propio
  DELETE /api/events/{id}      → elimina un evento propio
"""

from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.events import (
    create_event,
    delete_event,
    get_ar_holidays,
    list_events,
)

router = APIRouter(prefix="/api/events", tags=["events"])


# ── Schemas ───────────────────────────────────────────────────────────────────

EVENT_TYPES = ("holiday", "promotion", "seasonal", "other")


class EventCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    type: str = Field(..., pattern="^(holiday|promotion|seasonal|other)$")
    start_date: date
    end_date: date
    impact_pct: float | None = Field(default=None, ge=-100.0, le=500.0)

    model_config = {
        "json_schema_extra": {
            "example": {
                "name": "Black Friday",
                "type": "promotion",
                "start_date": "2024-11-29",
                "end_date": "2024-11-29",
                "impact_pct": 20.0,
            }
        }
    }


class EventResponse(BaseModel):
    id: str
    name: str
    type: str
    start_date: str
    end_date: str
    impact_pct: float | None
    is_global: bool
    user_id: str | None


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

    # Feriados AR automáticos
    if include_holidays:
        target_year = year or date.today().year
        for h in get_ar_holidays(target_year):
            events.append(_row_to_response(h))

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
    )
