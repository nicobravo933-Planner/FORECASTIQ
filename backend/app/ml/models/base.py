"""
Clase base abstracta para todos los modelos de forecasting.

Todo modelo concreto hereda de ForecastModel e implementa:
  - fit(series)       → entrena con la serie histórica
  - predict(horizon)  → retorna DataFrame con [date, predicted, lower, upper]
  - evaluate(test)    → retorna dict con métricas WAPE, MAE, BIAS, RMSE, MAPE
"""

from __future__ import annotations

from abc import ABC, abstractmethod

import pandas as pd


class ForecastModel(ABC):
    """Interfaz común para todos los modelos de forecasting de forecastiq."""

    name: str  # identificador del modelo (ej. "holt_winters")
    requires_min_observations: int  # mínimo de obs para entrenar sin error

    @abstractmethod
    def fit(self, series: pd.Series) -> None:
        """
        Entrena el modelo con la serie temporal.

        Args:
            series: pd.Series con índice DatetimeIndex y valores numéricos.
                    Ya winsorizada (p5/p95) y sin NaN.
        """
        ...

    @abstractmethod
    def predict(self, horizon: int) -> pd.DataFrame:
        """
        Genera predicciones futuras.

        Args:
            horizon: número de períodos a proyectar.

        Returns:
            DataFrame con columnas:
              - date       (Timestamp)
              - predicted  (float)  → valor puntual
              - lower      (float)  → límite inferior del intervalo de confianza
              - upper      (float)  → límite superior del intervalo de confianza
        """
        ...

    @abstractmethod
    def evaluate(self, test: pd.Series) -> dict[str, float]:
        """
        Evalúa el modelo contra una serie de test (hold-out).

        Returns:
            Dict con claves: "wape", "mae", "bias", "rmse", "mape"
        """
        ...
