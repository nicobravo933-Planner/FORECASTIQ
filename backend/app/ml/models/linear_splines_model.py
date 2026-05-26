"""
linear_splines_model.py — Regresión Lineal con Splines Cúbicos.

Modelo interpretable y sorprendentemente competitivo para series con tendencias
suaves y estacionalidad clara. Inspirado en el Streamlit de referencia.

Pipeline:
  1. Crea features: índice de tiempo (t), splines naturales de grado 3, dummies mensuales.
  2. Ajusta una regresión lineal ordinaria (OLS) sobre esas features.
  3. Predice hacia el futuro extrapolando el índice t y sus splines.

Ventajas vs Holt-Winters:
  - Completamente interpretable: coeficientes visibles.
  - Rápido (milisegundos incluso con 500 obs).
  - Robusto cuando la tendencia no es exponencial.

Desventajas:
  - No captura cambios estructurales bruscos.
  - Los splines pueden oscilar en extrapolación larga (> 2 ciclos).
  - Requiere al menos 1 ciclo completo de historia (12 obs mensuales).

Dependencias: sklearn (ya en pyproject.toml), scipy.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import SplineTransformer

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel
from app.ml.models.utils import get_seasonal_periods, normalize_freq


class LinearSplinesModel(ForecastModel):
    """
    Regresión lineal con splines cúbicos naturales + dummies estacionales.

    Hiperparámetros:
        n_knots:    número de nodos para los splines (default 5, rango 3-8).
        degree:     grado del polinomio de splines (default 3 = cúbico).
        alpha:      regularización L2 de Ridge (default 1e-3, casi OLS).
        add_dummies: si True, agrega variables indicadoras por período estacional.
    """

    name = "linear_splines"
    requires_min_observations = 12

    def __init__(
        self,
        n_knots: int = 5,
        degree: int = 3,
        alpha: float = 1e-3,
        add_dummies: bool = True,
    ) -> None:
        self.n_knots = n_knots
        self.degree = degree
        self.alpha = alpha
        self.add_dummies = add_dummies

        self._model: Ridge | None = None
        self._spline: SplineTransformer | None = None
        self._series: pd.Series | None = None
        self._freq: str | None = None
        self._season_len: int = 12
        self._train_end_t: int = 0  # último índice t de entrenamiento

    # ── features ──────────────────────────────────────────────────────────────

    def _build_features(self, t: np.ndarray, period_idx: np.ndarray | None) -> np.ndarray:
        """
        Construye la matriz de features:
          - Splines naturales cúbicos sobre t (tendencia suave)
          - Dummies estacionales (0/1 por mes/semana/trimestre)

        Args:
            t:           array 1D de índices de tiempo [0, 1, 2, ...]
            period_idx:  array 1D con el período estacional de cada punto
                         (0..season_len-1), o None si add_dummies=False.
        """
        # Reshape para sklearn
        t_col = t.reshape(-1, 1)

        # Splines sobre t — fit solo en train, transform en test/future
        if self._spline is None:
            self._spline = SplineTransformer(
                n_knots=min(self.n_knots, max(3, len(t) // 4)),
                degree=self.degree,
                include_bias=False,
                extrapolation="linear",  # extrapolación lineal fuera del dominio de train
            )
            spline_feats = self._spline.fit_transform(t_col)
        else:
            spline_feats = self._spline.transform(t_col)

        if self.add_dummies and period_idx is not None and self._season_len > 1:
            # One-hot sin la primera categoría (evita multicolinealidad)
            dummies = np.zeros((len(t), self._season_len - 1), dtype=float)
            for i, p in enumerate(period_idx):
                if p > 0:  # categoría 0 = base (absorbida por la constante del Ridge)
                    dummies[i, p - 1] = 1.0
            return np.array(np.hstack([spline_feats, dummies]))

        return np.array(spline_feats)

    def _period_idx(self, index: pd.DatetimeIndex) -> np.ndarray:
        """Retorna el índice estacional (0..season_len-1) para cada timestamp."""
        freq = self._freq or "MS"
        if freq in ("MS", "M", "ME"):
            return (index.month - 1).to_numpy()
        if freq in ("W", "W-MON"):
            return index.isocalendar().week.to_numpy() % self._season_len
        if freq in ("QS", "Q", "QE"):
            return (index.quarter - 1).to_numpy()
        # Diaria: día de la semana
        return index.dayofweek.to_numpy()

    # ── ForecastModel interface ──────────────────────────────────────────────

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()
        freq = normalize_freq(pd.infer_freq(pd.DatetimeIndex(series.index)) or "MS")
        self._freq = freq
        self._season_len = get_seasonal_periods(freq)
        self._spline = None  # reset para refit limpio

        n = len(series)
        t = np.arange(n, dtype=float)
        self._train_end_t = int(n - 1)

        period_idx = self._period_idx(pd.DatetimeIndex(series.index))
        X = self._build_features(t, period_idx)  # noqa: N806
        y = series.values.astype(float)

        self._model = Ridge(alpha=self.alpha, fit_intercept=True)
        self._model.fit(X, y)

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._model is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        # Generar índice de fechas futuras
        last_date = self._series.index[-1]
        freq = self._freq or "MS"
        future_index = pd.date_range(start=last_date, periods=horizon + 1, freq=freq)[1:]

        n_train = len(self._series)
        t_future = np.arange(n_train, n_train + horizon, dtype=float)
        period_idx_future = self._period_idx(pd.DatetimeIndex(future_index))

        X_future = self._build_features(t_future, period_idx_future)  # noqa: N806
        predicted = self._model.predict(X_future)
        predicted = np.clip(predicted, 0, None)  # demanda no negativa

        # CI: basado en residuos del train (IC gaussiano)
        t_train = np.arange(n_train, dtype=float)
        period_idx_train = self._period_idx(pd.DatetimeIndex(self._series.index))
        X_train = self._build_features(t_train, period_idx_train)  # noqa: N806
        resid = self._series.values.astype(float) - self._model.predict(X_train)
        std_resid = float(np.std(resid, ddof=1)) if len(resid) > 1 else 1.0

        z = 1.96  # 95% CI
        lower = np.clip(predicted - z * std_resid, 0, None)
        upper = predicted + z * std_resid

        return pd.DataFrame(
            {
                "date": future_index,
                "predicted": predicted.round(4),
                "lower": lower.round(4),
                "upper": upper.round(4),
            }
        )

    def evaluate(self, test: pd.Series) -> dict[str, float | None]:
        if self._model is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        n_train = len(self._series)
        t_test = np.arange(n_train, n_train + len(test), dtype=float)
        period_idx_test = self._period_idx(pd.DatetimeIndex(test.index))
        X_test = self._build_features(t_test, period_idx_test)  # noqa: N806
        predicted_vals = self._model.predict(X_test)
        predicted_series = pd.Series(predicted_vals, index=test.index)

        return evaluate_all(test, predicted_series)
