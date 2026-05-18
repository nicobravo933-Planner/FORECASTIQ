"""
Endpoints de datasets — Phase 1.

  POST /api/datasets/upload         → sube CSV a Supabase Storage
  GET  /api/datasets/{id}/preview   → primeras 10 filas + tipos de columnas
  POST /api/datasets/{id}/detect    → caracteriza la serie y recomienda modelo
"""

from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.ml.detector import DetectionResult, detect_best_model
from app.services.supabase import download_csv, register_dataset, upload_csv

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

# Tamaño máximo de CSV: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024


# ── Schemas de respuesta ───────────────────────────────────────────────────────


class UploadResponse(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: list[str]


class ColumnInfo(BaseModel):
    name: str
    dtype: str  # "datetime" | "numeric" | "text"
    null_count: int
    sample_values: list[str]  # primeros 3 valores como string


class PreviewResponse(BaseModel):
    dataset_id: str
    columns: list[ColumnInfo]
    rows: list[dict[str, str]]  # primeras 10 filas serializadas como strings
    total_rows: int


class DetectRequest(BaseModel):
    date_column: str
    target_column: str
    freq: str = "M"  # "D" | "W" | "M" | "Q"


# ── Helpers ───────────────────────────────────────────────────────────────────


def _infer_dtype(series: pd.Series) -> str:
    """Clasifica una columna en datetime | numeric | text."""
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"
    if pd.api.types.is_numeric_dtype(series):
        return "numeric"
    # Intenta parsear como fecha si es object
    try:
        pd.to_datetime(series.dropna().iloc[:5])
        return "datetime"
    except Exception:
        return "text"


def _parse_csv(content: bytes) -> pd.DataFrame:
    """Parsea bytes de CSV a DataFrame. Lanza HTTPException si el formato es inválido."""
    try:
        df = pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo leer el CSV: {exc}",
        ) from exc

    if df.empty:
        raise HTTPException(status_code=400, detail="El CSV está vacío.")
    if len(df.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail="El CSV debe tener al menos 2 columnas (fecha y valor objetivo).",
        )
    return df


# ── Endpoints ─────────────────────────────────────────────────────────────────


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_dataset(file: UploadFile, user: OptionalUser = None) -> UploadResponse:
    """
    Recibe un CSV, lo valida y lo sube a Supabase Storage.
    Retorna el dataset_id para usar en los siguientes endpoints.
    """
    if file.content_type not in ("text/csv", "application/csv", "application/octet-stream"):
        raise HTTPException(
            status_code=400,
            detail=f"Tipo de archivo no soportado: {file.content_type}. Solo se acepta CSV.",
        )

    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"El archivo supera el límite de {MAX_FILE_SIZE // (1024 * 1024)} MB.",
        )

    # Validamos que el CSV sea parseable antes de subirlo
    df = _parse_csv(content)

    dataset_id = upload_csv(content, file.filename or "upload.csv")

    # Registra metadata en la tabla datasets (user_id puede ser None en modo demo)
    register_dataset(
        dataset_id=dataset_id,
        filename=file.filename or "upload.csv",
        rows=len(df),
        columns=list(df.columns),
        user_id=str(user.user_id) if user else None,
    )

    return UploadResponse(
        dataset_id=dataset_id,
        filename=file.filename or "upload.csv",
        rows=len(df),
        columns=list(df.columns),
    )


@router.get("/{dataset_id}/preview", response_model=PreviewResponse)
async def preview_dataset(dataset_id: str) -> PreviewResponse:
    """
    Descarga el CSV desde Storage y retorna:
    - Primeras 10 filas (como strings para serialización segura)
    - Info de cada columna: tipo inferido, nulls, valores de muestra
    """
    try:
        content = download_csv(dataset_id)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' no encontrado.",
        ) from exc

    df = _parse_csv(content)

    columns_info = [
        ColumnInfo(
            name=col,
            dtype=_infer_dtype(df[col]),
            null_count=int(df[col].isnull().sum()),
            sample_values=[str(v) for v in df[col].dropna().iloc[:3].tolist()],
        )
        for col in df.columns
    ]

    # Primeras 10 filas serializadas como strings (seguro para JSON)
    preview_df = df.head(10).fillna("").astype(str)
    rows = preview_df.to_dict(orient="records")

    return PreviewResponse(
        dataset_id=dataset_id,
        columns=columns_info,
        rows=rows,
        total_rows=len(df),
    )


@router.post("/{dataset_id}/detect", response_model=DetectionResult)
async def detect_model(dataset_id: str, body: DetectRequest) -> DetectionResult:
    """
    Descarga el CSV, extrae la columna objetivo y corre el pipeline de detección:
      MAD → FFT → Mann-Kendall → CV → selección de modelo

    Requiere que el usuario especifique la columna de fecha y la columna objetivo.
    """
    try:
        content = download_csv(dataset_id)
    except Exception as exc:
        raise HTTPException(
            status_code=404,
            detail=f"Dataset '{dataset_id}' no encontrado.",
        ) from exc

    df = _parse_csv(content)

    # Validar columnas
    if body.date_column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Columna de fecha '{body.date_column}' no encontrada. "
                f"Columnas disponibles: {list(df.columns)}"
            ),
        )
    if body.target_column not in df.columns:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Columna objetivo '{body.target_column}' no encontrada. "
                f"Columnas disponibles: {list(df.columns)}"
            ),
        )

    # Parsear fecha y ordenar
    try:
        df[body.date_column] = pd.to_datetime(df[body.date_column])
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"No se pudo parsear '{body.date_column}' como fecha: {exc}",
        ) from exc

    df = df.sort_values(body.date_column).reset_index(drop=True)

    # Extraer serie objetivo
    series = pd.to_numeric(df[body.target_column], errors="coerce")
    null_count = int(series.isnull().sum())
    if null_count > 0:
        # Interpolación lineal para valores nulos antes de analizar
        series = series.interpolate(method="linear").ffill().bfill()

    if series.empty:
        raise HTTPException(
            status_code=400,
            detail=f"La columna '{body.target_column}' no contiene valores numéricos válidos.",
        )

    return detect_best_model(series, freq=body.freq)
