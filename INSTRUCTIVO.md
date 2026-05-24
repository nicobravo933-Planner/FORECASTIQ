# INSTRUCTIVO.md — ForecastIQ Setup Local

> Guía paso a paso para levantar ForecastIQ en tu máquina.
> El README es la portada del proyecto — acá está todo lo técnico.

---

## Prerrequisitos

| Herramienta    | Versión mínima | Cómo instalar                                                                                             |
| -------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| Python         | 3.12+          | [python.org](https://www.python.org/downloads/)                                                           |
| Node.js        | 20+            | [nodejs.org](https://nodejs.org/)                                                                         |
| Docker Desktop | cualquiera     | [docker.com](https://www.docker.com/products/docker-desktop/) — solo para Redis local                     |
| UV             | cualquiera     | `curl -LsSf https://astral.sh/uv/install.sh \| sh` (Linux/Mac) o ver [astral.sh/uv](https://astral.sh/uv) |
| Git            | cualquiera     | ya lo tenés si llegaste hasta acá                                                                         |

> **UV** reemplaza pip + venv + poetry en un solo comando. Nunca uses `pip` directamente en este proyecto.

---

## 1. Clonar el repositorio

```bash
git clone https://github.com/nicobravo/forecastiq.git
cd forecastiq
```

---

## 2. Crear cuentas necesarias (gratis)

Antes de levantar la app necesitás:

| Servicio          | Para qué                       | Link                                   | Tier                              |
| ----------------- | ------------------------------ | -------------------------------------- | --------------------------------- |
| **Supabase**      | Base de datos + auth + storage | [supabase.com](https://supabase.com)   | Free permanente                   |
| **Upstash Redis** | Cache + Celery broker          | [upstash.com](https://upstash.com)     | Free 10k req/día                  |
| **OpenRouter**    | LLM para el chat IA            | [openrouter.ai](https://openrouter.ai) | Free (modelos gratis disponibles) |

> Sin Supabase la app no arranca. Sin OpenRouter el chat IA no responde (pero todo lo demás funciona).

---

## 3. Configurar variables de entorno — Backend

```bash
cd backend
cp .env.example .env
```

Editá `backend/.env` con tus valores reales:

```bash
# ── Supabase ─────────────────────────────────────────────────────────────────
# Encontrás estos valores en: Supabase Dashboard → Settings → API
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
# Settings → Database → Connection string (Transaction pooler, puerto 5432)
DATABASE_URL=postgresql://postgres.xxxx:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres

# ── Redis ─────────────────────────────────────────────────────────────────────
# Opción A: Redis local con Docker (recomendado para empezar)
CELERY_BROKER_URL=redis://localhost:6379/0
CELERY_TASK_ALWAYS_EAGER=True   # True = sin Celery worker, jobs síncronos

# Opción B: Upstash Redis (para comportamiento real de Celery)
# UPSTASH_REDIS_URL=rediss://default:xxxx@xxxx.upstash.io:6379
# CELERY_BROKER_URL=rediss://default:xxxx@xxxx.upstash.io:6379

# ── Auth ──────────────────────────────────────────────────────────────────────
# Cualquier string aleatorio para desarrollo local
JWT_SECRET_KEY=mi_secreto_local_cualquier_cosa
BETTER_AUTH_URL=http://localhost:3000

# ── LLM (opcional) ────────────────────────────────────────────────────────────
# Sin esto el chat IA responde "API key no configurada"
OPENROUTER_API_KEY=sk-or-v1-...

# ── MLflow (opcional) ─────────────────────────────────────────────────────────
# Sin esto MLflow escribe a disco local — perfectamente funcional
MLFLOW_TRACKING_URI=./mlruns
# MLFLOW_TRACKING_URI=https://dagshub.com/<usuario>/forecastiq.mlflow  # producción

# ── Tier del servidor ─────────────────────────────────────────────────────────
# "local" habilita todos los modelos ML incluyendo LightGBM y batch analytics
SERVER_TIER=local
```

---

## 4. Configurar variables de entorno — Frontend

```bash
cd frontend
cp .env.example .env.local
```

Editá `frontend/.env.local`:

```bash
# Supabase (mismos valores que backend pero prefijo NEXT_PUBLIC_)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Auth (Better Auth)
BETTER_AUTH_SECRET=mismo_valor_que_JWT_SECRET_KEY_del_backend
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:8000

# OAuth — opcional, para login con Google/GitHub
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GITHUB_CLIENT_ID=Ov23liXXX
GITHUB_CLIENT_SECRET=xxx
```

---

## 5. Ejecutar migraciones en Supabase

Una sola vez. Entrá al **SQL Editor** de tu proyecto Supabase y ejecutá en orden:

```
1. backend/migrations/001_forecast_jobs.sql
2. backend/migrations/002_events.sql
3. backend/migrations/003_add_user_id.sql
4. backend/migrations/004_chat_conversations.sql
5. backend/migrations/005_hpo_cache.sql
6. backend/migrations/006_better_auth_schema.sql
```

> Si alguna migración falla, revisá que las anteriores se hayan ejecutado correctamente.

---

## 6. Levantar Redis local (Docker)

```bash
docker run -d --name forecastiq-redis -p 6379:6379 redis:alpine
```

> Si ya tenés Redis corriendo en otro proyecto, podés reutilizarlo.

---

## 7. Levantar el backend

```bash
cd backend
uv sync          # instala todas las dependencias (equivale a pip install -r requirements.txt)
uv run uvicorn app.main:app --reload --port 8000
```

Verificá que funciona:

```bash
curl http://localhost:8000/health
# → {"status": "ok", "environment": "development"}
```

Documentación interactiva de la API:

```
http://localhost:8000/docs
```

---

## 8. Levantar el Celery worker (terminal separada)

> Solo necesario si `CELERY_TASK_ALWAYS_EAGER=False`. Para desarrollo rápido dejalo en `True`.

```bash
cd backend
uv run celery -A app.services.celery_app.celery_app worker --loglevel=info
```

---

## 9. Levantar el frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

---

## 10. Verificar que todo funciona

1. Abrí `http://localhost:3000`
2. Login con Google o GitHub (o modo anónimo si está habilitado)
3. Ir a **Dataset** → subir cualquier CSV con columnas de fecha y valor numérico
4. Ir a **Forecast** → seleccionar columnas → ejecutar forecast
5. Ir a **Chat** → hacer una pregunta sobre los datos

---

## Usando con Docker Compose (alternativa)

Para levantar backend + worker + Redis en un solo comando:

```bash
# Desarrollo local
docker compose up -d

# Ver logs
docker compose logs -f backend
```

> El `docker-compose.yml` en la raíz está configurado para desarrollo local.
> El `docker-compose.prod.yml` es para el EC2 en producción.

---

## Datasets para practicar (Kaggle)

La app acepta cualquier CSV, Excel (.xlsx) o Parquet con al menos:

- Una columna de **fecha** (datetime en cualquier formato)
- Una columna **numérica** (ventas, unidades, precios, etc.)

Datasets recomendados en Kaggle para empezar:

- [Store Sales - Time Series Forecasting](https://www.kaggle.com/competitions/store-sales-time-series-forecasting)
- [Rossman Store Sales](https://www.kaggle.com/c/rossmann-store-sales)
- [M5 Forecasting Accuracy](https://www.kaggle.com/competitions/m5-forecasting-accuracy)
- [COVID-19 World Vaccination Progress](https://www.kaggle.com/datasets/gpreda/covid-world-vaccination-progress) — ejemplo no-ventas

> **Límites por tier de servidor:**
>
> - CSV / Excel / Parquet: hasta **10 MB** en EC2 (t3.micro), sin límite en local
> - Para datasets más grandes, usá Parquet — es 3-5x más compacto que CSV

---

## Generar el dataset sintético propio (opcional)

El proyecto incluye un script para generar 25k SKUs × 3 años con patrones realistas:

```bash
cd backend
uv run python ../scripts/generate_massive_dataset.py
# → data/ventas_25k_skus.parquet (~256 MB)
```

---

## Levantar el cluster PySpark (opcional, educativo)

```bash
docker compose -f docker-compose.spark.yml up -d
# Jupyter: http://localhost:8888  (token: forecastiq)
# Spark UI: http://localhost:8080
```

---

## Troubleshooting frecuente

| Problema                 | Causa probable                                          | Solución                                                           |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------------------------------ |
| `SUPABASE_URL not found` | `.env` no existe o está en la carpeta equivocada        | Asegurate de estar en `backend/` y de haber copiado `.env.example` |
| Login no funciona        | `BETTER_AUTH_SECRET` diferente entre backend y frontend | Usá el mismo valor en ambos `.env`                                 |
| Celery no procesa jobs   | `CELERY_TASK_ALWAYS_EAGER=True` en producción           | Cambiarlo a `False` y levantar el worker                           |
| Chat IA no responde      | `OPENROUTER_API_KEY` no configurada                     | Normal — la app funciona sin ella                                  |
| Parquet no carga         | pyarrow no instalado                                    | `uv add pyarrow`                                                   |
| `uv` no encontrado       | UV no instalado                                         | Ver [astral.sh/uv](https://astral.sh/uv)                           |

---

## Estructura del proyecto (referencia rápida)

```
forecastiq/
├── backend/
│   ├── pyproject.toml          # dependencias con UV
│   ├── .env.example            # plantilla de variables
│   ├── migrations/             # SQL para Supabase (ejecutar en orden)
│   └── app/
│       ├── main.py             # FastAPI app factory
│       ├── core/config.py      # todas las variables de entorno
│       ├── ml/                 # modelos + detector + evaluador
│       └── api/                # endpoints REST
├── frontend/
│   ├── .env.example            # plantilla de variables
│   └── app/dashboard/          # páginas de la app
├── scripts/                    # dataset sintético + benchmarks
├── notebooks/                  # PySpark pipeline (requiere docker-compose.spark.yml)
├── infra/aws/                  # guía de deploy en EC2
└── ENCICLOPEDIA/               # fuentes de aprendizaje (HTML/QMD)
```

---

_Última actualización: 2026-05-24_
