# CLAUDE.md — ForecastIQ Developer Guide

> **Leer este archivo antes de tocar cualquier código.**
> Es la fuente de verdad para convenciones, arquitectura y decisiones técnicas.
> Ante la duda: preguntar antes de implementar.

---

## Comportamiento esperado de Claude

```
Sos un ML Engineer y Full-Stack Engineer trabajando en ForecastIQ —
un proyecto educativo de forecasting con Machine Learning.

El usuario es un Data Scientist que está aprendiendo a aplicar ML
a series de tiempo. El código debe ser claro, bien comentado y
pedagógico — no solo correcto.

Reglas no negociables:
- Nunca reescribir un archivo > 30 líneas sin permiso — solo parches quirúrgicos
- Siempre leer el archivo antes de editarlo
- Siempre verificar TODO.md antes de empezar a trabajar
- Si un archivo no existe, preguntar antes de crearlo
- Para decisiones de arquitectura: proponer opciones con tradeoffs, no imponer
- Comentarios en Python: español. TypeScript: inglés.
```

---

## Foco del proyecto

ForecastIQ es un **proyecto educativo** para Data Scientists aprendiendo ML aplicado a forecasting de series de tiempo. El flujo pedagógico es:

```
EDA → ETL → Detección automática → Modelos → Evaluación → Enciclopedia
```

Las decisiones técnicas deben reflejar este foco. La simplicidad y la transparencia tienen más valor que la optimización prematura.

---

## Estructura del proyecto

```
forecastiq/
├── backend/                        # Python — FastAPI + ML
│   ├── pyproject.toml              # UV managed — nunca usar pip directamente
│   ├── uv.lock                     # committed, no editar manualmente
│   ├── Dockerfile
│   └── app/
│       ├── main.py                 # FastAPI app factory
│       ├── core/
│       │   ├── config.py           # pydantic-settings, todas las env vars
│       │   ├── logging.py          # structlog JSON logging
│       │   └── dependencies.py     # FastAPI Depends() compartidos
│       ├── api/
│       │   ├── health.py           # GET /health
│       │   ├── datasets.py         # upload, preview, detect, EDA
│       │   ├── eda.py              # quality score, outliers, ETL (en desarrollo)
│       │   ├── forecast.py         # run, status, result, benchmark
│       │   ├── events.py           # CRUD eventos + feriados AR
│       │   ├── chat.py             # SSE streaming chat
│       │   ├── conversations.py    # historial de chat
│       │   ├── mlops.py            # MLflow experiments + drift
│       │   └── batch.py            # Nixtla multi-serie
│       ├── ml/
│       │   ├── detector.py         # MAD + FFT + Mann-Kendall → selección modelo
│       │   ├── models/
│       │   │   ├── base.py         # abstract ForecastModel
│       │   │   ├── moving_average.py
│       │   │   ├── holt_winters.py
│       │   │   ├── sarima.py
│       │   │   └── lightgbm_model.py
│       │   └── evaluator.py        # WAPE, MAE, BIAS, RMSE, MAPE, FVA
│       └── services/
│           ├── supabase.py
│           ├── redis_cache.py
│           ├── celery_app.py
│           ├── mlflow_tracker.py
│           ├── drift_detector.py
│           ├── nixtla_forecaster.py
│           └── llm/
│               ├── client.py
│               ├── openrouter.py
│               └── tools.py
│
├── frontend/                       # TypeScript — Next.js 14 + MUI v6
│   └── app/dashboard/
│       ├── home/                   # panel principal
│       ├── dataset/                # subida + columnas
│       ├── eda/                    # análisis exploratorio (en desarrollo)
│       ├── forecast/               # resultados + gráfico
│       ├── calendar/               # eventos y promociones
│       ├── encyclopedia/           # libro interactivo (en desarrollo)
│       ├── chat/                   # asistente IA
│       ├── mlops/                  # MLflow + drift
│       └── batch/                  # forecasting multi-serie
│
├── ENCICLOPEDIA/                   # fuentes de aprendizaje
│   ├── FUENTE 2/                   # Vandeputt adaptado (caps 1-10, 18-19 en scope)
│   └── FUENTE 3/                   # Vandeputt original (qmd — usar como base)
├── notebooks/                      # PySpark pipeline + benchmark
├── scripts/                        # dataset sintético + benchmarks
├── infra/                          # AWS EC2 + Grafana Alloy
│   ├── aws/
│   └── alloy/
├── .github/workflows/
│   ├── ci.yml                      # lint + test en cada push
│   └── deploy.yml                  # SSH deploy a EC2 al mergear a main
├── docker-compose.yml              # dev local + prod EC2
├── docker-compose.spark.yml        # cluster Spark educativo
├── CLAUDE.md                       # ← estás acá
├── TODO.md                         # fases activas + backlog + session log
├── ROADMAP.md                      # mapa de aprendizaje + decisiones de diseño
└── INSTRUCTIVO.md                  # setup local paso a paso
```

---

## Convenciones Frontend

### rem siempre, nunca px

```typescript
// ✅ CORRECTO
sx={{ fontSize: '1rem', padding: '1.5rem', borderRadius: '0.5rem' }}

// ❌ INCORRECTO
sx={{ fontSize: '16px', padding: '24px' }}
```

Tabla de referencia rápida:

```
0.25rem = 4px    0.5rem = 8px    0.75rem = 12px
1rem = 16px      1.25rem = 20px  1.5rem = 24px
2rem = 32px      3rem = 48px
```

### MUI theme tokens — nunca colores hardcodeados

```typescript
// ✅ CORRECTO
sx={{ color: 'primary.main', bgcolor: 'background.paper' }}
sx={{ color: 'text.secondary', borderColor: 'divider' }}

// ❌ INCORRECTO
sx={{ color: '#6366f1', bgcolor: '#ffffff' }}
```

### Convenciones de componentes

```typescript
// Una componente por archivo
// Named exports (no default) para componentes reutilizables
// Props interface siempre explícita

interface QualityScoreCardProps {
  score: number           // 0-100
  breakdown: ScoreBreakdown
  modelsAvailable: string[]
}

export function QualityScoreCard({ score, breakdown, modelsAvailable }: QualityScoreCardProps) { ... }

// 'use client' solo cuando se necesitan hooks, eventos o browser APIs
// Server Components por defecto en App Router
```

### Naming

```
components/eda/QualityScoreCard.tsx    → PascalCase para componentes
hooks/useEda.ts                        → camelCase con prefijo "use"
lib/api.ts                             → camelCase para utilities
app/dashboard/eda/page.tsx             → lowercase para rutas Next.js
```

---

## Convenciones Backend

### Gestión de entorno — UV siempre

```bash
uv add <paquete>             # agregar dependencia
uv add --dev <paquete>       # dependencia de desarrollo
uv run <comando>             # ejecutar en virtualenv
uv run pytest                # correr tests
uv run uvicorn app.main:app  # servidor dev
```

### Config — todas las env vars en un lugar

```python
# app/core/config.py — pydantic-settings
class Settings(BaseSettings):
    environment: str = "development"
    debug: bool = False
    server_tier: str = "local"    # local | ec2 | cloud

    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    database_url: str

    upstash_redis_url: str = ""
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_task_always_eager: bool = True

    jwt_secret_key: str
    better_auth_url: str = "http://localhost:3000"

    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-v4-flash:free"

    mlflow_tracking_uri: str = "./mlruns"

    class Config:
        env_file = ".env"
```

### Respuestas API — siempre tipadas con Pydantic

```python
class EdaQualityScore(BaseModel):
    score: int                          # 0-100
    label: str                          # "poor" | "fair" | "good" | "excellent"
    completeness: float                 # 0-1
    history_years: float
    outlier_ratio: float
    has_gaps: bool
    models_available: list[str]
    recommendation: str                 # mensaje para mostrar al usuario

# HTTP status codes:
# 200 → éxito
# 201 → creado (POST que crea recurso)
# 202 → aceptado (job async iniciado)
# 400 → bad request (error de validación)
# 404 → no encontrado
# 429 → rate limit excedido
# 500 → error interno (nunca exponer detalles al cliente)
```

### Manejo de errores

```python
# ✅ CORRECTO — descriptivo, amigable para el usuario
raise HTTPException(
    status_code=400,
    detail="La columna 'fecha' no fue encontrada. Columnas disponibles: date, producto, cantidad"
)

# ❌ INCORRECTO — expone internals
raise HTTPException(status_code=500, detail=str(e))
```

---

## Modelos ML — interfaz base (inmutable)

```python
# app/ml/models/base.py
from abc import ABC, abstractmethod
import pandas as pd

class ForecastModel(ABC):
    name: str
    requires_min_observations: int
    parameters: dict                    # parámetros usados (para Enciclopedia)

    @abstractmethod
    def fit(self, series: pd.Series) -> None: ...

    @abstractmethod
    def predict(self, horizon: int) -> pd.DataFrame: ...
    # retorna: DataFrame con columnas [date, predicted, lower, upper]

    @abstractmethod
    def evaluate(self, test: pd.Series) -> dict[str, float]: ...
    # retorna: {"wape": float, "mae": float, "bias": float, "rmse": float, "fva": float}

    def get_parameters(self) -> dict:
    # retorna los parámetros usados — para mostrar en la UI (Enciclopedia + tuneo)
        return self.parameters
```

---

## Pipeline de detección automática (cerrado — no modificar la lógica)

```python
# app/ml/detector.py — pipeline en este orden exacto:
# 1. MAD (Modified Z-score, threshold=3.0)  → detecta outliers
# 2. Winsorización p5/p95                   → normaliza para análisis
# 3. FFT (numpy)                             → detecta estacionalidad
# 4. Seasonal Mann-Kendall (pymannkendall)   → detecta tendencia
# 5. CV = std / media                        → mide volatilidad
# 6. Árbol de decisión → elige modelo

# REGLAS (inmutables):
# n < 52                          → moving_average
# n ≥ 52  + estacionalidad        → holt_winters
# n ≥ 104 + tendencia sin estac.  → sarima
# n ≥ 104 + CV > 1.0             → lightgbm

# El detector DEBE retornar un DetectionReport con todos los pasos para la UI.
# Nunca debe ser una caja negra — siempre explicar el razonamiento.
```

---

## Métricas de evaluación (prioridad Vandeputt)

```python
# app/ml/evaluator.py
# Orden de prioridad:
# 1. WAPE  → error relativo ponderado — robusto a ceros — métrica principal
# 2. MAE   → error absoluto promedio — interpretable en unidades de negocio
# 3. BIAS  → sobreestimación/subestimación sistemática — crítico para inventario
# 4. RMSE  → penaliza errores grandes — para selección de modelo
# 5. FVA   → Forecast Value Added vs Seasonal Naive — SIEMPRE calcularlo

# WAPE = sum(|real - pred|) / sum(|real|)
# BIAS = mean(pred - real) / mean(real) * 100  → positivo = sobreestimación
# FVA  = (WAPE_naive - WAPE_model) / WAPE_naive * 100  → positivo = modelo mejora
```

---

## Quality Score (EDA) — lógica de semáforo

```python
# Cálculo del score 0-100:
# Completitud    (30 pts) — (1 - ratio_nulls) * 30
# Historia       (25 pts) — min(years_of_history / 3, 1.0) * 25  [3 años = máximo]
# Regularidad    (25 pts) — (1 - gap_ratio) * 25
# Outliers       (20 pts) — (1 - min(outlier_ratio / 0.2, 1.0)) * 20

# Modelos disponibles según score:
# < 30  → ["moving_average"]
# 30-60 → ["moving_average", "holt_winters_simple"]
# 60-80 → ["moving_average", "holt_winters", "sarima"]
# > 80  → ["moving_average", "holt_winters", "sarima", "lightgbm"]
```

---

## Rate Limiting (activo en producción)

```python
# redis_cache.py
UPLOAD_RATE_LIMIT   = 5    # uploads/hora/IP
FORECAST_RATE_LIMIT = 10   # jobs/hora/IP+user
CHAT_RATE_LIMIT     = 30   # mensajes/hora/IP+user

# Responde 429 con header Retry-After y mensaje amigable
```

---

## LLM — modelos gratuitos (OpenRouter)

```python
FREE_MODELS = [
    {"id": "openrouter/owl-alpha",               "label": "OWL Alpha"},
    {"id": "nvidia/nemotron-3-super-120b-a12b:free", "label": "Nemotron 120B"},
    {"id": "poolside/laguna-m.1:free",           "label": "Laguna M.1"},
    {"id": "openai/gpt-oss-120b:free",           "label": "GPT OSS 120B"},
    {"id": "z-ai/glm-4.5-air:free",              "label": "GLM 4.5 Air"},
    {"id": "deepseek/deepseek-v4-flash:free",    "label": "DeepSeek V4 Flash"},
    {"id": "minimax/minimax-m2.5:free",          "label": "MiniMax M2.5"},
]
```

---

## Tiers del servidor

| Tier     | `SERVER_TIER` | Modelos ML disponibles              | Analytics batch |
| -------- | ------------- | ----------------------------------- | --------------- |
| PC local | `local`       | Todos (MA + HW + SARIMA + LightGBM) | ✅              |
| AWS EC2  | `ec2`         | MA + HW + SARIMA (sin heavy-ml)     | ❌              |
| Cloud    | `cloud`       | Solo frontend                       | ❌              |

Los tiers se detectan via `GET /api/capabilities` y se muestran como chip en el header.

---

## Ingesta de datos — límites por tier

```
Formato    │ Local  │ EC2    │ Notas
───────────┼────────┼────────┼───────────────────────────────────────
CSV        │ 50 MB  │ 10 MB  │ Lento para > 1M filas
Excel      │ 50 MB  │ 10 MB  │ openpyxl — cuidado con fórmulas
Parquet    │ 50 MB  │ 25 MB  │ Preferir siempre — 3-5x más compacto
DB Query   │ 500k   │ 100k   │ Máximo de filas en la query
           │ filas  │ filas  │
```

Cloudflare R2: solo para el dataset de 25k SKUs (256 MB, egress gratuito).
Supabase Storage: solo para CSVs de usuario (< 10 MB). No subir archivos grandes acá.

---

## Convenciones de testing

```python
# tests/unit/test_detector.py
def test_short_series_uses_moving_average():
    """Series con < 52 obs siempre debe usar moving average."""
    series = pd.Series(np.random.rand(30))
    result = detect_best_model(series, freq="W")
    assert result.model == "moving_average"
    assert result.report.n_obs == 30       # siempre verificar el reporte también

def test_detection_report_is_never_empty():
    """El reporte de detección siempre debe tener todos los campos completados."""
    series = pd.Series(np.random.rand(60))
    result = detect_best_model(series, freq="M")
    assert result.report.outliers_detected is not None
    assert result.report.seasonality_detected is not None
    assert result.report.trend_detected is not None
```

---

## Pitfalls conocidos

### SSE Streaming (FastAPI)

```python
# Siempre estos headers — sin X-Accel-Buffering nginx bufferiza el stream
return StreamingResponse(
    generate(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "Connection": "keep-alive",
    }
)
```

### Celery + async

```python
# Los tasks de Celery son síncronos — usar asyncio.run() para llamar código async
@celery_app.task
def run_forecast_task(dataset_id: str, config: dict):
    import asyncio
    result = asyncio.run(_async_forecast(dataset_id, config))
    return result
```

### Frecuencias pandas — siempre Month Start

```python
# ✅ CORRECTO
"MS"     # Month Start → alinea con date_trunc('month') en DuckDB
"QS"     # Quarter Start
"W-MON"  # Week starting Monday → alinea con date_trunc('week') en DuckDB

# ❌ INCORRECTO — causan desalineación con DuckDB
"M"      # Month End (deprecado)
"ME"     # Month End
"W"      # Week (sin día especificado)
```

### Supabase RLS

```
Cada tabla tiene Row Level Security habilitado.
Siempre testear queries con la anon key (no service key) para detectar problemas RLS.
La service key bypasea RLS — solo usar en backend, nunca exponer al frontend.
```

### Next.js App Router — Server vs Client

```typescript
// Por defecto: Server Component (sin 'use client')
//   ✓ data fetching, contenido estático, layouts
//   ✗ useState, useEffect, onClick, browser APIs

// Agregar 'use client' solo cuando:
//   ✓ charts interactivos (Recharts)
//   ✓ SSE streaming (useChat hook)
//   ✓ formularios con estado
"use client";
```

---

## CI/CD

```
Cada push a cualquier branch → ci.yml:
  1. ruff check (linting)
  2. ruff format --check
  3. mypy (type checking — strict mode)
  4. pytest (unit + integration)

Merge a main → deploy.yml:
  1. Todos los checks de CI deben pasar
  2. docker build + push a ghcr.io (GitHub Container Registry)
  3. SSH al EC2 (AWS t3.micro) → docker compose pull + up -d
  4. Vercel deploy automático (vía integración GitHub)

CI debe estar verde en main siempre. Nunca mergear con CI rojo.
```

---

## Dependencias clave

| Paquete                     | Para qué                 | Notas                                   |
| --------------------------- | ------------------------ | --------------------------------------- |
| `fastapi`                   | API framework            | usar `async def` en todos los endpoints |
| `pydantic-settings`         | Config                   | todas las env vars acá                  |
| `sqlalchemy[asyncio]`       | ORM                      | sesiones async                          |
| `supabase`                  | Supabase client          | storage + DB                            |
| `redis`                     | Upstash Redis            | cache + rate limiting                   |
| `celery`                    | Jobs ML background       | con Redis broker                        |
| `lightgbm`                  | Gradient boosting        | con Optuna HPO                          |
| `statsmodels`               | SARIMA + Holt-Winters    | pmdarima para auto_arima                |
| `statsforecast`             | Nixtla vectorizado       | para batch multi-serie                  |
| `optuna`                    | HPO                      | pruner: MedianPruner                    |
| `pandas`                    | Manipulación de datos    |                                         |
| `pyarrow`                   | Parquet read/write       |                                         |
| `duckdb`                    | Queries analíticas       | para DuckDB tools del chat              |
| `httpx`                     | HTTP async               | para llamadas a OpenRouter              |
| `mlflow`                    | Tracking de experimentos | Dagshub en prod, filesystem en dev      |
| `evidently`                 | Drift detection          | pinned == 0.4.33                        |
| `pymannkendall`             | Seasonal Mann-Kendall    | en el detector                          |
| `pytest` + `pytest-asyncio` | Testing                  |                                         |
| `ruff`                      | Linting + format         | reemplaza black + flake8                |
| `mypy`                      | Type checking            | modo strict                             |

---

## Workflow para nuevas features

```
1. Verificar TODO.md → confirmar que la feature es de la fase activa
2. Leer los archivos relevantes existentes (nunca asumir estructura)
3. Escribir/actualizar tipos primero (interfaces TypeScript, modelos Pydantic)
4. Implementar endpoint backend con tests
5. Implementar componente frontend
6. Actualizar TODO.md → marcar tarea done
7. Commit con formato conventional:
   feat(eda): add quality score endpoint with semaphore logic
   fix(forecast): handle empty series before MAD detection
   docs(encyclopedia): add Holt-Winters chapter content
```

---

_Última actualización: 2026-05-24 — Foco educativo. Enterprise Stack removido. Fases E1-E9 definidas._
