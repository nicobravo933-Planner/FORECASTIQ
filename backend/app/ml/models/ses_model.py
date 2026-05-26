"""
SES — Simple Exponential Smoothing (Suavizamiento Exponencial Simple).

Solo captura nivel. Sin tendencia, sin estacionalidad.
Ideal para series cortas, muy ruidosas, o sin estructura clara.

Parámetro único:
  alpha  — peso del nivel más reciente (0-1).
           α≈1 → muy reactivo al último valor.
           α≈0 → promedio casi igual de todos los períodos.

Implementación: statsmodels SimpleExpSmoothing.
Intervalos de confianza: simulación gaussiana sobre residuos (igual que HW).
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import SimpleExpSmoothing

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel


class SESModel(ForecastModel):
    """
    Simple Exponential Smoothing — nivel solamente.
    Equivale a Holt-Winters con trend=None y seasonal=None.
    """

    name = "ses"
    requires_min_observations = 8  # mínimo razonable para estimar alpha

    def __init__(
        self,
        ci_level: float = 0.95,
        n_simulations: int = 1000,
        alpha: float | None = None,
    ) -> None:
        self.ci_level = ci_level
        self.n_simulations = n_simulations
        self.manual_alpha = alpha  # None = optimizado automáticamente

        self._model_fit = None
        self._series: pd.Series | None = None

    # ── Propiedades ────────────────────────────────────────────────────────────

    @property
    def parameters(self) -> dict[str, Any]:
        """Retorna los parámetros usados — para mostrar en la UI (ParameterExplorer)."""
        if self._model_fit is None:
            return {}
        return {
            "alpha": round(float(self._model_fit.params["smoothing_level"]), 4),
        }

    # ── Interfaz ForecastModel ─────────────────────────────────────────────────

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()

        model = SimpleExpSmoothing(series, initialization_method="estimated")
        fit_kwargs: dict[str, Any] = {"optimized": True, "remove_bias": True}
        if self.manual_alpha is not None:
            fit_kwargs["smoothing_level"] = self.manual_alpha

        self._model_fit = model.fit(**fit_kwargs)

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._model_fit is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        forecast = self._model_fit.forecast(horizon)

        # CI por simulación gaussiana sobre residuos
        rng = np.random.default_rng(seed=42)
        residuals = self._model_fit.resid.values
        std_resid = float(np.std(residuals, ddof=1)) if len(residuals) > 1 else 0.0

        simulations = np.array(
            [
                forecast.values + rng.normal(0, std_resid, size=horizon)
                for _ in range(self.n_simulations)
            ]
        )

        alpha = 1 - self.ci_level
        lower = np.percentile(simulations, alpha / 2 * 100, axis=0)
        upper = np.percentile(simulations, (1 - alpha / 2) * 100, axis=0)

        return pd.DataFrame(
            {
                "date": forecast.index,
                "predicted": forecast.values,
                "lower": lower,
                "upper": upper,
            }
        )

    def evaluate(self, test: pd.Series) -> dict[str, float | None]:
        if self._model_fit is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        predicted_series = pd.Series(
            self._model_fit.forecast(len(test)).values,
            index=test.index,
        )
        return evaluate_all(test, predicted_series)

    def get_parameters(self) -> dict[str, Any]:
        return self.parameters
