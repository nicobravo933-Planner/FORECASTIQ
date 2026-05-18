"""
SARIMA con auto-selección de orden vía pmdarima.auto_arima.

Cuándo se usa: series con tendencia + sin estacionalidad dominante (n >= 104).
Ventaja clave: intervalos de confianza estadísticamente rigurosos (analíticos).

pmdarima.auto_arima busca el mejor (p,d,q)(P,D,Q)[m] por AIC con stepwise search.
Se limita el espacio de búsqueda para mantener tiempos razonables en producción.
"""

from __future__ import annotations

import pandas as pd
import pmdarima as pm

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel
from app.ml.models.utils import get_seasonal_periods, normalize_freq

_SEASONAL_PERIODS: dict[str, int] = {}  # legacy, reemplazado por utils


class SarimaModel(ForecastModel):
    """
    Auto-SARIMA con pmdarima. CI analítico incluido en el summary del fit.
    """

    name = "sarima"
    requires_min_observations = 36  # mínimo para estimar correctamente

    def __init__(self, ci_level: float = 0.95) -> None:
        self.ci_level = ci_level
        self._model_fit = None
        self._series: pd.Series | None = None
        self._freq: str | None = None

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()
        freq = normalize_freq(pd.infer_freq(series.index) or "MS")
        self._freq = freq
        m = get_seasonal_periods(freq)

        # stepwise=True acelera mucho la búsqueda (esencial en producción)
        # max_p/max_q limitados para evitar overfitting en series cortas
        self._model_fit = pm.auto_arima(
            series.values,
            m=m,
            seasonal=m > 1,
            stepwise=True,
            information_criterion="aic",
            max_p=3, max_q=3,
            max_P=2, max_Q=2,
            d=None,   # auto-detecta diferenciación
            D=None,   # auto-detecta diferenciación estacional
            error_action="ignore",
            suppress_warnings=True,
            n_jobs=1,  # determinista — importante para reproducibilidad
        )

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._model_fit is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        alpha = 1 - self.ci_level
        # predict() de pmdarima retorna (mean, conf_int) cuando return_conf_int=True
        predicted, conf_int = self._model_fit.predict(
            n_periods=horizon,
            return_conf_int=True,
            alpha=alpha,
        )

        last_date = self._series.index[-1]
        future_dates = pd.date_range(
            start=last_date, periods=horizon + 1, freq=self._freq
        )[1:]

        return pd.DataFrame({
            "date":      future_dates,
            "predicted": predicted,
            "lower":     conf_int[:, 0],
            "upper":     conf_int[:, 1],
        })

    def evaluate(self, test: pd.Series) -> dict[str, float]:
        if self._model_fit is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        predicted, _ = self._model_fit.predict(
            n_periods=len(test), return_conf_int=True
        )
        predicted_series = pd.Series(predicted, index=test.index)
        return evaluate_all(test, predicted_series)
