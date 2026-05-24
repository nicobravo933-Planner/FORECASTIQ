"""
EDA — Análisis Exploratorio de Datos (E1).

Endpoints:
  GET /api/eda/{dataset_id}/summary        → estadísticas descriptivas de la serie
  GET /api/eda/{dataset_id}/outliers       → detección MAD + límites winsorización
  GET /api/eda/{dataset_id}/quality-score  → score 0-100 con breakdown por criterio
  GET /api/eda/{dataset_id}/models-available → modelos desbloqueados según quality score

Todos los endpoints reciben date_col, target_col y freq como query params (Opción A).
El frontend pasa lo que ya tiene en appStore — sin estado adicional en el backend.
"""

from __future__ import annotations

from typing import TypedDict

import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.ml.detector import detect_outliers_mad
from app.services.storage import load_dataset, save_dataset


def _f(x: object) -> float:
    """Cast seguro a float para mypy strict — pandas retorna tipos ambiguos en sus stubs."""
    return float(x)  # type: ignore[arg-type]

router = APIRouter(prefix="/api/eda", tags=["eda"])


# ── Helpers internos ──────────────────────────────────────────────────────────


def _load_series(
    dataset_id: str,
    date_col: str,
    target_col: str,
) -> tuple[pd.Series, pd.DatetimeIndex]:
    """
    Carga el dataset, valida columnas, parsea fechas y retorna (serie, índice temporal).
    Lanza HTTPException 404/400 si algo falla.
    """
    try:
        df = load_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' no encontrado.",
        ) from exc

    if date_col not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Columna de fecha '{date_col}' no encontrada. Disponibles: {list(df.columns)}",
        )
    if target_col not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Columna objetivo '{target_col}' no encontrada. Disponibles: {list(df.columns)}",
        )

    try:
        dates = pd.to_datetime(df[date_col])
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo parsear '{date_col}' como fecha: {exc}",
        ) from exc

    series = pd.to_numeric(df[target_col], errors="coerce")

    # Ordenar por fecha
    order = dates.argsort()
    series = series.iloc[order].reset_index(drop=True)
    dates_sorted = dates.iloc[order].reset_index(drop=True)

    return series, pd.DatetimeIndex(dates_sorted)


def _detect_gaps(dates: pd.DatetimeIndex, freq: str) -> tuple[int, float]:
    """
    Detecta gaps en la serie temporal.
    Retorna (n_gaps, gap_ratio) donde gap_ratio = gaps / períodos_esperados.
    """
    if len(dates) < 2:
        return 0, 0.0

    freq_map = {"D": "D", "W": "W", "M": "MS", "Q": "QS"}
    pd_freq = freq_map.get(freq.upper(), "MS")

    # Generar índice esperado completo
    expected = pd.date_range(start=dates.min(), end=dates.max(), freq=pd_freq)
    n_expected = len(expected)
    n_actual = len(dates)
    n_gaps = max(0, n_expected - n_actual)
    gap_ratio = n_gaps / n_expected if n_expected > 0 else 0.0

    return n_gaps, round(gap_ratio, 4)


def _compute_quality_score(
    series: pd.Series,
    dates: pd.DatetimeIndex,
    freq: str,
) -> tuple[int, str, QualityBreakdown, dict[str, str], str]:
    """
    Lógica de cálculo del quality score — centralizada para no duplicarla.
    Retorna (score, label, breakdown, messages_dict, recommendation).
    """
    n = len(series)

    # ── Completitud ──────────────────────────────────────────────────────────
    null_count = int(series.isnull().sum())
    null_ratio = null_count / n if n > 0 else 1.0
    completeness_score = round((1 - null_ratio) * 30, 2)

    if null_ratio == 0:
        completeness_msg = "✅ Sin valores nulos"
    elif null_ratio < 0.05:
        completeness_msg = f"🟡 {null_count} valores nulos ({null_ratio * 100:.1f}%) — aceptable"
    else:
        completeness_msg = (
            f"🔴 {null_count} valores nulos ({null_ratio * 100:.1f}%) — limpieza necesaria"
        )

    # ── Historia ─────────────────────────────────────────────────────────────
    if len(dates) >= 2:
        # to_pydatetime() retorna datetime puro — sin ambigüedad de stubs de pandas
        py_dates = dates.to_pydatetime()
        delta_days = (py_dates[-1] - py_dates[0]).days
        history_years = delta_days / 365.25
    else:
        history_years = 0.0

    history_score = round(min(history_years / 3.0, 1.0) * 25, 2)

    if history_years >= 3:
        history_msg = f"✅ {history_years:.1f} años de historia — excelente"
    elif history_years >= 1:
        history_msg = f"🟡 {history_years:.1f} años de historia — suficiente para modelos básicos"
    else:
        history_msg = (
            f"🔴 {history_years:.1f} años de historia — insuficiente para modelos complejos"
        )

    # ── Regularidad ──────────────────────────────────────────────────────────
    n_gaps, gap_ratio = _detect_gaps(dates, freq)
    regularity_score = round((1 - gap_ratio) * 25, 2)

    if n_gaps == 0:
        regularity_msg = "✅ Sin períodos faltantes"
    elif gap_ratio < 0.05:
        regularity_msg = f"🟡 {n_gaps} períodos faltantes ({gap_ratio * 100:.1f}%) — leve"
    else:
        regularity_msg = (
            f"🔴 {n_gaps} períodos faltantes ({gap_ratio * 100:.1f}%) — afecta la calidad"
        )

    # ── Outliers ─────────────────────────────────────────────────────────────
    series_filled = series.interpolate(method="linear").ffill().bfill()
    outlier_mask = detect_outliers_mad(series_filled, threshold=3.0)
    outlier_count = int(outlier_mask.sum())
    outlier_ratio = outlier_count / n if n > 0 else 0.0
    outlier_score = round((1 - min(outlier_ratio / 0.20, 1.0)) * 20, 2)

    if outlier_ratio == 0:
        outlier_msg = "✅ Sin outliers detectados"
    elif outlier_ratio < 0.05:
        outlier_msg = (
            f"🟡 {outlier_count} outliers ({outlier_ratio * 100:.1f}%) — winsorización recomendada"
        )
    else:
        outlier_msg = f"🔴 {outlier_count} outliers ({outlier_ratio * 100:.1f}%) — alta proporción, limpiar antes de modelar"

    # ── Score total ───────────────────────────────────────────────────────────
    total = completeness_score + history_score + regularity_score + outlier_score
    score = min(int(round(total)), 100)

    if score >= 80:
        label = "excellent"
        recommendation = (
            "Datos de alta calidad. Todos los modelos disponibles, incluyendo LightGBM."
        )
    elif score >= 60:
        label = "good"
        recommendation = (
            "Datos buenos. Holt-Winters y SARIMA disponibles. Podés mejorar limpiando outliers."
        )
    elif score >= 30:
        label = "fair"
        recommendation = "Datos aceptables. Moving Average y Holt-Winters disponibles. Considerá limpiar los datos primero."
    else:
        label = "poor"
        recommendation = "Datos insuficientes. Solo Moving Average disponible. Revisá la completitud y la historia."

    breakdown = QualityBreakdown(
        completeness_score=completeness_score,
        history_score=history_score,
        regularity_score=regularity_score,
        outlier_score=outlier_score,
    )
    messages = {
        "completeness": completeness_msg,
        "history": history_msg,
        "regularity": regularity_msg,
        "outlier": outlier_msg,
    }
    return score, label, breakdown, messages, recommendation


# ── Schemas de respuesta ──────────────────────────────────────────────────────


class SeriesSummary(BaseModel):
    dataset_id: str
    n_observations: int
    date_start: str  # "YYYY-MM-DD"
    date_end: str
    history_years: float  # años de historia
    freq: str
    null_count: int
    null_pct: float  # 0-100
    n_gaps: int
    gap_ratio: float  # 0-1
    mean: float
    median: float
    std: float
    min_val: float
    max_val: float
    skewness: float
    kurtosis: float
    cv: float  # coeficiente de variación (std/mean)


class OutlierInfo(BaseModel):
    dataset_id: str
    n_outliers: int
    outlier_pct: float  # 0-100
    outlier_indices: list[int]
    outlier_values: list[float]
    outlier_dates: list[str]  # fechas ISO de los outliers
    winsor_lower: float  # p5
    winsor_upper: float  # p95
    mad_threshold: float


class QualityBreakdown(BaseModel):
    completeness_score: float  # 0-30
    history_score: float  # 0-25
    regularity_score: float  # 0-25
    outlier_score: float  # 0-20


class QualityScoreResponse(BaseModel):
    dataset_id: str
    score: int  # 0-100
    label: str  # "poor" | "fair" | "good" | "excellent"
    breakdown: QualityBreakdown
    completeness_msg: str
    history_msg: str
    regularity_msg: str
    outlier_msg: str
    recommendation: str


class ModelInfo(BaseModel):
    id: str
    label: str
    available: bool
    reason: str


class ModelsAvailableResponse(BaseModel):
    dataset_id: str
    quality_score: int
    models: list[ModelInfo]


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.get("/{dataset_id}/summary", response_model=SeriesSummary)
async def eda_summary(
    dataset_id: str,
    date_col: str = Query(..., description="Columna de fecha"),
    target_col: str = Query(..., description="Columna objetivo (numérica)"),
    freq: str = Query("M", description="Frecuencia: D | W | M | Q"),
) -> SeriesSummary:
    """
    Estadísticas descriptivas completas de la serie temporal.
    """
    series, dates = _load_series(dataset_id, date_col, target_col)

    null_count = int(series.isnull().sum())
    null_pct = round(null_count / len(series) * 100, 2) if len(series) > 0 else 0.0

    valid = series.dropna()

    if len(dates) >= 2:
        py_dates = dates.to_pydatetime()
        delta_days = (py_dates[-1] - py_dates[0]).days
        history_years = round(delta_days / 365.25, 2)
    else:
        history_years = 0.0

    n_gaps, gap_ratio = _detect_gaps(dates, freq)

    mean_val   = round(_f(valid.mean()),     4) if len(valid) > 0 else 0.0
    median_val = round(_f(valid.median()),   4) if len(valid) > 0 else 0.0
    std_val    = round(_f(valid.std()),      4) if len(valid) > 1 else 0.0
    min_val    = round(_f(valid.min()),      4) if len(valid) > 0 else 0.0
    max_val    = round(_f(valid.max()),      4) if len(valid) > 0 else 0.0
    skewness   = round(_f(valid.skew()),     4) if len(valid) > 2 else 0.0
    kurt       = round(_f(valid.kurtosis()), 4) if len(valid) > 3 else 0.0
    cv         = round(_f(std_val / mean_val), 4) if mean_val != 0 else 0.0

    return SeriesSummary(
        dataset_id=dataset_id,
        n_observations=len(series),
        date_start=str(dates.min().date()),
        date_end=str(dates.max().date()),
        history_years=history_years,
        freq=freq.upper(),
        null_count=null_count,
        null_pct=null_pct,
        n_gaps=n_gaps,
        gap_ratio=gap_ratio,
        mean=mean_val,
        median=median_val,
        std=std_val,
        min_val=min_val,
        max_val=max_val,
        skewness=skewness,
        kurtosis=kurt,
        cv=cv,
    )


@router.get("/{dataset_id}/outliers", response_model=OutlierInfo)
async def eda_outliers(
    dataset_id: str,
    date_col: str = Query(..., description="Columna de fecha"),
    target_col: str = Query(..., description="Columna objetivo (numérica)"),
    mad_threshold: float = Query(3.0, description="Umbral MAD (default 3.0)"),
) -> OutlierInfo:
    """
    Detecta outliers con MAD modificado y calcula límites de Winsorización p5/p95.
    Retorna índices, valores y fechas de cada outlier para marcarlos en el gráfico.
    """
    series, dates = _load_series(dataset_id, date_col, target_col)

    # Imputar nulos para que no interfieran con la detección
    series_filled = series.interpolate(method="linear").ffill().bfill()

    outlier_mask = detect_outliers_mad(series_filled, threshold=mad_threshold)
    outlier_indices = [int(i) for i, v in enumerate(outlier_mask) if v]
    outlier_values = [round(float(series_filled.iloc[i]), 4) for i in outlier_indices]
    outlier_dates = [str(dates[i].date()) for i in outlier_indices]
    outlier_pct = round(len(outlier_indices) / len(series) * 100, 2) if len(series) > 0 else 0.0

    valid = series_filled.dropna()
    # to_list() produce list[Any] pero cada elemento es numeric — cast con list comprehension
    vals: list[float] = [v for v in valid.to_numpy(dtype="float64").tolist()]
    n_v = len(vals)
    winsor_lower = round(sorted(vals)[max(0, int(n_v * 0.05))], 4)       if n_v > 0 else 0.0
    winsor_upper = round(sorted(vals)[min(n_v - 1, int(n_v * 0.95))], 4) if n_v > 0 else 0.0

    return OutlierInfo(
        dataset_id=dataset_id,
        n_outliers=len(outlier_indices),
        outlier_pct=outlier_pct,
        outlier_indices=outlier_indices,
        outlier_values=outlier_values,
        outlier_dates=outlier_dates,
        winsor_lower=winsor_lower,
        winsor_upper=winsor_upper,
        mad_threshold=mad_threshold,
    )


@router.get("/{dataset_id}/quality-score", response_model=QualityScoreResponse)
async def eda_quality_score(
    dataset_id: str,
    date_col: str = Query(..., description="Columna de fecha"),
    target_col: str = Query(..., description="Columna objetivo (numérica)"),
    freq: str = Query("M", description="Frecuencia: D | W | M | Q"),
) -> QualityScoreResponse:
    """
    Quality Score 0-100 con semáforo (poor / fair / good / excellent).

    Puntos:
      Completitud  (30 pts) → (1 - null_ratio) * 30
      Historia     (25 pts) → min(años / 3, 1.0) * 25
      Regularidad  (25 pts) → (1 - gap_ratio) * 25
      Outliers     (20 pts) → (1 - min(outlier_ratio / 0.20, 1.0)) * 20
    """
    series, dates = _load_series(dataset_id, date_col, target_col)

    if len(series) == 0:
        raise HTTPException(status_code=400, detail="La serie está vacía.")

    score, label, breakdown, messages, recommendation = _compute_quality_score(series, dates, freq)

    return QualityScoreResponse(
        dataset_id=dataset_id,
        score=score,
        label=label,
        breakdown=breakdown,
        completeness_msg=messages["completeness"],
        history_msg=messages["history"],
        regularity_msg=messages["regularity"],
        outlier_msg=messages["outlier"],
        recommendation=recommendation,
    )


@router.get("/{dataset_id}/models-available", response_model=ModelsAvailableResponse)
async def eda_models_available(
    dataset_id: str,
    date_col: str = Query(..., description="Columna de fecha"),
    target_col: str = Query(..., description="Columna objetivo (numérica)"),
    freq: str = Query("M", description="Frecuencia: D | W | M | Q"),
) -> ModelsAvailableResponse:
    """
    Modelos desbloqueados según el quality score del dataset.

    Umbrales:
      score < 30  → solo Moving Average
      score 30-60 → MA + Holt-Winters
      score 60-80 → MA + HW + SARIMA
      score >= 80 → todos (MA + HW + SARIMA + LightGBM)
    """
    series, dates = _load_series(dataset_id, date_col, target_col)

    if len(series) == 0:
        raise HTTPException(status_code=400, detail="La serie está vacía.")

    score, _label, _breakdown, _msgs, _rec = _compute_quality_score(series, dates, freq)

    # TypedDict garantiza que mypy conoce los tipos exactos de cada campo
    class _ModelEntry(TypedDict):
        id: str
        label: str
        min_score: int
        reason_available: str
        reason_locked: str

    catalog: list[_ModelEntry] = [
        {
            "id": "moving_average",
            "label": "Moving Average",
            "min_score": 0,
            "reason_available": "Disponible siempre — baseline robusto para series cortas.",
            "reason_locked": "",
        },
        {
            "id": "holt_winters",
            "label": "Holt-Winters",
            "min_score": 30,
            "reason_available": "Disponible — ideal para series con tendencia y estacionalidad.",
            "reason_locked": f"Requiere score ≥ 30 (actual: {score}). Mejorá la completitud o la historia.",
        },
        {
            "id": "sarima",
            "label": "SARIMA",
            "min_score": 60,
            "reason_available": "Disponible — riguroso, con intervalos de confianza estadísticos.",
            "reason_locked": f"Requiere score ≥ 60 (actual: {score}). Necesitás más historia y menos gaps.",
        },
        {
            "id": "lightgbm",
            "label": "LightGBM",
            "min_score": 80,
            "reason_available": "Disponible — gradient boosting para series con alta variabilidad.",
            "reason_locked": f"Requiere score ≥ 80 (actual: {score}). Necesitás datos de alta calidad.",
        },
    ]

    models = [
        ModelInfo(
            id=m["id"],
            label=m["label"],
            available=score >= m["min_score"],
            reason=m["reason_available"] if score >= m["min_score"] else m["reason_locked"],
        )
        for m in catalog
    ]

    return ModelsAvailableResponse(
        dataset_id=dataset_id,
        quality_score=score,
        models=models,
    )


# ── E2: ETL endpoints ─────────────────────────────────────────────────────────


class EtlPoint(BaseModel):
    date: str
    original: float | None
    cleaned: float | None
    imputed: bool = False      # True si el punto fue imputado (fill-gaps)
    winsorized: bool = False   # True si el punto fue clipeado (winsorización)


class WinsorizeResponse(BaseModel):
    dataset_id: str
    cleaned_dataset_id: str   # nuevo dataset guardado en storage con sufijo _etl
    p_lower: float            # percentil inferior usado (ej. 5.0)
    p_upper: float            # percentil superior usado (ej. 95.0)
    winsor_lower: float       # valor límite inferior calculado
    winsor_upper: float       # valor límite superior calculado
    n_winsorized: int         # cantidad de puntos clipeados
    series: list[EtlPoint]    # serie completa antes/después para el gráfico
    new_quality_score: int    # quality score recalculado post-limpieza
    new_quality_label: str


class FillGapsResponse(BaseModel):
    dataset_id: str
    cleaned_dataset_id: str
    method: str               # "ffill" | "linear"
    n_imputed: int            # cantidad de períodos imputados
    series: list[EtlPoint]
    new_quality_score: int
    new_quality_label: str


@router.get("/{dataset_id}/winsorize", response_model=WinsorizeResponse)
async def eda_winsorize(
    dataset_id: str,
    date_col: str = Query(..., description="Columna de fecha"),
    target_col: str = Query(..., description="Columna objetivo (numérica)"),
    freq: str = Query("M", description="Frecuencia: D | W | M | Q"),
    p_lower: float = Query(5.0, ge=0.0, le=49.0, description="Percentil inferior (default 5)"),
    p_upper: float = Query(95.0, ge=51.0, le=100.0, description="Percentil superior (default 95)"),
) -> WinsorizeResponse:
    """
    Aplica winsorización al dataset: los valores fuera del rango [p_lower, p_upper]
    son clipeados al límite correspondiente (no eliminados).

    Guarda el dataset limpio como un nuevo archivo en storage con sufijo '_etl'
    y retorna la serie completa con marcadores antes/después para el gráfico.

    El quality score se recalcula sobre la serie limpia para mostrar la mejora.
    """
    df = None
    try:
        df = load_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' no encontrado.",
        ) from exc

    if date_col not in df.columns or target_col not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas inválidas. Disponibles: {list(df.columns)}",
        )

    # Parsear fechas y ordenar
    dates = pd.to_datetime(df[date_col])
    order = dates.argsort()
    df = df.iloc[order].reset_index(drop=True)
    dates = pd.to_datetime(df[date_col]).reset_index(drop=True)
    series_orig = pd.to_numeric(df[target_col], errors="coerce")

    # Calcular límites sobre valores válidos
    valid_vals = series_orig.dropna().to_numpy(dtype="float64")
    if len(valid_vals) == 0:
        raise HTTPException(status_code=400, detail="La columna objetivo no tiene valores numéricos válidos.")

    lower_val = float(pd.Series(valid_vals).quantile(p_lower / 100.0))
    upper_val = float(pd.Series(valid_vals).quantile(p_upper / 100.0))

    # Aplicar clip
    series_clean = series_orig.clip(lower=lower_val, upper=upper_val)
    n_winsorized = int(((series_orig < lower_val) | (series_orig > upper_val)).sum())

    # Guardar nuevo dataset con sufijo _etl
    cleaned_id = f"{dataset_id}_etl"
    df_clean = df.copy()
    df_clean[target_col] = series_clean
    save_dataset(df_clean, cleaned_id)

    # Construir serie para el gráfico
    etl_series: list[EtlPoint] = [
        EtlPoint(
            date=str(dates.iloc[i].date()),
            original=round(float(series_orig.iloc[i]), 4) if pd.notna(series_orig.iloc[i]) else None,
            cleaned=round(float(series_clean.iloc[i]), 4) if pd.notna(series_clean.iloc[i]) else None,
            winsorized=(
                pd.notna(series_orig.iloc[i])
                and (float(series_orig.iloc[i]) < lower_val or float(series_orig.iloc[i]) > upper_val)
            ),
        )
        for i in range(len(series_orig))
    ]

    # Recalcular quality score sobre datos limpios
    new_score, new_label, _, _, _ = _compute_quality_score(
        series_clean, pd.DatetimeIndex(dates), freq
    )

    return WinsorizeResponse(
        dataset_id=dataset_id,
        cleaned_dataset_id=cleaned_id,
        p_lower=p_lower,
        p_upper=p_upper,
        winsor_lower=round(lower_val, 4),
        winsor_upper=round(upper_val, 4),
        n_winsorized=n_winsorized,
        series=etl_series,
        new_quality_score=new_score,
        new_quality_label=new_label,
    )


@router.get("/{dataset_id}/fill-gaps", response_model=FillGapsResponse)
async def eda_fill_gaps(
    dataset_id: str,
    date_col: str = Query(..., description="Columna de fecha"),
    target_col: str = Query(..., description="Columna objetivo (numérica)"),
    freq: str = Query("M", description="Frecuencia: D | W | M | Q"),
    method: str = Query("linear", description="Método de imputación: ffill | linear"),
) -> FillGapsResponse:
    """
    Detecta gaps temporales en la serie (períodos faltantes según la frecuencia)
    e imputa los valores faltantes con el método elegido.

    Métodos:
      ffill   → propaga el último valor conocido hacia adelante
      linear  → interpolación lineal entre el punto anterior y siguiente

    Guarda el dataset completado como nuevo archivo '_etl' y retorna
    la serie con marcadores de qué puntos fueron imputados.
    """
    df = None
    try:
        df = load_dataset(dataset_id)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' no encontrado.",
        ) from exc

    if date_col not in df.columns or target_col not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=f"Columnas inválidas. Disponibles: {list(df.columns)}",
        )

    if method not in ("ffill", "linear"):
        raise HTTPException(
            status_code=400,
            detail="Método inválido. Usar 'ffill' o 'linear'.",
        )

    # Parsear y ordenar
    dates = pd.to_datetime(df[date_col])
    order = dates.argsort()
    df = df.iloc[order].reset_index(drop=True)
    dates = pd.to_datetime(df[date_col]).reset_index(drop=True)
    series_orig = pd.to_numeric(df[target_col], errors="coerce")

    # Mapear frecuencia al formato pandas
    freq_map = {"D": "D", "W": "W-MON", "M": "MS", "Q": "QS"}
    pd_freq = freq_map.get(freq.upper(), "MS")

    # Construir índice temporal completo (sin gaps)
    full_index = pd.date_range(start=dates.min(), end=dates.max(), freq=pd_freq)

    # Reindexar → los gaps quedan como NaN
    series_indexed = pd.Series(series_orig.values, index=pd.DatetimeIndex(dates))
    series_reindexed = series_indexed.reindex(full_index)

    # Marcar qué fechas son imputadas (estaban ausentes en el original)
    original_dates = set(dates.dt.strftime("%Y-%m-%d").tolist())
    imputed_flags = [
        d.strftime("%Y-%m-%d") not in original_dates
        for d in full_index
    ]
    n_imputed = sum(imputed_flags)

    # Imputar según método
    if method == "ffill":
        series_clean = series_reindexed.ffill().bfill()
    else:
        series_clean = series_reindexed.interpolate(method="linear").ffill().bfill()

    # Guardar dataset completado
    cleaned_id = f"{dataset_id}_etl"
    df_clean = pd.DataFrame({
        date_col:   full_index.strftime("%Y-%m-%d"),
        target_col: series_clean.values,
    })
    # Preservar columnas extra del df original (ej. SKU, categoría)
    for col in df.columns:
        if col not in (date_col, target_col):
            # Para gaps imputados, forward-fill las columnas categóricas
            col_series = pd.Series(df[col].values, index=pd.DatetimeIndex(dates))
            df_clean[col] = col_series.reindex(full_index).ffill().values
    save_dataset(df_clean, cleaned_id)

    # Construir serie para el gráfico
    etl_series: list[EtlPoint] = [
        EtlPoint(
            date=full_index[i].strftime("%Y-%m-%d"),
            original=None if imputed_flags[i] else round(float(series_reindexed.iloc[i]), 4) if pd.notna(series_reindexed.iloc[i]) else None,
            cleaned=round(float(series_clean.iloc[i]), 4) if pd.notna(series_clean.iloc[i]) else None,
            imputed=imputed_flags[i],
        )
        for i in range(len(full_index))
    ]

    # Recalcular quality score
    new_score, new_label, _, _, _ = _compute_quality_score(
        series_clean, pd.DatetimeIndex(full_index), freq
    )

    return FillGapsResponse(
        dataset_id=dataset_id,
        cleaned_dataset_id=cleaned_id,
        method=method,
        n_imputed=n_imputed,
        series=etl_series,
        new_quality_score=new_score,
        new_quality_label=new_label,
    )
