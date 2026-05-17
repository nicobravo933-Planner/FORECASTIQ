# TODO.md — forecastiq

> **Claude: read this file at the start of every session.**
> Update task status as work progresses. Never skip phases — complete current phase before starting next.

---

## 🗺️ Phase Overview

| Phase | Name                             | Status         | Goal                           |
| ----- | -------------------------------- | -------------- | ------------------------------ |
| **0** | Foundation                       | ✅ Done        | Repo + env + CI green          |
| **1** | Data ingestion + model detection | 🔲 Not started | Upload CSV → auto-select model |
| **2** | Forecast engine                  | 🔲 Not started | Real forecasts + charts        |
| **3** | Calendar of events               | 🔲 Not started | Events → forecast impact       |
| **4** | AI Chat with streaming           | 🔲 Not started | SSE chat about the data        |
| **5** | Auth + persistence               | 🔲 Not started | OAuth2 + per-user history      |
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

- [ ] Dataset page layout (sidebar nav item active)
- [ ] `components/upload/DropZone.tsx` — drag-and-drop CSV upload (MUI)
- [ ] `components/upload/ColumnSelector.tsx` — date col + target col dropdowns
- [ ] `components/upload/DataPreview.tsx` — MUI DataGrid first 10 rows
- [ ] `components/upload/ModelRecommendation.tsx` — badge + explanation card
- [ ] `hooks/useDataset.ts` — upload state + polling
- [ ] Upload progress bar (MUI LinearProgress)

### Done when

- [ ] User can upload a CSV (the synthetic dataset)
- [ ] Sees column selector after upload
- [ ] Sees "Recommended model: Holt-Winters — Reason: annual seasonality detected"

---

## Phase 2 — Forecast Engine

> Goal: forecast runs in background, user sees chart + metrics

### Backend

- [ ] `app/services/celery_app.py` — Celery with Upstash Redis broker
- [ ] `POST /api/forecast/run` → returns `{job_id, status: "pending"}`
- [ ] `GET /api/forecast/{job_id}/status` → `{status, progress_pct}`
- [ ] `GET /api/forecast/{job_id}/result` → full forecast data
- [ ] `app/ml/models/base.py` — abstract `ForecastModel`
- [ ] `app/ml/models/moving_average.py` — weighted moving average + CI
- [ ] `app/ml/models/holt_winters.py` — triple exponential smoothing (statsmodels)
- [ ] `app/ml/models/prophet_model.py` — Prophet with AR holidays
- [ ] `app/ml/models/lightgbm_model.py` — LightGBM + Optuna HPO + lag features
- [ ] `app/ml/evaluator.py` — MAPE, RMSE, MAE with time-series CV
- [ ] Redis caching for forecast results (Upstash)
- [ ] Unit tests for each model (synthetic fixtures)

### Frontend

- [ ] Forecast page layout
- [ ] `components/forecast/HorizonSelector.tsx` — +3m / +6m / +12m / custom toggle
- [ ] `components/forecast/ForecastChart.tsx` — Recharts with:
  - [ ] Historical line (solid)
  - [ ] Forecast line (dashed)
  - [ ] Confidence interval (area)
  - [ ] Event markers (vertical lines from calendar)
- [ ] `components/forecast/MetricsCard.tsx` — MAPE / RMSE / MAE chips
- [ ] `components/forecast/ModelBadge.tsx` — model name + "why this model" tooltip
- [ ] `hooks/useForecast.ts` — job polling with exponential backoff
- [ ] Loading skeleton while job runs (MUI Skeleton)

### Done when

- [ ] User selects dataset + horizon → forecast job runs in background
- [ ] Progress bar shows live progress
- [ ] Chart renders historical + projected + confidence interval
- [ ] Metrics visible (MAPE, RMSE, MAE)

---

## Phase 3 — Calendar of Events

> Goal: user adds events/promotions → forecast recalculates showing impact

### Backend

- [ ] `GET /api/events` — list user events + global events
- [ ] `POST /api/events` — create event (validated date range)
- [ ] `DELETE /api/events/{id}` — delete own event
- [ ] Prophet integration: inject user events as regressors
- [ ] `GET /api/forecast/{id}/compare` — with vs without events comparison
- [ ] AR public holidays auto-loaded via `holidays` library
- [ ] RLS: global events (user_id=null) visible to all, own events private

### Frontend

- [ ] Calendar page layout
- [ ] `components/calendar/EventCalendar.tsx` — month grid (react-big-calendar or custom MUI)
- [ ] `components/calendar/EventForm.tsx` — add event drawer (name, type, dates, impact %)
- [ ] `components/calendar/EventChip.tsx` — color-coded by type (holiday/promo/seasonal)
- [ ] "See impact on forecast →" button → navigates to forecast with events active
- [ ] Toggle: forecast with events ON/OFF comparison

### Done when

- [ ] User adds "Black Friday +20%" → forecast recalculates showing spike
- [ ] Side-by-side comparison: baseline vs with-events
- [ ] AR public holidays visible by default

---

## Phase 4 — AI Chat with Streaming SSE

> Goal: user chats about their data, tokens stream in real-time

### Backend

- [ ] `POST /api/chat/stream` — SSE endpoint with StreamingResponse
- [ ] OpenRouter multi-model router (same pattern as Priorizador project)
- [ ] LLM tools:
  - [ ] `query_dataset(sql)` — DuckDB over user's dataset
  - [ ] `get_forecast_summary()` — current forecast metrics
  - [ ] `get_events()` — active calendar events
  - [ ] `suggest_model_change(reason)` — propose switching ML model
- [ ] System prompt: dataset schema + current forecast context + session KPIs
- [ ] Follow-up suggestion extraction from LLM response
- [ ] Rate limiting per user (Redis token bucket)

### Frontend

- [ ] Chat page layout (sidebar left, chat main)
- [ ] `components/chat/ModelSelector.tsx` — free OpenRouter models dropdown (MUI Select)
- [ ] `components/chat/ChatBox.tsx` — message list with auto-scroll
- [ ] `components/chat/MessageBubble.tsx` — user/assistant styling, Markdown rendering
- [ ] `components/chat/StreamingCursor.tsx` — blinking cursor while streaming
- [ ] `components/chat/QuickQuestions.tsx` — suggested questions chips
- [ ] `hooks/useChat.ts` — SSE reader, token accumulation, error recovery
- [ ] Inline charts from LLM (render Recharts from JSON spec)
- [ ] Copy message button

### Done when

- [ ] User types question → tokens stream letter by letter
- [ ] Model selector works (DeepSeek / Llama / Gemini / Qwen)
- [ ] LLM can query the dataset and answer data questions
- [ ] Follow-up suggestions appear after each response

---

## Phase 5 — Auth + Persistence

> Goal: Google/GitHub login, forecast history saved per user

### Backend

- [ ] Better Auth integration with Next.js
- [ ] Supabase RLS policies verified for all tables
- [ ] `user_id` propagated to all forecasts, events, datasets
- [ ] `GET /api/me/history` — paginated forecast history
- [ ] Session middleware in FastAPI (verify JWT from Better Auth)

### Frontend

- [ ] Login page (Google + GitHub OAuth buttons — MUI)
- [ ] Better Auth client setup
- [ ] Protected routes (redirect to login if unauthenticated)
- [ ] Settings page: API keys (OpenRouter BYOK), preferred model
- [ ] History section in sidebar: past forecasts with quick-load
- [ ] User avatar + menu in topbar

### Done when

- [ ] Login with Google works end-to-end
- [ ] Each user sees only their own forecasts and events
- [ ] Returning user sees their forecast history

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

---

## Session Log

| Date | Session | Completed           |
| ---- | ------- | ------------------- |
| 2026-05-17 | 2 | CI verde en ambos jobs (backend + frontend). Fixes: ruff format, mypy lifespan type, ESLint config, unused import. Phase 0 cerrada. |
| 2026-05-17 | 3 | Phase 1 backend: supabase.py, detector.py (MAD+FFT+SeasonalMK+CV), datasets.py (3 endpoints), tests/unit/test_detector.py (11 tests), Dockerfile fix (uv.lock), pymannkendall dep. |
| 2026-05-17 | 4 | Fixes CI: ruff I001+F841+F401, pyproject readme field removido, deploy.yml deshabilitado (Railway directo desde repo). Dataset script + 3 CSVs mensuales con outliers. |

---

_Update this file after every work session. Mark tasks `[x]` as completed._
