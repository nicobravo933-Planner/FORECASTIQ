<p align="center">
  <img src="logo.png" alt="forecastiq logo" width="300"/><br/>
  <em>Conectá tus ventas. Obtené forecasts con IA al instante. Charlá con tus números.</em>
  <br/><br/>
  <!-- Estado del proyecto -->
  <img src="https://img.shields.io/badge/status-live%20en%20producci%C3%B3n-22c55e?style=for-the-badge&logo=githubactions&logoColor=white"/>
  <img src="https://img.shields.io/badge/phase-9%20Scale%20Engine%20%E2%8F%B3-6366f1?style=for-the-badge"/>
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
  <img src="https://img.shields.io/badge/Cloudflare-R2%20Storage-F38020?logo=cloudflare&logoColor=white"/>
  <img src="https://img.shields.io/badge/Redis-Upstash-00E9A3?logo=upstash&logoColor=white"/>
  <img src="https://img.shields.io/badge/Celery-worker-37814A?logo=celery&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/Backend-AWS%20EC2-FF9900?logo=amazonaws&logoColor=white"/>
  <img src="https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white"/>
  <br/>
  <!-- ML / AI / MLOps -->
  <img src="https://img.shields.io/badge/LLM-OpenRouter-FF6B35"/>
  <img src="https://img.shields.io/badge/ML-Holt--Winters-4285F4"/>
  <img src="https://img.shields.io/badge/ML-SARIMA-0ea5e9"/>
  <img src="https://img.shields.io/badge/ML-LightGBM-green"/>
  <img src="https://img.shields.io/badge/HPO-Optuna-6236FF"/>
  <img src="https://img.shields.io/badge/MLflow-Dagshub-0194E2?logo=mlflow&logoColor=white"/>
  <img src="https://img.shields.io/badge/Evidently-drift%20detection-8B5CF6"/>
  <br/>
  <!-- Roadmap futuro -->
  <img src="https://img.shields.io/badge/observability-Grafana%20Cloud%20✅-F46800?logo=grafana&logoColor=white"/>
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
> **Phase 6 — Deploy + CI/CD** ✅ completa · GitHub Actions → Docker → ghcr.io → AWS EC2 + Vercel (frontend)
>
> **Phase 7 — Observability** ✅ completa · structlog JSON + OTel traces → Grafana Cloud + [dashboard producción](https://nicobravo933.grafana.net/goto/shcs6k)
>
> **Phase 7.5 — UI Polish + Rate Limiting** ✅ completa · split login · logo sidebar · tabs dataset · rate limits 429
>
> **Phase 8 — MLOps** ✅ completa · MLflow (Dagshub) + Evidently AI drift detection + dashboard `/dashboard/mlops`
>
> **Phase 9–14 — Enterprise Roadmap** ⏳ pendiente · Nixtla · Polars · PySpark · Airflow · BigQuery/dbt · Terraform + K8s

---

## ✨ ¿Qué es forecastiq?

**forecastiq** es un SaaS open-source que permite a cualquiera —sin conocimiento de ML— subir sus datos de ventas y obtener forecasts de calidad profesional al instante. La app detecta automáticamente si tus datos necesitan un promedio móvil simple o un pipeline completo de LightGBM + Optuna, ejecuta el modelo en background y te deja chatear con los resultados usando IA.

> Proyecto público de portafolio que muestra una arquitectura full-stack moderna y cloud-native.

---

## 🎯 Features clave

| Feature                      | Descripción                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------ |
| 📁 **Subida CSV**            | Soltá tu CSV de ventas — no necesita formato previo. Límite 10 MB.                                     |
| 🎲 **Dataset demo**          | Dataset 25k SKUs × 3 años en Cloudflare R2 — explorá sin subir nada (Fase 9)          |
| 🤖 **Selección automática**  | Detección FFT + Seasonal Mann-Kendall elige MA / Holt-Winters / SARIMA / LightGBM                      |
| 📈 **Forecast interactivo**  | Horizontes +3 / +6 / +12 meses con intervalos de confianza                                             |
| 📅 **Calendario de eventos** | Agregá promociones, feriados y eventos externos — impactan el forecast                                 |
| 💬 **Chat IA (streaming)**   | Preguntale a tus datos en lenguaje natural — tokens en tiempo real                                     |
| 🔐 **Datos por usuario**     | Login OAuth2 — tus forecasts son privados, aislados por RLS de Supabase                                |
| 🆓 **Modelos LLM gratuitos** | Impulsado por OpenRouter free tier (DeepSeek V4 Flash, GLM 4.5 Air, GPT OSS 120B, Nemotron 120B y más) |
| 🧪 **MLflow tracking**       | Cada forecast queda registrado con params + métricas + modelo serializado (Fase 8)                     |
| 📉 **Drift detection**       | Evidently AI detecta cuándo los datos cambiaron y el modelo necesita reentrenarse (Fase 8)             |

---

## 🏗️ Arquitectura

```plaintext
┌──────────────────────────────────────────────────────────────┐
│                     Navegador del usuario                     │
│              Next.js 14 + MUI v6 + TypeScript                │
│     (Vercel — deploy automático + proxy HTTPS → EC2)         │
└─────────────────────────┬────────────────────────────────────┘
                          │  REST + SSE (via Vercel proxy)
┌─────────────────────────▼────────────────────────────────────┐
│                  Backend FastAPI (liviano)                    │
│              Python 3.12 · UV · pydantic-settings            │
│           (AWS EC2 t3.micro — solo API + Redis)              │
│                                                              │
│        ┌──────────────┐        ┌────────────────┐           │
│        │  Motor ML    │        │  Router LLM    │           │
│        │  detector.py │        │  OpenRouter    │           │
│        │  Holt-Winters│        │  SSE streaming │           │
│        │  SARIMA      │        │  multi-model   │           │
│        └──────────────┘        └────────────────┘           │
└──────┬──────────────────────────┬───────────────────────────┘
       │                          │
┌──────▼──────┐        ┌──────────▼──────────┐
│  Supabase   │        │    Upstash Redis     │
│ PostgreSQL  │        │    cache + rate      │
│   Storage   │        │    limiting          │
│ Auth + RLS  │        └─────────────────────┘
└─────────────┘

── Pipeline ML Enterprise (corre en PC local / notebooks) ─────
┌─────────────────────────────────────────────────────────────┐
│  Nixtla StatsForecast · PySpark · MLflow → Dagshub          │
│  Evidently drift · Airflow DAGs · LightGBM + Optuna HPO     │
│  Dataset 25k SKUs × 3 años (27M filas) en Supabase Storage  │
│  Resultados → Supabase → visibles en la app en producción   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del proyecto

```plaintext
forecastiq/
├── backend/                    # Python — FastAPI + ML
│   ├── pyproject.toml          # Dependencias con UV
│   ├── Dockerfile
│   └── app/
│       ├── main.py             # FastAPI app factory
│       ├── core/               # config, logging, dependencias
│       ├── api/                # endpoints: datasets, forecast, chat, mlops
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
├── infra/
│   ├── aws/                    # setup EC2 + nginx + guía de deploy
│   └── alloy/                  # Grafana Alloy config (observability)
├── .github/workflows/
│   ├── ci.yml                  # lint + test en cada push
│   └── deploy.yml              # SSH deploy a EC2 al mergear a main
├── docker-compose.yml          # dev local Y prod EC2: backend + worker + redis
├── .env.example
├── CLAUDE.md                   # Guía para desarrolladores IA
└── TODO.md                     # seguimiento de fases
```

---

## 🚀 Quick Start local

> Levantá la app completa en ~5 minutos. No necesitás AWS ni Railway.

```bash
# 1. Clonar
git clone https://github.com/nicobravo/forecastiq.git && cd forecastiq

# 2. Redis local
docker run -d -p 6379:6379 redis:alpine

# 3. Backend
cd backend && cp .env.example .env   # completar SUPABASE_* y JWT_SECRET_KEY
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 4. Celery worker (terminal separada)
cd backend && uv run celery -A app.services.celery_app.celery_app worker --loglevel=info

# 5. Frontend (terminal separada)
cd frontend && cp .env.example .env.local   # completar NEXT_PUBLIC_SUPABASE_* y BETTER_AUTH_*
npm install && npm run dev
# → http://localhost:3000
```

> **Variables mínimas:** `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`,
> `JWT_SECRET_KEY` (cualquier string en local), `BETTER_AUTH_URL=http://localhost:3000`.
> Sin `OPENROUTER_API_KEY` la app funciona pero el chat IA no responde.
> `MLFLOW_TRACKING_URI=./mlruns` — MLflow escribe a disco local, sin servidor.

### Migraciones Supabase (una sola vez)

Ejecutar en orden en el **SQL Editor** del Dashboard de Supabase:

```
1. backend/migrations/001_forecast_jobs.sql
2. backend/migrations/002_events.sql
3. backend/migrations/003_add_user_id.sql
4. backend/migrations/004_chat_conversations.sql
5. backend/migrations/005_hpo_cache.sql
6. backend/migrations/006_better_auth_schema.sql
```

### Prerrequisitos

- Python 3.12+ · Node.js 20+ · Docker (solo para Redis)
- [UV](https://astral.sh/uv): `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Cuenta [Supabase](https://supabase.com) (free tier) — obligatorio
- API key [OpenRouter](https://openrouter.ai) (free tier) — opcional (solo para chat IA)

---

## 🌍 Variables de entorno

**`backend/.env`** (EC2 / local):

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Upstash Redis (free permanente)
UPSTASH_REDIS_URL=rediss://...
CELERY_TASK_ALWAYS_EAGER=True   # False en producción
CELERY_BROKER_URL=redis://localhost:6379/0

# MLflow — Dagshub en prod, filesystem en dev
MLFLOW_TRACKING_URI=./mlruns                          # dev
# MLFLOW_TRACKING_URI=https://dagshub.com/<user>/forecastiq.mlflow  # prod

# LLM
OPENROUTER_API_KEY=sk-or-...

# Auth
JWT_SECRET_KEY=  # openssl rand -hex 32
BETTER_AUTH_URL=https://forecastiq.vercel.app
```

> Ver plantillas completas en `backend/.env.example` y `frontend/.env.example`.

---

## 🤖 Modelos LLM soportados (gratis)

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

```plaintext
n < 52 observaciones                        →  Moving Average (baseline robusto)
n ≥ 52  + estacionalidad detectada (FFT)    →  Holt-Winters Triple Exponencial
n ≥ 104 + tendencia sin estacionalidad      →  SARIMA (statsmodels, CI riguroso)
n ≥ 104 + alta volatilidad (CV > 1.0)      →  LightGBM + lags + Optuna HPO
```

Pipeline de detección: MAD (outliers) → FFT (estacionalidad) → Seasonal Mann-Kendall (tendencia) → Winsorización p5/p95.

**Métricas de evaluación:** WAPE · MAE · BIAS · RMSE · MAPE

---

## 🧪 Ejecutar tests

```bash
cd backend
uv run pytest                              # todos los tests
uv run pytest tests/unit                   # solo unit tests
uv run pytest --cov=app --cov-report=html  # con cobertura
```

---

## 🚢 Deploy en producción (AWS EC2)

El deploy está completamente automatizado vía GitHub Actions:

```plaintext
git push main
  → CI: ruff + mypy + pytest (debe pasar)
  → Build imagen Docker → push a ghcr.io
  → SSH al EC2 → docker compose pull + up -d
  → Vercel: deploy automático del frontend (vía integración GitHub)
```

Ver guía completa de setup en [`infra/aws/README.md`](infra/aws/README.md).

**Secrets necesarios en GitHub Actions:**

| Secret | Descripción |
|--------|-------------|
| `EC2_HOST` | IP pública del EC2 |
| `EC2_USER` | `ec2-user` |
| `EC2_SSH_KEY` | Contenido del archivo `.pem` |
| `GHCR_TOKEN` | GitHub PAT (scopes: `read:packages`, `write:packages`) |

**URLs de producción:**
- Frontend: https://forecastiq.vercel.app
- Backend API: https://`<EC2_IP>` (actualizar cuando esté configurado)
- Health check: https://`<EC2_IP>`/health
- API docs: https://`<EC2_IP>`/docs
- MLflow UI: https://dagshub.com/`<usuario>`/forecastiq/experiments

---

## 💰 Stack 100% gratuito (sin expiración)

| Servicio | Proveedor | Free tier |
|----------|-----------|-----------|
| Frontend | Vercel | Permanente |
| Backend + Worker | AWS EC2 t2.micro | 12 meses → luego ~$8/mes |
| Base de datos | Supabase PostgreSQL | Permanente |
| Storage demo | Cloudflare R2 (10 GB) | Egress gratuito permanente |
| Redis | Upstash (10k req/día) | Permanente |
| MLflow tracking | Dagshub | Permanente |
| Observability | Grafana Cloud | Permanente |
| CI/CD | GitHub Actions | Permanente |

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
- [x] **Fase 6** — Deploy completo a producción (AWS EC2 + Vercel + CI/CD)
- [x] **Fase 7** — Observability · structlog JSON + OTel traces → Grafana Cloud + [dashboard](https://nicobravo933.grafana.net/goto/shcs6k)
- [x] **Fase 7.5** — UI Polish + Rate Limiting · split login · logo sidebar · tabs dataset
- [x] **Fase 8** — MLOps · MLflow (Dagshub) + Evidently AI + dashboard `/dashboard/mlops`

### 🔄 En curso

- [ ] **Fase 9** — Scale Engine · Nixtla StatsForecast + Polars + DuckDB + Celery Beat

### ⏳ Roadmap Enterprise (Fases 9–14)

> Ver [`ROADMAP.md`](ROADMAP.md) para especificaciones técnicas y decisiones de arquitectura.

---

## 🤝 Contribuciones

¡Las contribuciones son bienvenidas! Por favor leé [`CLAUDE.md`](CLAUDE.md) para las convenciones de código antes de abrir un PR.

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
  <sub>Hecho con Python 🐍 · FastAPI · Next.js · MUI · Supabase · Upstash · AWS EC2 · Dagshub · OpenRouter</sub>
</p>
