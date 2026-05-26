"""
Holt Simple — Double Exponential Smoothing (nivel + tendencia, sin estacionalidad).

Captura nivel y tendencia pero NO estacionalidad.
Ideal cuando hay tendencia clara (creciente o decreciente) pero sin ciclo estacional.

Parámetros:
  alpha  — peso del nivel (0-1). α≈1 → nivel muy reactivo.
  beta   — peso de la tendencia (0-1). β≈1 → tendencia muy adaptable.

Cuándo usarlo vs Holt-Winters:
  • Serie sin patrón estacional claro (CV estacional bajo).
  • Historias cortas (< 2 ciclos) donde HW no puede estimar bien la estacionalidad.
  • Tendencia obvia (Mann-Kendall p < 0.05) sin ciclos.

Implementación: statsmodels ExponentialSmoothing(trend='add', seasonal=None).
Intervalos de confianza: simulación gaussiana sobre residuos.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from statsmodels.tsa.holtwinters import ExponentialSmoothing

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel


class HoltSimpleModel(ForecastModel):
    """
    Holt Simple (Double Exponential Smoothing) — nivel + tendencia, sin estacionalidad.
    statsmodels ExponentialSmoothing(trend='add', seasonal=None).
    """

    name = "holt_simple"
    requires_min_observations = 12  # necesita suficientes puntos para estimar tendencia

    def __init__(
        self,
        ci_level: float = 0.95,
        n_simulations: int = 1000,
        alpha: float | None = None,
        beta: float | None = None,
    ) -> None:
        self.ci_level = ci_level
        self.n_simulations = n_simulations
        self.manual_alpha = alpha  # None = optimizado automáticamente
        self.manual_beta = beta

        self._model_fit = None
        self._series: pd.Series | None = None

    # ── Propiedades ────────────────────────────────────────────────────────────

    @property
    def parameters(self) -> dict[str, Any]:
        """Retorna los parámetros usados — para mostrar en la UI (ParameterExplorer)."""
        if self._model_fit is None:
            return {}
        params = self._model_fit.params
        return {
            "alpha": round(float(params["smoothing_level"]), 4),
            "beta": round(float(params.get("smoothing_trend", 0.0)), 4),
        }

    # ── Interfaz ForecastModel ─────────────────────────────────────────────────

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()

        model = ExponentialSmoothing(
            series,
            trend="add",
            seasonal=None,
            initialization_method="estimated",
        )
        fit_kwargs: dict[str, Any] = {"optimized": True, "remove_bias": True}
        if self.manual_alpha is not None:
            fit_kwargs["smoothing_level"] = self.manual_alpha
        if self.manual_beta is not None:
            fit_kwargs["smoothing_trend"] = self.manual_beta

        self._model_fit = model.fit(**fit_kwargs)

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._model_fit is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        forecast = self._model_fit.forecast(horizon)

        # CI por simulación gaussiana sobre residuos (igual que HoltWinters)
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
