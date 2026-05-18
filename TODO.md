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
| **6** | Deploy + observability           | 🔲 Not started | Full prod CI/CD                |

---

## Phase 0 — Foundation

> Goal: `docker compose up` → backend :8000, frontend :3000, CI green on GitHub

### Backend

- [x] Init project with UV (`uv init forecastiq-backend`)
- [x] `pyproject.toml` with core deps (fastapi, uvicorn, pydantic-settings, ruff, mypy, pytest)
- [x] `app/main.py` — FastAPI app factory
- [x] `app/core/config.py` — pydantic-settings with all env vars
- [x] `app/core/logging.py` — structured JSON logging
- [x] `GET /health` endpoint → `{"status": "ok", "version": "0.1.0"}`
- [x] `Dockerfile` (python:3.12-slim, UV, non-root user)
- [x] `.dockerignore`

### Frontend

- [x] Init Next.js 14 with TypeScript (`npx create-next-app@latest`)
- [x] Install MUI v6 (`@mui/material @emotion/react @emotion/styled`)
- [x] `lib/theme.ts` — MUI theme (Inter font, indigo primary, rem sizing)
- [x] Root layout with ThemeProvider
- [x] Landing page placeholder (logo + "coming soon" centered)
- [x] `lib/api.ts` — typed fetch wrapper pointing to backend

### Infrastructure

- [x] `docker-compose.yml` (backend + redis)
- [x] `.env.example` with all required vars and descriptions
- [x] `.pre-commit-config.yaml` (ruff, mypy, prettier)
- [x] `.github/workflows/ci.yml` (lint + test on every push)
- [x] `.gitignore` (`.env`, `__pycache__`, `.next`, `node_modules`, `uv.lock` exceptions)
- [x] First commit + push to public GitHub repo

### Done when

- [x] `docker compose up` works from a fresh clone
- [x] `GET /health` returns 200
- [x] Frontend renders at localhost:3000
- [x] GitHub Actions CI passes (green badge)

---

## Phase 1 — Data Ingestion + Model Detection

> Goal: user uploads CSV → column selector → model recommendation with explanation

### Backend

- [x] `POST /api/datasets/upload` — accept CSV, validate, store in Supabase Storage
- [x] `GET /api/datasets/{id}/preview` — return first 10 rows + column types
- [x] `POST /api/datasets/{id}/detect` — auto model selection
- [x] `app/ml/detector.py`:
  - [x] `detect_outliers_mad(series)` — MAD outlier detection (threshold=3.0)
  - [x] `detect_seasonality_fft(series)` — FFT-based seasonality detection
  - [x] `detect_trend_mannkendall(series)` — Seasonal Mann-Kendall test (pymannkendall)
  - [x] `calculate_cv(series)` — coefficient of variation
  - [x] `detect_best_model(series, freq)` → `DetectionResult`
- [x] Unit tests for detector (short series, seasonal, trending, volatile, MAD, FFT, CV)
- [x] `app/services/supabase.py` — Supabase client wrapper (upload/download/delete CSV)

### Frontend

- [x] Dataset page layout (sidebar nav item active)
- [x] `components/upload/DropZone.tsx` — drag-and-drop CSV upload (MUI)
- [x] `components/upload/ColumnSelector.tsx` — date col + target col dropdowns
- [x] `components/upload/DataPreview.tsx` — MUI Table first 10 rows
- [x] `components/upload/ModelRecommendation.tsx` — badge + explanation card
- [x] `hooks/useDataset.ts` — upload state machine (idle→uploading→preview→detecting→done)
- [x] Upload progress bar (MUI LinearProgress)

### Done when

- [x] User can upload a CSV (the synthetic dataset)
- [x] Sees column selector after upload
- [x] Sees "Recommended model: Holt-Winters — Reason: annual seasonality detected"

---

## Phase 2 — Forecast Engine

> Goal: forecast runs in background, user sees chart + metrics

### Backend

- [x] `app/services/celery_app.py` — Celery with Upstash Redis broker
- [x] `POST /api/forecast/run` → returns `{job_id, status: "pending"}`
- [x] `GET /api/forecast/{job_id}/status` → `{status, progress_pct}`
- [x] `GET /api/forecast/{job_id}/result` → full forecast data
- [x] `migrations/001_forecast_jobs.sql` — tabla Supabase con RLS
- [x] `app/ml/models/base.py` — abstract `ForecastModel`
- [x] `app/ml/models/moving_average.py` — weighted moving average + CI bootstrap
- [x] `app/ml/models/holt_winters.py` — triple exponential smoothing (statsmodels)
- [x] `app/ml/models/sarima.py` — auto-SARIMA (pmdarima) + CI analítico
- [x] `app/ml/models/lightgbm_model.py` — LightGBM + Optuna HPO + CI quantile
- [x] `app/ml/evaluator.py` — WAPE, MAE, BIAS, RMSE, MAPE
- [ ] Redis caching for forecast results (Upstash)
- [ ] Unit tests for each model (synthetic fixtures)

### Frontend

- [x] Forecast page layout
- [x] `components/forecast/HorizonSelector.tsx` — +3m / +6m / +12m / custom toggle
- [x] `components/forecast/ForecastChart.tsx` — Recharts histórico + proyección + CI
- [x] `components/forecast/MetricsCard.tsx` — WAPE / MAE / BIAS / RMSE chips
- [x] `hooks/useForecast.ts` — job polling con backoff
- [x] `lib/types.ts` — tipos actualizados (ForecastResult, HistoricalPoint, ForecastMetrics)

### Done when

- [x] User selects dataset + horizon → forecast job runs in background
- [x] Progress bar shows live progress (eager mode: instant)
- [x] Chart renders historical + projected + confidence interval
- [x] Metrics visible (WAPE, MAE, BIAS, RMSE)

---

## Phase 3 — Calendar of Events

> Goal: user adds events/promotions → forecast recalculates showing impact

### Backend

- [x] `GET /api/events` — list user events + global events
- [x] `POST /api/events` — create event (validated date range)
- [x] `DELETE /api/events/{id}` — delete own event
- [x] `GET /api/forecast/{id}/compare` — with vs without events comparison
- [x] AR public holidays auto-loaded via `holidays` library
- [x] RLS: global events (user_id=null) visible to all, own events private

### Frontend

- [x] Calendar page layout
- [x] `components/calendar/EventCalendar.tsx` — month grid (pure MUI)
- [x] `components/calendar/EventForm.tsx` — add event drawer (name, type, dates, impact %)
- [x] `components/calendar/EventChip.tsx` — color-coded by type (holiday/promo/seasonal)
- [x] Toggle: forecast with events ON/OFF comparison

### Done when

- [x] User adds "Black Friday +20%" → forecast recalculates showing spike
- [x] Side-by-side comparison: baseline vs with-events
- [x] AR public holidays visible by default

---

## Phase 4 — AI Chat with Streaming SSE

> Goal: user chats about their data, tokens stream in real-time

### Backend

- [x] `POST /api/chat/stream` — SSE endpoint with StreamingResponse
- [x] OpenRouter multi-model router (same pattern as Priorizador project)
- [x] LLM tools:
  - [x] `query_dataset(sql)` — DuckDB over user's dataset
  - [x] `get_forecast_summary()` — current forecast metrics
  - [x] `get_events()` — active calendar events
  - [x] `suggest_model_change(reason)` — propose switching ML model
- [x] System prompt: dataset schema + current forecast context + session KPIs
- [x] Follow-up suggestion extraction from LLM response
- [x] Rate limiting per user (Redis token bucket)

### Frontend

- [x] Chat page layout (top bar + chat area + input)
- [x] `components/chat/ModelSelector.tsx` — free OpenRouter models dropdown (MUI Select)
- [x] `components/chat/ChatBox.tsx` — message list with auto-scroll
- [x] `components/chat/MessageBubble.tsx` — user/assistant styling, Markdown rendering
- [x] `components/chat/StreamingCursor.tsx` — blinking cursor while streaming
- [x] `components/chat/QuickQuestions.tsx` — suggested questions chips
- [x] `hooks/useChat.ts` — SSE reader, token accumulation, error recovery
- [x] Inline charts from LLM (render Recharts from JSON spec)
- [x] Copy message button

### Done when

- [x] User types question → tokens stream letter by letter
- [x] Model selector works (OWL Alpha / Nemotron / Laguna / GPT OSS / GLM / DeepSeek / MiniMax)
- [x] LLM can query the dataset and answer data questions
- [x] Follow-up suggestions appear after each response

---

## Phase 5 — Auth + Persistence

> Goal: Google/GitHub login, forecast history saved per user

### Backend

- [x] `app/core/dependencies.py` — `CurrentUser`, `get_current_user`, `get_optional_user`, `AuthUser`, `OptionalUser`
- [x] Better Auth integration with Next.js
- [x] Supabase RLS policies verified for all tables
- [x] `GET /api/me` — perfil del usuario autenticado
- [x] `GET /api/me/history` — paginated forecast history
- [x] `get_forecast_history(user_id)` in supabase.py
- [x] `user_id` propagated to all forecasts, events, datasets
- [x] `migrations/003_add_user_id.sql` — tabla datasets + RLS por usuario + reemplaza policy pública de forecast_jobs
- [x] Session middleware in FastAPI (verify JWT from Better Auth)

### Frontend

- [x] Login page (Google + GitHub OAuth buttons — MUI)
- [x] Better Auth client setup
- [x] Protected routes (redirect to login if unauthenticated)
- [x] Settings page: API keys (OpenRouter BYOK), preferred model
- [x] History section in sidebar: past forecasts with quick-load
- [x] User avatar + menu in topbar

### Done when

- [x] Login with Google works end-to-end
- [x] Each user sees only their own forecasts and events
- [x] Returning user sees their forecast history

---

## Phase 6 — Deploy + Observability

> Goal: everything in production, CI/CD fully automated

### Infrastructure

- [ ] `.github/workflows/deploy.yml` — build + push Docker image to ghcr.io
- [ ] Railway deployment configured (backend + Celery worker)
- [ ] Vercel deployment configured (frontend — auto via GitHub integration)
- [ ] Upstash Redis connected in production
- [ ] Supabase production project configured
- [ ] Environment variables set in Railway + Vercel dashboards

### Observability

- [ ] Sentry DSN configured (backend + frontend)
- [ ] Structured logging in production (JSON format → Railway logs)
- [ ] Health check endpoint monitored (Railway auto-restart on failure)
- [ ] OpenTelemetry basic traces (forecast job duration, LLM latency)

### Documentation

- [ ] README.md updated with:
  - [ ] Live demo URL
  - [ ] Architecture diagram
  - [ ] Local development guide
  - [ ] Screenshots / GIF demo
- [ ] `CONTRIBUTING.md` for open source contributors
- [ ] API docs auto-generated (FastAPI `/docs` — public)

### Done when

- [ ] `git push main` → CI passes → Railway + Vercel deploy automatically
- [ ] Live URL accessible from any device
- [ ] Sentry catches errors in production
- [ ] README has green CI badge + live demo link

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

---

_Update this file after every work session. Mark tasks `[x]` as completed._
