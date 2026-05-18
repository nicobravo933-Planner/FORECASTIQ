"""
Métricas de evaluación para forecasting — Phase 2.

Métricas implementadas:
  WAPE  → métrica primaria (robusta a ceros, estándar en retail/supply chain)
  MAE   → error absoluto medio (interpretable en unidades de negocio)
  BIAS  → detecta sobreestimación/subestimación sistemática (crítico en planificación)
  RMSE  → penaliza errores grandes (usado para selección de modelo)
  MAPE  → incluido con advertencia cuando hay ceros (no usar como primaria)
  FVA   → Forecast Value Added: compara el modelo contra un baseline Naive.
           Si FVA < 0, el modelo resta valor — usar Naive directamente.

Referencias:
  Vandeputt, N. — "Inventory Optimization" (WAPE, BIAS, FVA)
  Hyndman & Athanasopoulos — "Forecasting: Principles and Practice"
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def wape(actual: pd.Series, predicted: pd.Series) -> float:
    """
    Weighted Absolute Percentage Error.
    WAPE = sum(|actual - predicted|) / sum(|actual|)

    Ventaja sobre MAPE: no explota cuando actual=0 y es robusta a series con
    muchos ceros (ej. SKUs de baja rotación en retail).
    Rango: [0, ∞) — menor es mejor. < 0.20 es excelente en planificación de demanda.
    """
    denom = actual.abs().sum()
    if denom == 0:
        return 0.0
    return float((actual - predicted).abs().sum() / denom)


def mae(actual: pd.Series, predicted: pd.Series) -> float:
    """
    Mean Absolute Error — error medio en unidades de la serie.
    Interpretable directamente: "el modelo se equivoca en promedio X unidades".
    """
    return float((actual - predicted).abs().mean())


def bias(actual: pd.Series, predicted: pd.Series) -> float:
    """
    BIAS = mean(predicted - actual) / mean(actual)

    Positivo → el modelo sobreestima sistemáticamente (stock excesivo).
    Negativo → el modelo subestima (quiebres de stock).
    Rango: (-∞, ∞). Idealmente cercano a 0.
    """
    mean_actual = actual.mean()
    if mean_actual == 0:
        return 0.0
    return float((predicted - actual).mean() / mean_actual)


def rmse(actual: pd.Series, predicted: pd.Series) -> float:
    """
    Root Mean Square Error — penaliza errores grandes más que MAE.
    Útil para detectar modelos con outliers de predicción.
    """
    return float(np.sqrt(((actual - predicted) ** 2).mean()))


def mape(actual: pd.Series, predicted: pd.Series) -> float | None:
    """
    Mean Absolute Percentage Error.
    Retorna None si la serie tiene ceros (división por cero).
    Usar WAPE como primaria — MAPE solo como referencia cuando no hay ceros.
    """
    if (actual == 0).any():
        return None
    return float(((actual - predicted).abs() / actual.abs()).mean())


def fva(actual: pd.Series, predicted: pd.Series) -> float:
    """
    Forecast Value Added (FVA).
    Compara el WAPE del modelo contra el WAPE de un baseline Naive.

    Naive usado: Seasonal Naive (mismo período del año anterior, lag=12 mensual).
    Si la serie es demasiado corta para seasonal naive, usa lag-1.

    FVA = WAPE_naive - WAPE_modelo
      FVA > 0  → el modelo MEJORA sobre el Naive (agrega valor)
      FVA = 0  → empate con el Naive
      FVA < 0  → el modelo EMPEORA (señal de alerta: considerar usar Naive)

    En retail es común que modelos complejos en series cortas o muy ruidosas
    tengan FVA negativo. No es un error — es información valiosa para el planificador.
    """
    # Seasonal Naive: lag 12 si hay historia suficiente, sino lag 1
    lag = 12 if len(actual) >= 24 else 1
    naive_values = actual.shift(lag).dropna()

    if len(naive_values) == 0:
        return 0.0

    # Alineamos sobre el período común
    n = min(len(naive_values), len(actual), len(predicted))
    actual_tail = actual.iloc[-n:]
    predicted_tail = predicted.iloc[-n:] if len(predicted) >= n else predicted
    naive_tail = naive_values.iloc[-n:]

    # Re-indexamos predicted_tail con el índice de actual_tail
    predicted_tail = pd.Series(predicted_tail.values, index=actual_tail.index)
    naive_tail = pd.Series(naive_tail.values, index=actual_tail.index)

    wape_naive = wape(actual_tail, naive_tail)
    wape_model = wape(actual_tail, predicted_tail)

    if wape_naive == 0:
        return 0.0
    return round(float(wape_naive - wape_model), 4)


def evaluate_all(actual: pd.Series, predicted: pd.Series) -> dict[str, float | None]:
    """
    Calcula todas las métricas en un solo dict.
    Usado por cada modelo en su método evaluate().

    Returns:
        {
          "wape": float,
          "mae":  float,
          "bias": float,
          "rmse": float,
          "mape": float | None  (None si hay ceros en actual)
          "fva":  float         (positivo = modelo supera al Naive)
        }
    """
    actual, predicted = actual.align(predicted, join="inner")
    mape_val = mape(actual, predicted)

    return {
        "wape": round(wape(actual, predicted), 4),
        "mae": round(mae(actual, predicted), 4),
        "bias": round(bias(actual, predicted), 4),
        "rmse": round(rmse(actual, predicted), 4),
        "mape": round(mape_val, 4) if mape_val is not None else None,
        "fva": fva(actual, predicted),
    }
