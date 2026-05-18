"""Definiciones de tools para el LLM (formato OpenAI function calling).

El LLM puede invocar estas tools para acceder a los datos reales del usuario:
  - query_dataset        → SQL sobre el CSV usando DuckDB
  - get_forecast_summary → métricas del forecast activo
  - get_events           → eventos del calendario activos
  - suggest_model_change → propone cambiar el modelo ML
"""

from typing import Any

OPENROUTER_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "query_dataset",
            "description": (
                "Execute a SQL query over the user's uploaded dataset using DuckDB. "
                "The table is always named 'data'. Use this to answer questions about "
                "the raw data: totals, averages, trends, top products, date ranges, etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "sql": {
                        "type": "string",
                        "description": "A valid DuckDB SQL query. Table name is always 'data'.",
                    }
                },
                "required": ["sql"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_forecast_summary",
            "description": (
                "Returns the current forecast metrics and a summary of the last "
                "completed forecast job: model used, WAPE, MAE, BIAS, RMSE, horizon, freq."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_events",
            "description": (
                "Returns the list of active calendar events (promotions, holidays, "
                "seasonalities) and their impact percentage on the forecast."
            ),
            "parameters": {
                "type": "object",
                "properties": {},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "suggest_model_change",
            "description": (
                "Propose switching the ML forecasting model when the current one "
                "is not performing well. Returns a suggestion the user can act on."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "current_model": {
                        "type": "string",
                        "description": "The model currently in use.",
                    },
                    "proposed_model": {
                        "type": "string",
                        "enum": ["moving_average", "holt_winters", "sarima", "lightgbm"],
                        "description": "The model to switch to.",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why the switch would improve results.",
                    },
                },
                "required": ["current_model", "proposed_model", "reason"],
            },
        },
    },
]

# Modelos libres disponibles en OpenRouter
FREE_MODELS: list[dict[str, str]] = [
    {"id": "openrouter/owl-alpha", "label": "OWL Alpha"},
    {"id": "nvidia/nemotron-3-super-120b-a12b:free", "label": "Nemotron 120B"},
    {"id": "poolside/laguna-m.1:free", "label": "Laguna M.1"},
    {"id": "openai/gpt-oss-120b:free", "label": "GPT OSS 120B"},
    {"id": "z-ai/glm-4.5-air:free", "label": "GLM 4.5 Air"},
    {"id": "deepseek/deepseek-v4-flash:free", "label": "DeepSeek V4 Flash"},
    {"id": "minimax/minimax-m2.5:free", "label": "MiniMax M2.5"},
]

DEFAULT_MODEL_ID = "deepseek/deepseek-v4-flash:free"
