"""
Endpoints de datasets — Phase 1 + Conectar Datos.

  POST /api/datasets/upload         → sube CSV a Supabase Storage
  GET  /api/datasets/{id}/preview   → primeras 10 filas + tipos de columnas
  POST /api/datasets/{id}/detect    → caracteriza la serie y recomienda modelo
  POST /api/datasets/connect-db     → conexión DB efímera: SELECT → dataset_id
  GET  /api/datasets/demo/skus      → lista SKUs del dataset sintético por categoría
  POST /api/datasets/demo/load      → carga una serie de un SKU via DuckDB → dataset_id
"""

from __future__ import annotations

import io

import pandas as pd
from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.ml.detector import DetectionResult, detect_best_model
from app.services.redis_cache import check_upload_rate_limit
from app.services.supabase import (
    download_csv,
    list_user_datasets,
    register_dataset,
    upload_csv,
)

router = APIRouter(prefix="/api/datasets", tags=["datasets"])

# Tamaño máximo de CSV: 10 MB
MAX_FILE_SIZE = 10 * 1024 * 1024


# ── Schemas de respuesta ───────────────────────────────────────────────────────


class DatasetListItem(BaseModel):
    dataset_id: str
    filename: str
    rows: int | None
    columns: list[str]
    created_at: str


class DatasetListResponse(BaseModel):
    datasets: list[DatasetListItem]
    total: int


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


# ── List ─────────────────────────────────────────────────────────────────────


@router.get("/", response_model=DatasetListResponse)
async def list_datasets(user: OptionalUser = None) -> DatasetListResponse:
    """
    Lista todos los datasets subidos por el usuario autenticado.
    Requiere sesión activa — sin auth retorna lista vacía.
    """
    if not user:
        return DatasetListResponse(datasets=[], total=0)

    rows = list_user_datasets(user_id=str(user.user_id))
    items = [
        DatasetListItem(
            dataset_id=r["dataset_id"],
            filename=r["filename"],
            rows=r.get("rows"),
            columns=r.get("columns") or [],
            created_at=r.get("created_at", ""),
        )
        for r in rows
    ]
    return DatasetListResponse(datasets=items, total=len(items))


# ── Upload ────────────────────────────────────────────────────────────────────


@router.post("/upload", response_model=UploadResponse, status_code=201)
async def upload_dataset(
    request: Request, file: UploadFile, user: OptionalUser = None
) -> UploadResponse:
    """
    Recibe un CSV, lo valida y lo sube a Supabase Storage.
    Retorna el dataset_id para usar en los siguientes endpoints.

    Rate limit: 5 uploads por hora por IP.
    """
    ip = request.client.host if request.client else "unknown"
    rl = check_upload_rate_limit(ip)
    if not rl.allowed:
        from fastapi.responses import JSONResponse

        return JSONResponse(  # type: ignore[return-value]
            status_code=429,
            content={
                "detail": f"Demasiados uploads. Límite: 5 por hora. "
                f"Podés volver a intentar en {rl.reset_in // 60} minutos."
            },
            headers={"Retry-After": str(rl.reset_in)},
        )
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


# ── Connect DB ─────────────────────────────────────────────────────────


class DbConnectRequest(BaseModel):
    connection_string: str
    query: str
    engine: str = "postgresql"  # postgresql | mysql | sqlite | mssql


class DbConnectResponse(BaseModel):
    dataset_id: str
    rows: int
    columns: list[str]


@router.post("/connect-db", response_model=DbConnectResponse, status_code=201)
async def connect_db(body: DbConnectRequest, user: OptionalUser = None) -> DbConnectResponse:
    """
    Ejecuta una query SELECT sobre la base de datos del usuario.
    La conexión es EFÍMERA: se crea, ejecuta y descarta en esta misma función.
    Nunca se persiste la connection_string en ningún lugar.

    Seguridad:
      - Solo se permiten queries SELECT (validación previa al ejecutar).
      - engine.dispose() garantiza que la conexión se cierra inmediatamente.
      - La connection_string no aparece en logs ni en trazas OTel.
    """
    import re

    from sqlalchemy import create_engine, text

    # ── Validación de seguridad: solo SELECT permitido ───────────────────────────────
    query_stripped = body.query.strip().lstrip("-").strip()
    if not re.match(r"(?i)^(SELECT|WITH)\b", query_stripped):
        raise HTTPException(
            status_code=400,
            detail="Solo se aceptan queries de lectura (SELECT / WITH). No DDL ni DML.",
        )

    # ── Ejecutar query y descartar conexión ──────────────────────────────────────────
    engine_sa = None
    try:
        engine_sa = create_engine(
            body.connection_string,
            connect_args={"connect_timeout": 10},  # no esperar más de 10s
            echo=False,  # nunca loguear la connection string
            hide_parameters=True,  # no loguear parámetros de la query
        )
        with engine_sa.connect() as conn:
            result = conn.execute(text(body.query))
            df = pd.DataFrame(result.fetchall(), columns=list(result.keys()))
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Error al conectar o ejecutar la query: {exc}",
        ) from exc
    finally:
        # SIEMPRE descartamos la conexión — incluso si la query falló
        if engine_sa is not None:
            engine_sa.dispose()

    if df.empty:
        raise HTTPException(
            status_code=400,
            detail="La query retornó cero filas. Verifíca los filtros.",
        )
    if len(df.columns) < 2:
        raise HTTPException(
            status_code=400,
            detail="La query debe retornar al menos 2 columnas (fecha y valor objetivo).",
        )

    # Convertir a CSV y subirlo a Supabase Storage como si fuera un upload normal
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    dataset_id = upload_csv(csv_bytes, f"db_query_{body.engine}.csv")
    register_dataset(
        dataset_id=dataset_id,
        filename=f"db_query_{body.engine}.csv",
        rows=len(df),
        columns=list(df.columns),
        user_id=str(user.user_id) if user else None,
    )

    return DbConnectResponse(
        dataset_id=dataset_id,
        rows=len(df),
        columns=list(df.columns),
    )


# ── Dataset Demo (DuckDB sobre Supabase Storage) ─────────────────────────────

# URLs públicas de los 6 chunks del Parquet 25k SKUs en Supabase Storage
_DEMO_BASE = (
    "https://umzqqrujfnqfearjmbyn.supabase.co/storage/v1/object/public/datasets/ventas_25k_skus"
)
_DEMO_CHUNKS = [f"{_DEMO_BASE}/ventas_chunk_{str(i).zfill(3)}.parquet" for i in range(1, 7)]
_DEMO_CHUNKS_SQL = ", ".join(f"'{u}'" for u in _DEMO_CHUNKS)

# Mapeo categoría → chunk(s) donde predominan sus SKUs
# Los SKUs están ordenados por sku_id, cada chunk tiene ~4167 SKUs
# Usamos todos los chunks pero filtramos por categoría (DuckDB hace pushdown)
_CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]


class DemoSkusResponse(BaseModel):
    categoria: str
    skus: list[str]  # primeros 50 SKU-IDs de esa categoría
    total: int


class DemoLoadRequest(BaseModel):
    sku_id: str
    categoria: str
    freq: str = "D"  # los datos son diarios


class DemoLoadResponse(BaseModel):
    dataset_id: str
    sku_id: str
    rows: int
    columns: list[str]
    date_range: str  # ej. "2022-01-01 → 2024-12-31"


@router.get("/demo/skus", response_model=DemoSkusResponse)
async def demo_list_skus(categoria: str = "Electrónica") -> DemoSkusResponse:
    """
    Lista los primeros 50 SKUs de una categoría del dataset sintético.
    DuckDB lee directamente desde las URLs públicas de Supabase Storage.
    Solo descarga los row groups necesarios (column + predicate pushdown).
    """
    import duckdb

    if categoria not in _CATEGORIAS:
        raise HTTPException(
            status_code=400,
            detail=f"Categoría inválida. Opciones: {_CATEGORIAS}",
        )

    try:
        con = duckdb.connect()
        # Instalar y cargar extensión httpfs para leer URLs remotas
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET enable_progress_bar = false;")

        # Query eficiente: solo columnas sku_id y categoria, sin descargar y
        result = con.execute(
            f"""
            SELECT DISTINCT sku_id
            FROM read_parquet([{_DEMO_CHUNKS_SQL}])
            WHERE categoria = ?
            ORDER BY sku_id
            LIMIT 50
            """,
            [categoria],
        ).fetchall()

        con.close()
        skus = [row[0] for row in result]
        return DemoSkusResponse(categoria=categoria, skus=skus, total=len(skus))

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al leer dataset demo: {exc}",
        ) from exc


@router.post("/demo/load", response_model=DemoLoadResponse, status_code=201)
async def demo_load_sku(body: DemoLoadRequest, user: OptionalUser = None) -> DemoLoadResponse:
    """
    Carga la serie temporal completa de un SKU específico del dataset sintético.
    DuckDB hace pushdown sobre los 6 chunks y solo descarga las filas del SKU pedido.
    El resultado se guarda en Supabase Storage como CSV virtual con un dataset_id.
    El usuario puede entonces correr forecast normalmente sobre ese dataset_id.

    Columnas retornadas: fecha, ventas, precio, stock
    (las suficientes para hacer forecast con o sin features externas)
    """
    import duckdb

    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET enable_progress_bar = false;")

        df: pd.DataFrame = con.execute(
            f"""
            SELECT fecha, ventas, precio, stock
            FROM read_parquet([{_DEMO_CHUNKS_SQL}])
            WHERE sku_id = ?
            ORDER BY fecha
            """,
            [body.sku_id],
        ).df()

        con.close()

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Error al leer SKU del dataset demo: {exc}",
        ) from exc

    if df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"SKU '{body.sku_id}' no encontrado en el dataset demo.",
        )

    # Rango de fechas para mostrar en la UI
    date_min = str(df["fecha"].min())[:10]
    date_max = str(df["fecha"].max())[:10]
    date_range = f"{date_min} → {date_max}"

    # Guardar como CSV en Supabase Storage (mismo pipeline que upload normal)
    filename = f"demo_{body.sku_id.replace('-', '_')}.csv"
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    dataset_id = upload_csv(csv_bytes, filename)
    register_dataset(
        dataset_id=dataset_id,
        filename=filename,
        rows=len(df),
        columns=list(df.columns),
        user_id=str(user.user_id) if user else None,
    )

    return DemoLoadResponse(
        dataset_id=dataset_id,
        sku_id=body.sku_id,
        rows=len(df),
        columns=list(df.columns),
        date_range=date_range,
    )
