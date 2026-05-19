<p align="center">
  <img src="logo.png" alt="forecastiq logo" width="300"/><br/>
  <em>Conectá tus ventas. Obtené forecasts con IA al instante. Charlá con tus números.</em>
  <br/><br/>
  <!-- Estado del proyecto -->
  <img src="https://img.shields.io/badge/status-live%20en%20producción-22c55e?style=for-the-badge&logo=githubactions&logoColor=white"/>
  <img src="https://img.shields.io/badge/phase-7%20observability%20✅-22c55e?style=for-the-badge"/>
  <br/><br/>
  <a href="https://forecastiq.vercel.app/dashboard/dataset"><img src="https://img.shields.io/badge/🚀%20Live%20Demo-forecastiq.vercel.app-6366f1?style=for-the-badge"/></a>
  <a href="https://nicobravo933.grafana.net/goto/shcs6k?orgId=stacks-1651316"><img src="https://img.shields.io/badge/📊%20Grafana%20Dashboard-production%20metrics-F46800?style=for-the-badge&logo=grafana&logoColor=white"/></a>
  <br/><br/>
  <!-- Core stack -->
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/MUI-v6-007FFF?logo=mui&logoColor=white"/>
  <br/>
  <!-- Infrastructure -->
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/Redis-Railway-DC382D?logo=redis&logoColor=white"/>
  <img src="https://img.shields.io/badge/Celery-worker-37814A?logo=celery&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/Backend-Railway-0B0D0E?logo=railway&logoColor=white"/>
  <img src="https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white"/>
  <br/>
  <!-- ML / AI -->
  <img src="https://img.shields.io/badge/LLM-OpenRouter-FF6B35"/>
  <img src="https://img.shields.io/badge/ML-Holt--Winters-4285F4"/>
  <img src="https://img.shields.io/badge/ML-SARIMA-0ea5e9"/>
  <img src="https://img.shields.io/badge/ML-LightGBM-green"/>
  <img src="https://img.shields.io/badge/HPO-Optuna-6236FF"/>
  <img src="https://img.shields.io/badge/data-27M%20filas%20sintéticas-f59e0b"/>
  <br/>
  <!-- Roadmap futuro -->
  <img src="https://img.shields.io/badge/próximo-MLflow%20%2B%20Evidently-0194E2?logo=mlflow&logoColor=white"/>
  <img src="https://img.shields.io/badge/observability-Grafana%20Cloud%20%E2%9C%85-F46800?logo=grafana&logoColor=white"/>
  <img src="https://img.shields.io/badge/roadmap-PySpark%20%2B%20Nixtla-E25A1C?logo=apachespark&logoColor=white"/>
  <img src="https://img.shields.io/badge/roadmap-Airflow%20DAGs-017CEE?logo=apacheairflow&logoColor=white"/>
  <img src="https://img.shields.io/badge/roadmap-BigQuery%20%2B%20dbt-4285F4?logo=googlebigquery&logoColor=white"/>
  <img src="https://img.shields.io/badge/roadmap-Terraform%20%2B%20K8s-7B42BC?logo=terraform&logoColor=white"/>
  <br/><br/>
  <img src="https://img.shields.io/badge/License-MIT-6366F1"/>
  <img src="https://img.shields.io/badge/UV-package%20manager-DE5FE9?logo=astral&logoColor=white"/>
  <img src="https://img.shields.io/badge/Ruff-linter-D7FF64?logo=ruff&logoColor=black"/>
  <img src="https://img.shields.io/badge/mypy-strict-2A6DB2"/>
</p>

---

> [!NOTE]
> **Phase 1 — Data Ingestion** ✅ completa · Backend: 3 endpoints + detector MAD/FFT/MK · Frontend: DropZone + ColumnSelector + DataPreview + ModelRecommendation
>
> **Phase 2 — Forecast Engine** ✅ completa · 4 modelos ML (MA, Holt-Winters, SARIMA, LightGBM+Optuna) + Recharts chart + métricas WAPE/MAE/BIAS/RMSE
>
> **Phase 3 — Calendar of Events** ✅ completa · Eventos CRUD + feriados AR + post-processing multiplicativo + toggle en forecast
>
> **Phase 4 — AI Chat con streaming SSE** ✅ completa · SSE real-time + DuckDB tools + 7 modelos OpenRouter free + inline charts + rate limiting Redis
>
> **Phase 5 — Auth + Persistencia** ✅ completa · OAuth2 Google/GitHub (Better Auth) + historial por usuario + RLS Supabase + Settings BYOK
>
> **Phase 6 — Deploy + CI/CD** ✅ completa · GitHub Actions → Railway (API + Worker) + Vercel (frontend) + Google OAuth prod
>
> **Phase 7 — Observability** ✅ completa · structlog JSON + OTel traces → Grafana Tempo + Grafana Alloy (scrape /metrics → Grafana Cloud) + [dashboard producción](https://nicobravo933.grafana.net/goto/shcs6k)
>
> **Phase 8–14 — Enterprise Roadmap** ⏳ pendiente · MLflow · Evidently AI · Nixtla · Polars · PySpark · Airflow · BigQuery/dbt · Terraform + K8s

---

## ✨ ¿Qué es forecastiq?

**forecastiq** es un SaaS open-source que permite a cualquiera —sin conocimiento de ML— subir sus datos de ventas y obtener forecasts de calidad profesional al instante. La app detecta automáticamente si tus datos necesitan un promedio móvil simple o un pipeline completo de LightGBM + Optuna, ejecuta el modelo en background y te deja chatear con los resultados usando IA.

> Proyecto público de portafolio que muestra una arquitectura full-stack moderna y cloud-native.

---

## 🎯 Features clave

| Feature                      | Descripción                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| 📁 **Subida CSV**            | Soltá tu CSV de ventas — no necesita formato previo                                                    |
| 🤖 **Selección automática**  | Detección FFT + Seasonal Mann-Kendall elige MA / Holt-Winters / SARIMA / LightGBM                      |
| 📈 **Forecast interactivo**  | Horizontes +3 / +6 / +12 meses con intervalos de confianza                                             |
| 📅 **Calendario de eventos** | Agregá promociones, feriados y eventos externos — impactan el forecast                                 |
| 💬 **Chat IA (streaming)**   | Preguntale a tus datos en lenguaje natural — tokens en tiempo real                                     |
| 🔐 **Datos por usuario**     | Login OAuth2 — tus forecasts son privados, aislados por RLS de Supabase                                |
| 🆓 **Modelos LLM gratuitos** | Impulsado por OpenRouter free tier (DeepSeek V4 Flash, GLM 4.5 Air, GPT OSS 120B, Nemotron 120B y más) |

---

## 🏗️ Arquitectura

```Plaintext
┌──────────────────────────────────────────────────────────────┐
│                     Navegador del usuario                     │
│              Next.js 14 + MUI v6 + TypeScript               │
│          (Vercel — deploy automático en git push)             │
└─────────────────────────┬────────────────────────────────────┘
                          │  REST + SSE
┌─────────────────────────▼────────────────────────────────────┐
│                     Backend FastAPI                           │
│              Python 3.12 · UV · pydantic-settings            │
│          (Railway — contenedor Docker, auto-deploy)           │
│                                                              │
│   ┌──────────────┐  ┌────────────────┐  ┌────────────────┐  │
│   │  Motor ML    │  │  Router LLM    │  │  Celery Worker │  │
│   │  detector.py │  │  OpenRouter    │  │  background    │  │
│   │  Holt-Winters│  │  SSE streaming │  │  jobs ML       │  │
│   │  LightGBM    │  │  multi-model   │  │                │  │
│   └──────────────┘  └────────────────┘  └────────────────┘  │
└──────┬──────────────────────────────────────┬────────────────┘
       │                                      │
┌──────▼──────┐                    ┌──────────▼─────────────┐
│  Supabase   │                    │    Railway Redis        │
│ PostgreSQL  │                    │  Celery broker + cache  │
│   Storage   │                    │  (resultados forecast)  │
│ Auth + RLS  │                    └────────────────────────┘
└─────────────┘
```

---

## 📁 Estructura del proyecto

```Plaintext
forecastiq/
├── backend/                    # Python — FastAPI + ML
│   ├── pyproject.toml          # Dependencias con UV
│   ├── Dockerfile
│   └── app/
│       ├── main.py             # FastAPI app factory
│       ├── core/               # config, logging, dependencias
│       ├── api/                # endpoints: datasets, forecast, chat
│       ├── ml/
│       │   ├── detector.py     # selección automática (FFT + Mann-Kendall)
│       │   └── models/         # MA, Holt-Winters, SARIMA, LightGBM
│       └── services/           # Supabase, Redis, Celery, router LLM
│
├── frontend/                   # TypeScript — Next.js 14 + MUI v6
│   ├── app/                    # Páginas App Router
│   │   ├── dashboard/
│   │   │   ├── dataset/        # subida CSV + selector de columnas
│   │   │   ├── forecast/       # resultados + gráfico interactivo
│   │   │   ├── calendar/       # gestor de eventos y promociones
│   │   │   ├── chat/           # asistente IA con streaming
│   │   │   └── settings/       # selector de modelos + API keys
│   │   └── (auth)/             # login + registro
│   ├── components/             # componentes MUI reutilizables
│   ├── hooks/                  # useChat (SSE), useForecast, useDataset
│   └── lib/                    # theme, API client, types, auth
│
├── .github/workflows/
│   ├── ci.yml                  # lint + test en cada push
│   └── deploy.yml              # deploy al mergear a main
├── railway.toml                # configuración Railway (build + healthcheck)
├── docker-compose.yml          # desarrollo local: backend + redis
├── .env.example
├── CLAUDE.md                   # Guía para desarrolladores IA
└── TODO.md                     # seguimiento de fases
```

---

## 🚀 Desarrollo local

### Prerrequisitos

- Python 3.12+
- Node.js 20+
- [UV](https://github.com/astral-sh/uv) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- Docker + Docker Compose
- Un proyecto de [Supabase](https://supabase.com) (free tier)
- Una API key de [OpenRouter](https://openrouter.ai) (free tier disponible)

### 1. Clonar y configurar

```bash
git clone https://github.com/nicobravo/forecastiq.git
cd forecastiq
cp .env.example .env
# Completá tus keys en .env
```

### 2. Iniciar backend + redis

```bash
docker compose up -d redis
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

### 3. Iniciar frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

### 4. O todo con Docker

```bash
docker compose up
# backend → :8000
# frontend → :3000
# redis   → :6379
```

---

## 🌍 Variables de entorno

Las variables están separadas por contexto de deploy:

**`backend/.env`** (Railway / local):

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Redis (Railway en prod, localhost en dev)
UPSTASH_REDIS_URL=redis://...
CELERY_TASK_ALWAYS_EAGER=True   # False en producción
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_RESULT_BACKEND=redis://localhost:6379/0

# LLM
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-r1-0528:free

# Auth
JWT_SECRET_KEY=  # python -c "import secrets; print(secrets.token_hex(32))"
BETTER_AUTH_URL=https://forecastiq.vercel.app
```

**`frontend/.env.local`** (Vercel / local):

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
BETTER_AUTH_SECRET=  # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
BETTER_AUTH_URL=https://forecastiq.vercel.app
```

> Ver plantillas completas en `backend/.env.example` y `frontend/.env.example`.

---

## 🤖 Modelos LLM soportados (gratis)

Todos los modelos son seleccionables desde el chat del frontend:

| Modelo            | Proveedor               |
| ----------------- | ----------------------- |
| OWL Alpha         | OpenRouter              |
| Nemotron 120B     | NVIDIA vía OpenRouter   |
| Laguna M.1        | Poolside vía OpenRouter |
| GPT OSS 120B      | OpenAI vía OpenRouter   |
| GLM 4.5 Air       | ZhipuAI vía OpenRouter  |
| DeepSeek V4 Flash | DeepSeek vía OpenRouter |
| MiniMax M2.5      | MiniMax vía OpenRouter  |

---

## 📊 Lógica de selección de modelo ML

forecastiq selecciona automáticamente el mejor modelo según las características de tus datos:

```plaintext
n < 52 observaciones                        →  Moving Average (baseline robusto)
n ≥ 52  + estacionalidad detectada (FFT)    →  Holt-Winters Triple Exponencial
n ≥ 104 + tendencia sin estacionalidad      →  SARIMA (statsmodels, CI riguroso)
n ≥ 104 + alta volatilidad (CV > 1.0)      →  LightGBM + lags + Optuna HPO
```

El pipeline de detección usa MAD para outliers, FFT para estacionalidad y Seasonal Mann-Kendall (pymannkendall) para tendencia. Winsorización p5/p95 se aplica antes de entrenar en Phase 2.

**Métricas de evaluación:** WAPE · MAE · BIAS · RMSE · MAPE

---

## 🧪 Ejecutar tests

```bash
cd backend
uv run pytest                          # todos los tests
uv run pytest tests/unit               # solo unit tests
uv run pytest tests/unit/test_detector # módulo específico
uv run pytest --cov=app --cov-report=html  # con cobertura
```

---

## 🚢 Deploy

El deploy está completamente automatizado vía GitHub Actions:

```Plaintext
git push main
  → CI: ruff + mypy + pytest (debe pasar)
  → Build imagen Docker → push a ghcr.io
  → Railway: deploy automático del backend (API + Worker)
  → Vercel: deploy automático del frontend (vía integración GitHub)
```

**URLs de producción:**
- Frontend: https://forecastiq.vercel.app
- Backend API: https://forecastiq-api-production.up.railway.app
- Health check: https://forecastiq-api-production.up.railway.app/health
- API docs: https://forecastiq-api-production.up.railway.app/docs

---

## 🗺️ Roadmap

Ver [`TODO.md`](TODO.md) para la lista completa de tareas fase por fase.

### ✅ Completado

- [x] **Fase 0** — Fundación (repo + CI + Docker)
- [x] **Fase 1** — Subida CSV + detección automática de modelo
- [x] **Fase 2** — Motor de forecast (4 modelos ML)
- [x] **Fase 3** — Calendario de eventos
- [x] **Fase 4** — Chat IA con streaming SSE
- [x] **Fase 5** — Auth + persistencia (Google/GitHub OAuth, historial por usuario)
- [x] **Fase 6** — Deploy completo a producción (Railway + Vercel + CI/CD)

### 🔄 En progreso

- [ ] **Fase 7** — Observability · OpenTelemetry → Grafana Cloud (Loki + Tempo + Mimir) + Sentry

### ⏳ Roadmap Enterprise (Fases 8–14)

| Fase | Objetivo | Stack |
|------|----------|-------|
| **8** | MLOps | MLflow experiment tracking + Evidently AI drift detection |
| **9** | Scale Engine | Nixtla StatsForecast vectorizado + Polars + Celery Beat batch |
| **10** | Dataset sintético | 25k SKUs × 3 años diario → 27M filas Parquet (✅ script listo) |
| **11** | PySpark local | Docker Spark cluster · feature engineering distribuido |
| **12** | Airflow | DAGs batch: forecast → drift check → MLflow cleanup |
| **13** | Data Warehouse | BigQuery free tier + dbt models + SQL analítico |
| **14** | Infra as Code | Terraform + Kubernetes manifests + Helm chart |

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor leé [`CLAUDE.md`](CLAUDE.md) para las convenciones de código antes de abrir un PR.

```bash
# Instalar pre-commit hooks
pip install pre-commit
pre-commit install
```

---

## 📬 Contacto

<p align="center">
  <strong>Nicolás Bravo</strong> — Data Scientist & Full-Stack Developer<br/><br/>
  <a href="mailto:nicobravo933@gmail.com"><img src="https://img.shields.io/badge/Email-nicobravo933%40gmail.com-ea4335?logo=gmail&logoColor=white"/></a>
  <a href="https://www.linkedin.com/in/nicolás-adrian-bravo-675070b8/"><img src="https://img.shields.io/badge/LinkedIn-Nicol%C3%A1s%20Bravo-0077b5?logo=linkedin&logoColor=white"/></a>
  <a href="https://github.com/nicobravo"><img src="https://img.shields.io/badge/GitHub-nicobravo-181717?logo=github&logoColor=white"/></a>
</p>

---

## 📄 Licencia

MIT © [Nicolás Bravo](https://github.com/nicobravo)

---

<p align="center">
  <sub>Hecho con Python 🐍 · FastAPI · Next.js · MUI · Supabase · OpenRouter</sub>
</p>
