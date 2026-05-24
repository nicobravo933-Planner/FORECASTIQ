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


# ── Rolling cross-validation ────────────────────────────────────────────────────────────────


class CvFoldResult:
    """Resultado de un fold de cross-validation."""

    def __init__(
        self,
        fold: int,
        train_size: int,
        test_size: int,
        train_start: str,
        train_end: str,
        test_start: str,
        test_end: str,
        wape: float | None,
        mae: float | None,
        bias: float | None,
        rmse: float | None,
    ) -> None:
        self.fold = fold
        self.train_size = train_size
        self.test_size = test_size
        self.train_start = train_start
        self.train_end = train_end
        self.test_start = test_start
        self.test_end = test_end
        self.wape = wape
        self.mae = mae
        self.bias = bias
        self.rmse = rmse

    def to_dict(self) -> dict[str, object]:
        return {
            "fold": self.fold,
            "train_size": self.train_size,
            "test_size": self.test_size,
            "train_start": self.train_start,
            "train_end": self.train_end,
            "test_start": self.test_start,
            "test_end": self.test_end,
            "wape": self.wape,
            "mae": self.mae,
            "bias": self.bias,
            "rmse": self.rmse,
        }


class CvSummary:
    """Resumen agregado de todos los folds."""

    def __init__(self, folds: list[CvFoldResult]) -> None:
        self.folds = folds
        wapes = [f.wape for f in folds if f.wape is not None]
        maes = [f.mae for f in folds if f.mae is not None]
        biases = [f.bias for f in folds if f.bias is not None]
        self.wape_mean = round(float(np.mean(wapes)), 4) if wapes else None
        self.wape_std = round(float(np.std(wapes)), 4) if wapes else None
        self.mae_mean = round(float(np.mean(maes)), 4) if maes else None
        self.mae_std = round(float(np.std(maes)), 4) if maes else None
        self.bias_mean = round(float(np.mean(biases)), 4) if biases else None
        self.n_folds = len(folds)

    def to_dict(self) -> dict[str, object]:
        return {
            "n_folds": self.n_folds,
            "wape_mean": self.wape_mean,
            "wape_std": self.wape_std,
            "mae_mean": self.mae_mean,
            "mae_std": self.mae_std,
            "bias_mean": self.bias_mean,
            "folds": [f.to_dict() for f in self.folds],
        }


def rolling_cv(
    series: pd.Series,
    model_cls: type,
    model_kwargs: dict[str, object],
    horizon: int,
    k_folds: int,
) -> CvSummary:
    """
    Rolling window cross-validation para series temporales.

    Usa sklearn.model_selection.TimeSeriesSplit para respetar el orden temporal:
    el set de test siempre es posterior al set de train (sin data leakage).

    Reglas de mínimos por número de folds:
      - k=3: requiere al menos 3 * horizon + 4 observaciones
      - k=5: requiere al menos 5 * horizon + 4 observaciones

    Args:
        series:       Serie temporal ya preprocesada (winsorizada, sin NaN, con DatetimeIndex).
        model_cls:    Clase del modelo (ej. HoltWintersModel). Debe implementar fit/predict.
        model_kwargs: kwargs para el constructor del modelo (ej. {"ci_level": 0.95}).
        horizon:      Número de períodos en cada ventana de test.
        k_folds:      Número de folds (2–5 recomendado).

    Returns:
        CvSummary con métricas por fold + estadísticos agregados (media ± std).
    """
    from sklearn.model_selection import TimeSeriesSplit

    n = len(series)
    min_obs = k_folds * horizon + 4
    if n < min_obs:
        raise ValueError(
            f"Serie demasiado corta para {k_folds} folds con horizonte {horizon}. "
            f"Mínimo requerido: {min_obs} obs. Disponibles: {n}."
        )

    tscv = TimeSeriesSplit(n_splits=k_folds, test_size=horizon)
    fold_results: list[CvFoldResult] = []

    for fold_idx, (train_idx, test_idx) in enumerate(tscv.split(series), start=1):
        train = series.iloc[train_idx]
        test = series.iloc[test_idx]

        # Instancia fresca del modelo en cada fold para evitar contaminación
        model = model_cls(**model_kwargs)
        try:
            model.fit(train)
            metrics = model.evaluate(test)
        except Exception:
            # Fold falla (ej. serie muy corta para ETS estacional) — registra None
            metrics = {"wape": None, "mae": None, "bias": None, "rmse": None}

        fold_results.append(
            CvFoldResult(
                fold=fold_idx,
                train_size=len(train),
                test_size=len(test),
                train_start=str(train.index[0].date()),
                train_end=str(train.index[-1].date()),
                test_start=str(test.index[0].date()),
                test_end=str(test.index[-1].date()),
                wape=metrics.get("wape"),
                mae=metrics.get("mae"),
                bias=metrics.get("bias"),
                rmse=metrics.get("rmse"),
            )
        )

    return CvSummary(fold_results)
