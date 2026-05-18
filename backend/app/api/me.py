"""
Endpoint /api/me — Phase 5.

  GET /api/me          → perfil del usuario autenticado
  GET /api/me/history  → historial paginado de forecasts del usuario
"""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.core.dependencies import AuthUser
from app.services.supabase import get_forecast_history

router = APIRouter(prefix="/api/me", tags=["me"])


# ── Schemas ───────────────────────────────────────────────────────────────────


class MeResponse(BaseModel):
    user_id: str
    email: str
    name: str | None = None
    image: str | None = None


class ForecastHistoryItem(BaseModel):
    job_id: str
    status: str
    dataset_id: str | None = None
    model_used: str | None = None
    freq: str | None = None
    horizon: int | None = None
    metrics: dict[str, float | None] | None = None
    created_at: str | None = None


class HistoryResponse(BaseModel):
    page: int
    page_size: int
    items: list[ForecastHistoryItem]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("", response_model=MeResponse)
async def get_me(user: AuthUser) -> MeResponse:
    """Retorna el perfil del usuario extraído del JWT."""
    return MeResponse(
        user_id=user.user_id,
        email=user.email,
        name=user.name,
        image=user.image,
    )


@router.get("/history", response_model=HistoryResponse)
async def get_history(
    user: AuthUser,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> HistoryResponse:
    """
    Historial paginado de forecasts del usuario autenticado.
    Ordenado por created_at DESC (más reciente primero).
    """
    rows = get_forecast_history(user.user_id, page=page, page_size=page_size)
    items = [ForecastHistoryItem(**row) for row in rows]
    return HistoryResponse(page=page, page_size=page_size, items=items)
