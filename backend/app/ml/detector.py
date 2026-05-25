"""
Detector automático de modelo — Phase 1.

Pipeline de caracterización de serie temporal:
  1. Detección de outliers (MAD)
  2. Detección de estacionalidad (FFT)
  3. Detección de tendencia (Seasonal Mann-Kendall)
  4. Cálculo de CV (dispersión / ruido)
  5. Selección de modelo según reglas de negocio

Tratamiento de outliers (Winsorización) queda para Phase 2, antes de fit().
"""

from __future__ import annotations

import numpy as np
import pandas as pd
import pymannkendall as mk
from pydantic import BaseModel

# ── Schema de resultado ────────────────────────────────────────────────────────


class DecisionStep(BaseModel):
    """Un paso del árbol de decisión — para mostrar en el frontend (E6)."""

    step: int  # número de paso (1-4)
    label: str  # ej. "Outliers (MAD)"
    passed: bool  # True = condición verificada / relevante
    value: str  # valor medido, ej. "3 outliers (2.1%)"
    threshold: str  # umbral usado, ej. "threshold = 3.0"
    explanation: str  # qué significa este paso en lenguaje simple


class DetectionResult(BaseModel):
    """Resultado completo de la caracterización de la serie."""

    # Modelo recomendado
    model: str  # "moving_average" | "holt_winters" | "sarima" | "lightgbm"
    reason: str  # explicación en lenguaje natural para el usuario

    # Características detectadas
    n_observations: int
    has_trend: bool
    trend_direction: str  # "increasing" | "decreasing" | "no trend"
    trend_p_value: float  # p-value del test Mann-Kendall
    seasonality_period: int | None  # ej. 52 (semanal/anual), 12 (mensual/anual)
    has_seasonality: bool
    cv: float  # coeficiente de variación (std/mean)

    # Outliers (MAD)
    outlier_count: int
    outlier_pct: float  # porcentaje de outliers sobre total
    outlier_indices: list[int]  # posiciones para resaltar en frontend

    # Confianza de la recomendación (0-1)
    confidence: float

    # E6: árbol de decisión explicitado paso a paso
    decision_steps: list[DecisionStep] = []


# ── 1. Detección de outliers (MAD) ────────────────────────────────────────────


def detect_outliers_mad(series: pd.Series, threshold: float = 3.0) -> pd.Series:
    """
    Detecta outliers usando Median Absolute Deviation (MAD).
    Retorna una serie booleana: True = outlier.

    No asume distribución normal — robusto para series de ventas con estacionalidad.
    threshold=3.0 es el estándar de industria (equivale a ~3 sigma en distribución normal).
    """
    arr = series.to_numpy(dtype=float)
    median = float(np.median(arr))
    mad = float(np.median(np.abs(arr - median)))

    # MAD == 0 implica que >50% de los valores son iguales (serie muy constante)
    if mad == 0:
        return pd.Series(False, index=series.index)

    # Modified Z-score: 0.6745 es el factor de consistencia para distribución normal
    modified_z = 0.6745 * (arr - median) / mad
    return pd.Series(np.abs(modified_z) > threshold, index=series.index)


# ── 2. Detección de estacionalidad (FFT) ──────────────────────────────────────


def detect_seasonality_fft(
    series: pd.Series,
    freq: str = "M",
    min_power_ratio: float = 0.10,
) -> int | None:
    """
    Detecta el período de estacionalidad dominante usando FFT.

    Retorna el período en unidades de la frecuencia (ej. 12 para mensual anual,
    52 para semanal anual) o None si no hay estacionalidad significativa.

    min_power_ratio: la frecuencia dominante debe tener al menos este % del poder
    total del espectro para considerarse estacional (evita falsos positivos en ruido).
    """
    # Períodos candidatos según frecuencia de la serie
    candidate_periods: dict[str, list[int]] = {
        "D": [7, 30, 365],  # diaria: semanal, mensual, anual
        "W": [4, 13, 26, 52],  # semanal: mensual, trimestral, semestral, anual
        "M": [3, 6, 12],  # mensual: trimestral, semestral, anual
        "Q": [4],  # trimestral: anual
    }
    candidates = candidate_periods.get(freq, [12])

    n = len(series)
    if n < 2:
        return None

    # FFT sobre la serie (removemos la media para no contaminar con DC component)
    values = series.to_numpy(dtype=float) - float(series.mean())
    fft_vals = np.abs(np.fft.rfft(values)) ** 2  # potencia espectral
    # freqs no se usa directamente — los índices se calculan por período

    total_power = fft_vals.sum()
    if total_power == 0:
        return None

    best_period: int | None = None
    best_power: float = 0.0

    for period in candidates:
        if period >= n:
            continue
        # Frecuencia correspondiente al período
        target_freq = 1.0 / period
        # Índice en el espectro más cercano a esa frecuencia
        idx = int(np.round(target_freq * n))
        idx = min(idx, len(fft_vals) - 1)

        # Ventana de ±1 bin para capturar el pico aunque no caiga exacto
        window = fft_vals[max(0, idx - 1) : idx + 2]
        peak_power = float(window.max())
        ratio = peak_power / total_power

        if ratio > min_power_ratio and peak_power > best_power:
            best_power = peak_power
            best_period = period

    return best_period


# ── 3. Tendencia (Seasonal Mann-Kendall) ──────────────────────────────────────


def detect_trend_mannkendall(
    series: pd.Series,
    seasonality_period: int | None,
    alpha: float = 0.05,
) -> tuple[bool, str, float]:
    """
    Detecta tendencia usando Seasonal Mann-Kendall si hay estacionalidad,
    o Mann-Kendall original si no.

    Retorna (has_trend, direction, p_value).
    direction: "increasing" | "decreasing" | "no trend"
    """
    values = series.values

    if seasonality_period is not None and len(values) >= seasonality_period * 2:
        # Seasonal MK: controla la estacionalidad antes de testear tendencia
        result = mk.seasonal_test(values, period=seasonality_period, alpha=alpha)
    else:
        result = mk.original_test(values, alpha=alpha)

    has_trend = result.h  # True si se rechaza H0 (= hay tendencia)

    if not has_trend:
        direction = "no trend"
    elif result.trend == "increasing":
        direction = "increasing"
    else:
        direction = "decreasing"

    return has_trend, direction, float(result.p)


# ── 4. Coeficiente de variación ───────────────────────────────────────────────


def calculate_cv(series: pd.Series) -> float:
    """
    Coeficiente de variación = std / mean.
    Mide el ruido relativo de la serie.
    CV > 1.0 indica serie muy volátil (candidata a LightGBM con features externas).
    """
    mean = series.mean()
    if mean == 0:
        return 0.0
    return float(series.std() / mean)


# ── 5. Lógica de selección de modelo ──────────────────────────────────────────


def _build_decision_steps(
    n: int,
    outlier_count: int,
    outlier_pct: float,
    has_seasonality: bool,
    seasonality_period: int | None,
    has_trend: bool,
    trend_direction: str,
    trend_p_value: float,
    cv: float,
) -> list[DecisionStep]:
    """
    Construye la lista de pasos del árbol de decisión con explicaciones pedagógicas.
    Cada paso muestra el valor medido, el umbral usado y por qué importa (E6).
    """
    steps: list[DecisionStep] = []

    # Paso 1 — Observaciones
    steps.append(
        DecisionStep(
            step=1,
            label="Historia de la serie",
            passed=n >= 52,
            value=f"{n} observaciones",
            threshold="mínimo recomendado: 52",
            explanation=(
                "Con menos de 52 obs. no hay suficiente señal para detectar estacionalidad o tendencia. "
                + (
                    "✓ Historia suficiente — se continúa con el análisis."
                    if n >= 52
                    else "✗ Historia insuficiente — se usa Moving Average como baseline robusto."
                )
            ),
        )
    )

    # Paso 2 — Outliers (MAD)
    steps.append(
        DecisionStep(
            step=2,
            label="Outliers (MAD modificado)",
            passed=True,  # siempre se corre, es informativo
            value=f"{outlier_count} outlier{'s' if outlier_count != 1 else ''} ({outlier_pct:.1f}%)",
            threshold="Modified Z-score > 3.0",
            explanation=(
                "MAD es robusto a la estacionalidad — no asume distribución normal. "
                + (
                    "Los outliers detectados se winsorizan a p5/p95 antes del ajuste."
                    if outlier_count > 0
                    else "Sin outliers detectados — la serie es limpia."
                )
            ),
        )
    )

    # Paso 3 — Estacionalidad (FFT)
    period_label = (
        f"período {seasonality_period} "
        f"({'anual' if seasonality_period in (12, 52) else 'ciclo recurrente'})"
        if seasonality_period is not None
        else "sin período dominante"
    )
    steps.append(
        DecisionStep(
            step=3,
            label="Estacionalidad (FFT)",
            passed=has_seasonality,
            value=period_label,
            threshold="razón de potencia espectral ≥ 10%",
            explanation=(
                "La FFT descompone la serie en frecuencias y mide el peso de cada ciclo. "
                + (
                    "✓ Estacionalidad clara → Holt-Winters triple (α+β+γ) activado."
                    if has_seasonality
                    else "✗ Sin ciclo claro → se evalúan tendencia y volatilidad."
                )
            ),
        )
    )

    # Paso 4 — Tendencia (Mann-Kendall)
    mk_method = "Seasonal MK" if has_seasonality else "Mann-Kendall original"
    steps.append(
        DecisionStep(
            step=4,
            label=f"Tendencia ({mk_method})",
            passed=has_trend,
            value=(
                f"{trend_direction} (p={trend_p_value:.3f})"
                if has_trend
                else f"sin tendencia (p={trend_p_value:.3f})"
            ),
            threshold="p-value < 0.05",
            explanation=(
                f"{'Seasonal MK controla la estacionalidad antes de testear la tendencia.' if has_seasonality else 'MK original sobre la serie completa.'} "
                + (
                    f"✓ Tendencia {trend_direction} significativa → SARIMA candidato (requiere n ≥ 104)."
                    if has_trend
                    else "✗ Sin tendencia significativa → se evalúa la volatilidad."
                )
            ),
        )
    )

    # Paso 5 — Volatilidad (CV)
    steps.append(
        DecisionStep(
            step=5,
            label="Volatilidad (CV = std / media)",
            passed=cv > 1.0,
            value=f"CV = {cv:.3f}",
            threshold="CV > 1.0 para LightGBM",
            explanation=(
                "CV mide el ruido relativo de la serie. "
                + (
                    "✓ Alta volatilidad → LightGBM con features de lag captura patrones no lineales."
                    if cv > 1.0
                    else "✗ Volatilidad controlada → modelos estadísticos son suficientes."
                )
            ),
        )
    )

    return steps


def detect_best_model(series: pd.Series, freq: str = "M") -> DetectionResult:
    """
    Función principal: caracteriza la serie y recomienda el mejor modelo.

    Reglas (en orden de prioridad):
      1. n < 52  → Moving Average (no hay suficientes datos para modelos complejos)
      2. n >= 52 + estacionalidad clara → Holt-Winters (caballo de batalla)
      3. n >= 104 + tendencia + sin estacionalidad clara → SARIMA
      4. n >= 104 + CV alto (> 1.0) → LightGBM (serie muy volátil, necesita features)
      5. default → Holt-Winters

    Args:
        series: pd.Series con índice temporal y valores numéricos, sin NaN.
        freq: frecuencia de la serie ("D", "W", "M", "Q").
    """
    n = len(series)

    # ── Outliers ──
    outlier_mask = detect_outliers_mad(series)
    outlier_indices = [int(i) for i, v in enumerate(outlier_mask) if v]
    outlier_count = len(outlier_indices)
    outlier_pct = round(outlier_count / n * 100, 2) if n > 0 else 0.0

    # ── Estacionalidad ──
    seasonality_period = detect_seasonality_fft(series, freq=freq)
    has_seasonality = seasonality_period is not None

    # ── Tendencia ──
    has_trend, trend_direction, trend_p_value = detect_trend_mannkendall(series, seasonality_period)

    # ── CV ──
    cv = calculate_cv(series)

    # ── Selección ──
    if n < 52:
        model = "moving_average"
        reason = (
            f"La serie tiene {n} observaciones (mínimo recomendado: 52). "
            "Se usa Moving Average como baseline robusto para series cortas."
        )
        confidence = 0.90

    elif has_seasonality and seasonality_period is not None:
        model = "holt_winters"
        reason = (
            f"Se detectó estacionalidad con período {seasonality_period} "
            f"({'anual' if seasonality_period in (12, 52) else 'otro ciclo'}). "
            "Holt-Winters Triple (suavizado exponencial) es el estándar de industria "
            "para series con tendencia y estacionalidad clara."
        )
        confidence = 0.85 if has_trend else 0.80

    elif has_trend and n >= 104:
        model = "sarima"
        reason = (
            f"La serie muestra tendencia {trend_direction} significativa "
            f"(p={trend_p_value:.3f}) sin estacionalidad dominante. "
            "SARIMA provee intervalos de confianza estadísticamente rigurosos "
            "y es el estándar en finanzas y planificación de demanda."
        )
        confidence = 0.80

    elif cv > 1.0 and n >= 104:
        model = "lightgbm"
        reason = (
            f"La serie tiene alta volatilidad (CV={cv:.2f}). "
            "LightGBM con features de lag captura patrones no lineales "
            "mejor que los modelos estadísticos en series muy ruidosas."
        )
        confidence = 0.70

    else:
        # Default: Holt-Winters es el caballo de batalla
        model = "holt_winters"
        reason = (
            "Serie con características mixtas. Holt-Winters es el modelo "
            "más robusto y usado en retail y supply chain como punto de partida."
        )
        confidence = 0.75

    return DetectionResult(
        model=model,
        reason=reason,
        n_observations=n,
        has_trend=has_trend,
        trend_direction=trend_direction,
        trend_p_value=round(trend_p_value, 4),
        seasonality_period=seasonality_period,
        has_seasonality=has_seasonality,
        cv=round(cv, 4),
        outlier_count=outlier_count,
        outlier_pct=outlier_pct,
        outlier_indices=outlier_indices,
        confidence=round(confidence, 2),
        decision_steps=_build_decision_steps(
            n=n,
            outlier_count=outlier_count,
            outlier_pct=outlier_pct,
            has_seasonality=has_seasonality,
            seasonality_period=seasonality_period,
            has_trend=has_trend,
            trend_direction=trend_direction,
            trend_p_value=round(trend_p_value, 4),
            cv=round(cv, 4),
        ),
    )
