# ROADMAP.md — forecastiq

> Documento de referencia para las Fases 7.5 a 14.
> El TODO.md mantiene el tracking operativo (tareas, checkboxes, session log).
> Este archivo contiene las decisiones de arquitectura cerradas para cada fase.
>
> **Claude: leer este archivo cuando se trabaje en Fases 7.5 en adelante.**

---

## Índice

| Fase                                                | Nombre                    | Estado       | Prioridad |
| --------------------------------------------------- | ------------------------- | ------------ | --------- |
| [7.5](#fase-75--ui-polish--rate-limiting)           | UI Polish + Rate Limiting | ✅ Completa  | —         |
| [8](#fase-8--mlops-mlflow--evidently-ai)            | MLOps                     | ✅ Completa  | —         |
| [9](#fase-9--scale-engine-nixtla--polars)           | Scale Engine              | ✅ Completa  | —         |
| [10](#fase-10--dataset-sintético-masivo)            | Dataset Sintético         | ✅ Completa  | —         |
| [11](#fase-11--pyspark-local-docker)                | PySpark Local             | ⏳ Pendiente | Media     |
| [12](#fase-12--airflow-orquestación-batch)          | Airflow                   | ⏳ Pendiente | Media     |
| [13](#fase-13--data-warehouse-bigquery--dbt)        | Data Warehouse            | ⏳ Pendiente | Baja      |
| [14](#fase-14--infra-as-code-terraform--kubernetes) | Infra as Code             | ⏳ Pendiente | Baja      |

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

**Componentes creados:**

```
frontend/components/
  dataset/   → DataSourceTabs, DemoDatasetCard, ConnectDbCard, CloudDataCard
  forecast/  → ForecastConfigPanel, HorizonSelector, DatasetPicker
  upload/    → DropZone, DataPreview, ColumnSelector, ModelRecommendation
```

**UX implementada:**
- Login split layout desktop/mobile
- Sidebar colapsable con chip de tier (local/ec2/cloud) en header
- Dataset tabs: CSV / Dataset demo / Conectar DB / Cloud (bloqueado)
- DatasetPicker visual en Forecast (nombre legible, no UUID)
- HorizonSelector contextual por frecuencia (D/W/M/Q)

---

## Fase 8 — MLOps (MLflow + Evidently AI)

> ✅ Completa.

**Stack:** MLflow en Dagshub (free) + Evidently AI en Celery worker.

- Local dev: `MLFLOW_TRACKING_URI=./mlruns`
- Producción: `MLFLOW_TRACKING_URI=https://dagshub.com/<user>/forecastiq.mlflow`

**Endpoints:**
- `GET /api/experiments` — lista de runs MLflow
- `GET /api/experiments/{run_id}` — detalle: params + métricas
- `GET /api/drift/{dataset_id}` — drift score por columna

---

## Fase 9 — Scale Engine (Nixtla + Polars)

> ✅ Completa.

### Decisión arquitectural: DuckDB + Cloudflare R2

El Parquet de 25k SKUs (256 MB, archivo único) vive en **Cloudflare R2** (egress gratuito ilimitado).
Antes estaba en Supabase Storage (6 chunks), migrado en mayo 2026 por exceso de egress.

```python
# URL pública de R2 — DuckDB lee directamente via httpfs
_DEMO_PARQUET_URL = "https://pub-d0a335fad6124970951095c7dce170c3.r2.dev/ventas_25k_skus.parquet"
_DEMO_CHUNKS_SQL = f"'{_DEMO_PARQUET_URL}'"
```

**Por qué R2 sobre Supabase Storage para archivos grandes:**
- Supabase Storage cobra egress (~$0.09/GB después de 5 GB free/mes)
- Cloudflare R2: egress 100% gratuito, 10 GB storage gratis
- DuckDB lee con pushdown de predicados — no descarga el archivo completo

### Pipeline Nixtla vectorizado

```python
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, SeasonalNaive

sf = StatsForecast(
    models=[AutoETS(season_length=52)],
    freq="W-MON",  # semanal, alineado con DuckDB date_trunc('week') → LUNES
    n_jobs=-1,
    fallback_model=SeasonalNaive(season_length=52),
)
forecast_df = sf.forecast(df=panel, h=horizon)
```

**Nota de alineación de frecuencias:**
- `date_trunc('week')` en DuckDB → lunes → usar `W-MON` en pandas/StatsForecast
- `date_trunc('month')` en DuckDB → primer día del mes → usar `MS` (Month Start), NO `M` ni `ME`
- `date_trunc('quarter')` → usar `QS`

### Analytics endpoint

`GET /api/datasets/demo/analyze-category` — análisis vectorizado de categoría:
- Soporta `freq=W` (semanal, máx 52) y `freq=M` (mensual, máx 24)
- Hold-out configurable (parámetro `horizon`)
- Retorna WAPE/BIAS por segmento ABC-XYZ + top/bottom 20 SKUs para drill-down
- Solo disponible en tier `local` o `ec2` (requiere grupo `heavy-ml`)

### Tiers de servidor

| Tier | SERVER_TIER | Modelos disponibles | Analytics |
|------|-------------|--------------------|---------  |
| PC dev | `local` | MA + HW + SARIMA + LightGBM | ✅ |
| AWS EC2 | `ec2` | MA + HW + SARIMA | ❌ (sin heavy-ml) |
| Cloud (Vercel) | `cloud` | — (solo frontend) | ❌ |

El tier se detecta via `GET /api/capabilities` y se muestra como chip en el header del dashboard.

### Clustering ABC-XYZ → modelo por segmento

```
A-X (alto volumen, baja variabilidad)   → Holt-Winters (ETS)
A-Z (alto volumen, alta variabilidad)   → LightGBM (MLForecast)
B-X, B-Y                                → AutoETS
B-Z, C-Z (baja rotación, intermitente) → Croston / TSB
C-X, C-Y                                → Seasonal Naive (baseline)
```

---

## Fase 10 — Dataset Sintético Masivo

> ✅ Completa. Dataset en Cloudflare R2.

### Especificación

```
Archivo:    ventas_25k_skus.parquet
Formato:    Parquet (archivo único, sin chunks)
Tamaño:     256 MB
Alojado:    Cloudflare R2 (egress gratuito)
URL pública: https://pub-d0a335fad6124970951095c7dce170c3.r2.dev/ventas_25k_skus.parquet

Columnas: sku_id, categoria, canal, fecha, ventas, precio, stock, cluster_abc, cluster_xyz
Rango:    2022-01-01 → 2024-12-31 (3 años diarios)
SKUs:     ~25.000 (5 categorías: Electronica, Alimentos, Indumentaria, Hogar, Deportes)
```

---

## Fase 11 — PySpark Local (Docker)

> ⏳ Pendiente.

### Cuándo Spark vs Polars

```
Polars  → hasta ~100M filas en una sola máquina, latencia baja
Spark   → >100M filas, o distribución real entre nodos

Para forecastiq: 27M filas → Polars es suficiente.
Spark se incluye para el caso de uso distribuido explícito en portafolio.
```

### Stack Docker

```yaml
# docker-compose.spark.yml
services:
  spark-master:
    image: bitnami/spark:3.5
    ports: ["8080:8080", "7077:7077"]
  spark-worker-1:
    image: bitnami/spark:3.5
    environment:
      SPARK_MODE: worker
      SPARK_MASTER_URL: spark://spark-master:7077
      SPARK_WORKER_MEMORY: 2G
```

---

## Fase 12 — Airflow (Orquestación Batch)

> ⏳ Pendiente.

### DAGs planeados

```
forecast_batch_daily  (cron: 0 2 * * *)
    1. sensor: Parquet actualizado en R2
    2. nixtla_forecast_task: StatsForecast sobre todos los SKUs
    3. save_results_task: guardar en Supabase
    4. notify_task: log de éxito + métricas

drift_check_weekly  (cron: 0 6 * * 1)
    1. evidently_report_task: generar HTML report
    2. threshold_check_task: WAPE drift > 5%? → alerta
```

---

## Fase 13 — Data Warehouse (BigQuery + dbt)

> ⏳ Pendiente.

### Arquitectura Lakehouse

```
Raw layer     → Cloudflare R2 (Parquet) — source of truth
Serving layer → BigQuery free tier — análisis ad-hoc
Transform     → dbt — modelos SQL versionados
```

---

## Fase 14 — Infra as Code (Terraform + Kubernetes)

> ⏳ Pendiente.

### Stack planeado

```hcl
# infra/terraform/
# aws.tf     → EC2 + security groups
# vercel.tf  → proyecto + env vars
```

```yaml
# infra/k8s/
# api/deployment.yaml    → FastAPI (HPA CPU 70%)
# worker/deployment.yaml → Celery worker
# ingress.yaml           → nginx + TLS
```

---

## Backlog — Fuentes de datos

### Estado actual

| Fuente | Estado | Notas |
|--------|--------|-------|
| CSV Upload (≤10 MB) | ✅ Funciona | Supabase Storage |
| Dataset Demo 25k SKUs | ✅ Funciona | Cloudflare R2 + DuckDB |
| Conectar DB (PostgreSQL/MySQL/SQLite) | ✅ Funciona | Conexión efímera, solo SELECT |
| Parquet upload (local) | 🔜 Backlog | Solo modo local/ec2 |
| BigQuery / Snowflake | ⏳ Fase 13 | — |
| S3 / R2 directo | ⏳ Backlog | — |

### Notas sobre Storage

- **Supabase Storage**: para CSVs de usuario (pequeños, <10 MB). Cuidado con egress.
- **Cloudflare R2**: para archivos grandes estáticos (Parquet demo). Egress gratuito.
- **Regla**: nunca subir archivos >50 MB a Supabase Storage.

---

## Auth — Estado actual (mayo 2026)

| Feature | Estado | Notas |
|---------|--------|-------|
| Google OAuth | ✅ Funciona en prod | Better Auth + Supabase |
| GitHub OAuth | ✅ Funciona en prod | Better Auth + Supabase |
| Login invitado (anonymous) | ⚠️ En investigación | 404 en Vercel — posible problema de DB schema |
| Session management | ✅ Funciona | Cookie-based, Better Auth |

**Tablas DB necesarias para Better Auth** (migration 006):
`user`, `session`, `account`, `verification` — con columna `isAnonymous` en `user`.

**Variables de entorno requeridas en Vercel:**
- `BETTER_AUTH_SECRET` — firmar sesiones
- `BETTER_AUTH_URL` — `https://forecastiq.vercel.app`
- `NEXT_PUBLIC_APP_URL` — `https://forecastiq.vercel.app`
- `DATABASE_URL` — PostgreSQL de Supabase (session pooler puerto 5432)

---

_Última actualización: 2026-05-24 — Migración Parquet a Cloudflare R2, Better Auth anonymous en investigación._
