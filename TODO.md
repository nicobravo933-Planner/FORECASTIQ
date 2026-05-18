# TODO.md — forecastiq

> **Claude: read this file at the start of every session.**
> Update task status as work progresses. Never skip phases — complete current phase before starting next.

---

## 🗺️ Phase Overview

| Phase  | Name                             | Status            | Goal                                        |
| ------ | -------------------------------- | ----------------- | ------------------------------------------- |
| **0**  | Foundation                       | ✅ Done           | Repo + env + CI green                       |
| **1**  | Data ingestion + model detection | ✅ Done           | Upload CSV → auto-select model              |
| **2**  | Forecast engine                  | ✅ Done           | Real forecasts + charts                     |
| **3**  | Calendar of events               | ✅ Done           | Events → forecast impact                    |
| **4**  | AI Chat with streaming           | ✅ Done           | SSE chat about the data                     |
| **5**  | Auth + persistence               | ✅ Done           | OAuth2 + per-user history                   |
| **6**  | Deploy + CI/CD                   | ✅ Done           | Full prod CI/CD + Railway + Vercel          |
| **7**  | Observability                    | 🔄 Next           | OpenTelemetry + Grafana LGTM + Sentry       |
| **8**  | MLOps                            | ⏳ Pending        | MLflow tracking + Evidently drift detection |
| **9**  | Scale Engine                     | ⏳ Pending        | Nixtla vectorizado + Polars + batch         |
| **10** | Dataset sintético masivo         | ⏳ Pending        | Script 25k SKUs → Parquet ~180 MB           |
| **11** | PySpark local                    | ⏳ Pending        | PySpark sobre dataset enterprise en Docker  |
| **12** | Airflow                          | ⏳ Pending        | Orquestación batch nocturno con DAGs        |
| **13** | Data Warehouse                   | ⏳ Pending        | BigQuery free tier o Snowflake trial        |
| **14** | Infra as Code                    | ⏳ Pending        | Terraform + Kubernetes manifests            |

---

## Phase 6 — Deploy + Observability

> Goal: everything in production, CI/CD fully automated

### Infrastructure

- [x] `.github/workflows/deploy.yml` — build + push Docker image a ghcr.io + Railway deploy
- [x] Railway deployment configurado (forecastiq-api + forecastiq-worker + Redis)
- [x] Vercel deployment configurado (frontend — auto via GitHub integration)
- [x] Railway Redis conectado en producción (private networking)
- [x] Variables de entorno seteadas en Railway + Vercel
- [x] `railway.toml` — config as code (Dockerfile path + healthcheck)
- [x] `frontend/vercel.json` — output directory Next.js
- [x] Google OAuth callback URL actualizada para producción

### Observability

- [ ] Sentry DSN configurado (backend + frontend)
- [ ] Structured logging en producción (JSON format → Railway logs)
- [ ] Health check endpoint monitoreado (Railway auto-restart on failure)
- [ ] OpenTelemetry básico (forecast job duration, LLM latency)

### Documentation

- [x] README.md actualizado con live demo URL + URLs de producción + badge "live"
- [ ] `CONTRIBUTING.md` para open source contributors
- [ ] API docs públicas (FastAPI `/docs` — ya disponible en prod)

### Done when

- [x] `git push main` → CI pasa → Railway + Vercel despliegan automáticamente
- [x] Live URL accesible desde cualquier dispositivo
- [x] Login con Google funciona en producción
- [ ] Sentry captura errores en producción
- [ ] README tiene badge CI verde + live demo link

---

---

## Phase 7 — Observability (OpenTelemetry + Grafana + Sentry)

> Goal: visibilidad production-grade sobre logs, métricas, trazas y errores.
> Stack: structlog + OpenTelemetry → Grafana Cloud (Loki + Tempo + Mimir) + Sentry free tier.
> Referencia: lo que usa Mercado Libre, Rappi, cualquier empresa de tecnología seria.

### Nivel 1 — Structured Logging + Métricas base

- [ ] `structlog` configurado en FastAPI — logs JSON con campos: `request_id`, `user_id`, `duration_ms`, `endpoint`
- [ ] Middleware de logging: cada request loguea método, path, status, duración
- [ ] `/metrics` endpoint con `prometheus-fastapi-instrumentator` (Prometheus scrape)
- [ ] Logs de Celery worker en JSON estructurado
- [ ] Variables de entorno: `LOG_LEVEL`, `LOG_FORMAT` (json | pretty)

### Nivel 2 — OpenTelemetry → Grafana Cloud

- [ ] OpenTelemetry SDK instalado (`opentelemetry-sdk`, `opentelemetry-exporter-otlp`)
- [ ] Auto-instrumentación FastAPI (`opentelemetry-instrumentation-fastapi`)
- [ ] Traces: cada forecast job como span con atributos (model, dataset_id, duration)
- [ ] Traces: cada llamada LLM como span (provider, model, tokens, latency)
- [ ] Grafana Cloud free tier configurado (account + API key)
- [ ] OTLP exporter apuntando a Grafana Cloud (Loki para logs, Tempo para traces, Mimir para metrics)
- [ ] Dashboard Grafana: forecast jobs por usuario, latencia LLM por modelo, error rate por endpoint
- [ ] Dashboard Grafana: top modelos usados, WAPE promedio, distribución horizontes

### Nivel 3 — Sentry

- [ ] Sentry free tier configurado (proyecto Python + proyecto Next.js)
- [ ] `sentry-sdk` integrado en FastAPI (captura excepciones + performance)
- [ ] `@sentry/nextjs` integrado en frontend
- [ ] `SENTRY_DSN` en `.env.example` (backend y frontend)
- [ ] Alertas configuradas: error rate > 1% en 5 min → email
- [ ] Variables Railway + Vercel actualizadas con DSNs

### Done when

- [ ] Dashboard Grafana público visible desde cualquier browser
- [ ] Sentry captura un error real en producción
- [ ] README Fase 7 actualizado con screenshot del dashboard

---

## Phase 8 — MLOps (MLflow + Evidently AI)

> Goal: tracking de experimentos ML reproducible + detección automática de data drift.
> Stack: MLflow (local o Railway) + Evidently AI + alertas vía Grafana.

- [ ] MLflow server en Docker (local) y Railway (prod)
- [ ] Cada run de forecast registrado en MLflow: params, métricas (WAPE/MAE/BIAS), artefactos
- [ ] Model Registry: versionar modelos entrenados por dataset
- [ ] Evidently AI: reporte de data drift por SKU (comparar distribución histórica vs últimas semanas)
- [ ] Endpoint `GET /api/drift/{dataset_id}` → devuelve drift score por columna
- [ ] Alerta automática si WAPE sube >5% respecto a baseline → log estructurado + Sentry event
- [ ] Dashboard MLflow embebido o linkeado desde la UI de ForecastIQ
- [ ] `MLFLOW_TRACKING_URI` en config.py + .env.example

---

## Phase 9 — Scale Engine (Nixtla + Polars + Batch)

> Goal: procesar 25k SKUs en minutos, no horas. Reemplazar statsmodels por Nixtla.
> Stack: StatsForecast + MLForecast (Nixtla) + Polars + Celery Beat (batch nocturno).

- [ ] Migrar pipeline a `StatsForecast` (Nixtla) — formato panel `unique_id/ds/y`
- [ ] Reemplazar pandas por Polars en ingesta y pre-procesamiento
- [ ] Global Model con `MLForecast` + LightGBM sobre todos los SKUs simultáneamente
- [ ] Clustering ABC-XYZ: asignar modelo por segmento (A-X→HW / A-Z→LGB / C-Z→Naive)
- [ ] Croston/TSB para SKUs intermitentes (demanda esporádica con muchos ceros)
- [ ] Celery Beat: job batch nocturno que re-forecasta todos los SKUs del usuario
- [ ] Resultados guardados en Parquet en Supabase Storage (no JSONB)
- [ ] Benchmark: tiempo statsmodels vs Nixtla sobre mismo dataset de 1k SKUs

---

## Phase 10 — Dataset Sintético Masivo

> Goal: generar un dataset realista de 25k SKUs con historia diaria de 3 años (~27M filas)
> para usar como combustible en las fases 11-13.
> Script standalone: no modifica la app, corre en local.

- [x] Script `scripts/generate_dataset.py` creado y documentado
- [ ] Output: `data/ventas_25k_skus.parquet` (~180 MB, compresión Snappy)
- [ ] Columnas: `sku_id`, `categoria`, `canal`, `fecha`, `ventas`, `precio`, `stock`, `cluster_abc`, `cluster_xyz`
- [ ] Patrones realistas: tendencia + estacionalidad anual/semanal + ruido + outliers + ceros
- [ ] Clustering ABC-XYZ calculado en el script (por volumen y variabilidad)
- [ ] README del script con instrucciones de ejecución
- [ ] Upload a Supabase Storage (`datasets/` bucket) sin superar 400 MB del plan free

---

## Phase 11 — PySpark Local (Docker)

> Goal: practicar PySpark sobre el dataset de 25k SKUs. Todo corre local con Docker.
> No se necesita cluster — Spark standalone mode es suficiente para aprender.

- [ ] `docker-compose.spark.yml` — Spark master + 2 workers (imagen bitnami/spark)
- [ ] `notebooks/spark_forecast_pipeline.ipynb` — notebook PySpark con:
      - Lectura del Parquet de 25k SKUs
      - Feature engineering distribuido (lag features, rolling means)
      - Forecast por partición (mapPartitions sobre unique_id)
      - Escritura resultado en Parquet particionado por categoria/fecha
- [ ] Script `scripts/spark_benchmark.py` — compara tiempo Pandas vs Polars vs Spark
- [ ] Documentación: cuándo tiene sentido usar Spark vs Polars

---

## Phase 12 — Airflow (Orquestación Batch)

> Goal: orquestar el pipeline completo con Airflow — el estándar de la industria.
> DAGs: ingesta → validación → forecast → drift check → notificación.

- [ ] `docker-compose.airflow.yml` — Airflow con CeleryExecutor (local)
- [ ] DAG `forecast_batch_daily`: ingesta Parquet → Nixtla forecast → guardar resultados
- [ ] DAG `drift_check_weekly`: Evidently drift report → alerta si umbral superado
- [ ] DAG `mlflow_cleanup_monthly`: archiva runs viejos de MLflow
- [ ] Conexión Airflow → Supabase (via PostgresHook)
- [ ] Documentación: comparativa Airflow vs Prefect vs Celery Beat

---

## Phase 13 — Data Warehouse

> Goal: conectar ForecastIQ a un DWH real. BigQuery free tier o Snowflake trial.
> Practicar SQL analítico, dbt, y arquitectura Lakehouse.

- [ ] Cuenta BigQuery creada (free tier: 10 GB storage + 1 TB queries/mes)
- [ ] Dataset `forecastiq_demo` en BigQuery con tablas: `ventas`, `forecasts`, `drift_reports`
- [ ] Script de carga: Parquet → BigQuery via `google-cloud-bigquery` Python client
- [ ] dbt project básico: modelos `stg_ventas`, `fct_forecast_accuracy`, `mart_abc_xyz`
- [ ] Endpoint `GET /api/dw/query` — ejecuta query analítica en BigQuery y devuelve resultado
- [ ] Comparativa BigQuery vs Snowflake vs Databricks en README

---

## Phase 14 — Infra as Code (Terraform + Kubernetes)

> Goal: documentar y codificar toda la infraestructura. Kubernetes manifests para scale-out.
> Terraform para Railway + Supabase + Vercel (donde hay provider).

- [ ] `infra/terraform/` — Railway service + Supabase project + variables
- [ ] `infra/k8s/` — manifests: Deployment API, Deployment Worker, Service, Ingress, HPA
- [ ] Helm chart básico para ForecastIQ
- [ ] `infra/README.md` — arquitectura completa con diagrama
- [ ] Diagrama de arquitectura: local dev → Railway → K8s → AWS EKS

---

## Backlog (Post-MVP)

- [ ] Multiple time series support (all products simultaneously)
- [ ] CSV column auto-mapping with LLM assistance
- [ ] User-provided DB connection string (ephemeral, never stored)
- [ ] BYOK — user provides their own OpenRouter API key
- [ ] Export forecast to Excel / PDF
- [ ] Email notifications when long forecast job completes
- [ ] Kubernetes manifests (documentation for scale-out)
- [ ] Nix flake for reproducible ML environment
- [ ] Spanish / English i18n toggle

## Backlog — Escala Enterprise (25k SKUs tipo COTO)

> Estas tareas son para cuando forecastiq pase de series individuales a un pipeline
> de planificación de demanda masiva. No bloquean el MVP pero deben diseñarse bien.

### Motor ML a escala

- [ ] Migrar pipeline a `StatsForecast` + `MLForecast` (Nixtla) para procesamiento vectorizado
      (lo que statsmodels hace en 4hs, StatsForecast lo hace en 5min con Numba + C)
- [ ] Soporte de formato panel: columnas `unique_id`, `ds`, `y` (estándar Nixtla)
      → un solo request procesa todos los SKUs en paralelo
- [ ] Global Model: un único LightGBM entrenado sobre todos los SKUs (MLForecast)
      en lugar de un modelo por serie
- [ ] Clustering ABC-XYZ previo al forecast: asignar modelos por segmento
      (A-X: Holt-Winters / A-Z: LightGBM / C-Z: Naive)
- [ ] Croston / TSB para SKUs intermitentes (muchos ceros — típico en baja rotación)

### Optuna a escala ("pescar y mockear")

- [ ] Endpoint `POST /api/forecast/tune` — HPO pesado offline, guarda params en Supabase
      por `dataset_id` (correr cada 3-6 meses o ante data drift detectado)
- [ ] Batch diario reutiliza params guardados (`SELECT params FROM tuning_runs`)
      sin correr Optuna en cada forecast (de 30min a <5s)
- [ ] Monitor de Data Drift: calcular WAPE diario y alertar si se desvía >5% de media histórica
      → dispara re-tuning automático el fin de semana
- [ ] Tuning segmentado por clúster: 4-5 sets de hiperparámetros óptimos en lugar de uno global

### Métricas avanzadas

- [ ] FVA por SKU: tabla comparativa modelo vs Naive vs Seasonal Naive para benchmark
- [ ] OTIF (On Time In Full) simulado: % de semanas sin quiebre dado el forecast + stock actual
- [ ] Monto en riesgo: BIAS _ precio unitario _ volumen = ARS inmovilizados o ventas perdidas

### Infraestructura

- [ ] Job batch nocturno (Celery beat) para re-forecast automático de todos los SKUs
- [ ] Resultado en Parquet en Supabase Storage (más eficiente que JSONB para miles de series)
- [ ] API para conectar directamente a ERP/WMS (reemplaza subida manual de CSV)

---

## Session Log

| Date       | Session | Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-17 | 2       | CI verde en ambos jobs (backend + frontend). Fixes: ruff format, mypy lifespan type, ESLint config, unused import. Phase 0 cerrada.                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-17 | 3       | Phase 1 backend: supabase.py, detector.py (MAD+FFT+SeasonalMK+CV), datasets.py (3 endpoints), tests/unit/test_detector.py (11 tests), Dockerfile fix (uv.lock), pymannkendall dep.                                                                                                                                                                                                                                                                                        |
| 2026-05-17 | 4       | Fixes CI: ruff I001+F841+F401, pyproject readme field removido, deploy.yml deshabilitado (Railway directo desde repo). Dataset script + 3 CSVs mensuales con outliers.                                                                                                                                                                                                                                                                                                    |
| 2026-05-17 | 5       | Phase 1 frontend completo: dashboard layout (sidebar), DropZone, ColumnSelector, DataPreview, ModelRecommendation, useDataset hook, placeholders forecast/calendar/chat/settings. types.ts + api.ts patched.                                                                                                                                                                                                                                                              |
| 2026-05-17 | 6       | Phase 2 backend completo: base.py, evaluator.py (WAPE/MAE/BIAS/RMSE/MAPE), moving_average.py, holt_winters.py, sarima.py, lightgbm_model.py, celery_app.py, api/forecast.py (3 endpoints), supabase.py (+save/get forecast), migrations/001_forecast_jobs.sql. pmdarima agregado a pyproject.toml. .env.example separado en backend/ y frontend/. README.md actualizado.                                                                                                  |
| 2026-05-17 | 7       | Phase 2 frontend + fixes: useForecast.ts, HorizonSelector, ForecastChart (Recharts), MetricsCard, forecast/page.tsx. Fixes: Redis eager mode (\_update helper), pandas freq aliases (ME/QE/YE), Recharts tooltip array crash, selector modelo "auto". Phase 2 cerrada.                                                                                                                                                                                                    |
| 2026-05-17 | 8       | FVA agregado a evaluator.py (Seasonal Naive lag-12/lag-1), types.ts, ForecastMetrics Pydantic, MetricsCard con color semáforico. README actualizado Phase 2→Phase 3. Backlog Enterprise (25k SKUs COTO): Nixtla, Optuna offline, clustering ABC-XYZ, Croston, OTIF, Data Drift monitor.                                                                                                                                                                                   |
| 2026-05-17 | 9       | Fase 3 completa: migrations/002_events.sql, api/events.py (GET/POST/DELETE), services/events.py (CRUD+feriados AR via holidays), forecast.py +compare endpoint (post-processing multiplicativo), main.py router, pyproject.toml +holidays. Frontend: useEvents.ts, EventChip, ImpactBadge, EventForm (drawer), EventCalendar (pure MUI grid), calendar/page.tsx completa, toggle eventos en forecast/page.tsx, types.ts +ComparePoint. README y TODO purgados de Prophet. |
| 2026-05-17 | 10      | Fase 4 completa (backend + frontend): tools.py, tool_executor.py (DuckDB), openrouter.py (SSE+tool loop), client.py (system prompt dinámico), api/chat.py (SSE endpoint). Frontend: useChat.ts, ModelSelector, StreamingCursor, MessageBubble, ChatBox, QuickQuestions, chat/page.tsx. 7 modelos free actualizados. config.py default model actualizado. Fixes mypy+ruff (type-arg, N806, B007, F841).                                                                    |
| 2026-05-17 | 13      | Fix mypy: bool() en cache_set y cache_delete (redis_cache.py), isinstance(row, dict) en get_forecast_history (supabase.py). Backend Fase 5: dependencies.py (CurrentUser, get_current_user, get_optional_user, AuthUser, OptionalUser), supabase.py +get_forecast_history, api/me.py (GET /api/me + GET /api/me/history), main.py +me_router. mypy 34 archivos ✅                                                                                                         |
| 2026-05-17 | 14      | Migration 003_add_user_id.sql: tabla datasets (metadata CSVs + RLS por usuario), reemplazo policy pública de forecast_jobs por RLS user_id (con fallback user_id IS NULL para modo demo).                                                                                                                                                                                                                                                                                 |
| 2026-05-17 | 17      | Fase 5 cerrada. Settings page (modelo preferido + BYOK localStorage). api.ts propaga Bearer token al backend. dependencies.py reescrito: valida sesiones via Better Auth /api/auth/get-session (httpx). config.py +better_auth_url. .env.example backend actualizado. README badge Fase 5 done.                                                                                                                                                                           |
| 2026-05-18 | 18      | Fase 6 infraestructura completa: deploy.yml (CI→Docker→ghcr.io→Railway), railway.toml (config-as-code + healthcheck), Dockerfile.worker (Celery), frontend/vercel.json. Railway: 2 servicios + Redis privado. Vercel: deploy exitoso + Google OAuth callback URL prod. Login con Google funcionando en producción. README actualizado con live demo + URLs prod. |
| 2026-05-18 | 19      | Roadmap enterprise documentado: Fases 7-14 agregadas a TODO.md y CLAUDE.md. Script generate_massive_dataset.py creado (25k SKUs, 3 años diario, ~27M filas, Parquet Snappy). Stack: pandas+numpy+pyarrow, clustering ABC-XYZ, patrones realistas por categoría. |

---

_Update this file after every work session. Mark tasks `[x]` as completed._
