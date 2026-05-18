"""
LightGBM con features de lag + Optuna HPO.

Cuándo se usa: series de alta volatilidad (CV > 1.0) con >= 104 observaciones.
Ventaja: captura patrones no lineales que los modelos estadísticos no ven.

Features de lag generadas automáticamente:
  - lags 1..max_lag (configurable, default 13 para mensual)
  - rolling mean y std (ventanas 3, 6, 12)
  - features de calendario: mes, trimestre, día del año

CI via quantile regression: entrena dos modelos extra (q=0.025, q=0.975).
Optuna: MedianPruner, 30 trials, timeout 60s (para no bloquear la cola).
"""

from __future__ import annotations

import warnings

import lightgbm as lgb
import numpy as np
import optuna
import pandas as pd

from app.ml.evaluator import evaluate_all
from app.ml.models.base import ForecastModel
from app.ml.models.utils import normalize_freq

optuna.logging.set_verbosity(optuna.logging.WARNING)
warnings.filterwarnings("ignore", category=UserWarning, module="lightgbm")


def _make_features(series: pd.Series, max_lag: int = 13) -> pd.DataFrame:
    """Genera features temporales y de lag para el DataFrame de entrenamiento."""
    df = pd.DataFrame({"y": series.values}, index=series.index)

    # Features de lag
    for lag in range(1, max_lag + 1):
        df[f"lag_{lag}"] = df["y"].shift(lag)

    # Rolling stats
    for window in [3, 6, 12]:
        if window < max_lag:
            df[f"roll_mean_{window}"] = df["y"].shift(1).rolling(window).mean()
            df[f"roll_std_{window}"] = df["y"].shift(1).rolling(window).std()

    # Features de calendario
    df["month"] = series.index.month
    df["quarter"] = series.index.quarter
    df["day_of_year"] = series.index.day_of_year

    return df.dropna()


class LightGBMModel(ForecastModel):
    """
    LightGBM con HPO via Optuna + CI por quantile regression.
    Predice recursivamente: cada paso usa las predicciones anteriores como lags.
    """

    name = "lightgbm"
    requires_min_observations = 52

    def __init__(
        self,
        max_lag: int = 13,
        ci_level: float = 0.95,
        n_trials: int = 30,
        optuna_timeout: int = 60,
    ) -> None:
        self.max_lag = max_lag
        self.ci_level = ci_level
        self.n_trials = n_trials
        self.optuna_timeout = optuna_timeout

        self._model_mean: lgb.Booster | None = None
        self._model_lower: lgb.Booster | None = None
        self._model_upper: lgb.Booster | None = None
        self._series: pd.Series | None = None
        self._freq: str | None = None
        self._best_params: dict = {}

    # ── Entrenamiento ─────────────────────────────────────────────────────────

    def fit(self, series: pd.Series) -> None:
        self._series = series.copy()
        self._freq = normalize_freq(pd.infer_freq(series.index) or "MS")

        df = _make_features(series, self.max_lag)
        x = df.drop(columns=["y"]).values
        y = df["y"].values

        # Optuna HPO sobre el modelo de media
        self._best_params = self._optimize(x, y)

        # Entrena modelo de media con mejores params
        self._model_mean = self._train_lgb(x, y, self._best_params, objective="regression")

        # Modelos de quantile para CI
        alpha = 1 - self.ci_level
        lower_q = alpha / 2
        upper_q = 1 - alpha / 2

        q_params = {**self._best_params, "objective": "quantile", "verbose": -1}
        self._model_lower = self._train_lgb(
            x, y, {**q_params, "alpha": lower_q}, objective="quantile"
        )
        self._model_upper = self._train_lgb(
            x, y, {**q_params, "alpha": upper_q}, objective="quantile"
        )

    def _optimize(self, x: np.ndarray, y: np.ndarray) -> dict:
        """Optuna: busca hiperparámetros minimizando RMSE en validación temporal."""

        def objective(trial: optuna.Trial) -> float:
            params = {
                "objective": "regression",
                "metric": "rmse",
                "verbose": -1,
                "num_leaves": trial.suggest_int("num_leaves", 16, 128),
                "learning_rate": trial.suggest_float("learning_rate", 0.01, 0.3, log=True),
                "n_estimators": trial.suggest_int("n_estimators", 50, 500),
                "min_child_samples": trial.suggest_int("min_child_samples", 5, 50),
                "subsample": trial.suggest_float("subsample", 0.5, 1.0),
                "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
                "reg_alpha": trial.suggest_float("reg_alpha", 1e-4, 10.0, log=True),
                "reg_lambda": trial.suggest_float("reg_lambda", 1e-4, 10.0, log=True),
            }
            # Validación temporal: últimos 20% como test
            split = int(len(x) * 0.8)
            x_train, x_val = x[:split], x[split:]
            y_train, y_val = y[:split], y[split:]

            model = lgb.train(
                params,
                lgb.Dataset(x_train, label=y_train),
                valid_sets=[lgb.Dataset(x_val, label=y_val)],
                callbacks=[lgb.early_stopping(20, verbose=False), lgb.log_evaluation(-1)],
            )
            preds = model.predict(x_val)
            return float(np.sqrt(np.mean((y_val - preds) ** 2)))

        study = optuna.create_study(
            direction="minimize",
            pruner=optuna.pruners.MedianPruner(n_startup_trials=5),
            sampler=optuna.samplers.TPESampler(seed=42),
        )
        study.optimize(objective, n_trials=self.n_trials, timeout=self.optuna_timeout)
        return study.best_params

    def _train_lgb(self, x: np.ndarray, y: np.ndarray, params: dict, objective: str) -> lgb.Booster:
        final_params = {**params, "objective": objective, "verbose": -1}
        return lgb.train(
            final_params,
            lgb.Dataset(x, label=y),
            callbacks=[lgb.log_evaluation(-1)],
        )

    # ── Predicción recursiva ──────────────────────────────────────────────────

    def predict(self, horizon: int) -> pd.DataFrame:
        if self._model_mean is None or self._series is None:
            raise RuntimeError("Llamar fit() antes de predict().")

        last_date = self._series.index[-1]
        future_dates = pd.date_range(start=last_date, periods=horizon + 1, freq=self._freq)[1:]

        # Predicción recursiva: cada paso extiende la serie con la pred anterior
        extended = self._series.copy()
        preds_mean, preds_lower, preds_upper = [], [], []

        for future_date in future_dates:
            df = _make_features(extended, self.max_lag)
            x_row = df.drop(columns=["y"]).iloc[[-1]].values

            pred_mean = float(self._model_mean.predict(x_row)[0])
            pred_lower = float(self._model_lower.predict(x_row)[0])  # type: ignore[union-attr]
            pred_upper = float(self._model_upper.predict(x_row)[0])  # type: ignore[union-attr]

            preds_mean.append(pred_mean)
            preds_lower.append(pred_lower)
            preds_upper.append(pred_upper)

            # Agrega la predicción puntual a la serie para el siguiente paso
            extended = pd.concat(
                [
                    extended,
                    pd.Series([pred_mean], index=pd.DatetimeIndex([future_date])),
                ]
            )

        return pd.DataFrame(
            {
                "date": future_dates,
                "predicted": preds_mean,
                "lower": preds_lower,
                "upper": preds_upper,
            }
        )

    def evaluate(self, test: pd.Series) -> dict[str, float]:
        if self._model_mean is None:
            raise RuntimeError("Llamar fit() antes de evaluate().")

        preds = self.predict(len(test))
        predicted_series = pd.Series(preds["predicted"].values, index=test.index)
        return evaluate_all(test, predicted_series)
