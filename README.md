<p align="center">
  <img src="logo.png" alt="forecastiq logo" width="300"/><br/>
  <em>Conectá tus ventas. Obtené forecasts con IA al instante. Charlá con tus números.</em>
  <br/><br/>
  <!-- Estado del proyecto -->
  <img src="https://img.shields.io/badge/status-en%20construcción-orange?style=for-the-badge&logo=githubactions&logoColor=white"/>
  <img src="https://img.shields.io/badge/phase-2%20forecast%20engine-6366f1?style=for-the-badge"/>
  <br/><br/>
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/MUI-v6-007FFF?logo=mui&logoColor=white"/>
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/Redis-Upstash-DC382D?logo=redis&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/Backend-Railway-0B0D0E?logo=railway&logoColor=white"/>
  <img src="https://img.shields.io/badge/Frontend-Vercel-000000?logo=vercel&logoColor=white"/>
  <img src="https://img.shields.io/badge/LLM-OpenRouter-FF6B35"/>
  <img src="https://img.shields.io/badge/ML-Holt--Winters-4285F4"/>
  <img src="https://img.shields.io/badge/ML-SARIMA-0ea5e9"/>
  <img src="https://img.shields.io/badge/ML-LightGBM-green"/>
  <img src="https://img.shields.io/badge/HPO-Optuna-6236FF"/>
  <img src="https://img.shields.io/badge/License-MIT-6366F1"/>
</p>

---

> [!WARNING]
> **Este proyecto está en construcción activa.** La API, la estructura de carpetas y los contratos de datos pueden cambiar sin previo aviso mientras avanzamos por las fases del roadmap.

> [!NOTE]
> **Phase 1 — Data Ingestion** ✅ completa · Backend: 3 endpoints + detector MAD/FFT/MK · Frontend: DropZone + ColumnSelector + DataPreview + ModelRecommendation + sidebar dashboard · **Siguiente: Phase 2 — Forecast Engine**

---

## ✨ ¿Qué es forecastiq?

**forecastiq** es un SaaS open-source que permite a cualquiera —sin conocimiento de ML— subir sus datos de ventas y obtener forecasts de calidad profesional al instante. La app detecta automáticamente si tus datos necesitan un promedio móvil simple o un pipeline completo de LightGBM + Optuna, ejecuta el modelo en background y te deja chatear con los resultados usando IA.

> Proyecto público de portafolio que muestra una arquitectura full-stack moderna y cloud-native.

---

## 🎯 Features clave

| Feature                      | Descripción                                                               |
| ---------------------------- | ------------------------------------------------------------------------- |
| 📁 **Subida CSV**            | Soltá tu CSV de ventas — no necesita formato previo                       |
| 🤖 **Selección automática**  | Detección FFT + Seasonal Mann-Kendall elige MA / Holt-Winters / SARIMA / LightGBM |
| 📈 **Forecast interactivo**  | Horizontes +3 / +6 / +12 meses con intervalos de confianza                |
| 📅 **Calendario de eventos** | Agregá promociones, feriados y eventos externos — impactan el forecast    |
| 💬 **Chat IA (streaming)**   | Preguntale a tus datos en lenguaje natural — tokens en tiempo real        |
| 🔐 **Datos por usuario**     | Login OAuth2 — tus forecasts son privados, aislados por RLS de Supabase   |
| 🆓 **Modelos LLM gratuitos** | Impulsado por OpenRouter free tier (DeepSeek R1, Llama 3.3, Gemini Flash) |

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
│   │  Prophet     │  │  SSE streaming │  │  jobs ML       │  │
│   │  LightGBM    │  │  multi-model   │  │                │  │
│   └──────────────┘  └────────────────┘  └────────────────┘  │
└──────┬──────────────────────────────────────┬────────────────┘
       │                                      │
┌──────▼──────┐                    ┌──────────▼─────────────┐
│  Supabase   │                    │    Upstash Redis        │
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
│       │   └── models/         # MA, Holt-Winters, Prophet, LightGBM
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

Copiá `.env.example` a `.env` y completá tus valores:

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# Redis (Upstash)
UPSTASH_REDIS_URL=rediss://...
UPSTASH_REDIS_TOKEN=...

# LLM
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=deepseek/deepseek-r1-0528:free

# Auth
JWT_SECRET_KEY=  # openssl rand -hex 32
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
```

---

## 🤖 Modelos LLM soportados (gratis)

Todos los modelos son seleccionables desde el panel de configuración del frontend:

| Modelo           | Proveedor              | Contexto |
| ---------------- | ---------------------- | -------- |
| DeepSeek R1      | OpenRouter             | 164K     |
| Llama 3.3 70B    | Meta vía OpenRouter    | 128K     |
| Gemini 2.0 Flash | Google vía OpenRouter  | 1M       |
| Qwen3 235B       | Alibaba vía OpenRouter | 40K      |
| Mistral 7B       | Mistral vía OpenRouter | 32K      |

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

```
git push main
  → CI: ruff + mypy + pytest (debe pasar)
  → Build imagen Docker → push a ghcr.io
  → Railway: deploy automático del backend
  → Vercel: deploy automático del frontend (vía integración GitHub)
```

---

## 🗺️ Roadmap

Ver [`TODO.md`](TODO.md) para la lista completa de tareas fase por fase.

- [x] **Fase 0** — Fundación (repo + CI + Docker)
- [x] **Fase 1** — Subida CSV + detección automática de modelo ✅
- [ ] **Fase 2** — Motor de forecast (4 modelos ML) ← estamos aquí
- [ ] **Fase 3** — Calendario de eventos
- [ ] **Fase 4** — Chat IA con streaming SSE
- [ ] **Fase 5** — Auth + persistencia
- [ ] **Fase 6** — Deploy completo a producción

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
