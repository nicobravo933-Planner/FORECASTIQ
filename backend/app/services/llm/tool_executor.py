"""Ejecutor de tools del LLM.

Recibe el nombre de la tool + argumentos del LLM y retorna el resultado
como string JSON que se reenvía al modelo como tool_result.

Usa DuckDB en memoria para ejecutar SQL sobre el CSV del usuario.
"""

from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def execute_tool(
    tool_name: str,
    tool_args: dict[str, Any],
    *,
    dataset_id: str | None = None,
    job_id: str | None = None,
) -> str:
    """Despacha la tool al handler correcto. Retorna siempre un string JSON."""
    handlers = {
        "query_dataset": _handle_query_dataset,
        "get_forecast_summary": _handle_forecast_summary,
        "get_events": _handle_get_events,
        "suggest_model_change": _handle_suggest_model_change,
        "get_encyclopedia_context": _handle_encyclopedia_context,  # P6
    }
    handler = handlers.get(tool_name)
    if handler is None:
        return json.dumps({"error": f"Unknown tool: {tool_name}"})

    try:
        return handler(tool_args, dataset_id=dataset_id, job_id=job_id)
    except Exception as exc:
        logger.exception("Tool '%s' failed: %s", tool_name, exc)
        return json.dumps({"error": str(exc)})


# ── Handlers ──────────────────────────────────────────────────────────────────


def _handle_query_dataset(
    args: dict[str, Any],
    *,
    dataset_id: str | None,
    job_id: str | None,
) -> str:
    """Ejecuta SQL sobre el CSV del usuario usando DuckDB en memoria."""
    if not dataset_id:
        return json.dumps({"error": "No dataset_id provided in session context."})

    sql: str = args.get("sql", "").strip()
    if not sql:
        return json.dumps({"error": "Empty SQL query."})

    # Bloquear operaciones destructivas
    sql_upper = sql.upper()
    for forbidden in ("DROP ", "DELETE ", "INSERT ", "UPDATE ", "ALTER ", "CREATE "):
        if forbidden in sql_upper:
            return json.dumps({"error": f"Operation not allowed: {forbidden.strip()}"})

    import duckdb

    from app.services.supabase import download_csv

    # Descarga el CSV y lo carga en DuckDB en memoria
    csv_bytes = download_csv(dataset_id)
    import io

    import pandas as pd

    df = pd.read_csv(io.BytesIO(csv_bytes))

    con = duckdb.connect(database=":memory:")
    con.register("data", df)  # tabla siempre se llama "data"

    try:
        result_df = con.execute(sql).df()
        # Limitar a 200 filas para no inflar el contexto del LLM
        if len(result_df) > 200:
            result_df = result_df.head(200)
        rows = result_df.to_dict(orient="records")
        return json.dumps({"rows": rows, "total": len(rows)}, default=str)
    finally:
        con.close()


def _handle_forecast_summary(
    args: dict[str, Any],
    *,
    dataset_id: str | None,
    job_id: str | None,
) -> str:
    """Retorna las métricas y metadatos del último forecast."""
    if not job_id:
        return json.dumps({"error": "No active forecast job in session."})

    from app.services.supabase import get_forecast_result

    data = get_forecast_result(job_id)
    if not data:
        return json.dumps({"error": f"Forecast job '{job_id}' not found."})

    metrics = data.get("metrics") or {}
    return json.dumps(
        {
            "model_used": data.get("model_used"),
            "freq": data.get("freq"),
            "horizon": data.get("horizon"),
            "metrics": metrics,
            "created_at": data.get("created_at"),
            "predictions_count": len(data.get("predictions") or []),
        },
        default=str,
    )


def _handle_get_events(
    args: dict[str, Any],
    *,
    dataset_id: str | None,
    job_id: str | None,
) -> str:
    """Retorna eventos activos del calendario (propios + feriados AR)."""
    from datetime import date

    from app.services.events import get_ar_holidays, list_events

    user_id: str | None = None  # Phase 5: inyectar desde JWT
    year = date.today().year
    events = list_events(user_id=user_id) + get_ar_holidays(year)

    # Serializar solo los campos relevantes para el LLM
    simplified = [
        {
            "name": e.get("name"),
            "type": e.get("event_type"),
            "start_date": str(e.get("start_date", ""))[:10],
            "end_date": str(e.get("end_date", ""))[:10],
            "impact_pct": e.get("impact_pct"),
        }
        for e in events
    ]
    return json.dumps({"events": simplified, "total": len(simplified)}, default=str)


def _handle_suggest_model_change(
    args: dict[str, Any],
    *,
    dataset_id: str | None,
    job_id: str | None,
) -> str:
    """Registra la sugerencia de cambio de modelo y la retorna al LLM."""
    current = args.get("current_model", "unknown")
    proposed = args.get("proposed_model", "unknown")
    reason = args.get("reason", "")

    return json.dumps(
        {
            "suggestion": {
                "action": "switch_model",
                "from": current,
                "to": proposed,
                "reason": reason,
                "message": (
                    f"I suggest switching from **{current}** to **{proposed}**. "
                    f"Reason: {reason}. You can re-run the forecast from the Forecast page."
                ),
            }
        }
    )


def _handle_encyclopedia_context(
    args: dict[str, Any],
    *,
    dataset_id: str | None,
    job_id: str | None,
) -> str:
    """Retorna el resumen del capítulo de la Enciclopedia solicitado por el LLM."""
    from app.services.llm.tools import ENCYCLOPEDIA_CONTEXT

    chapter_id = args.get("chapter_id", "").strip()
    if not chapter_id:
        return json.dumps({"error": "chapter_id is required."})

    content = ENCYCLOPEDIA_CONTEXT.get(chapter_id)
    if not content:
        available = list(ENCYCLOPEDIA_CONTEXT.keys())
        return json.dumps(
            {
                "error": f"Chapter '{chapter_id}' not found.",
                "available_chapters": available,
            }
        )

    return json.dumps(
        {
            "chapter_id": chapter_id,
            "content": content,
            "source": "ForecastIQ Encyclopedia — Vandeputt (Demand Forecasting Best Practices)",
        }
    )
