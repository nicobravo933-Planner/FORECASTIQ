"""
Endpoints de datasets — Phase 1 + Conectar Datos + Data Explorer.

  POST /api/datasets/upload              → sube CSV a Supabase Storage
  GET  /api/datasets/{id}/preview        → primeras 10 filas + tipos de columnas
  POST /api/datasets/{id}/detect         → caracteriza la serie y recomienda modelo
  POST /api/datasets/connect-db          → conexión DB efímera: SELECT → dataset_id
  GET  /api/datasets/demo/skus           → lista SKUs del dataset sintético por categoría
  POST /api/datasets/demo/load           → carga una serie de un SKU via DuckDB → dataset_id
  GET  /api/datasets/demo/analyze-category → análisis vectorizado de categoría completa (StatsForecast)
  POST /api/datasets/explore/db/schema   → introspecciona esquemas/tablas/columnas/PKs/FKs de una DB
  POST /api/datasets/explore/db/query    → ejecuta SELECT paginado sobre una tabla de la DB
  GET  /api/datasets/explore/demo        → paginación sobre el Parquet demo con filtros
  GET  /api/datasets/{id}/page           → paginación sobre un CSV ya subido
"""

from __future__ import annotations

import io
from typing import Any

import pandas as pd
from fastapi import APIRouter, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.core.dependencies import OptionalUser
from app.ml.detector import DetectionResult, detect_best_model
from app.services.redis_cache import check_upload_rate_limit
from app.services.supabase import (
    delete_dataset,
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
async def list_datasets(
    user: OptionalUser = None,
    session_ids: str = "",  # CSV de dataset_ids de sesión anónima (query param)
) -> DatasetListResponse:
    """
    Lista datasets del usuario autenticado + datasets anónimos de la sesión actual.
    session_ids: lista separada por comas de dataset_ids creados sin auth (localStorage).
    """
    from app.services.supabase import get_supabase

    items: list[DatasetListItem] = []

    # 1. Datasets del usuario autenticado
    if user:
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

    # 2. Datasets anónimos de la sesión actual (pasados desde localStorage)
    if session_ids:
        ids = [s.strip() for s in session_ids.split(",") if s.strip()]
        if ids:
            client = get_supabase()
            resp = (
                client.table("datasets")
                .select("dataset_id, filename, rows, columns, created_at")
                .in_("dataset_id", ids)
                .is_("user_id", "null")  # solo anónimos
                .order("created_at", desc=True)
                .execute()
            )
            existing_ids = {item.dataset_id for item in items}
            for r in resp.data or []:
                if not isinstance(r, dict):
                    continue
                if r["dataset_id"] not in existing_ids:
                    items.append(
                        DatasetListItem(
                            dataset_id=str(r["dataset_id"]),
                            filename=str(r["filename"]),
                            rows=r.get("rows"),
                            columns=r.get("columns") or [],
                            created_at=str(r.get("created_at", "")),
                        )
                    )

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

# Categorías exactas según los valores en el Parquet (sin tildes)
_CATEGORIAS = ["Electronica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]
# Mapeo para mostrar en la UI con tildes → valor real en el Parquet
_CATEGORIAS_DISPLAY = {
    "Electrónica": "Electronica",
    "Alimentos": "Alimentos",
    "Indumentaria": "Indumentaria",
    "Hogar": "Hogar",
    "Deportes": "Deportes",
}


# Stats precalculadas del dataset demo (obtenidas con DuckDB una sola vez)
# Evitan COUNT(*) en cada request
_DEMO_STATS: dict[str, dict[str, int]] = {
    "Electronica": {"total_rows": 687_295, "unique_skus": 627},
    "Alimentos": {"total_rows": 1_379_700, "unique_skus": 1258},
    "Indumentaria": {"total_rows": 918_705, "unique_skus": 838},
    "Hogar": {"total_rows": 883_665, "unique_skus": 806},
    "Deportes": {"total_rows": 693_135, "unique_skus": 632},
}
_DEMO_STATS_TOTAL = sum(v["total_rows"] for v in _DEMO_STATS.values())
# Canales disponibles (descubiertos del Parquet)
_DEMO_CANALES = ["Mayorista", "Minorista", "Online"]


class DemoStatsResponse(BaseModel):
    total_rows: int
    categorias: dict[
        str, dict[str, int]
    ]  # {"Electronica": {"total_rows": N, "unique_skus": M}, ...}
    canales: list[str]
    columns: list[str]
    date_range: str


@router.get("/demo/stats", response_model=DemoStatsResponse)
async def demo_stats() -> DemoStatsResponse:
    """Stats precalculadas del dataset demo. No hace scan. Respuesta instantánea."""
    return DemoStatsResponse(
        total_rows=_DEMO_STATS_TOTAL,
        categorias=_DEMO_STATS,
        canales=_DEMO_CANALES,
        columns=[
            "fecha",
            "sku_id",
            "categoria",
            "canal",
            "ventas",
            "precio",
            "stock",
            "cluster_abc",
            "cluster_xyz",
        ],
        date_range="2022-01-01 \u2192 2024-12-31",
    )


class DemoSkusResponse(BaseModel):
    categoria: str
    skus: list[str]
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
async def demo_list_skus(
    categoria: str = "Electrónica",
    search: str = "",
    limit: int = 100,
) -> DemoSkusResponse:
    import duckdb

    # Normalizar: aceptar con o sin tilde
    cat_real = _CATEGORIAS_DISPLAY.get(categoria, categoria)
    if cat_real not in _CATEGORIAS:
        raise HTTPException(
            status_code=400,
            detail=f"Categoría inválida. Opciones: {list(_CATEGORIAS_DISPLAY.keys())}",
        )
    limit = min(limit, 500)
    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET enable_progress_bar = false;")
        search_clause = "AND sku_id ILIKE ?" if search else ""
        params: list[str] = [cat_real]
        if search:
            # ILIKE para búsqueda case-insensitive (sin forzar upper)
            params.append(f"%{search}%")
        result = con.execute(
            f"""
            SELECT DISTINCT sku_id
            FROM read_parquet([{_DEMO_CHUNKS_SQL}])
            WHERE categoria = ? {search_clause}
            ORDER BY sku_id
            LIMIT {limit}
            """,
            params,
        ).fetchall()
        con.close()
        skus = [row[0] for row in result]
        return DemoSkusResponse(categoria=categoria, skus=skus, total=len(skus))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al leer dataset demo: {exc}") from exc


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
            SELECT fecha, ventas, precio, stock, canal
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


# ── Demo: análisis de categoría completa (Modo 2) ────────────────────────────


class SkuMetrics(BaseModel):
    sku_id: str
    wape: float | None
    mae: float | None
    bias: float | None
    model: str
    n_obs: int
    cluster_abc: str | None = None
    cluster_xyz: str | None = None


class CategoryAnalysisResponse(BaseModel):
    categoria: str
    n_skus: int
    freq: str
    horizon: int
    duration_s: float
    # Métricas agregadas
    wape_mean: float | None
    wape_p50: float | None
    wape_p90: float | None
    bias_mean: float | None
    # Por segmento ABC
    by_segment: dict[str, dict[str, float | int]]  # {"A-X": {wape, n_skus}, ...}
    # Detalle por SKU (los 20 peores por WAPE para drill-down)
    worst_skus: list[SkuMetrics]
    best_skus: list[SkuMetrics]


@router.get("/demo/analyze-category", response_model=CategoryAnalysisResponse)
async def demo_analyze_category(
    categoria: str = "Electrónica",
    freq: str = "W",  # agrupamos a semanal para hacer más rápido el forecast
    horizon: int = 12,
    max_skus: int = 200,  # límite para no tardar más de 30s en local
) -> CategoryAnalysisResponse:
    """
    Modo 2: corre StatsForecast (Nixtla) sobre todos los SKUs de una categoría.
    Retorna métricas agregadas (WAPE/BIAS por segmento) + top 20 mejores/peores SKUs.

    Flujo:
      1. DuckDB lee datos de la categoría desde Supabase Storage
      2. Agrega de diario a semanal (suma de ventas)
      3. StatsForecast AutoETS vectorizado sobre todos los SKUs
      4. Evalua con hold-out 20% por SKU
      5. Retorna métricas agregadas + top/bottom SKUs

    Solo disponible en tier local (requiere statsforecast del grupo heavy-ml).
    """
    import time

    t0 = time.perf_counter()

    # Verificar deps heavy-ml
    try:
        from statsforecast import StatsForecast
        from statsforecast.models import AutoETS, SeasonalNaive
    except ImportError as exc:
        raise HTTPException(
            status_code=503,
            detail="Análisis de categoría requiere el grupo heavy-ml (statsforecast + polars). "
            "Instalá con: uv sync --group heavy-ml",
        ) from exc

    import duckdb

    # Normalizar: aceptar con o sin tilde (igual que demo/skus)
    cat_real = _CATEGORIAS_DISPLAY.get(categoria, categoria)
    if cat_real not in _CATEGORIAS:
        raise HTTPException(
            status_code=400,
            detail=f"Categoría inválida. Opciones: {list(_CATEGORIAS_DISPLAY.keys())}",
        )

    max_skus = min(max_skus, 1000)

    # ── 1. Leer datos con DuckDB ──────────────────────────────────────────────────────
    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET enable_progress_bar = false;")

        # Tomar solo los primeros max_skus SKUs de la categoría para no saturar RAM
        # Agrega de diario a la freq pedida directamente en DuckDB
        freq_trunc = {"W": "week", "M": "month", "D": "day", "Q": "quarter"}.get(freq, "week")

        raw: pd.DataFrame = con.execute(
            f"""
            WITH top_skus AS (
                SELECT DISTINCT sku_id
                FROM read_parquet([{_DEMO_CHUNKS_SQL}])
                WHERE categoria = ?
                ORDER BY sku_id
                LIMIT {max_skus}
            )
            SELECT
                t.sku_id,
                date_trunc('{freq_trunc}', t.fecha::DATE)::DATE AS ds,
                SUM(t.ventas)                                   AS y,
                MAX(t.cluster_abc)                              AS cluster_abc,
                MAX(t.cluster_xyz)                              AS cluster_xyz
            FROM read_parquet([{_DEMO_CHUNKS_SQL}]) t
            INNER JOIN top_skus ts ON t.sku_id = ts.sku_id
            WHERE t.categoria = ?
            GROUP BY t.sku_id, date_trunc('{freq_trunc}', t.fecha::DATE)
            ORDER BY t.sku_id, ds
            """,
            [cat_real, cat_real],
        ).df()
        con.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al leer datos: {exc}") from exc

    if raw.empty:
        raise HTTPException(status_code=404, detail=f"Sin datos para categoría '{cat_real}'")

    # ── 2. Preparar panel para StatsForecast ───────────────────────────────────────────────
    raw["ds"] = pd.to_datetime(raw["ds"])
    raw["y"] = pd.to_numeric(raw["y"], errors="coerce").fillna(0)

    # Hold-out: últimos horizon períodos como test
    panel_list = []
    test_list = []
    for sku, grp in raw.groupby("sku_id"):
        grp = grp.sort_values("ds").reset_index(drop=True)
        if len(grp) < horizon + 4:
            continue  # serie demasiado corta
        train = grp.iloc[:-horizon].copy()
        test = grp.iloc[-horizon:].copy()
        train["unique_id"] = str(sku)
        test["unique_id"] = str(sku)
        panel_list.append(train[["unique_id", "ds", "y"]])
        test_list.append(test[["unique_id", "ds", "y", "cluster_abc", "cluster_xyz"]])

    if not panel_list:
        raise HTTPException(status_code=422, detail="Todas las series son demasiado cortas.")

    panel = pd.concat(panel_list, ignore_index=True)
    test_df = pd.concat(test_list, ignore_index=True)

    # Asegurar tipos consistentes para el merge posterior
    panel["unique_id"] = panel["unique_id"].astype(str)
    test_df["unique_id"] = test_df["unique_id"].astype(str)
    panel["ds"] = pd.to_datetime(panel["ds"]).dt.normalize()   # strip hora
    test_df["ds"] = pd.to_datetime(test_df["ds"]).dt.normalize()  # strip hora

    # ── 3. StatsForecast vectorizado ───────────────────────────────────────────────────
    season_len = {"D": 7, "W": 52, "M": 12, "Q": 4}.get(freq, 52)
    # Mapeo freq → alias pandas aceptado por StatsForecast.
    # IMPORTANTE: DuckDB date_trunc('week')  → LUNES (ISO 8601)  → usar W-MON
    #             DuckDB date_trunc('month') → primer día del mes  → usar MS (Month Start)
    #             "ME" (Month End) genera el último día del mes → mismatch garantizado
    _freq_alias = {"D": "D", "W": "W-MON", "M": "MS", "Q": "QS"}
    sf = StatsForecast(
        models=[AutoETS(season_length=season_len)],
        freq=_freq_alias.get(freq, "W"),
        n_jobs=-1,
        fallback_model=SeasonalNaive(season_length=season_len),
    )
    try:
        fc = sf.forecast(df=panel, h=horizon).reset_index()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error en StatsForecast: {exc}") from exc

    # Columna de predicción (AutoETS la llama 'AutoETS')
    pred_col = [c for c in fc.columns if c not in ("unique_id", "ds")][0]
    fc = fc.rename(columns={pred_col: "predicted"})
    fc["predicted"] = fc["predicted"].clip(lower=0)
    # Normalizar tipos del forecast para merge seguro con test_df
    fc["unique_id"] = fc["unique_id"].astype(str)
    fc["ds"] = pd.to_datetime(fc["ds"]).dt.normalize()  # strip hora, queda solo DATE

    # ── 4. Métricas por SKU ────────────────────────────────────────────────────────────
    merged = test_df.merge(
        fc[["unique_id", "ds", "predicted"]],
        on=["unique_id", "ds"],
        how="inner",
    )

    sku_metrics: list[SkuMetrics] = []
    for sku_id, grp in merged.groupby("unique_id"):
        actual = grp["y"].to_numpy(dtype=float)
        predicted = grp["predicted"].to_numpy(dtype=float)
        denom = float(abs(actual).sum())
        wape = float(abs(actual - predicted).sum() / denom) if denom > 0 else None
        mae = float(abs(actual - predicted).mean())
        mean_actual = float(actual.mean())
        bias = float((predicted - actual).mean() / mean_actual) if mean_actual != 0 else None
        sku_metrics.append(
            SkuMetrics(
                sku_id=str(sku_id),
                wape=round(wape, 4) if wape is not None else None,
                mae=round(mae, 4),
                bias=round(bias, 4) if bias is not None else None,
                model="AutoETS",
                n_obs=len(grp),
                cluster_abc=str(grp["cluster_abc"].iloc[0])
                if "cluster_abc" in grp.columns
                else None,
                cluster_xyz=str(grp["cluster_xyz"].iloc[0])
                if "cluster_xyz" in grp.columns
                else None,
            )
        )

    if not sku_metrics:
        raise HTTPException(status_code=422, detail="No se pudieron calcular métricas.")

    # ── 5. Agregar métricas ────────────────────────────────────────────────────────────────
    import numpy as np

    wapes = [m.wape for m in sku_metrics if m.wape is not None]
    biases = [m.bias for m in sku_metrics if m.bias is not None]

    # Por segmento ABC-XYZ — acumulador con tipos explícitos
    _seg_wapes: dict[str, list[float]] = {}
    _seg_counts: dict[str, int] = {}
    for m in sku_metrics:
        if m.cluster_abc and m.cluster_xyz:
            key = f"{m.cluster_abc}-{m.cluster_xyz}"
            if key not in _seg_wapes:
                _seg_wapes[key] = []
                _seg_counts[key] = 0
            _seg_wapes[key].append(m.wape or 0.0)
            _seg_counts[key] += 1

    # Calcular WAPE medio por segmento
    clean_segment: dict[str, dict[str, float | int]] = {}
    for seg in _seg_wapes:
        wl = _seg_wapes[seg]
        clean_segment[seg] = {
            "wape_mean": round(float(np.mean(wl)), 4) if wl else 0.0,
            "n_skus": _seg_counts[seg],
        }

    # Top/bottom 20
    sorted_by_wape = sorted(sku_metrics, key=lambda m: m.wape or 999)
    best_skus = sorted_by_wape[:20]
    worst_skus = sorted_by_wape[-20:][::-1]

    duration = round(time.perf_counter() - t0, 2)

    return CategoryAnalysisResponse(
        categoria=categoria,
        n_skus=len(sku_metrics),
        freq=freq,
        horizon=horizon,
        duration_s=duration,
        wape_mean=round(float(np.mean(wapes)), 4) if wapes else None,
        wape_p50=round(float(np.percentile(wapes, 50)), 4) if wapes else None,
        wape_p90=round(float(np.percentile(wapes, 90)), 4) if wapes else None,
        bias_mean=round(float(np.mean(biases)), 4) if biases else None,
        by_segment=clean_segment,
        worst_skus=worst_skus,
        best_skus=best_skus,
    )


# ── Data Explorer endpoints ─────────────────────────────────────────────────────────────


class ExploreDbSchemaRequest(BaseModel):
    connection_string: str
    engine: str = "postgresql"


class ColumnMeta(BaseModel):
    name: str
    type: str
    nullable: bool
    is_pk: bool = False
    is_fk: bool = False
    fk_ref: str | None = None  # "schema.table.column"


class TableMeta(BaseModel):
    schema_name: str
    table_name: str
    row_count: int | None = None
    columns: list[ColumnMeta] = []


class SchemaResponse(BaseModel):
    engine: str
    schemas: list[str]
    tables: list[TableMeta]


@router.post("/explore/db/schema", response_model=SchemaResponse)
async def explore_db_schema(body: ExploreDbSchemaRequest) -> SchemaResponse:
    """
    Introspecciona esquemas, tablas, columnas, PKs y FKs de la DB del usuario.
    La conexión es EFÍMERA: se abre, introspecciona y cierra en esta función.
    La connection_string nunca se persiste.
    """
    from sqlalchemy import create_engine, inspect, text

    engine_sa = None
    try:
        engine_sa = create_engine(
            body.connection_string,
            connect_args={"connect_timeout": 10},
            echo=False,
            hide_parameters=True,
        )
        insp = inspect(engine_sa)

        schemas = [
            s
            for s in insp.get_schema_names()
            if s not in ("information_schema", "pg_catalog", "pg_toast")
        ]

        tables: list[TableMeta] = []
        for schema in schemas:
            for tname in insp.get_table_names(schema=schema):
                # Columnas
                pk_cols = set(
                    insp.get_pk_constraint(tname, schema=schema).get("constrained_columns", [])
                )
                fk_map: dict[str, str] = {}
                for fk in insp.get_foreign_keys(tname, schema=schema):
                    for local_col, ref_col in zip(
                        fk["constrained_columns"],
                        fk["referred_columns"],
                        strict=False,
                    ):
                        ref = f"{fk['referred_schema'] or schema}.{fk['referred_table']}.{ref_col}"
                        fk_map[local_col] = ref

                cols: list[ColumnMeta] = []
                for col in insp.get_columns(tname, schema=schema):
                    cname = col["name"]
                    cols.append(
                        ColumnMeta(
                            name=cname,
                            type=str(col["type"]),
                            nullable=bool(col.get("nullable", True)),
                            is_pk=cname in pk_cols,
                            is_fk=cname in fk_map,
                            fk_ref=fk_map.get(cname),
                        )
                    )

                # Contar filas (solo tablas pequeñas — max 5s)
                row_count: int | None = None
                try:
                    with engine_sa.connect() as conn:
                        result = conn.execute(text(f'SELECT COUNT(*) FROM "{schema}"."{tname}"'))
                        row_count = result.scalar()
                except Exception:
                    pass

                tables.append(
                    TableMeta(
                        schema_name=schema,
                        table_name=tname,
                        row_count=row_count,
                        columns=cols,
                    )
                )

    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Error al conectar o introspeccionar la DB: {exc}",
        ) from exc
    finally:
        if engine_sa is not None:
            engine_sa.dispose()

    return SchemaResponse(
        engine=body.engine,
        schemas=schemas,
        tables=tables,
    )


class ExploreDbQueryRequest(BaseModel):
    connection_string: str
    schema_name: str
    table_name: str
    page: int = 1
    page_size: int = 50
    order_by: str | None = None
    filters: dict[str, str] = {}  # {col: value} — filtra por ILIKE
    search_text: str = ""  # texto libre a buscar
    search_column: str = ""  # columna donde buscar (ILIKE '%text%')


class ExplorePageResponse(BaseModel):
    total_rows: int
    page: int
    page_size: int
    pages: int
    columns: list[str]
    rows: list[dict[str, str]]  # filas serializadas como strings


@router.post("/explore/db/query", response_model=ExplorePageResponse)
async def explore_db_query(body: ExploreDbQueryRequest) -> ExplorePageResponse:
    """
    Ejecuta un SELECT paginado sobre una tabla de la DB del usuario.
    Solo lectura. Conexión efímera.
    """
    import re

    from sqlalchemy import create_engine, text

    # Validar nombre de tabla/esquema para evitar SQL injection
    safe = re.compile(r"^[\w\-\.]+$")
    if not safe.match(body.schema_name) or not safe.match(body.table_name):
        raise HTTPException(status_code=400, detail="Nombre de tabla o esquema inválido.")

    page_size = min(body.page_size, 200)
    offset = (body.page - 1) * page_size

    engine_sa = None
    try:
        engine_sa = create_engine(
            body.connection_string,
            connect_args={"connect_timeout": 10},
            echo=False,
            hide_parameters=True,
        )
        with engine_sa.connect() as conn:
            # Claúusulas WHERE para búsqueda
            where_clause = ""
            bind_params: dict[str, Any] = {}
            if body.search_text and body.search_column:
                safe_col = re.sub(r"[^\w]", "", body.search_column)
                where_clause = f'WHERE "{safe_col}" ILIKE :search_val'
                bind_params["search_val"] = f"%{body.search_text}%"

            # Contar total
            total: int = (
                conn.execute(
                    text(
                        f'SELECT COUNT(*) FROM "{body.schema_name}"."{body.table_name}" {where_clause}'
                    ),
                    bind_params,
                ).scalar()
                or 0
            )

            # Query paginada
            order_clause = f'ORDER BY "{body.order_by}"' if body.order_by else ""
            result = conn.execute(
                text(
                    f'SELECT * FROM "{body.schema_name}"."{body.table_name}" '
                    f"{where_clause} {order_clause} LIMIT {page_size} OFFSET {offset}"
                ),
                bind_params,
            )
            df = pd.DataFrame(result.fetchall(), columns=list(result.keys()))

    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Error al ejecutar query: {exc}") from exc
    finally:
        if engine_sa is not None:
            engine_sa.dispose()

    rows: list[dict[str, str]] = df.fillna("").astype(str).to_dict(orient="records")  # type: ignore[assignment]
    pages = max(1, (total + page_size - 1) // page_size)

    return ExplorePageResponse(
        total_rows=total,
        page=body.page,
        page_size=page_size,
        pages=pages,
        columns=list(df.columns),
        rows=rows,
    )


@router.get("/explore/demo", response_model=ExplorePageResponse)
async def explore_demo(
    categoria: str = "Electrónica",
    sku_id: str = "",
    page: int = 1,
    page_size: int = 50,
    search_text: str = "",
    search_column: str = "",
) -> ExplorePageResponse:
    """
    Paginación sobre el Parquet demo con filtros opcionales y búsqueda por columna.
    No hace COUNT(*) full-scan: usa LIMIT n+1 para detectar si hay más páginas.
    """
    import duckdb

    cat_real = _CATEGORIAS_DISPLAY.get(categoria, categoria)
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size

    where_parts = ["categoria = ?"]
    params: list[str] = [cat_real]
    if sku_id:
        where_parts.append("sku_id = ?")
        params.append(sku_id)

    # Búsqueda ILIKE sobre columna elegida
    valid_cols = {
        "fecha",
        "sku_id",
        "categoria",
        "canal",
        "ventas",
        "precio",
        "stock",
        "cluster_abc",
        "cluster_xyz",
    }
    if search_text and search_column and search_column in valid_cols:
        where_parts.append(f"CAST({search_column} AS VARCHAR) ILIKE ?")
        params.append(f"%{search_text}%")

    where_sql = " AND ".join(where_parts)

    try:
        con = duckdb.connect()
        con.execute("INSTALL httpfs; LOAD httpfs;")
        con.execute("SET enable_progress_bar = false;")
        con.execute("SET http_timeout = 30000;")

        df: pd.DataFrame = con.execute(
            f"""
            SELECT fecha, sku_id, categoria, canal, ventas, precio, stock,
                   cluster_abc, cluster_xyz
            FROM read_parquet([{_DEMO_CHUNKS_SQL}])
            WHERE {where_sql}
            ORDER BY sku_id, fecha
            LIMIT {page_size + 1} OFFSET {offset}
            """,
            params,
        ).df()
        con.close()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al leer demo: {exc}") from exc

    has_more = len(df) > page_size
    df = df.iloc[:page_size]

    if sku_id or search_text:
        total_rows = offset + len(df) + (1 if has_more else 0)
    else:
        total_rows = offset + len(df) + (page_size * 100 if has_more else 0)

    pages = max(1, (total_rows + page_size - 1) // page_size)
    rows = df.fillna("").astype(str).to_dict(orient="records")

    return ExplorePageResponse(
        total_rows=total_rows,
        page=page,
        page_size=page_size,
        pages=pages,
        columns=list(df.columns),
        rows=rows,
    )


@router.delete("/{dataset_id}", status_code=204)
async def delete_dataset_endpoint(dataset_id: str) -> None:
    """
    Borra un dataset del Storage y la tabla datasets.
    No requiere autenticación — el control de acceso es por dataset_id.
    """
    try:
        delete_dataset(dataset_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Error al borrar dataset: {exc}") from exc


@router.get("/{dataset_id}/page", response_model=ExplorePageResponse)
async def page_dataset(
    dataset_id: str,
    page: int = 1,
    page_size: int = 50,
    search_text: str = "",
    search_column: str = "",
) -> ExplorePageResponse:
    """
    Paginación sobre un CSV ya subido a Supabase Storage.
    Soporta búsqueda por columna (contains, case-insensitive).
    """
    try:
        content = download_csv(dataset_id)
    except Exception as exc:
        raise HTTPException(
            status_code=404, detail=f"Dataset '{dataset_id}' no encontrado."
        ) from exc

    df = _parse_csv(content)

    # Filtrar si hay búsqueda
    if search_text and search_column and search_column in df.columns:
        mask = df[search_column].astype(str).str.contains(search_text, case=False, na=False)
        df = df[mask].reset_index(drop=True)

    total = len(df)
    page_size = min(page_size, 200)
    offset = (page - 1) * page_size
    page_df = df.iloc[offset : offset + page_size]
    rows = page_df.fillna("").astype(str).to_dict(orient="records")
    pages = max(1, (total + page_size - 1) // page_size)

    return ExplorePageResponse(
        total_rows=total,
        page=page,
        page_size=page_size,
        pages=pages,
        columns=list(df.columns),
        rows=rows,
    )
