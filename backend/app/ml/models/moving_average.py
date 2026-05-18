"""
Moving Average con pesos — modelo baseline para series cortas (< 52 obs).

Estrategia:
  - Weighted Moving Average (WMA): los últimos períodos pesan más
  - Intervalo de confianza: bootstrap sobre los residuos del entrenamiento
  - Horizonte: repite el último valor WMA (naive para series sin tendencia clara)
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel
from app.ml.models.utils import normalize_freq


class MovingAverageModel(ForecastModel):
    """
    Weighted Moving Average con bootstrap CI.
    Ventana por defecto: min(window, n_obs // 3) para adaptarse a series cortas.
    """

    name = "moving_average"
    requires_min_observations = 4  # mínimo absoluto para calcular residuos

    def __init__(self, window: int = 6, ci_level: float = 0.95, n_bootstrap: int = 500) -> None:
        self.window = window
        self.ci_level = ci_level
        self.n_bootstrap = n_bootstrap

        self._series: pd.Series | None = None
        self._fitted_values: pd.Series | None = None
        self._residuals: np.ndarray | None = None
        self._last_wma: float = 0.0
        self._freq: str | None = None

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()
        n = len(series)

        # Ventana efectiva: no mayor a 1/3 de la serie ni mayor al window pedido
        effective_window = min(self.window, max(2, n // 3))

        # Pesos lineales: el más reciente tiene el mayor peso
        weights = np.arange(1, effective_window + 1, dtype=float)
        weights /= weights.sum()

        # Calcula WMA deslizante
        fitted = series.rolling(window=effective_window).apply(
            lambda x: np.dot(x, weights), raw=True
        )

        # Guarda valores ajustados y residuos (solo donde hay fitted)
        self._fitted_values = fitted
        valid = fitted.dropna()
        self._residuals = (series.loc[valid.index] - valid).values
        self._last_wma = float(valid.iloc[-1])
        self._freq = normalize_freq(pd.infer_freq(series.index) or "MS")

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._series is None or self._residuals is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        last_date = self._series.index[-1]

        # Genera fechas futuras según la frecuencia inferida
        future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=self._freq)[1:]

        # Predicción puntual: repite el último WMA (naive projection)
        predicted = np.full(horizon, self._last_wma)

        # Bootstrap CI sobre residuos históricos
        rng = np.random.default_rng(seed=42)
        alpha = 1 - self.ci_level
        bootstrap_means = np.array(
            [
                self._last_wma + np.mean(rng.choice(self._residuals, size=len(self._residuals)))
                for _ in range(self.n_bootstrap)
            ]
        )
        lower = float(np.percentile(bootstrap_means, alpha / 2 * 100))
        upper = float(np.percentile(bootstrap_means, (1 - alpha / 2) * 100))

        return pd.DataFrame(
            {
                "date": future_dates,
                "predicted": predicted,
                "lower": np.full(horizon, lower),
                "upper": np.full(horizon, upper),
            }
        )

    def evaluate(self, test: pd.Series) -> dict[str, float]:
        if self._series is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        # Genera predicciones para el período de test
        preds = self.predict(len(test))
        predicted_series = pd.Series(
            preds["predicted"].values,
            index=test.index,
        )
        return evaluate_all(test, predicted_series)
