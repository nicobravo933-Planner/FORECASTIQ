# ROADMAP.md — forecastiq

> Documento de referencia para las Fases 7.5 a 14.
> El TODO.md mantiene el tracking operativo (tareas, checkboxes, session log).
> Este archivo contiene las decisiones de arquitectura cerradas para cada fase.
>
> **Claude: leer este archivo cuando se trabaje en Fases 7.5 en adelante.**

---

## Índice

| Fase                                                | Nombre                    | Estado       | Prioridad        |
| --------------------------------------------------- | ------------------------- | ------------ | ---------------- |
| [7.5](#fase-75--ui-polish--rate-limiting)           | UI Polish + Rate Limiting | ✅ Completa  | —                |
| [8](#fase-8--mlops-mlflow--evidently-ai)            | MLOps                     | ✅ Completa  | —                |
| [9](#fase-9--scale-engine-nixtla--polars)           | Scale Engine              | ⏳ Pendiente | Alta             |
| [10](#fase-10--dataset-sintético-masivo)            | Dataset Sintético         | ⏳ Pendiente | Media            |
| [11](#fase-11--pyspark-local-docker)                | PySpark Local             | ⏳ Pendiente | Media            |
| [12](#fase-12--airflow-orquestación-batch)          | Airflow                   | ⏳ Pendiente | Media            |
| [13](#fase-13--data-warehouse-bigquery--dbt)        | Data Warehouse            | ⏳ Pendiente | Baja             |
| [14](#fase-14--infra-as-code-terraform--kubernetes) | Infra as Code             | ⏳ Pendiente | Baja             |

---

## Fase 7.5 — UI Polish + Rate Limiting

> ✅ Completa.

### Decisiones implementadas

**Rate limiting por endpoint:**

| Endpoint                    | Límite      | Ventana          | Razón                              |
| --------------------------- | ----------- | ---------------- | ---------------------------------- |
| `POST /api/datasets/upload` | 5 uploads   | 1 hora / IP      | Storage Supabase free = 1 GB total |
| `POST /api/forecast/run`    | 10 jobs     | 1 hora / IP+user | ML es el recurso más caro en EC2   |
| `POST /api/chat`            | 30 mensajes | 1 hora / IP+user | Ya implementado                    |
| `GET *`                     | sin límite  | —                | Solo lectura                       |

Implementado en `redis_cache.py` con `_check_rate_limit_generic`. Respuesta 429 con header `Retry-After`.

**Componentes creados:**

```
frontend/components/
  layout/    → README.md (preparado para Fase 8+)
  dataset/   → DataSourceTabs, DemoDatasetCard, ConnectDbCard

frontend/lib/
  motion.ts  → constantes de animación MUI
```

**Páginas rediseñadas:**
- Login — split layout desktop / mobile-only panel derecho
- Sidebar — logo PNG en lugar de texto
- Dataset — 3 tabs: Subir CSV / Dataset demo (placeholder) / Conectar DB (placeholder)

---

## Fase 8 — MLOps (MLflow + Evidently AI)

> **Objetivo:** Tracking reproducible de experimentos ML + detección automática de data drift.

### Decisión de infraestructura

MLflow se hostea en **Dagshub** (free, sin límite de tiempo). No requiere servicio adicional en EC2.

- Local dev: `MLFLOW_TRACKING_URI=./mlruns` (filesystem, sin servidor)
- Producción: `MLFLOW_TRACKING_URI=https://dagshub.com/<user>/forecastiq.mlflow`

Evidently corre dentro del Celery worker — no requiere servicio externo.

### Stack

```
Forecast run (Celery worker)
    │
    ├── mlflow.start_run()
    │     ├── log_params: {model, freq, horizon, dataset_id, n_obs}
    │     ├── log_metrics: {wape, mae, bias, rmse, mape}
    │     └── log_model: artefacto serializado (joblib)
    │
    └── evidently.Report(metrics=[DataDriftPreset()])
          ├── comparar últimas 4 semanas vs histórico completo
          └── guardar HTML report en Supabase Storage (drift_reports/ bucket)

MLflow Tracking:
  - Local:  ./mlruns (filesystem)
  - Prod:   Dagshub (https://dagshub.com/<user>/forecastiq.mlflow)
```

### Endpoints nuevos

```
GET  /api/experiments              → lista de runs MLflow del usuario
GET  /api/experiments/{run_id}     → detalle: params + métricas de un run
GET  /api/drift/{dataset_id}       → drift score por columna (JSON)
```

### Alerta automática de drift

Si WAPE del forecast más reciente sube >5% respecto al promedio de los últimos 5 runs:
1. Log estructurado con `structlog` (campo `drift_alert=True`)
2. (Futuro) Email al usuario via Resend/SendGrid

### Frontend — componentes nuevos (`components/mlops/`)

- `ExperimentTable` — tabla de runs: WAPE, modelo, fecha, link a Dagshub
- `DriftCard` — badge por columna: verde / amarillo / rojo según drift score
- `MLflowLink` — botón que abre la URL de experiments en Dagshub

---

## Fase 9 — Scale Engine (Nixtla + Polars)

> **Objetivo:** Procesar múltiples series temporales en paralelo con un pipeline vectorizado.

### Decisión arquitectural: DuckDB + Supabase Storage

El Parquet de 25k SKUs (~180 MB) vive en **Supabase Storage**, no en el servidor EC2.

```python
# DuckDB lee columnas específicas directamente desde la URL firmada
# Pushdown de predicados y columnas — no descarga el archivo completo
import duckdb

signed_url = supabase.storage.from_("datasets").create_signed_url(
    "ventas_25k_skus.parquet", expires_in=3600
)["signedURL"]

df = duckdb.execute(
    "SELECT fecha, ventas FROM read_parquet(?) WHERE sku_id = ?",
    [signed_url, sku_id]
).pl()  # retorna Polars DataFrame directamente
```

Esto mantiene el uso de RAM del EC2 bajo control: DuckDB solo descarga los row groups necesarios.

### Pipeline Nixtla vectorizado

```python
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoARIMA, SeasonalNaive
import polars as pl

panel = df.rename({"sku_id": "unique_id", "fecha": "ds", "ventas": "y"})

sf = StatsForecast(
    models=[AutoETS(), AutoARIMA(), SeasonalNaive(season_length=7)],
    freq="D",
    n_jobs=-1
)
forecast_df = sf.forecast(df=panel, h=30)
```

### Clustering ABC-XYZ → modelo por segmento

```
A-X (alto volumen, baja variabilidad)   → Holt-Winters (ETS)
A-Z (alto volumen, alta variabilidad)   → LightGBM (MLForecast)
B-X, B-Y                                → AutoETS
B-Z, C-Z (baja rotación, intermitente) → Croston / TSB
C-X, C-Y                                → Seasonal Naive (baseline)
```

El clustering está pre-calculado en el dataset (`cluster_abc`, `cluster_xyz`).

### Celery Beat — batch nocturno

```python
CELERYBEAT_SCHEDULE = {
    "nightly-reforecast": {
        "task": "app.services.celery_app.batch_reforecast",
        "schedule": crontab(hour=2, minute=0),  # 02:00 AR (UTC-3)
    }
}
```

### Benchmark

Script `scripts/benchmark_models.py` — compara sobre 1k SKUs:
- `statsmodels` (loop)
- `StatsForecast` (Nixtla vectorizado)
- `MLForecast` + LightGBM (modelo global)

Output: tabla markdown con tiempo de ejecución + WAPE por segmento.

---

## Fase 10 — Dataset Sintético Masivo

> **Objetivo:** Dataset de referencia para las Fases 11-13.
> Script standalone — no modifica la app.

### Especificación

```
Archivo:    data/ventas_25k_skus.parquet
Formato:    Parquet, compresión Snappy
Tamaño:     ~180 MB
Filas:      ~27M (25k SKUs × ~1095 días = 3 años diarios)

Columnas:
  sku_id        string    "SKU-00001" a "SKU-25000"
  categoria     string    Electrónica | Alimentos | Indumentaria | Hogar | Deportes
  canal         string    online | offline | ambos
  fecha         date      2022-01-01 a 2024-12-31
  ventas        float     unidades vendidas (con ceros para intermitentes)
  precio        float     precio unitario (con variaciones)
  stock         float     stock disponible al cierre del día
  cluster_abc   string    A | B | C (por volumen total)
  cluster_xyz   string    X | Y | Z (por coeficiente de variación)
```

### Patrones por categoría

| Categoría    | Tendencia | Estacionalidad anual    | Estacionalidad semanal      | % ceros |
| ------------ | --------- | ----------------------- | --------------------------- | ------- |
| Electrónica  | +3%/año   | Navidad fuerte (×2.5)   | Fines de semana +20%        | 2%      |
| Alimentos    | +1%/año   | Moderada                | Fuerte (×1.8 fin de semana) | 0%      |
| Indumentaria | 0%        | Primavera/Otoño fuertes | Moderada                    | 5%      |
| Hogar        | +2%/año   | Fin de año              | Baja                        | 15%     |
| Deportes     | +5%/año   | Verano + Año Nuevo      | Fines de semana             | 10%     |

### Script

`scripts/generate_massive_dataset.py` — ya creado.
Output: `data/` (gitignored).
Upload manual a Supabase Storage bucket `datasets/`.

---

## Fase 11 — PySpark Local (Docker)

> **Objetivo:** Feature engineering distribuido sobre el dataset de 25k SKUs.

### Cuándo Spark vs Polars

```
Polars  → hasta ~100M filas en una sola máquina, latencia baja
Spark   → >100M filas, o distribución real entre nodos, o cluster ya existente

Para este proyecto:
  - 27M filas → Polars es suficiente en velocidad
  - Spark se incluye para cubrir el caso de uso distribuido explícitamente
```

### Stack Docker

```yaml
# docker-compose.spark.yml
services:
  spark-master:
    image: bitnami/spark:3.5
    ports:
      - "8080:8080"
      - "7077:7077"

  spark-worker-1:
    image: bitnami/spark:3.5
    environment:
      - SPARK_MODE=worker
      - SPARK_MASTER_URL=spark://spark-master:7077
      - SPARK_WORKER_MEMORY=2G
      - SPARK_WORKER_CORES=2

  spark-worker-2:
    image: bitnami/spark:3.5
    environment:
      - SPARK_MODE=worker
      - SPARK_MASTER_URL=spark://spark-master:7077
      - SPARK_WORKER_MEMORY=2G
      - SPARK_WORKER_CORES=2
```

### Notebook

`notebooks/spark_forecast_pipeline.ipynb`:
1. Leer Parquet desde Supabase Storage (o local)
2. Feature engineering: lag-7, lag-30, rolling mean 7/30, day_of_week, month
3. Forecast por partición (`mapPartitions` sobre `unique_id`) con LightGBM local
4. Escribir resultado en Parquet particionado por `categoria/fecha`
5. Tabla comparativa de tiempos: Pandas vs Polars vs Spark

---

## Fase 12 — Airflow (Orquestación Batch)

> **Objetivo:** Orquestar el pipeline de forecast con retry automático y monitoreo.

### DAGs

```
forecast_batch_daily  (cron: 0 2 * * *)
    1. sensor: verificar Parquet actualizado en Supabase Storage
    2. download_parquet_task: descarga incremental
    3. nixtla_forecast_task: StatsForecast sobre todos los SKUs
    4. save_results_task: guardar Parquet de resultados en Storage
    5. notify_task: log de éxito + métricas

drift_check_weekly  (cron: 0 6 * * 1)
    1. load_recent_data_task: últimas 4 semanas
    2. evidently_report_task: generar HTML report
    3. threshold_check_task: WAPE drift > 5%? → alerta structlog
    4. upload_report_task: guardar HTML en Storage

mlflow_cleanup_monthly  (cron: 0 0 1 * *)
    1. list_old_runs_task: runs MLflow > 90 días
    2. archive_runs_task: mover artefactos
    3. delete_runs_task: limpiar tracking server
```

### Stack local

```yaml
# docker-compose.airflow.yml — CeleryExecutor
# Broker: mismo Redis de la app
# Metadata DB: PostgreSQL de Supabase
```

### Comparativa de orquestadores

| Orquestador | Cuándo usarlo                                  | Ventaja                    | Desventaja                           |
| ----------- | ---------------------------------------------- | -------------------------- | ------------------------------------ |
| Celery Beat | Jobs simples, misma codebase                   | Sin overhead adicional     | Sin UI, difícil de monitorear        |
| Airflow     | Pipelines complejos, dependencias entre tareas | UI, retry, SLA, sensors    | Pesado (PostgreSQL + Redis + workers)|
| Prefect     | Python-native, equipos modernos                | UI cloud, fácil de operar  | Vendor lock-in en cloud              |

---

## Fase 13 — Data Warehouse (BigQuery + dbt)

> **Objetivo:** Capa analítica sobre los datos de forecast con SQL versionado.

### Arquitectura Lakehouse

```
Raw layer     → Supabase Storage (Parquet) — source of truth
Serving layer → BigQuery free tier — análisis ad-hoc
Transform     → dbt — modelos SQL versionados

Flujo:
  Parquet en Storage
      → script Python (google-cloud-bigquery client)
      → tablas raw en BigQuery
      → dbt transforma
      → marts: fct_forecast_accuracy, mart_abc_xyz
      → endpoint FastAPI /api/dw/query
```

### dbt models

```sql
-- stg_ventas: limpieza y tipado
-- fct_forecast_accuracy: WAPE/MAE/BIAS por SKU, modelo, semana
-- mart_abc_xyz: clasificación con métricas de negocio
-- mart_otif: On Time In Full simulado por SKU
```

### BigQuery free tier

- 10 GB storage + 1 TB queries/mes
- Alternativa: Snowflake trial (30 días, $400 crédito)
- Alternativa: Databricks Community (Spark + MLflow + Delta Lake)

---

## Fase 14 — Infra as Code (Terraform + Kubernetes)

> **Objetivo:** Codificar la infraestructura actual en Terraform y preparar manifests K8s.

### Terraform

```hcl
# infra/terraform/
# aws.tf        → EC2 + security groups + key pair
# supabase.tf   → proyecto + storage buckets
# vercel.tf     → proyecto + env vars
```

### Kubernetes

```yaml
# infra/k8s/
# api/deployment.yaml       → FastAPI (3 replicas, HPA CPU 70%)
# worker/deployment.yaml    → Celery worker (2 replicas)
# ingress.yaml              → nginx-ingress con TLS
# hpa.yaml                  → HorizontalPodAutoscaler
```

### Helm chart

Chart en `infra/helm/forecastiq/` con `values.yaml` parametrizable.

### Estrategia de escalado

```
EC2 t2.micro (hoy)  → 1 API + 1 Worker · suficiente para carga baja
K8s en GKE/EKS      → cuando se necesite >10 req/s sostenidos
  - API: HPA 2-10 pods basado en CPU
  - Worker: HPA 1-5 pods basado en profundidad de cola Celery
  - Redis: Upstash o GCP Memorystore
```

---

## Backlog — Fuentes de datos (Dataset page)

### Tab 1: CSV Upload (actual)

- Límite: 10 MB → elevar a 50 MB
- Validación de columnas mínimas con mensaje de error descriptivo
- Auto-mapping de columnas con LLM (post-MVP)

### Tab 2: Dataset Demo (Fase 9)

- Dataset 25k SKUs disponible para todos los usuarios sin subir nada
- DuckDB lee desde Supabase Storage via URL firmada
- Rate limit: 20 forecasts/hora sobre el dataset demo

### Tab 3: Conexión directa DB (Backlog)

- Soportar: PostgreSQL, BigQuery, Snowflake, S3/Parquet
- Connection string efímera — nunca persistida, nunca logueada
- El backend ejecuta la query y descarta la conexión inmediatamente
- Validación: solo SELECT permitido (no DDL/DML)

---

## Quick Start Local

Ver guía completa en `infra/aws/README.md`.

### Variables mínimas

```bash
# backend/.env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
UPSTASH_REDIS_URL=http://localhost:6379
BETTER_AUTH_URL=http://localhost:3000
JWT_SECRET_KEY=dev-secret
MLFLOW_TRACKING_URI=./mlruns
# Opcional:
OPENROUTER_API_KEY=sk-or-...
```

```bash
# frontend/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
BETTER_AUTH_SECRET=dev-secret
BETTER_AUTH_URL=http://localhost:3000
```

### Comandos

```bash
# Redis
docker run -d -p 6379:6379 redis:alpine

# Backend
cd backend && cp .env.example .env && uv sync
uv run uvicorn app.main:app --reload --port 8000

# Worker (terminal separada)
uv run celery -A app.services.celery_app.celery_app worker --loglevel=info

# Frontend (terminal separada)
cd frontend && cp .env.example .env.local && npm install && npm run dev
```

### Migraciones Supabase

```
1. backend/migrations/001_forecast_jobs.sql
2. backend/migrations/002_events.sql
3. backend/migrations/003_add_user_id.sql
```

---

_Última actualización: 2026-05-20 — Sesión 26 — Migración Railway → AWS + Dagshub._
