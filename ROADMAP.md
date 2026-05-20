# ROADMAP.md — forecastiq Enterprise Roadmap

> Documento de referencia para las Fases 7.5 a 14.
> El TODO.md mantiene el tracking operativo (tareas, checkboxes, session log).
> Este archivo es la **visión y las decisiones de arquitectura** ya cerradas para cada fase.
>
> **Claude: leer este archivo cuando se trabaje en Fases 7.5 en adelante.**

---

## Índice

| Fase                                                | Nombre                    | Estado       | Prioridad                             |
| --------------------------------------------------- | ------------------------- | ------------ | ------------------------------------- |
| [7.5](#fase-75--ui-polish--rate-limiting)           | UI Polish + Rate Limiting | 🔄 En curso  | Alta — portfolio + protección Railway |
| [8](#fase-8--mlops-mlflow--evidently-ai)            | MLOps                     | ⏳ Pendiente | Alta — diferenciador técnico          |
| [9](#fase-9--scale-engine-nixtla--polars)           | Scale Engine              | ⏳ Pendiente | Alta — 25k SKUs                       |
| [10](#fase-10--dataset-sintético-masivo)            | Dataset Sintético         | ⏳ Pendiente | Media — combustible para 11-13        |
| [11](#fase-11--pyspark-local-docker)                | PySpark Local             | ⏳ Pendiente | Media — portafolio data engineering   |
| [12](#fase-12--airflow-orquestación-batch)          | Airflow                   | ⏳ Pendiente | Media — orquestación enterprise       |
| [13](#fase-13--data-warehouse-bigquery--dbt)        | Data Warehouse            | ⏳ Pendiente | Baja — showcase analítico             |
| [14](#fase-14--infra-as-code-terraform--kubernetes) | Infra as Code             | ⏳ Pendiente | Baja — showcase devops                |

---

## Fase 7.5 — UI Polish + Rate Limiting

> **Objetivo:** Interfaz de nivel SaaS profesional apta para demostraciones en LinkedIn/portfolio.
> Protección del backend Railway contra uso abusivo (proyecto público sin concurrencia esperada alta).

### Contexto de decisión

El frontend fue construido fase a fase priorizando funcionalidad. Es correcto y funciona, pero
visualmente no refleja la calidad del stack técnico subyacente. Antes de avanzar al roadmap
enterprise, hay que elevar el diseño al nivel de lo que se muestra.

Railway tiene recursos limitados (hobby plan: 512 MB RAM, 1 vCPU). El repo es público y
cualquiera puede usar la app. Sin rate limiting en uploads y forecasts, un script malicioso
puede agotar Storage y CPU en minutos.

### Decisiones cerradas

**Rate limiting por endpoint:**

| Endpoint                    | Límite      | Ventana          | Razón                                |
| --------------------------- | ----------- | ---------------- | ------------------------------------ |
| `POST /api/datasets/upload` | 5 uploads   | 1 hora / IP      | Storage Supabase free = 1 GB total   |
| `POST /api/forecast/run`    | 10 jobs     | 1 hora / IP+user | ML es el recurso más caro en Railway |
| `POST /api/chat`            | 30 mensajes | 1 hora / IP+user | Ya implementado                      |
| `GET *`                     | sin límite  | —                | Solo lectura, barato                 |

Implementación: extender `redis_cache.py` (ya existe) con `UPLOAD_RATE_KEY_PREFIX` y
`FORECAST_RATE_KEY_PREFIX`. Misma lógica de ventana fija que el rate limit de chat.

**Frontend — arquitectura de componentes nueva:**

```Plaintext
frontend/components/
  layout/          ← NUEVO: Sidebar, Topbar, UserBadge (extraer de dashboard/layout.tsx)
  upload/          ← EXISTE: DropZone, DataPreview, ColumnSelector (renombrar de ui/)
  dataset/         ← NUEVO: DataSourceTabs, DemoDatasetCard, ConnectionStringForm
  forecast/        ← EXISTE: ForecastChart, MetricsCard, ModelBadge
  chat/            ← EXISTE: ChatBox, MessageBubble, ModelSelector
  landing/         ← NUEVO: HeroSection, FeatureGrid, DemoEmbed (Fase 7.5 o post-MVP)
  mlops/           ← NUEVO: DriftCard, ExperimentTable, MLflowLink (Fase 8)

frontend/lib/
  motion.ts        ← NUEVO: constantes de animación MUI (durations, easings)
```

**Páginas a rediseñar (en orden de prioridad):**

1. **Login** — split layout: panel izquierdo (gradient + logo grande + tagline + feature bullets),
   panel derecho (card blanca con OAuth buttons). Mobile: solo panel derecho.
   Logo: `frontend/public/logo.png` → componente `<Image>` de Next.js.

2. **Sidebar (dashboard/layout.tsx)** — reemplazar texto "forecastiq" por logo PNG.
   Mantener estructura actual, solo elevar visual.

3. **Dataset page** — stepper de 3 tabs:
   - Tab 1: `📄 Subir CSV` (DropZone actual, sin cambios funcionales)
   - Tab 2: `🎲 Dataset demo` (seleccionar desde datasets pre-cargados en Supabase Storage)
   - Tab 3: `🔌 Conectar DB` (placeholder UI — funcionalidad en backlog enterprise)

4. **Landing page (`app/page.tsx`)** — actualmente redirige a `/dashboard/dataset`.
   Convertir en landing pública con hero + features + CTA. (Puede hacerse post demo si el tiempo apremia.)

### Consideraciones técnicas

- `logo.png` en `frontend/public/` → usar siempre `<Image src="/logo.png" ...>` de `next/image`
  (optimización automática WebP + lazy loading).
- Todos los colores via tokens MUI del `theme.ts`. Nunca hardcoded.
- Todos los espaciados en `rem`. Ver tabla de referencia en `CLAUDE.md`.
- Animaciones con `sx={{ transition: 'all 0.2s ease' }}` — no depender de librerías externas.

---

## Fase 8 — MLOps (MLflow + Evidently AI)

> **Objetivo:** Tracking reproducible de experimentos ML + detección automática de data drift.

### Stack decidido

```Plaintext
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

MLflow Tracking Server:
  - Local: localhost:5000 (SQLite backend)
  - Prod:  Railway service separado (PostgreSQL backend via Supabase DB)

Model Registry:
  - Local: SQLite
  - Prod:  PostgreSQL (misma DB Supabase, schema mlflow_*)
```

### Endpoints nuevos

```Plaintext
GET  /api/drift/{dataset_id}     → drift score por columna (JSON)
GET  /api/experiments            → lista de runs MLflow del usuario
GET  /api/experiments/{run_id}   → detalle de un run (params + métricas)
```

### Alerta automática de drift

Si WAPE del forecast más reciente sube >5% respecto al promedio de los últimos 5 runs:

1. Log estructurado con `structlog` (campo `drift_alert=True`)
2. Sentry event con severity `warning`
3. (Futuro) Email al usuario via Resend/SendGrid

### Frontend — componentes nuevos (`components/mlops/`)

- `DriftCard` — badge por columna: verde/amarillo/rojo según drift score
- `ExperimentTable` — tabla de runs con WAPE, modelo, fecha, link a MLflow UI
- `MLflowLink` — botón que abre el MLflow UI deployado (o localhost en dev)

### Railway considerations

MLflow server como servicio separado en Railway:

- Imagen: `ghcr.io/mlflow/mlflow:latest`
- Puerto: 5000 interno, expuesto solo al backend (private networking)
- Storage de artefactos: Supabase Storage (via S3-compatible API de Supabase)
- `MLFLOW_TRACKING_URI=http://mlflow-service:5000` en Railway backend service

---

## Fase 9 — Scale Engine (Nixtla + Polars)

> **Objetivo:** Procesar 25k SKUs en minutos. Demostrar que el stack escala.
> Referencia de industria: lo que usa Mercado Libre, Rappi para planificación de demanda.

### Decisión arquitectural: DuckDB + Supabase Storage

El Parquet de 25k SKUs (~180 MB) vive en **Supabase Storage**, no en Railway ni en PostgreSQL.

```python
# DuckDB lee columnas específicas directamente desde la URL firmada
# No descarga el archivo completo — pushdown de predicados y columnas
import duckdb

signed_url = supabase.storage.from_("datasets").create_signed_url(
    "ventas_25k_skus.parquet", expires_in=3600
)["signedURL"]

df = duckdb.execute(
    "SELECT fecha, ventas FROM read_parquet(?) WHERE sku_id = ?",
    [signed_url, sku_id]
).pl()  # retorna Polars DataFrame directamente
```

Esto resuelve el problema de RAM en Railway hobby (512 MB): DuckDB usa columnar pushdown
y solo descarga los row groups necesarios del Parquet remoto.

### Pipeline Nixtla vectorizado

```python
from statsforecast import StatsForecast
from statsforecast.models import AutoETS, AutoARIMA, SeasonalNaive
import polars as pl

# Formato panel estándar Nixtla
df = pl.read_parquet("ventas_25k_skus.parquet")  # o via DuckDB desde Storage
panel = df.rename({"sku_id": "unique_id", "fecha": "ds", "ventas": "y"})

# Un solo call procesa todos los SKUs en paralelo (Numba + C internamente)
sf = StatsForecast(
    models=[AutoETS(), AutoARIMA(), SeasonalNaive(season_length=7)],
    freq="D",
    n_jobs=-1  # todos los CPUs disponibles
)
forecast_df = sf.forecast(df=panel, h=30)
# → ~5 min para 25k SKUs vs ~4 hs con statsmodels loop
```

### Clustering ABC-XYZ → modelo por segmento

```Plaintext
A-X (alto volumen, baja variabilidad)  → Holt-Winters (ETS)
A-Z (alto volumen, alta variabilidad)  → LightGBM (MLForecast)
B-X, B-Y                               → AutoETS
B-Z, C-Z (baja rotación, intermitente) → Croston / TSB
C-X, C-Y                               → Seasonal Naive (baseline)
```

El clustering ya está calculado en el script de generación del dataset
(`cluster_abc`, `cluster_xyz` columnas en el Parquet).

### Celery Beat — batch nocturno

```python
# celery_app.py — schedule
CELERYBEAT_SCHEDULE = {
    "nightly-reforecast": {
        "task": "app.services.celery_app.batch_reforecast",
        "schedule": crontab(hour=2, minute=0),  # 02:00 AR (UTC-3)
    }
}
```

El job nocturno re-forecasta todos los SKUs del dataset demo y guarda resultados
en Parquet en Supabase Storage (no JSONB — más eficiente para miles de series).

### Benchmark requerido

Script `scripts/benchmark_models.py` que compara sobre el mismo dataset de 1k SKUs:

- `statsmodels` (loop, actual)
- `StatsForecast` (Nixtla vectorizado)
- `MLForecast` + LightGBM (global model)

Output: tabla markdown con tiempo de ejecución + WAPE por segmento.

---

## Fase 10 — Dataset Sintético Masivo

> **Objetivo:** Generar el combustible para las Fases 11-13.
> Script standalone — no modifica la app.

### Especificación del dataset

```Plaintext
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
| Indumentaria | 0% (moda) | Primavera/Otoño fuertes | Moderada                    | 5%      |
| Hogar        | +2%/año   | Fin de año              | Baja                        | 15%     |
| Deportes     | +5%/año   | Verano + Año Nuevo      | Fines de semana             | 10%     |

### Script

`scripts/generate_massive_dataset.py` — ya creado en Fase 6/7.
Output va a `data/` (gitignored — archivo demasiado grande para el repo).
Upload manual a Supabase Storage bucket `datasets/` como `ventas_25k_skus.parquet`.

---

## Fase 11 — PySpark Local (Docker)

> **Objetivo:** Demostrar conocimiento de Spark sobre datos reales. Todo local con Docker.
> Contexto para portfolio: "sé cuándo usar Spark vs Polars, y lo demuestro con código".

### Cuándo Spark vs Polars (decisión documentada)

```Plaintext
Polars  → hasta ~100M filas en una sola máquina, latencia baja, API más ergonómica
Spark   → >100M filas O necesitás distribución real O el job debe escalar horizontalmente
          O el equipo ya usa Databricks/EMR y la infra existe

Regla práctica para este proyecto:
  - Dataset de 25k SKUs × 3 años (~27M filas) → Polars es suficiente y más rápido
  - Spark se usa aquí para APRENDER y MOSTRAR la habilidad, no porque sea necesario
```

### Stack Docker

```yaml
# docker-compose.spark.yml
services:
  spark-master:
    image: bitnami/spark:3.5
    environment:
      - SPARK_MODE=master
    ports:
      - "8080:8080" # Spark UI
      - "7077:7077" # Master port

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

### Notebook PySpark

`notebooks/spark_forecast_pipeline.ipynb`:

1. Leer Parquet desde Supabase Storage (o local)
2. Feature engineering distribuido: lag-7, lag-30, rolling mean 7/30, day_of_week, month
3. Forecast por partición (`mapPartitions` sobre `unique_id`) con modelo LightGBM local
4. Escribir resultado en Parquet particionado por `categoria/fecha`
5. Comparativa de tiempos: Pandas vs Polars vs Spark (tabla en el notebook)

---

## Fase 12 — Airflow (Orquestación Batch)

> **Objetivo:** Orquestar el pipeline completo con el estándar de la industria.
> DAGs reproducibles, monitoreables, con retry automático.

### DAGs

```Plaintext
forecast_batch_daily  (cron: 0 2 * * *)
    1. sensor: esperar que Supabase Storage tenga el Parquet actualizado
    2. download_parquet_task: descarga incremental (solo SKUs con nuevos datos)
    3. nixtla_forecast_task: StatsForecast sobre todos los SKUs
    4. save_results_task: guardar Parquet de resultados en Storage
    5. notify_task: log estructurado de éxito + métricas de calidad

drift_check_weekly  (cron: 0 6 * * 1)
    1. load_recent_data_task: últimas 4 semanas por SKU
    2. evidently_report_task: generar HTML report
    3. threshold_check_task: WAPE drift > 5%? → Sentry event
    4. upload_report_task: guardar HTML en Storage

mlflow_cleanup_monthly  (cron: 0 0 1 * *)
    1. list_old_runs_task: runs de MLflow > 90 días
    2. archive_runs_task: mover artefactos a cold storage
    3. delete_runs_task: eliminar runs del tracking server
```

### Stack local

```yaml
# docker-compose.airflow.yml — CeleryExecutor
# Usa el mismo Redis de la app como broker
# PostgreSQL de Supabase como metadata DB de Airflow
```

### Comparativa documentada (para el README de la fase)

| Orquestador | Cuándo usarlo                                  | Ventaja                     | Desventaja                           |
| ----------- | ---------------------------------------------- | --------------------------- | ------------------------------------ |
| Celery Beat | Jobs simples, misma codebase                   | Ya instalado, sin overhead  | No tiene UI, difícil de monitorear   |
| Airflow     | Pipelines complejos, dependencias entre tareas | UI, retry, SLA, sensors     | Heavy (PostgreSQL + Redis + workers) |
| Prefect     | Equipos modernos, Python-native                | UI cloud, fácil de aprender | Vendor lock-in en cloud              |

---

## Fase 13 — Data Warehouse (BigQuery + dbt)

> **Objetivo:** Conectar forecastiq a un DWH real. Practicar SQL analítico y arquitectura Lakehouse.
> Showcase para roles de Data Engineer / Analytics Engineer.

### Arquitectura Lakehouse

```Plaintext
Raw layer     → Supabase Storage (Parquet) — source of truth, inmutable
Serving layer → BigQuery free tier — análisis ad-hoc, dashboards
Transform     → dbt — modelos SQL versionados, tests de calidad

Flujo:
  Parquet en Storage
      → script Python (google-cloud-bigquery client)
      → tabla raw en BigQuery (ventas, forecasts, drift_reports)
      → dbt transforma
      → tablas marts (fct_forecast_accuracy, mart_abc_xyz)
      → endpoint FastAPI /api/dw/query ejecuta queries analíticas
```

### dbt models

```sql
-- stg_ventas: limpieza y tipado
-- fct_forecast_accuracy: WAPE/MAE/BIAS por SKU, modelo, semana
-- mart_abc_xyz: tabla de clasificación con métricas de negocio
-- mart_otif: simulación On Time In Full por SKU
```

### BigQuery free tier

- 10 GB storage + 1 TB queries/mes — suficiente para el portfolio
- Alternativa Snowflake: trial 30 días con $400 crédito (para comparar en el README)
- Alternativa Databricks Community: Spark + MLflow + Delta Lake (lakehouse completo)

---

## Fase 14 — Infra as Code (Terraform + Kubernetes)

> **Objetivo:** Documentar y codificar toda la infraestructura.
> Showcase para roles de Platform/DevOps/MLOps Engineer.

### Terraform

```hcl
# infra/terraform/
# railway.tf    → Railway services + variables (via railway provider)
# supabase.tf   → proyecto Supabase + storage buckets
# vercel.tf     → proyecto Vercel + env vars
```

### Kubernetes

```yaml
# infra/k8s/
# api/deployment.yaml       → FastAPI (3 replicas, HPA CPU 70%)
# worker/deployment.yaml    → Celery worker (2 replicas)
# mlflow/deployment.yaml    → MLflow server
# ingress.yaml              → nginx-ingress con TLS
# hpa.yaml                  → HorizontalPodAutoscaler
```

### Helm chart

Chart completo en `infra/helm/forecastiq/` con values.yaml parametrizable.
Permite `helm install forecastiq ./infra/helm/forecastiq -f values.prod.yaml`.

### Escalado documentado

```Plaintext
Railway (hoy)     → 1 API + 1 Worker + Redis · hobby plan · suficiente para portfolio
K8s en GKE/EKS    → cuando MRR > $1k o necesitás >10 req/s sostenidos
  - API: HPA 2-10 pods basado en CPU
  - Worker: HPA 1-5 pods basado en queue depth (Celery metric)
  - Redis: managed (Upstash o GCP Memorystore)
  - Supabase: mismo — no hay razón de migrar hasta escala muy grande
```

---

## Backlog — Fuentes de datos (Dataset page)

> Estas features expanden cómo los usuarios conectan sus datos.
> Diseñadas en la sesión del 2026-05-19.

### Tab 1: CSV Upload (actual)

- Límite actual: 10 MB → elevar a 50 MB (dentro del free tier de Supabase Storage)
- Agregar validación de columnas mínimas con mensaje de error amigable
- Auto-mapping de columnas con LLM (backlog post-MVP)

### Tab 2: Dataset Demo (Fase 9)

- Dataset "Ventas 25k SKUs — 3 años diarios" disponible para todos los usuarios
- Backend: DuckDB lee desde Supabase Storage via URL firmada (no descarga 180 MB)
- Usuario elige un SKU o categoría desde el frontend → forecast sobre esa serie
- Rate limit especial: 20 forecasts/hora sobre el dataset demo (más permisivo que uploads)

### Tab 3: Conexión directa DB (Backlog Enterprise)

- Soportar: PostgreSQL, BigQuery, Snowflake, S3/Parquet
- Connection string ingresada por el usuario → **efímera, nunca persistida**
- El backend la usa para una query, descarta la conexión inmediatamente
- No se guarda en Supabase, no se loguea, no aparece en traces de OTel
- UI: form con connection string + query SQL + botón "Probar conexión"
- Consideración de seguridad: validar que la query sea un SELECT (no DDL/DML)

---

## Quick Start Local — Referencia

> Para que cualquier persona pueda levantar la app desde cero en ~5 minutos.
> Documentado acá para mantener el README conciso.

### Prerrequisitos mínimos

- Python 3.12+ · Node.js 20+ · [UV](https://astral.sh/uv) · Docker (solo para Redis)
- Cuenta Supabase (free) · API key OpenRouter (free)

### Variables de entorno mínimas para desarrollo local

El único servicio externo **obligatorio** es Supabase (DB + Storage).
Redis puede correr local con Docker. OpenRouter es opcional (el chat no funciona sin key).

```bash
# backend/.env — mínimo para que arranque
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres
UPSTASH_REDIS_URL=http://localhost:6379   # Redis local via Docker
UPSTASH_REDIS_TOKEN=                      # vacío en local
BETTER_AUTH_URL=http://localhost:3000
JWT_SECRET_KEY=dev-secret-change-in-prod  # cualquier string en local
# Opcional:
OPENROUTER_API_KEY=sk-or-...             # sin esto el chat no funciona
```

```bash
# frontend/.env.local — mínimo
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
BETTER_AUTH_SECRET=dev-secret-change-in-prod
BETTER_AUTH_URL=http://localhost:3000
```

### Comandos — arrancar en 5 pasos

```bash
# 1. Clonar
git clone https://github.com/nicobravo/forecastiq.git && cd forecastiq

# 2. Redis local
docker run -d -p 6379:6379 redis:alpine

# 3. Backend
cd backend
cp .env.example .env          # completar SUPABASE_* y JWT_SECRET_KEY
uv sync                        # instala todas las dependencias
uv run uvicorn app.main:app --reload --port 8000

# 4. Celery worker (terminal separada)
cd backend
uv run celery -A app.services.celery_app.celery_app worker --loglevel=info

# 5. Frontend (terminal separada)
cd frontend
cp .env.example .env.local    # completar NEXT_PUBLIC_SUPABASE_* y BETTER_AUTH_*
npm install
npm run dev
# → http://localhost:3000
```

### Migraciones Supabase (una sola vez)

Ejecutar en orden en el SQL Editor del Dashboard de Supabase:

1. `backend/migrations/001_forecast_jobs.sql`
2. `backend/migrations/002_events.sql`
3. `backend/migrations/003_add_user_id.sql`

---

_Última actualización: 2026-05-19 — Sesión 21 — Documento creado._
_Próxima actualización: al completar Fase 7.5 (UI Polish)._
