# TODO.md — forecastiq

> **Claude: read this file at the start of every session.**
> Update task status as work progresses. Never skip phases — complete current phase before starting next.

---

## 🗺️ Phase Overview

| Phase | Name                             | Status         | Goal                           |
| ----- | -------------------------------- | -------------- | ------------------------------ |
| **0** | Foundation                       | ✅ Done        | Repo + env + CI green          |
| **1** | Data ingestion + model detection | ✅ Done        | Upload CSV → auto-select model |
| **2** | Forecast engine                  | ✅ Done        | Real forecasts + charts        |
| **3** | Calendar of events               | ✅ Done        | Events → forecast impact       |
| **4** | AI Chat with streaming           | ✅ Done        | SSE chat about the data        |
| **5** | Auth + persistence               | ✅ Done        | OAuth2 + per-user history      |
| **6** | Deploy + observability           | ✅ Done        | Full prod CI/CD                |

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

---

_Update this file after every work session. Mark tasks `[x]` as completed._
