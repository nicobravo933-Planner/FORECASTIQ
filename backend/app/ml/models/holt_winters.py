"""
Holt-Winters Triple Exponential Smoothing — modelo principal para series con
tendencia y estacionalidad (caballo de batalla en retail y supply chain).

Implementación: statsmodels ExponentialSmoothing
  - trend="add"       → tendencia aditiva (más estable que multiplicativa con ceros)
  - seasonal="add"    → estacionalidad aditiva
  - seasonal_periods  → inferido desde la frecuencia de la serie

Intervalos de confianza: simulación de Monte Carlo sobre los residuos del fit.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel
from app.ml.models.utils import get_seasonal_periods, normalize_freq

# Mapa frecuencia -> períodos estacionales (legacy, mantenido por compatibilidad)
_SEASONAL_PERIODS: dict[str, int] = {}


class HoltWintersModel(ForecastModel):
    """
    Holt-Winters Triple Exponential Smoothing con CI por simulación.
    statsmodels maneja la optimización de alpha/beta/gamma automáticamente.
    """

    name = "holt_winters"
    requires_min_observations = 24  # necesita al menos 2 ciclos estacionales

    def __init__(self, ci_level: float = 0.95, n_simulations: int = 1000) -> None:
        self.ci_level = ci_level
        self.n_simulations = n_simulations

        self._model_fit = None
        self._series: pd.Series | None = None
        self._freq: str | None = None
        self._seasonal_periods: int = 12

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()
        freq = normalize_freq(pd.infer_freq(series.index) or "MS")
        self._freq = freq
        self._seasonal_periods = get_seasonal_periods(freq)

        n = len(series)
        # Si no hay suficientes obs para estacionalidad, cae a tendencia sola
        use_seasonal = n >= self._seasonal_periods * 2

        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal="add" if use_seasonal else None,
            seasonal_periods=self._seasonal_periods if use_seasonal else None,
            initialization_method="estimated",
        )
        self._model_fit = model.fit(optimized=True, remove_bias=True)

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._model_fit is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        # Predicción puntual
        forecast = self._model_fit.forecast(horizon)

        # CI por simulación: statsmodels HW no tiene CI analítico directo
        rng = np.random.default_rng(seed=42)
        residuals = self._model_fit.resid.values
        std_resid = float(np.std(residuals, ddof=1))

        # Simula `n_simulations` trayectorias añadiendo ruido gaussiano
        simulations = np.array([
            forecast.values + rng.normal(0, std_resid, size=horizon)
            for _ in range(self.n_simulations)
        ])

        alpha = 1 - self.ci_level
        lower = np.percentile(simulations, alpha / 2 * 100, axis=0)
        upper = np.percentile(simulations, (1 - alpha / 2) * 100, axis=0)

        return pd.DataFrame({
            "date":      forecast.index,
            "predicted": forecast.values,
            "lower":     lower,
            "upper":     upper,
        })

    def evaluate(self, test: pd.Series) -> dict[str, float]:
        if self._model_fit is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        predicted_series = pd.Series(
            self._model_fit.forecast(len(test)).values,
            index=test.index,
        )
        return evaluate_all(test, predicted_series)
