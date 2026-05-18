"""OpenRouter streaming con soporte de tool calls.

Implementa el loop multi-turn:
  1. Manda mensajes al LLM con tools disponibles
  2. Si el LLM responde con tool_calls → ejecuta → reenvía resultado
  3. Continúa el stream hasta que el LLM no pide más tools
  4. Yields eventos SSE como strings listos para StreamingResponse
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.core.config import settings
from app.services.llm.tool_executor import execute_tool
from app.services.llm.tools import OPENROUTER_TOOLS

logger = logging.getLogger(__name__)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"
HTTP_TIMEOUT = 120.0  # segundos


def _sse(event_type: str, payload: dict[str, Any]) -> str:
    """Formatea un evento SSE."""
    return f"data: {json.dumps({'type': event_type, **payload})}\n\n"


async def stream_chat(
    messages: list[dict[str, Any]],
    model: str,
    dataset_id: str | None,
    job_id: str | None,
) -> AsyncGenerator[str, None]:
    """
    Generador async que yields strings SSE.
    Maneja el loop de tool calls internamente.
    """
    # Historial mutable que se extiende con tool calls y results
    conversation: list[dict[str, Any]] = list(messages)

    # Máximo de rondas de tool calls para evitar loops infinitos
    max_tool_rounds = 5

    for _round_num in range(max_tool_rounds + 1):
        tool_calls_this_round: list[dict[str, Any]] = []
        accumulated_text = ""

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT) as client:
                async with client.stream(
                    "POST",
                    OPENROUTER_BASE_URL,
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://forecastiq.app",
                        "X-Title": "ForecastIQ",
                    },
                    json={
                        "model": model,
                        "messages": conversation,
                        "tools": OPENROUTER_TOOLS,
                        "tool_choice": "auto",
                        "stream": True,
                        "max_tokens": 2048,
                    },
                ) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        logger.error("OpenRouter error %s: %s", response.status_code, body)
                        yield _sse("error", {"message": f"LLM error {response.status_code}"})
                        return

                    async for line in response.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        raw = line[6:].strip()
                        if raw == "[DONE]":
                            break

                        try:
                            chunk = json.loads(raw)
                        except json.JSONDecodeError:
                            continue

                        delta = chunk.get("choices", [{}])[0].get("delta", {})

                        # ── Token de texto ────────────────────────────────
                        content = delta.get("content")
                        if content:
                            accumulated_text += content
                            yield _sse("token", {"content": content})

                        # ── Tool call ─────────────────────────────────────
                        tool_calls_delta = delta.get("tool_calls", [])
                        for tc_delta in tool_calls_delta:
                            idx = tc_delta.get("index", 0)

                            # Inicializa la estructura si es el primer fragmento
                            while len(tool_calls_this_round) <= idx:
                                tool_calls_this_round.append(
                                    {
                                        "id": "",
                                        "type": "function",
                                        "function": {"name": "", "arguments": ""},
                                    }
                                )

                            tc = tool_calls_this_round[idx]
                            if tc_delta.get("id"):
                                tc["id"] = tc_delta["id"]
                            fn_delta = tc_delta.get("function", {})
                            if fn_delta.get("name"):
                                tc["function"]["name"] += fn_delta["name"]
                            if fn_delta.get("arguments"):
                                tc["function"]["arguments"] += fn_delta["arguments"]

        except httpx.TimeoutException:
            yield _sse("error", {"message": "LLM request timed out."})
            return
        except Exception as exc:
            logger.exception("OpenRouter stream error: %s", exc)
            yield _sse("error", {"message": "Internal streaming error."})
            return

        # ── Si no hay tool calls → respuesta final ────────────────────────
        if not tool_calls_this_round:
            # Extrae sugerencias de follow-up del texto acumulado
            suggestions = _extract_suggestions(accumulated_text)
            if suggestions:
                yield _sse("suggestions", {"items": suggestions})
            yield _sse("done", {})
            return

        # ── Hay tool calls → ejecutar y continuar ─────────────────────────
        # Agrega el mensaje del assistant con las tool calls
        conversation.append(
            {
                "role": "assistant",
                "content": accumulated_text or None,
                "tool_calls": tool_calls_this_round,
            }
        )

        for tc in tool_calls_this_round:
            tool_name = tc["function"]["name"]
            try:
                tool_args = json.loads(tc["function"]["arguments"] or "{}")
            except json.JSONDecodeError:
                tool_args = {}

            # Notifica al frontend que se está ejecutando una tool
            yield _sse("tool_call", {"tool": tool_name, "input": tool_args})

            # Ejecuta la tool
            result_str = execute_tool(
                tool_name,
                tool_args,
                dataset_id=dataset_id,
                job_id=job_id,
            )

            yield _sse("tool_result", {"tool": tool_name, "result": json.loads(result_str)})

            # Agrega el resultado al historial para el siguiente turno
            conversation.append(
                {
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result_str,
                }
            )

    # Si llegamos aquí se agotaron las rondas de tools
    yield _sse("error", {"message": "Max tool rounds exceeded."})


def _extract_suggestions(text: str) -> list[str]:
    """
    Extrae sugerencias de preguntas de seguimiento del texto del LLM.
    Busca patrones como "You could also ask:" o listas numeradas al final.
    Retorna hasta 3 sugerencias cortas.
    """
    suggestions: list[str] = []
    lines = text.split("\n")

    capture = False
    for line in lines:
        line = line.strip()
        lower = line.lower()

        # Detecta sección de sugerencias
        if any(
            k in lower for k in ("you could also ask", "follow-up", "sugerencia", "también podrías")
        ):
            capture = True
            continue

        if capture and line:
            # Limpia numeración o bullets
            clean = line.lstrip("0123456789.-) ").strip()
            if len(clean) > 10 and clean.endswith("?"):
                suggestions.append(clean)
            if len(suggestions) >= 3:
                break

    return suggestions
