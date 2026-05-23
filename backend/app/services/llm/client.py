"""Router LLM — delega a OpenRouter según configuración.

Punto de entrada único para el chat. Construye el system prompt
con contexto del dataset y forecast antes de llamar al provider.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncGenerator
from typing import Any

from app.core.config import settings
from app.services.llm.tools import DEFAULT_MODEL_ID, FREE_MODELS

logger = logging.getLogger(__name__)


def build_system_prompt(session_context: dict[str, Any], user_message: str = "") -> str:
    """
    Construye el system prompt inyectando contexto del dataset y forecast.
    El LLM recibe el esquema de columnas + KPIs actuales para responder
    preguntas específicas sobre los datos del usuario.
    """
    dataset_schema = session_context.get("dataset_schema", "No dataset loaded.")
    forecast_summary = session_context.get("forecast_summary", "No forecast run yet.")
    events_summary = session_context.get("events_summary", "No events configured.")
    freq_label = session_context.get("freq_label", "unknown frequency")

    # Detecta idioma del mensaje del usuario para responder en el mismo idioma.
    # Si el mensaje contiene caracteres latinos/españoles → español, sino inglés.
    spanish_chars = set("áéíóúüñ¿¡àèìòùâêîôûäëïöü")
    is_spanish = any(c.lower() in spanish_chars for c in user_message) or \
        any(w in user_message.lower() for w in [
            "como", "qué", "cuál", "cuáles", "cuánto", "cuándo", "dónde",
            "por qué", "puedo", "podés", "tiene", "hay", "son", "está",
            "quiero", "necesito", "mostrar", "analizar", "dame", "hola",
        ])
    language_instruction = (
        "IMPORTANT: Always respond in Spanish (es-AR). "
        "Use professional but approachable language."
        if is_spanish else
        "Respond in the same language the user writes in."
    )

    return f"""You are ForecastIQ's AI assistant — an expert in time-series forecasting and demand planning.

You have access to the user's actual sales data and forecast results.
Use the available tools to query their data and give precise, data-driven answers.

## Language
{language_instruction}

## Current dataset
{dataset_schema}

## Active forecast
{forecast_summary}

## Calendar events
{events_summary}

## Guidelines
- Always query the data before making claims about specific numbers.
- When discussing forecast accuracy, reference the actual metrics (WAPE, MAE, BIAS).
- Suggest actionable improvements when you detect patterns.
- Keep answers concise but insightful — the user is a demand planner.
- The data frequency is: {freq_label}.
- When showing tabular or trend data, you MAY include a chart using this exact format:
  ```json chart-spec
  {{"type": "bar", "title": "Your title", "xKey": "name", "yKey": "value", "data": [...]}}
  ```
  Supported types: "bar", "line", "area". Use sparingly — only when a chart adds clarity.
- At the end of each response, add 2-3 follow-up questions the user might want to ask.
  Format them exactly as:
  You could also ask:
  1. <question 1>?
  2. <question 2>?
  3. <question 3>?
"""


def resolve_model(session_context: dict[str, Any]) -> str:
    """
    Resuelve el modelo a usar.
    Prioridad: session_context > .env > default.
    Valida que el modelo esté en la lista de modelos permitidos.
    """
    requested = session_context.get("active_model") or settings.openrouter_model
    allowed_ids = {m["id"] for m in FREE_MODELS}

    if requested in allowed_ids:
        return requested

    logger.warning("Model '%s' not in FREE_MODELS list, falling back to default.", requested)
    return DEFAULT_MODEL_ID


async def stream_llm_response(
    user_message: str,
    history: list[dict[str, str]],
    session_context: dict[str, Any],
) -> AsyncGenerator[str, None]:
    """
    Punto de entrada principal para el chat con streaming.

    Args:
        user_message:    Mensaje actual del usuario.
        history:         Historial de mensajes anteriores [{role, content}].
        session_context: Contexto de la sesión:
                           - active_model: str
                           - dataset_id: str | None
                           - job_id: str | None
                           - dataset_schema: str
                           - forecast_summary: str
                           - events_summary: str
                           - freq_label: str

    Yields:
        Strings SSE en formato "data: {...}\\n\\n"
    """
    from app.services.llm.openrouter import stream_chat

    model = resolve_model(session_context)
    system_prompt = build_system_prompt(session_context, user_message=user_message)

    # Construye el historial completo para el LLM
    messages: list[dict[str, Any]] = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    dataset_id: str | None = session_context.get("dataset_id")
    job_id: str | None = session_context.get("job_id")

    async for event in stream_chat(
        messages=messages,
        model=model,
        dataset_id=dataset_id,
        job_id=job_id,
    ):
        yield event
