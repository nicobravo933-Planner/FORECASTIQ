"""
Endpoint de chat con streaming SSE — Phase 4.

  POST /api/chat/stream   → StreamingResponse text/event-stream
  GET  /api/chat/models   → lista de modelos disponibles
"""

from __future__ import annotations

import io
import logging
from collections.abc import AsyncGenerator
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.llm.client import stream_llm_response
from app.services.llm.tools import FREE_MODELS
from app.services.redis_cache import CHAT_RATE_LIMIT, check_rate_limit
from app.services.supabase import download_csv, get_forecast_result

router = APIRouter(prefix="/api/chat", tags=["chat"])
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────


class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class ChatStreamRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    history: list[ChatMessage] = Field(default_factory=list)
    model: str | None = None
    dataset_id: str | None = None
    job_id: str | None = None


class ModelInfo(BaseModel):
    id: str
    label: str


# ── Helpers de contexto ───────────────────────────────────────────────────────


def _build_dataset_schema(dataset_id: str) -> str:
    """Descarga el CSV y retorna un resumen del esquema para el system prompt."""
    try:
        csv_bytes = download_csv(dataset_id)
        df = pd.read_csv(io.BytesIO(csv_bytes))
        # Solo primeras 3 filas para no inflar el prompt
        sample = df.head(3).to_dict(orient="records")
        cols = {col: str(df[col].dtype) for col in df.columns}
        n_rows = len(df)
        date_range = ""
        # Detecta columna de fecha para mostrar rango
        for col in df.columns:
            if df[col].dtype == "object":
                try:
                    parsed = pd.to_datetime(df[col], errors="coerce")
                    if parsed.notna().sum() > n_rows * 0.8:
                        date_range = f"Date range: {parsed.min().date()} → {parsed.max().date()}"
                        break
                except Exception:
                    pass
        return f"Columns: {cols}\nTotal rows: {n_rows}\n{date_range}\nSample rows: {sample}"
    except Exception as exc:
        logger.warning("Could not build dataset schema for %s: %s", dataset_id, exc)
        return f"Dataset ID: {dataset_id} (schema unavailable)"


def _build_forecast_summary(job_id: str) -> str:
    """Retorna un resumen de métricas del forecast para el system prompt."""
    try:
        data = get_forecast_result(job_id)
        if not data:
            return f"Job {job_id} not found."
        m = data.get("metrics") or {}
        return (
            f"Model: {data.get('model_used')} | "
            f"Horizon: {data.get('horizon')} periods | "
            f"Freq: {data.get('freq')} | "
            f"WAPE: {m.get('wape')} | MAE: {m.get('mae')} | "
            f"BIAS: {m.get('bias')} | RMSE: {m.get('rmse')}"
        )
    except Exception as exc:
        logger.warning("Could not build forecast summary for %s: %s", job_id, exc)
        return f"Forecast job {job_id} (summary unavailable)"


def _build_events_summary() -> str:
    """Retorna un resumen de eventos activos para el system prompt."""
    try:
        from datetime import date

        from app.services.events import get_ar_holidays, list_events

        year = date.today().year
        events = list_events(user_id=None) + get_ar_holidays(year)
        if not events:
            return "No active events."
        lines = [
            f"- {e.get('name')} ({e.get('event_type')}, {str(e.get('start_date', ''))[:10]} "
            f"→ {str(e.get('end_date', ''))[:10]}, impact: {e.get('impact_pct', 'N/A')}%)"
            for e in events[:10]  # máximo 10 para no inflar el prompt
        ]
        return "\n".join(lines)
    except Exception as exc:
        logger.warning("Could not build events summary: %s", exc)
        return "Events unavailable."


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/models", response_model=list[ModelInfo])
async def list_models() -> list[ModelInfo]:
    """Retorna la lista de modelos libres disponibles."""
    return [ModelInfo(id=m["id"], label=m["label"]) for m in FREE_MODELS]


@router.post("/stream")
async def chat_stream(body: ChatStreamRequest, request: Request) -> StreamingResponse:
    """
    SSE streaming endpoint.
    Acepta un mensaje + historial y devuelve tokens en tiempo real.

    Eventos SSE emitidos:
      {"type": "token",       "content": "..."}
      {"type": "tool_call",   "tool": "...", "input": {...}}
      {"type": "tool_result", "tool": "...", "result": {...}}
      {"type": "suggestions", "items": ["...", "..."]}
      {"type": "done"}
      {"type": "error",       "message": "..."}
    """
    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Rate limiting: 30 req/hora por IP (Phase 5: sustituir por user_id)
    client_ip = request.client.host if request.client else "unknown"
    rl = check_rate_limit(client_ip)
    if not rl.allowed:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {rl.reset_in}s ({CHAT_RATE_LIMIT} requests/hour).",
            headers={"Retry-After": str(rl.reset_in)},
        )

    # Construye el contexto de sesión para el LLM
    session_context: dict[str, Any] = {
        "active_model": body.model,
        "dataset_id": body.dataset_id,
        "job_id": body.job_id,
        "dataset_schema": (
            _build_dataset_schema(body.dataset_id) if body.dataset_id else "No dataset loaded."
        ),
        "forecast_summary": (
            _build_forecast_summary(body.job_id) if body.job_id else "No forecast run yet."
        ),
        "events_summary": _build_events_summary(),
        "freq_label": "monthly",  # Phase 5: leer desde el job
    }

    history = [{"role": m.role, "content": m.content} for m in body.history]

    async def generate() -> AsyncGenerator[str, None]:
        async for chunk in stream_llm_response(
            user_message=body.message,
            history=history,
            session_context=session_context,
        ):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
