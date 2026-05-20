# TODO.md — forecastiq

> **Claude: read this file at the start of every session.**
> Update task status as work progresses. Never skip phases — complete current phase before starting next.
> **Para detalles de arquitectura de Fases 7.5–14, leer ROADMAP.md.**

---

## 🗺️ Phase Overview

| Phase   | Name                             | Status     | Goal                                         |
| ------- | -------------------------------- | ---------- | -------------------------------------------- |
| **0**   | Foundation                       | ✅ Done    | Repo + env + CI green                        |
| **1**   | Data ingestion + model detection | ✅ Done    | Upload CSV → auto-select model               |
| **2**   | Forecast engine                  | ✅ Done    | Real forecasts + charts                      |
| **3**   | Calendar of events               | ✅ Done    | Events → forecast impact                     |
| **4**   | AI Chat with streaming           | ✅ Done    | SSE chat about the data                      |
| **5**   | Auth + persistence               | ✅ Done    | OAuth2 + per-user history                    |
| **6**   | Deploy + CI/CD                   | ✅ Done    | Full prod CI/CD + Railway + Vercel           |
| **7**   | Observability                    | ✅ Done    | OpenTelemetry + Grafana LGTM + Alloy         |
| **7.5** | UI Polish + Rate Limiting        | 🔄 Next    | Diseño SaaS profesional + protección Railway |
| **8**   | MLOps                            | ⏳ Pending | MLflow tracking + Evidently drift detection  |
| **9**   | Scale Engine                     | ⏳ Pending | Nixtla vectorizado + Polars + batch          |
| **10**  | Dataset sintético masivo         | ⏳ Pending | Script 25k SKUs → Parquet ~180 MB            |
| **11**  | PySpark local                    | ⏳ Pending | PySpark sobre dataset enterprise en Docker   |
| **12**  | Airflow                          | ⏳ Pending | Orquestación batch nocturno con DAGs         |
| **13**  | Data Warehouse                   | ⏳ Pending | BigQuery free tier o Snowflake trial         |
| **14**  | Infra as Code                    | ⏳ Pending | Terraform + Kubernetes manifests             |

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

- [x] `dataset/page.tsx` — agregar `<Tabs>` con 3 opciones:
  - Tab 1: `📄 Subir CSV` — DropZone actual sin cambios funcionales
  - Tab 2: `🎲 Dataset demo` — placeholder UI (funcionalidad en Fase 9)
  - Tab 3: `🔌 Conectar DB` — placeholder UI (backlog enterprise)
- [x] Crear `components/dataset/DataSourceTabs.tsx`
- [x] Crear `components/dataset/DemoDatasetCard.tsx` (placeholder con stats del dataset)
- [x] Crear `components/dataset/ConnectDbCard.tsx` (placeholder con nota de seguridad)

### Estructura de carpetas

- [x] Crear `frontend/components/layout/` (README.md, preparado para Fase 8+)
- [x] Crear `frontend/components/dataset/` con los nuevos componentes
- [x] Crear `frontend/lib/motion.ts` — constantes de animación (durations, easings, transitions)

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
| **8**  | MLOps             | MLflow + Evidently AI + Sentry alerts                  |
| **9**  | Scale Engine      | Nixtla StatsForecast + Polars + DuckDB + Celery Beat   |
| **10** | Dataset Sintético | 25k SKUs × 3 años → Parquet 180 MB en Supabase Storage |
| **11** | PySpark Local     | Docker Spark cluster · feature engineering distribuido |
| **12** | Airflow           | DAGs: forecast batch + drift check + MLflow cleanup    |
| **13** | Data Warehouse    | BigQuery free tier + dbt models + SQL analítico        |
| **14** | Infra as Code     | Terraform + Kubernetes manifests + Helm chart          |

### Phase 10 — Dataset Sintético (tareas pendientes)

- [x] Script `scripts/generate_dataset.py` creado y documentado
- [ ] Ejecutar script → generar `data/ventas_25k_skus.parquet` (~180 MB)
- [ ] Upload a Supabase Storage (`datasets/` bucket) como `ventas_25k_skus.parquet`
- [ ] Verificar tamaño total Storage no supera 400 MB del plan free

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
| 2026-05-18 | 18      | Fase 6 infraestructura completa: deploy.yml (CI→Docker→ghcr.io→Railway), railway.toml (config-as-code + healthcheck), Dockerfile.worker (Celery), frontend/vercel.json. Railway: 2 servicios + Redis privado. Vercel: deploy exitoso + Google OAuth callback URL prod. Login con Google funcionando en producción. README actualizado con live demo + URLs prod.                                                                                                          |
| 2026-05-18 | 19      | Roadmap enterprise documentado: Fases 7-14 agregadas a TODO.md y CLAUDE.md. Script generate_massive_dataset.py creado (25k SKUs, 3 años diario, ~27M filas, Parquet Snappy). Stack: pandas+numpy+pyarrow, clustering ABC-XYZ, patrones realistas por categoría.                                                                                                                                                                                                           |
| 2026-05-19 | 20      | Fase 7 completa: structlog+middleware (Nivel 1), OTel SDK+traces+forecast_span (Nivel 2), Grafana Alloy en Railway (scrape /metrics → Grafana Cloud Mimir), dashboard producción online. Fixes: Railway TOKEN, mypy FilteringBoundLogger, $PORT sh -c, startCommand railway.toml, archivos faltantes en git (middleware.py, telemetry.py), /metrics router explícito. Dashboard: https://nicobravo933.grafana.net/goto/shcs6k                                             |
| 2026-05-19 | 21      | Documentación completa: ROADMAP.md creado (Fases 7.5–14 con decisiones de arquitectura cerradas, Quick Start local, fuentes de datos, rate limiting, DuckDB+Parquet strategy). TODO.md reestructurado: Fase 7.5 agregada como próxima, Fases 8-14 comprimidas con referencia a ROADMAP.md. README.md actualizado: Quick Start 5 pasos, sección Dataset Demo, badge Fase 7.5 next.                                                                                         |
| 2026-05-19 | 22      | Fase 7.5 frontend iniciada: login/page.tsx rediseñado (split layout, logo PNG, feature bullets, glow sutil, mobile responsive). dashboard/layout.tsx: logo texto reemplazado por Image next/image (130×32).                                                                                                                                                                                                                                                               |
| 2026-05-19 | 24      | Fase 7.5 completa: rate limiting backend. redis_cache.py generalizado (\_check_rate_limit_generic + check_upload_rate_limit + check_forecast_rate_limit). datasets.py y forecast.py con check 429 + Retry-After. Fase 7.5 cerrada.                                                                                                                                                                                                                                        |
| 2026-05-19 | 25      | Sidebar: logo cambiado de logo.png → logo_rectangular.png en dashboard/layout.tsx. Edición quirúrgica de 1 línea.                                                                                                                                                                                                                                                                                                                                                         |

---

_Update this file after every work session. Mark tasks `[x]` as completed._
