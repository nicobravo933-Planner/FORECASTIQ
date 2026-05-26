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


# ── Tool: get_encyclopedia_context ─────────────────────────────────────────────
# Permite al LLM citar definiciones de la Enciclopedia ForecastIQ cuando
# el usuario pregunta conceptos como WAPE, SARIMA, Holt-Winters, etc.

OPENROUTER_TOOLS.append(
    {
        "type": "function",
        "function": {
            "name": "get_encyclopedia_context",
            "description": (
                "Retrieves a summary of a ForecastIQ Encyclopedia chapter. "
                "Use this when the user asks about forecasting concepts like WAPE, MAE, BIAS, "
                "Moving Average, Holt-Winters, SARIMA, LightGBM, cross-validation, seasonality, "
                "trend, or model selection. Returns the chapter definition to ground your answer."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "chapter_id": {
                        "type": "string",
                        "enum": [
                            "cap1",
                            "cap2",
                            "cap3",
                            "cap4",
                            "cap5",
                            "cap6",
                            "cap7",
                            "cap8",
                            "cap9",
                            "cap10",
                            "cap18",
                            "cap19",
                        ],
                        "description": (
                            "Chapter to retrieve. "
                            "cap1=forecasting intro, cap2=demand patterns, cap3=error metrics, "
                            "cap4=moving average, cap5=holt-winters, cap6=SES+holt simple, "
                            "cap7=SARIMA, cap8=linear+splines, cap9=LightGBM+Optuna, "
                            "cap10=rolling CV, cap18=multi-series, cap19=auto model selection."
                        ),
                    }
                },
                "required": ["chapter_id"],
            },
        },
    }
)


# ── Resúmenes de la Enciclopedia por capítulo ─────────────────────────────────
ENCYCLOPEDIA_CONTEXT: dict[str, str] = {
    "cap1": (
        "Cap 1 — Qué es el forecasting: predicción de demanda futura basada en patrones históricos. "
        "Tipos: cualitativo (juicio experto) y cuantitativo (modelos estadísticos/ML). "
        "Error de forecast: la diferencia entre real y predicho — minimizarlo es el objetivo central."
    ),
    "cap2": (
        "Cap 2 — Patrones de demanda: tendencia (cambio sostenido a lo largo del tiempo), "
        "estacionalidad (ciclos que se repiten con frecuencia fija: mensual, semanal), "
        "ruido (variación aleatoria no explicable). Identificarlos es el primer paso del modelado."
    ),
    "cap3": (
        "Cap 3 — Métricas de error: WAPE = sum(|real-pred|)/sum(real) — métrica principal, robusta a ceros. "
        "MAE = mean(|real-pred|) — interpretable en unidades de negocio. "
        "BIAS = mean(pred-real)/mean(real)*100 — positivo = sobreestimación sistemática. "
        "RMSE penaliza errores grandes. FVA (Forecast Value Added) mide si el modelo gana al naive."
    ),
    "cap4": (
        "Cap 4 — Promedio Móvil (Moving Average): baseline simple. "
        "Promedia las últimas N observaciones — útil para series cortas o muy ruidosas. "
        "No captura tendencia ni estacionalidad. Parámetro: ventana N (por defecto 3)."
    ),
    "cap5": (
        "Cap 5 — Holt-Winters (Triple Exponential Smoothing): modela nivel + tendencia + estacionalidad. "
        "Parámetros: alpha (nivel), beta (tendencia), gamma (estacionalidad). "
        "Variantes: aditiva (amplitud constante) y multiplicativa (amplitud proporcional al nivel). "
        "Recomendado cuando la serie tiene los tres componentes y ≥52 observaciones."
    ),
    "cap6": (
        "Cap 6 — SES y Holt Simple: SES (Simple Exponential Smoothing) solo modela el nivel — "
        "ideal para series sin tendencia ni estacionalidad. Parámetro: alpha. "
        "Holt Simple (Double Exponential Smoothing) modela nivel + tendencia sin estacionalidad. "
        "Parámetros: alpha (nivel) + beta (tendencia). Usar cuando hay tendencia pero no ciclo estacional."
    ),
    "cap7": (
        "Cap 7 — SARIMA: modelo estadístico riguroso para series con tendencia y/o estacionalidad. "
        "Parámetros: p,d,q (parte regular) + P,D,Q,s (parte estacional). "
        "Ventajas: intervalos de confianza estadísticos, interpretabilidad. "
        "Requiere ≥104 observaciones y series estacionarias (diferenciación)."
    ),
    "cap8": (
        "Cap 8 — Regresión Lineal y Splines: la regresión lineal modela tendencias globales. "
        "Los splines cúbicos ajustan tendencias locales con mayor flexibilidad, "
        "dividiendo la serie en segmentos con polinomios de grado 3. "
        "Más interpretable que LightGBM; menos flexible que Holt-Winters para series estacionales."
    ),
    "cap9": (
        "Cap 9 — LightGBM con Optuna: gradient boosting para series con alta volatilidad (CV>1). "
        "Crea features de lag automáticamente. Optuna optimiza hiperparámetros con pruning bayesiano. "
        "Primera corrida ~60s; siguientes usan cache. Requiere ≥104 observaciones y tier local."
    ),
    "cap10": (
        "Cap 10 — Validación cruzada rolling (time-series CV): divide la serie en K folds temporales, "
        "entrenando siempre con datos pasados y evaluando en el futuro inmediato. "
        "Evita data leakage. ForecastIQ usa entre 3 y 5 folds con gap=0 por defecto."
    ),
    "cap18": (
        "Cap 18 — Forecasting multi-serie: ejecutar el mismo modelo sobre múltiples entidades "
        "(productos, regiones, SKUs) de forma vectorizada. StatsForecast (Nixtla) permite procesar "
        "cientos de series en paralelo. El benchmark multi-serie compara modelos y elige el ganador por entidad."
    ),
    "cap19": (
        "Cap 19 — Selección automática de modelo: el detector de ForecastIQ sigue un árbol de decisión: "
        "<52 obs → Moving Average. ≥52 + estacionalidad → Holt-Winters. "
        "≥104 + tendencia sin estacional → SARIMA. ≥104 + CV>1 → LightGBM. "
        "Usa MAD para outliers, FFT para estacionalidad, Seasonal Mann-Kendall para tendencia."
    ),
}
