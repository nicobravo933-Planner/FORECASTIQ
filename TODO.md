# TODO.md — forecastiq

> **Claude: read this file at the start of every session.**
> Update task status as work progresses. Never skip phases — complete current phase before starting next.
> **Para detalles de arquitectura de Fases 7.5–14, leer ROADMAP.md.**

---

## 🗺️ Phase Overview

| Phase   | Name                             | Status     | Goal                                            |
| ------- | -------------------------------- | ---------- | ----------------------------------------------- |
| **0**   | Foundation                       | ✅ Done    | Repo + env + CI green                           |
| **1**   | Data ingestion + model detection | ✅ Done    | Upload CSV → auto-select model                  |
| **2**   | Forecast engine                  | ✅ Done    | Real forecasts + charts                         |
| **3**   | Calendar of events               | ✅ Done    | Events → forecast impact                        |
| **4**   | AI Chat with streaming           | ✅ Done    | SSE chat about the data                         |
| **5**   | Auth + persistence               | ✅ Done    | OAuth2 + per-user history                       |
| **6**   | Deploy + CI/CD                   | ✅ Done    | Full prod CI/CD + AWS EC2 + Vercel              |
| **7**   | Observability                    | ✅ Done    | OpenTelemetry + Grafana LGTM + Alloy            |
| **7.5** | UI Polish + Rate Limiting        | ✅ Done    | Diseño SaaS profesional + rate limits 429       |
| **8**   | MLOps                            | ✅ Done    | MLflow (Dagshub) + Evidently drift detection    |
| **9**   | Scale Engine                     | ✅ Done    | Nixtla vectorizado + Polars + batch             |
| **10**  | Dataset sintético masivo         | ✅ Done    | 27M filas Parquet → 6 chunks → Supabase Storage |
| **11**  | PySpark local                    | ✅ Done    | Docker Spark cluster + notebook + benchmark     |
| **12**  | Airflow                          | ⏳ Pending | Orquestación batch nocturno con DAGs            |
| **13**  | Data Warehouse                   | ⏳ Pending | BigQuery free tier o Snowflake trial            |
| **14**  | Infra as Code                    | ⏳ Pending | Terraform + Kubernetes manifests                |

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

## Phase 7 — Observability (OpenTelemetry + Grafana + Sentry)

> Goal: visibilidad production-grade sobre logs, métricas, trazas y errores.
> Stack: structlog + OpenTelemetry → Grafana Cloud (Loki + Tempo + Mimir) + Sentry free tier.
> Referencia: lo que usa Mercado Libre, Rappi, cualquier empresa de tecnología seria.

### Nivel 1 — Structured Logging + Métricas base

- [x] `structlog` configurado en FastAPI — logs JSON con campos: `request_id`, `user_id`, `duration_ms`, `endpoint`
- [x] Middleware de logging: cada request loguea método, path, status, duración
- [x] `/metrics` endpoint con `prometheus-fastapi-instrumentator` (Prometheus scrape)
- [x] Logs de Celery worker en JSON estructurado
- [x] Variables de entorno: `LOG_LEVEL`, `LOG_FORMAT` (json | pretty)

### Nivel 2 — OpenTelemetry → Grafana Cloud

- [x] OpenTelemetry SDK instalado (`opentelemetry-sdk`, `opentelemetry-exporter-otlp`)
- [x] Auto-instrumentación FastAPI (`opentelemetry-instrumentation-fastapi`)
- [x] Traces: cada forecast job como span con atributos (model, dataset_id, duration)
- [x] Traces: cada llamada LLM como span (provider, model, tokens, latency)
- [x] Grafana Cloud free tier configurado (account + API key)
- [x] Grafana Alloy deployado en Railway — scrape /metrics + push a Loki
- [x] OTLP exporter apuntando a Grafana Cloud (Tempo para traces)
- [x] Dashboard Grafana: CPU, memoria, GC collections, file descriptors
- [x] Dashboard URL: https://nicobravo933.grafana.net/goto/shcs6k?orgId=stacks-1651316

### Nivel 3 — Sentry

- [ ] Sentry free tier configurado (proyecto Python + proyecto Next.js)
- [ ] `sentry-sdk` integrado en FastAPI (captura excepciones + performance)
- [ ] `@sentry/nextjs` integrado en frontend
- [ ] `SENTRY_DSN` en `.env.example` (backend y frontend)
- [ ] Alertas configuradas: error rate > 1% en 5 min → email
- [ ] Variables Railway + Vercel actualizadas con DSNs

### Done when

- [x] Dashboard Grafana público visible desde cualquier browser
- [x] Métricas reales de producción en Grafana Cloud
- [x] OTel traces → Grafana Tempo (3 traces confirmados)
- [ ] Sentry captura un error real en producción
- [x] README Fase 7 actualizado

---

## Phase 7.5 — UI Polish + Rate Limiting

> Goal: interfaz SaaS profesional para portfolio + protección Railway de uso abusivo.
> Ver decisiones de arquitectura completas en **ROADMAP.md → Fase 7.5**.

### Rate Limiting (backend)

- [x] Extender `redis_cache.py`: `UPLOAD_RATE_LIMIT = 5` uploads/hora/IP
- [x] Extender `redis_cache.py`: `FORECAST_RATE_LIMIT = 10` jobs/hora/IP+user
- [x] Aplicar rate limit en `POST /api/datasets/upload` (datasets.py)
- [x] Aplicar rate limit en `POST /api/forecast/run` (forecast.py)
- [x] Respuesta 429 con header `Retry-After` y mensaje amigable en español

### Frontend — Rediseño Login

- [x] `app/(auth)/login/page.tsx` — split layout: panel izquierdo (gradient + logo + bullets) / panel derecho (card OAuth)
- [x] Logo PNG via `<Image src="/logo.png">` de `next/image` (ya en `public/`)
- [x] Mobile: colapsa a solo panel derecho (breakpoint `md`)

### Frontend — Sidebar

- [x] `dashboard/layout.tsx` — reemplazar texto "forecastiq" por `<Image>` logo PNG
- [x] Ajustar tamaño logo en sidebar: ~32px height

### Frontend — Dataset page (tabs)

- [x] `dataset/page.tsx` — agregar `<Tabs>` con 3 opciones
- [x] Crear `components/dataset/DataSourceTabs.tsx`
- [x] Crear `components/dataset/DemoDatasetCard.tsx`
- [x] Crear `components/dataset/ConnectDbCard.tsx`

### Done when

- [x] Login page con logo real y split layout funciona en desktop y mobile
- [x] Sidebar muestra logo PNG
- [x] Dataset page tiene tabs (aunque Tab 2 y 3 sean placeholders)
- [x] Rate limits activos: 5 uploads/h y 10 forecasts/h responden 429 correctamente
- [x] CI verde

---

## Phases 8–14 — Enterprise Roadmap

> Detalles completos, decisiones de arquitectura y especificaciones técnicas en **ROADMAP.md**.
> El tracking de tareas se agrega aquí cuando cada fase se activa.

### Resumen

| Fase   | Nombre            | Stack clave                                            |
| ------ | ----------------- | ------------------------------------------------------ |
| **8**  | MLOps             | MLflow (Dagshub) + Evidently AI + drift alerts         |
| **9**  | Scale Engine      | Nixtla StatsForecast + Polars + DuckDB + Celery Beat   |
| **10** | Dataset Sintético | 25k SKUs × 3 años → Parquet 180 MB en Supabase Storage |
| **11** | PySpark Local     | Docker Spark cluster · feature engineering distribuido |
| **12** | Airflow           | DAGs: forecast batch + drift check + MLflow cleanup    |
| **13** | Data Warehouse    | BigQuery free tier + dbt models + SQL analítico        |
| **14** | Infra as Code     | Terraform (AWS) + Kubernetes manifests + Helm chart    |

---

## Phase 8 — MLOps (MLflow + Evidently AI)

> ✅ Completa. Ver ROADMAP.md → Fase 8 para detalles.

- [x] mlflow_tracker.py, drift_detector.py, api/mlops.py
- [x] ExperimentTable, DriftCard, MLflowLink, dashboard/mlops/page.tsx
- [ ] Alerta automática WAPE drift >5% (backlog)
- [ ] Sentry integración (backlog)

---

## Phase 9 — Scale Engine (Nixtla + Polars)

> ✅ Completa. Ver ROADMAP.md → Fase 9 para detalles.

- [x] nixtla_forecaster.py, api/batch.py, benchmark_models.py
- [x] Celery Beat batch_reforecast (02:00 AR)
- [x] /dashboard/batch playground + sidebar nav

---

## Phase 11 — PySpark Local (Docker)

> Goal: cluster Spark local + feature engineering distribuido + benchmark Pandas/Polars/Spark.
> Ver arquitectura completa en **ROADMAP.md → Fase 11**.

- [x] `docker-compose.spark.yml` — 1 master + 2 workers + Jupyter (bitnami/spark:3.5)
- [x] Montar `data/` y `notebooks/` como volúmenes en el cluster
- [x] `notebooks/spark_forecast_pipeline.ipynb` — pipeline completo:
  - SparkSession con configuración AQE + Kryo serializer
  - Lectura Parquet desde volumen montado
  - Feature engineering: lag-7/14/30, rolling 7/14/30, rolling_std, calendario, precio_rel, cobertura_stock
  - Label encoding categóricos para LightGBM
  - Train/test split por fecha (hold-out últimos 28 días)
  - LightGBM global por segmento ABC-XYZ (9 modelos)
  - Métricas WAPE/MAE/BIAS por segmento con tabla coloreada
  - Escritura Parquet particionado por `categoria/anio_mes`
  - Benchmark Pandas vs Polars vs Spark (3 operaciones: read, groupby, rolling)
- [x] `scripts/spark_benchmark.py` — script standalone CLI (argparse --local / --n-skus / --skip-lgbm / --skip-spark)
- [x] `notebooks/` directorio creado

### Done when

- [x] `docker-compose.spark.yml` válido — levanta con `docker compose -f docker-compose.spark.yml up -d`
- [x] Notebook ejecutable dentro del contenedor Jupyter (token: forecastiq)
- [x] Benchmark genera tabla Pandas vs Polars vs Spark
- [x] Script CLI funciona con `--local --skip-lgbm` para smoke test rápido

---

## Backlog (Post-MVP)

> Ver ROADMAP.md para detalles completos de cada ítem.

- [ ] CSV column auto-mapping with LLM assistance (Tab 1 dataset page)
- [ ] User-provided DB connection string — Tab 3 dataset page (ephemeral, never persisted)
- [ ] BYOK — user provides their own OpenRouter API key
- [ ] Export forecast to Excel / PDF
- [ ] Email notifications when long forecast job completes (Resend/SendGrid)
- [ ] Landing page pública con hero + features + demo embed
- [ ] Spanish / English i18n toggle
- [ ] CONTRIBUTING.md para open source contributors
- [ ] Sentry free tier (backend + frontend) — quedó pendiente de Fase 7

---

## Session Log

| Date       | Session | Completed                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-05-17 | 2       | CI verde en ambos jobs (backend + frontend). Fixes: ruff format, mypy lifespan type, ESLint config, unused import. Phase 0 cerrada.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-17 | 3       | Phase 1 backend: supabase.py, detector.py (MAD+FFT+SeasonalMK+CV), datasets.py (3 endpoints), tests/unit/test_detector.py (11 tests), Dockerfile fix (uv.lock), pymannkendall dep.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-17 | 4       | Fixes CI: ruff I001+F841+F401, pyproject readme field removido, deploy.yml deshabilitado (Railway directo desde repo). Dataset script + 3 CSVs mensuales con outliers.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-17 | 5       | Phase 1 frontend completo: dashboard layout (sidebar), DropZone, ColumnSelector, DataPreview, ModelRecommendation, useDataset hook, placeholders forecast/calendar/chat/settings. types.ts + api.ts patched.                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-05-17 | 6       | Phase 2 backend completo: base.py, evaluator.py (WAPE/MAE/BIAS/RMSE/MAPE), moving_average.py, holt_winters.py, sarima.py, lightgbm_model.py, celery_app.py, api/forecast.py (3 endpoints), supabase.py (+save/get forecast), migrations/001_forecast_jobs.sql. pmdarima agregado a pyproject.toml. .env.example separado en backend/ y frontend/. README.md actualizado.                                                                                                                                                                                                                                                               |
| 2026-05-17 | 7       | Phase 2 frontend + fixes: useForecast.ts, HorizonSelector, ForecastChart (Recharts), MetricsCard, forecast/page.tsx. Fixes: Redis eager mode (\_update helper), pandas freq aliases (ME/QE/YE), Recharts tooltip array crash, selector modelo "auto". Phase 2 cerrada.                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-05-17 | 8       | FVA agregado a evaluator.py (Seasonal Naive lag-12/lag-1), types.ts, ForecastMetrics Pydantic, MetricsCard con color semáforico. README actualizado Phase 2→Phase 3. Backlog Enterprise (25k SKUs COTO): Nixtla, Optuna offline, clustering ABC-XYZ, Croston, OTIF, Data Drift monitor.                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-17 | 9       | Fase 3 completa: migrations/002_events.sql, api/events.py (GET/POST/DELETE), services/events.py (CRUD+feriados AR via holidays), forecast.py +compare endpoint (post-processing multiplicativo), main.py router, pyproject.toml +holidays. Frontend: useEvents.ts, EventChip, ImpactBadge, EventForm (drawer), EventCalendar (pure MUI grid), calendar/page.tsx completa, toggle eventos en forecast/page.tsx, types.ts +ComparePoint. README y TODO purgados de Prophet.                                                                                                                                                              |
| 2026-05-17 | 10      | Fase 4 completa (backend + frontend): tools.py, tool_executor.py (DuckDB), openrouter.py (SSE+tool loop), client.py (system prompt dinámico), api/chat.py (SSE endpoint). Frontend: useChat.ts, ModelSelector, StreamingCursor, MessageBubble, ChatBox, QuickQuestions, chat/page.tsx. 7 modelos free actualizados. config.py default model actualizado. Fixes mypy+ruff (type-arg, N806, B007, F841).                                                                                                                                                                                                                                 |
| 2026-05-17 | 13      | Fix mypy: bool() en cache_set y cache_delete (redis_cache.py), isinstance(row, dict) en get_forecast_history (supabase.py). Backend Fase 5: dependencies.py (CurrentUser, get_current_user, get_optional_user, AuthUser, OptionalUser), supabase.py +get_forecast_history, api/me.py (GET /api/me + GET /api/me/history), main.py +me_router. mypy 34 archivos ✅                                                                                                                                                                                                                                                                      |
| 2026-05-17 | 14      | Migration 003_add_user_id.sql: tabla datasets (metadata CSVs + RLS por usuario), reemplazo policy pública de forecast_jobs por RLS user_id (con fallback user_id IS NULL para modo demo).                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-17 | 17      | Fase 5 cerrada. Settings page (modelo preferido + BYOK localStorage). api.ts propaga Bearer token al backend. dependencies.py reescrito: valida sesiones via Better Auth /api/auth/get-session (httpx). config.py +better_auth_url. .env.example backend actualizado. README badge Fase 5 done.                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-18 | 18      | Fase 6 infraestructura completa: deploy.yml (CI→Docker→ghcr.io→Railway), railway.toml (config-as-code + healthcheck), Dockerfile.worker (Celery), frontend/vercel.json. Railway: 2 servicios + Redis privado. Vercel: deploy exitoso + Google OAuth callback URL prod. Login con Google funcionando en producción. README actualizado con live demo + URLs prod.                                                                                                                                                                                                                                                                       |
| 2026-05-18 | 19      | Roadmap enterprise documentado: Fases 7-14 agregadas a TODO.md y CLAUDE.md. Script generate_massive_dataset.py creado (25k SKUs, 3 años diario, ~27M filas, Parquet Snappy). Stack: pandas+numpy+pyarrow, clustering ABC-XYZ, patrones realistas por categoría.                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-19 | 20      | Fase 7 completa: structlog+middleware (Nivel 1), OTel SDK+traces+forecast_span (Nivel 2), Grafana Alloy en Railway (scrape /metrics → Grafana Cloud Mimir), dashboard producción online. Fixes: Railway TOKEN, mypy FilteringBoundLogger, $PORT sh -c, startCommand railway.toml, archivos faltantes en git (middleware.py, telemetry.py), /metrics router explícito. Dashboard: https://nicobravo933.grafana.net/goto/shcs6k                                                                                                                                                                                                          |
| 2026-05-19 | 21      | Documentación completa: ROADMAP.md creado (Fases 7.5–14 con decisiones de arquitectura cerradas, Quick Start local, fuentes de datos, rate limiting, DuckDB+Parquet strategy). TODO.md reestructurado: Fase 7.5 agregada como próxima, Fases 8-14 comprimidas con referencia a ROADMAP.md. README.md actualizado: Quick Start 5 pasos, sección Dataset Demo, badge Fase 7.5 next.                                                                                                                                                                                                                                                      |
| 2026-05-19 | 22      | Fase 7.5 frontend iniciada: login/page.tsx rediseñado (split layout, logo PNG, feature bullets, glow sutil, mobile responsive). dashboard/layout.tsx: logo texto reemplazado por Image next/image (130×32).                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2026-05-19 | 24      | Fase 7.5 completa: rate limiting backend. redis_cache.py generalizado (\_check_rate_limit_generic + check_upload_rate_limit + check_forecast_rate_limit). datasets.py y forecast.py con check 429 + Retry-After. Fase 7.5 cerrada.                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-19 | 25      | Sidebar: logo cambiado de logo.png → logo_rectangular.png en dashboard/layout.tsx. Edición quirúrgica de 1 línea.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-20 | 26      | Migración Railway → AWS+Dagshub completa: railway.toml archivados en infra/_deprecated_railway/. deploy.yml reescrito (SSH → EC2 via appleboy/ssh-action). docker-compose.yml actualizado (volumen mlruns, healthcheck, IMAGE var). backend/.env.example con MLFLOW_\* y sin referencias Railway. infra/aws/ creado (setup_ec2.sh + README.md). README.md reescrito (badges AWS/Upstash/Dagshub, tabla costo $0, arquitectura actualizada). TODO.md: Fase 7.5 ✅, Fase 8 🔄 Next con todas las tareas detalladas.                                                                                                                      |
| 2026-05-20 | 27      | Setup completo AWS EC2 + Dagshub en producción: cuenta AWS, instancia t3.micro Amazon Linux 2023, Docker + Docker Compose instalados, imagen ghcr.io pulleada, 3 contenedores corriendo (backend + celery_worker + redis), health check ✅ environment=production. Systemd service configurado para autostart. Variables IMAGE + ENVIRONMENT persistidas en /etc/environment. EC2_MANUAL_OPERACIONES.md creado (gitignored). Setup previo Fase 8 completo (Dagshub token + repo mirror GitHub).                                                                                                                                        |
| 2026-05-20 | 28      | Fase 8 backend completo: pyproject.toml +mlflow +evidently +joblib. config.py +4 vars MLflow. mlflow_tracker.py creado (log_forecast_run, get_recent_runs, get_run_detail, dagshub URL builder). drift_detector.py creado (Evidently DataDriftPreset, detect_drift, detect_wape_drift, \_save_report_html Supabase Storage, get_drift_summary). celery_app.py integrado (pasos 9+10: mlflow tracking + drift detection post-forecast). api/mlops.py creado (GET /api/experiments, GET /api/experiments/{run_id}, GET /api/drift/{dataset_id}). main.py registra mlops_router + drift_router. .env.example actualizado con vars MLflow. |
| 2026-05-20 | 29      | Fase 8 frontend completo: types.ts +MlflowRun +DriftSummary +DriftColumnResult. components/mlops/ExperimentTable.tsx (tabla WAPE semafórico, link Dagshub). components/mlops/DriftCard.tsx (badge verde/amarillo/rojo + links Evidently HTML). components/mlops/MLflowLink.tsx (botón Dagshub/local). app/dashboard/mlops/page.tsx (página integradora con dataset selector). dashboard/layout.tsx +MLOps en sidebar nav.                                                                                                                                                                                                              |
| 2026-05-20 | 30      | Fase 9 inicio (Opción B end-to-end): pyproject.toml +statsforecast +polars. nixtla_forecaster.py creado (pipeline vectorizado multi-serie, segmentación ABC-XYZ, AutoETS+AutoARIMA+SeasonalNaive, n_jobs=-1, Polars para ingesta). api/batch.py creado (POST /api/batch/forecast, rate limit reutilizado, validación 50k records). main.py +batch_router. WapeTrendChart.tsx creado (Recharts line chart WAPE evolution, reference lines 10%/25%). mlops/page.tsx placeholder reemplazado por WapeTrendChart real. types.ts +BatchForecastRequest +BatchForecastResponse +BatchPredictionPoint.                                        |
| 2026-05-20 | 31      | Fase 9 casi cerrada: scripts/benchmark_models.py (statsmodels vs Nixtla, 3 métodos, argparse). Celery Beat batch_reforecast (crontab 05:00 UTC=02:00 AR) + supabase.list_recent_datasets(hours=48). Frontend /dashboard/batch/page.tsx (playground JSON panel, selector freq/horizon/columnas/ABC-XYZ, tabla resultado). Sidebar +Batch item BarChartIcon. TODO.md: Phase 9 sección creada, 12/13 tareas [x]. Pendiente solo: uv sync en EC2.                                                                                                                                                                                          |
| 2026-05-21 | 32      | Beat como servicio docker-compose (celery_beat, restart:unless-stopped) — SCP a EC2, docker compose up -d celery_beat ✅ 4 contenedores corriendo post-reboot. Fase 10 completa: generate_massive_dataset.py → 27,375,000 filas 255MB, split_parquet.py → 6 chunks 43MB, upload manual a Supabase Storage, bucket público, verify_dataset_supabase.py → DuckDB lee 25k SKUs vía URLs públicas ✅. Fixes CI: evidently pinned ==0.4.33, dev deps movidas a [dependency-groups], ColumnMapping import revertido. Vercel NEXT_PUBLIC_API_URL corregida → redeploy. Fases 9+10 cerradas.                                                   |
| 2026-05-20 | 33      | Fase 11 completa: docker-compose.spark.yml (bitnami/spark:3.5 × master+2workers+Jupyter, volúmenes data/ y notebooks/, puertos 8080/8081/8082/8888). notebooks/spark_forecast_pipeline.ipynb creado (8 secciones: setup→ingesta→exploración→feature_eng→LightGBM_por_segmento→Parquet_particionado→benchmark→conclusiones). scripts/spark_benchmark.py creado (CLI standalone, argparse --local/--n-skus/--skip-lgbm/--skip-spark). TODO.md Fase 11 ✅.                                                                                                                                                                                |
| 2026-05-21 | 35      | Fix EC2 CELERY_TASK_ALWAYS_EAGER (env corrompido detectado, fix sed + force-recreate). docker-compose.prod.yml creado en EC2. UX fix forecast page: useDataset guarda selectedDateColumn/targetCol/Freq, dataset/page.tsx persiste a appStore con valores reales, forecast/page.tsx pre-llena form desde appStore + banner dataset activo. Fase UX-1: layout.tsx — maxWidth eliminado, padding responsivo (xs→lg), sidebar 15rem, logo rectangular 148×32 altura fija 3.5rem. |
| 2026-05-21 | 36      | UX-3 completa: hooks/useColumnPreview.ts (carga columnas desde /api/datasets/{id}/preview, cancellable effect). components/forecast/ForecastConfigPanel.tsx (dropdowns con tipos por columna, chips datetime/numeric/text, validación inline ✅/⚠️, fallback a TextFields sin dataset, auto-selección: primera datetime → fecha, primer numeric → objetivo). forecast/page.tsx reescrito: layout 2 columnas md+ / apilado mobile, config panel izquierda, gráfico + métricas derecha, config summary compacto post-run. |
| 2026-05-21 | 37      | .gitignore +frontend/public/ai_muestra/ (carpeta referencia IA, local only). Commit general UX-1→UX-3: dataset manager, forecast 2 columnas, layout full-width, dropdowns con tipos de columna. |
| 2026-05-21 | 38      | UX-4a completa: FloatingChat.tsx (FAB + Drawer 22rem, reutiliza useChat+ChatBox+QuickQuestions, badge contador mensajes, contexto appStore, se oculta en /dashboard/chat). layout.tsx +FloatingChat montado una sola vez para toda la app. |
| 2026-05-21 | 39      | UX-4b completa: WelcomeScreen.tsx (grid 2×2 quick-cards con íconos y animación fadeInUp). MessageBubble.tsx rediseñado (avatar gradiente, animaciones msgInUser/msgInAi, burbuja IA fit-content, burbuja user gradiente primary). ChatBox.tsx rediseñado (WelcomeScreen integrado, ThinkingIndicator con dots animados → BoltIcon cuando hay toolCall). QuickQuestions.tsx rediseñado (chips accent pill con BoltIcon, solo visible con sugerencias LLM). chat/page.tsx rediseñado (layout full-height con borde, header compacto con avatar, input bar con gradiente). FloatingChat actualizado (ChatBox new interface). |
| 2026-05-22 | 40      | Bugs UX: (1) getPreferredModel() lee localStorage — modelo de Settings se aplica al Chat. (2) FloatingChat: Drawer→Popper+Grow burbuja ecommerce, botón OpenInFull. (3) RobotAvatar.tsx: Lottie robot.json con fallback gradiente. (4) MLOps maxHeight 20rem. (5) ModelSelector prop compact. ChatBox prop compact. |
| 2026-05-23 | 43      | UX-5 NavyPro: theme.ts modo light (bg #f0f4f8, sidebar blanco, header gradiente #0f2044→#1a3868). layout.tsx: header full-width con logo ForecastIQ.png centrado + hamburger toggle, sidebar blanco fixed con borde-left acento activo, user footer en sidebar. |
| 2026-05-23 | 44      | Chat history feature completa: migration 004_chat_conversations.sql (tabla + RLS + trigger updated_at). supabase.py +save/list/get/delete_conversation. api/conversations.py (POST/GET/GET{id}/DELETE). main.py +conversations_router. types.ts +ChatConversation +ChatConversationDetail. useConversations.ts (CRUD hook + localStorage fallback anónimos). ConversationSidebar.tsx (panel izquierdo, hover delete, formatDate). useChat.ts +setMessages. chat/page.tsx: layout 2 col sidebar+main, auto-save al done, carga conversación al click, nueva conversación. |
| 2026-05-23 | 49      | Fix mypy residual datasets.py: reemplazado `_seg_acc dict[str,object]` por dos dicts paralelos `_seg_wapes: dict[str,list[float]]` + `_seg_counts: dict[str,int]` (elimina 4 errores de `int(object)` y `np.mean(object)`). `rows to_dict` con `# type: ignore[assignment]` correcto. 6 errores → 0. |
| 2026-05-23 | 50      | Fix bug categoría con tilde en `demo/analyze-category`: normalización via `_CATEGORIAS_DISPLAY.get()` antes de validar y pasar a DuckDB (igual que `demo/skus`). 3 cambios quirúrgicos en datasets.py. |
| 2026-05-23 | 51      | Browser tab: layout.tsx title → "ForecastIQ", icons metadata apunta a /logo.png (icon + shortcut + apple). Sin dependencias extra, sin conversión necesaria. |
| 2026-05-23 | 55      | Fix frecuencia mensual + horizonte libre: (1) backend `_freq_alias["M"] = "MS"` (Month Start, alinea con DuckDB date_trunc que retorna primer día del mes), `"Q" = "QS"`. (2) frontend: horizonte mínimo 1 (antes bloqueado en 4), máximo dinámico 24 para mensual / 52 para semanal, reset automático al cambiar frecuencia. |
| 2026-05-23 | P1+P6 | Paso 1+6 chart: ForecastChart.tsx reescrito — Brush scrubber, quick-zoom (Todo/Últ.24/Últ.12/Solo forecast), 3 zonas coloreadas (train azul / test amber / futuro cyan), ReferenceArea, 460px altura, tooltip fecha completa, rangeLabel. forecast/page.tsx: layout full-width cuando showResults=true (gridTemplateColumns dinámico, gridColumn 1/-1 en LEFT box). |
| 2026-05-23 | P2 | Paso 2 hold-out manual: backend celery_app.py +test_periods kwarg, split bifurcado (manual vs auto 20%), test_actual/test_predicted/train_end_date/test_start_date en result dict. forecast.py +test_periods en Request/Response/delay/deserialización. Frontend: types.ts ForecastResult+ForecastRunRequest extendidos. ForecastConfigPanel +testPeriods field + selector ToggleButton (Auto/3/6/12). ForecastChart recibe props opcionales y los pasa a las 3 zonas. MetricsCard +testPeriods badge (verde=manual, gris=auto). |
| 2026-05-24 | fix-auth | Fix login local + Vercel: Transaction Pooler (6543) con params explícitos, SUPABASE_DB_PASSWORD env var, BETTER_AUTH_SECRET reemplazado por hex puro (sin `+`/`.`/`=`), limpieza de cookies de sesión corrupta. Login Google/GitHub funcionando local. |
| 2026-05-24 | P1-P4 | Pasos 1-4 completos. P1: ForecastChart reescrito (Brush/zoom, 3 zonas, 460px). P2: hold-out manual test_periods. P3: rolling CV K-folds (TimeSeriesSplit, CvResultsCard). P4: Analytics selector modelo (AutoETS/SeasonalNaive/AutoARIMA) + validación mínimos (n_skus_short, n_obs_median, min_obs_required en response y badge UI). |
| 2026-05-24 | fixes-CD | ActiveDatasetBar quitada del layout (desmontada — componente existe pero no se usa). Tier chip reemplazado por Box simple (ícono + Typography) — elimina bug del SVG desalineado en modo colapsado; color semafórico verde/indigo/gris según tier. CI fixes: B007 uid→_uid (datasets.py groupby analyze-multi). mypy no-any-return: _parse_xlsx usa pd.DataFrame(raw_excel) en lugar de pd.read_excel directamente. mypy arg-type batch.py: records cast a list[dict[str, Any]] via comprensión str(k). |
| 2026-05-24 | P5 | Paso 5 Demo SKU en Forecast: DemoSkuSearchDialog.tsx creado (Dialog con chips de categoría, buscador debounced, lista scrollable de SKUs, POST demo/load, addSessionDataset). DatasetPicker.tsx: +dialogOpen estado, +handleSkuLoaded, +MenuItem "Buscar SKU en el demo…" con ListSubheader y guard onChange, +DemoSkuSearchDialog renderizado. Disponible en local y ec2. |

| 2026-05-23 | 62      | NavyPro glass effect: layout.tsx fondo degradado `linear-gradient(155deg, #c7dcff→#eef2ff)` con `backgroundAttachment:fixed`, main transparente. theme.ts — Card: glass `rgba(255,255,255,0.82)` + `backdropFilter:blur(10px)` + borde `rgba(219,234,254,0.7)`, hover opacifica a 0.93. Paper: `rgba(255,255,255,0.88)` + `blur(12px)`. Drawer/sidebar: `rgba(255,255,255,0.92)` + `blur(16px)` + borde azulado. Todos los elementos transicionan bien con el fondo degradado. |
| 2026-05-24 | UX-Home | Vista Home creada: HomeDashboard.tsx (logo flotante animado, reloj en vivo, saludo personalizado con nombre de sesión, badges de estado, strip de 4 status cards, grid 3×2 de acceso rápido con hover). app/dashboard/home/page.tsx creado. Sidebar: HomeIcon + "Inicio" como primer ítem de nav. Calendario: refactor EventCalendar — Grid2 eliminado, CSS grid nativo, encabezados azul/glass, celdas blancas sólidas 90%, borde exterior azulado, día de hoy destacado. |
| 2026-05-24 | UX-Home-v3 | HomeDashboard rediseñado siguiendo ForecastIQ Layout.html: hero strip horizontal (gradiente navy + logo nativo ×2 = 9rem + badges), status 4col, cards 3×2 con contenido centrado + hover "Abrir", panel actividad. layout.tsx: padding cero en /dashboard/home, height calc sin scroll. |

---

_Update this file after every work session. Mark tasks `[x]` as completed._
