"""
Seasonal Naive — baseline obligatorio para FVA (Forecast Value Added).

Estrategia:
  - Para cada período futuro, repite el valor del mismo período del año/ciclo anterior.
  - Ejemplo mensual (m=12): el forecast de enero 2025 = valor de enero 2024.
  - Es el modelo de referencia de Vandeputt: si tu modelo no le gana al Naive, usá el Naive.

Uso en E7 (benchmarking):
  - Siempre se incluye en el benchmark como baseline obligatorio.
  - Su WAPE es el denominador del FVA: FVA = (WAPE_naive - WAPE_model) / WAPE_naive * 100.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel
from app.ml.models.utils import get_seasonal_periods, normalize_freq


class SeasonalNaiveModel(ForecastModel):
    """
    Seasonal Naive: forecast = valor del mismo período del ciclo anterior.

    Para series más cortas que un ciclo estacional (n < m), degrada a Naive simple
    (último valor observado) sin romper.
    """

    name = "seasonal_naive"
    requires_min_observations = 2

    def __init__(self) -> None:
        self._series: pd.Series | None = None
        self._freq: str | None = None
        self._seasonal_periods: int = 12

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()
        raw_freq = pd.infer_freq(pd.DatetimeIndex(series.index)) or "MS"
        self._freq = normalize_freq(raw_freq)
        self._seasonal_periods = get_seasonal_periods(self._freq)

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        n = len(self._series)
        m = self._seasonal_periods
        values = self._series.to_numpy(dtype=float)
        last_date = self._series.index[-1]

        # Genera fechas futuras
        future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=self._freq)[1:]

        # Predicción: índice i → repite values[n - m + (i % m)]
        # Si la serie es más corta que un ciclo, repite el último valor (naive simple)
        predicted = np.array(
            [
                values[n - m + (i % m)] if n >= m else values[-1]
                for i in range(horizon)
            ],
            dtype=float,
        )

        # Intervalo de confianza: std de los residuos estacionales del entrenamiento
        # Residuo del período k = valor[k] - valor[k - m]
        if n >= m + 1:
            residuals = values[m:] - values[:-m]
            sigma = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0
        else:
            sigma = float(np.std(values, ddof=1)) if n > 1 else 0.0

        # CI 95%: ±1.96 * sigma (intervalos simétricos — aproximación)
        z = 1.96
        lower = predicted - z * sigma
        upper = predicted + z * sigma

        return pd.DataFrame(
            {
                "date": future_dates,
                "predicted": predicted,
                "lower": lower,
                "upper": upper,
            }
        )

    def evaluate(self, test: pd.Series) -> dict[str, float | None]:
        if self._series is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        preds = self.predict(len(test))
        predicted_series = pd.Series(
            preds["predicted"].values,
            index=test.index,
        )
        return evaluate_all(test, predicted_series)
