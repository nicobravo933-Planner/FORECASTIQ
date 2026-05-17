# CLAUDE.md — forecastiq Developer Guide

> **Read this file before touching any code.**
> This is the single source of truth for conventions, architecture decisions, and pitfalls.
> When in doubt: ask before implementing.

---

## 🧠 Behavior Rules for Claude

```Plaintext
You are a senior full-stack engineer and ML engineer working on forecastiq —
a public SaaS that lets anyone connect their sales data, get automatic
time-series forecasts, and chat with their data using AI.

Your job is to write production-quality code that is clean, typed, and consistent.
You follow the conventions in this file strictly. You never rewrite entire files
unless explicitly asked. You make surgical edits and report what changed and why.
```

**Non-negotiable rules:**

- Never rewrite a file > 30 lines without explicit permission — patch only what changed
- Always read the relevant file before editing it
- Always check `TODO.md` for current phase before starting work
- If a file doesn't exist yet, ask before creating it
- Propose, don't impose — for architecture decisions, list options with tradeoffs
- Spanish comments in Python are fine; TypeScript uses English comments

---

## 📁 Project Structure

```Plaintext
forecastiq/
├── backend/                        # Python — FastAPI + ML
│   ├── pyproject.toml              # UV managed — never use pip directly
│   ├── uv.lock                     # committed, do not edit manually
│   ├── Dockerfile
│   ├── app/
│   │   ├── main.py                 # FastAPI app factory
│   │   ├── core/
│   │   │   ├── config.py           # pydantic-settings, all env vars
│   │   │   ├── logging.py          # structured logging setup
│   │   │   └── dependencies.py     # FastAPI Depends() shared deps
│   │   ├── api/
│   │   │   ├── health.py           # GET /health
│   │   │   ├── datasets.py         # upload, preview, detect
│   │   │   ├── forecast.py         # run, status, result
│   │   │   └── chat.py             # SSE streaming chat
│   │   ├── ml/
│   │   │   ├── detector.py         # auto model selection logic
│   │   │   ├── models/
│   │   │   │   ├── base.py         # abstract ForecastModel
│   │   │   │   ├── moving_average.py
│   │   │   │   ├── holt_winters.py
│   │   │   │   ├── prophet_model.py
│   │   │   │   └── lightgbm_model.py
│   │   │   └── evaluator.py        # MAPE, RMSE, MAE
│   │   ├── services/
│   │   │   ├── supabase.py         # Supabase client wrapper
│   │   │   ├── redis_cache.py      # Upstash Redis cache
│   │   │   ├── celery_app.py       # Celery + tasks
│   │   │   └── llm/
│   │   │       ├── client.py       # OpenRouter router (multi-provider)
│   │   │       ├── openrouter.py   # OpenRouter SSE streaming
│   │   │       └── tools.py        # LLM tool definitions
│   │   └── models/                 # SQLAlchemy ORM models
│   │       ├── product.py
│   │       ├── sale.py
│   │       ├── event.py
│   │       └── forecast.py
│   └── tests/
│       ├── conftest.py
│       ├── unit/
│       └── integration/
│
├── frontend/                       # TypeScript — Next.js 14 + MUI v6
│   ├── package.json
│   ├── tsconfig.json
│   ├── app/                        # App Router
│   │   ├── layout.tsx              # root layout + ThemeProvider
│   │   ├── page.tsx                # landing / redirect
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx          # sidebar + topbar
│   │       ├── dataset/page.tsx    # upload + column selector
│   │       ├── forecast/page.tsx   # results + chart
│   │       ├── calendar/page.tsx   # events manager
│   │       ├── chat/page.tsx       # AI assistant
│   │       └── settings/page.tsx   # API keys, model selector
│   ├── components/
│   │   ├── ui/                     # pure MUI wrappers, no business logic
│   │   ├── charts/                 # Recharts components
│   │   ├── chat/                   # ChatBox, MessageBubble, ModelSelector
│   │   └── forecast/               # ForecastChart, MetricsCard, ModelBadge
│   ├── lib/
│   │   ├── api.ts                  # typed fetch client
│   │   ├── auth.ts                 # Better Auth config
│   │   ├── theme.ts                # MUI theme definition
│   │   └── types.ts                # shared TypeScript types
│   └── hooks/
│       ├── useChat.ts              # SSE streaming hook
│       ├── useForecast.ts          # forecast job polling
│       └── useDataset.ts           # dataset state
│
├── .github/
│   └── workflows/
│       ├── ci.yml                  # lint + test on every push/PR
│       └── deploy.yml              # deploy on merge to main
├── docker-compose.yml              # backend + redis for local dev
├── .env.example                    # template — never commit .env
├── .pre-commit-config.yaml
├── CLAUDE.md                       # ← you are here
├── TODO.md                         # current phase + task list
└── README.md
```

---

## 🎨 Frontend Conventions

### Styling — rem only, never px

```typescript
// ✅ CORRECT
sx={{ fontSize: '1rem', padding: '1.5rem', borderRadius: '0.5rem' }}
sx={{ gap: '0.75rem', marginBottom: '2rem' }}

// ❌ WRONG — never use px
sx={{ fontSize: '16px', padding: '24px', borderRadius: '8px' }}
```

**Why rem:** respects user browser font settings, scales correctly across devices, consistent with MUI's own spacing system.

**Rem reference:**

```Plaintext
0.25rem =  4px    (tight spacing)
0.5rem  =  8px    (small gap)
0.75rem = 12px    (compact)
1rem    = 16px    (base — body text)
1.25rem = 20px    (large text)
1.5rem  = 24px    (section spacing)
2rem    = 32px    (section header)
3rem    = 48px    (hero/display)
```

### MUI Theme — always use theme tokens, never hardcode colors

```typescript
// ✅ CORRECT — uses theme
sx={{ color: 'primary.main', bgcolor: 'background.paper' }}
sx={{ color: 'text.secondary', borderColor: 'divider' }}

// ❌ WRONG — hardcoded color
sx={{ color: '#6366f1', bgcolor: '#ffffff' }}
```

### Theme definition lives in `frontend/lib/theme.ts`

```typescript
// All colors are defined once here — never anywhere else
export const theme = createTheme({
  palette: {
    primary: { main: "#6366f1" }, // indigo
    secondary: { main: "#06b6d4" }, // cyan
    // ...
  },
  typography: {
    fontFamily: '"Inter", "Roboto", sans-serif',
    // all sizes in rem
    h1: { fontSize: "2.25rem", fontWeight: 700 },
    h2: { fontSize: "1.875rem", fontWeight: 600 },
    body1: { fontSize: "1rem" },
    caption: { fontSize: "0.75rem" },
  },
  shape: { borderRadius: 8 }, // MUI uses px internally — override in sx with rem
});
```

### Component conventions

```typescript
// 1. One component per file
// 2. Named exports (not default) for components used in multiple places
// 3. Props interface always defined explicitly

interface ForecastChartProps {
  data: ForecastPoint[]
  horizon: number
  modelName: string
  showConfidenceInterval?: boolean   // optional with default
}

export function ForecastChart({
  data,
  horizon,
  modelName,
  showConfidenceInterval = true,
}: ForecastChartProps) { ... }

// 4. 'use client' only when truly needed (event handlers, hooks, browser APIs)
// 5. Server Components by default in App Router
```

### File naming

```Plaintext
components/forecast/ForecastChart.tsx    ← PascalCase for components
hooks/useForecast.ts                     ← camelCase with "use" prefix
lib/api.ts                               ← camelCase for utilities
app/dashboard/forecast/page.tsx          ← lowercase for Next.js routes
```

---

## 🐍 Backend Conventions

### Environment and dependency management

```bash
# Always use UV — never pip directly
uv add <package>             # add dependency
uv add --dev <package>       # add dev dependency
uv run <command>             # run in virtualenv
uv run pytest                # run tests
uv run uvicorn app.main:app  # run server
```

### Config — all env vars in one place

```python
# app/core/config.py — pydantic-settings
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # App
    environment: str = "development"
    debug: bool = False

    # Database
    supabase_url: str
    supabase_anon_key: str
    supabase_service_key: str
    database_url: str

    # Cache
    upstash_redis_url: str
    upstash_redis_token: str

    # Auth
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"

    # LLM
    openrouter_api_key: str = ""
    openrouter_model: str = "deepseek/deepseek-r1-0528:free"
    gemini_api_key: str = ""
    anthropic_api_key: str = ""

    class Config:
        env_file = ".env"

settings = Settings()
```

### LLM provider pattern — same as current Priorizador project

```python
# app/services/llm/client.py
async def ask_llm(messages, session_context, on_token=None):
    """Router: delegates to provider based on session_context."""
    provider = (
        session_context.get("active_provider")
        or os.getenv("LLM_PROVIDER", "openrouter")
    ).lower()

    model = (
        session_context.get("active_model")
        or settings.openrouter_model
    )

    if provider == "gemini":
        return await _ask_gemini(messages, session_context, on_token)
    else:
        return await _ask_openrouter(messages, session_context, model, on_token)
```

**Free models available on OpenRouter (selectable from frontend):**

```python
FREE_MODELS = [
    {"id": "deepseek/deepseek-r1-0528:free",      "label": "DeepSeek R1"},
    {"id": "meta-llama/llama-3.3-70b:free",        "label": "Llama 3.3 70B"},
    {"id": "google/gemini-2.0-flash:free",          "label": "Gemini 2.0 Flash"},
    {"id": "qwen/qwen3-235b-a22b:free",             "label": "Qwen3 235B"},
    {"id": "mistralai/mistral-7b-instruct:free",    "label": "Mistral 7B"},
]
```

### API response conventions

```python
# Always return typed Pydantic responses
from pydantic import BaseModel

class ForecastResult(BaseModel):
    job_id: str
    status: str                        # pending | running | done | failed
    model_used: str | None = None
    mape: float | None = None
    predictions: list[PredictionPoint] = []

# HTTP status codes:
# 200 → success
# 201 → created (POST that creates a resource)
# 202 → accepted (async job started)
# 400 → bad request (validation error)
# 401 → unauthenticated
# 403 → unauthorized (wrong user)
# 404 → not found
# 422 → unprocessable (Pydantic validation — FastAPI handles automatically)
# 500 → internal error (never expose details to client)
```

### Error handling pattern

```python
from fastapi import HTTPException

# ✅ CORRECT — descriptive, user-friendly
raise HTTPException(status_code=400, detail="Column 'fecha' not found in dataset. Available: date, product, qty")

# ❌ WRONG — exposes internals
raise HTTPException(status_code=500, detail=str(e))
```

### ML model interface — always inherit from base

```python
# app/ml/models/base.py
from abc import ABC, abstractmethod
import pandas as pd

class ForecastModel(ABC):
    name: str
    requires_min_observations: int

    @abstractmethod
    def fit(self, series: pd.Series) -> None: ...

    @abstractmethod
    def predict(self, horizon: int) -> pd.DataFrame: ...
        # returns: DataFrame with columns [date, predicted, lower, upper]

    @abstractmethod
    def evaluate(self, test: pd.Series) -> dict[str, float]: ...
        # returns: {"mape": float, "rmse": float, "mae": float}
```

### Testing conventions

```python
# tests/unit/test_detector.py
import pytest
import pandas as pd
import numpy as np
from app.ml.detector import detect_best_model

def test_short_series_uses_moving_average():
    """Series with < 52 obs should always use moving average."""
    series = pd.Series(np.random.rand(30))
    result = detect_best_model(series, freq="W")
    assert result.model == "moving_average"

def test_seasonal_series_uses_holt_winters():
    """Clear seasonal series (52 weeks) → Holt-Winters."""
    t = np.arange(104)
    series = pd.Series(10 + 3 * np.sin(2 * np.pi * t / 52) + np.random.rand(104) * 0.5)
    result = detect_best_model(series, freq="W")
    assert result.model == "holt_winters"
```

---

## 🔐 Security Rules

```Plaintext
NEVER commit to the repo:
  ✗ .env files
  ✗ API keys (OpenRouter, Supabase, etc.)
  ✗ JWT secrets
  ✗ Database passwords
  ✗ Private keys

ALWAYS:
  ✓ Use .env.example with placeholder values
  ✓ Read secrets from environment (pydantic-settings)
  ✓ Ephemeral DB connections for user-provided connection strings (dispose immediately after)
  ✓ Row Level Security on all Supabase tables
  ✓ Validate all user inputs with Pydantic before processing
```

---

## 🚀 CI/CD Rules

```yaml
# Every push to any branch → ci.yml runs:
#   1. ruff check (lint)
#   2. ruff format --check
#   3. mypy (type check)
#   4. pytest (unit + integration)
#
# Merge to main → deploy.yml runs:
#   1. ci.yml (all checks must pass)
#   2. docker build + push to ghcr.io
#   3. railway deploy (backend)
#   4. vercel deploy (frontend — auto via Vercel GitHub integration)
```

**CI must always be green on `main`. Never merge a failing PR.**

---

## 📦 Key Dependencies

| Package                     | Purpose                     | Notes                       |
| --------------------------- | --------------------------- | --------------------------- |
| `fastapi`                   | API framework               | use `async def` everywhere  |
| `uvicorn`                   | ASGI server                 | with `--reload` in dev only |
| `pydantic-settings`         | Config management           | all env vars here           |
| `sqlalchemy[asyncio]`       | ORM                         | async sessions              |
| `supabase`                  | Supabase Python client      | storage + DB                |
| `redis`                     | Upstash Redis cache         | forecast result caching     |
| `celery`                    | Background ML jobs          | with Redis broker           |
| `prophet`                   | Time-series forecasting     | install separately (C deps) |
| `lightgbm`                  | Gradient boosting           | with optuna for HPO         |
| `optuna`                    | Hyperparameter optimization | pruner: MedianPruner        |
| `pandas`                    | Data manipulation           |                             |
| `httpx`                     | Async HTTP                  | for OpenRouter calls        |
| `openai`                    | OpenRouter SDK compat       | base_url override           |
| `pytest` + `pytest-asyncio` | Testing                     |                             |
| `ruff`                      | Linting + formatting        | replaces black + flake8     |
| `mypy`                      | Type checking               | strict mode                 |

---

## ⚠️ Known Pitfalls

### SSE Streaming (FastAPI)

```python
# ✅ CORRECT — always set these headers
return StreamingResponse(
    generate(),
    media_type="text/event-stream",
    headers={
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",    # critical for nginx proxies
        "Connection": "keep-alive",
    }
)
```

### Celery + async

```python
# Celery tasks are sync — use asyncio.run() to call async code inside them
@celery_app.task
def run_forecast_task(dataset_id: str, config: dict):
    import asyncio
    result = asyncio.run(_async_forecast(dataset_id, config))
    return result
```

### Prophet installation

```bash
# Prophet requires C compiler — install separately BEFORE other deps
uv add prophet --no-build-isolation
# On Docker: RUN apt-get install -y gcc g++ && pip install prophet
```

### Supabase RLS

```Plaintext
Every table has Row Level Security enabled.
Always test queries with the anon key (not service key) to catch RLS issues.
Service key bypasses RLS — only use it in backend, never expose to frontend.
```

### Next.js App Router — Server vs Client components

```typescript
// Default: Server Component (no 'use client')
//   ✓ data fetching, static content, layouts
//   ✗ useState, useEffect, onClick, browser APIs

// Add 'use client' only when needed:
//   ✓ interactive charts (Recharts)
//   ✓ SSE streaming (useChat hook)
//   ✓ forms with state
"use client";
```

---

## 📋 Workflow for New Features

```Plaintext
1. Check TODO.md → confirm feature is in current phase
2. Read relevant existing files (don't assume structure)
3. Write/update types first (TypeScript interfaces, Pydantic models)
4. Implement backend endpoint with tests
5. Implement frontend component
6. Update TODO.md → mark task done
7. Commit with conventional commit message:
   feat(forecast): add Holt-Winters model with seasonal detection
   fix(chat): handle SSE connection drop gracefully
   docs(readme): add deployment section
```

---

_Last updated: Phase 1 — Data ingestion + Model detection_
_Stack: FastAPI + Next.js 14 + MUI v6 + Supabase + Redis + OpenRouter_

---

## 🧠 ML Decisions (closed — do not re-discuss)

### Models in scope
```
moving_average   → baseline, series < 52 obs
holt_winters     → trend + clear seasonality (workhorse)
sarima           → replaces Prophet — statsmodels, rigorous CI
lightgbm         → high CV or external features, Optuna HPO
prophet          → BACKLOG only (bad reputation, C deps)
```

### Evaluation metrics (Phase 2 evaluator.py)
```
WAPE   → primary metric, industry standard (robust to zeros)
MAE    → interpretable in business units
BIAS   → detects systematic over/under-estimation (critical per Vandeputt)
RMSE   → penalizes large errors, used for model selection
MAPE   → included with warning when zeros present
```

### Outlier strategy
```
Phase 1 (detector.py): MAD detection only (threshold=3.0, modified Z-score)
Phase 2 (before fit): Winsorization p5/p95
Never Z-score: assumes normality, bad for seasonal demand series
```

### Detector pipeline order
```
1. MAD outlier detection
2. FFT seasonality (numpy, candidate periods by freq)
3. Seasonal Mann-Kendall trend (pymannkendall library)
4. CV calculation
5. Model selection rules
```
