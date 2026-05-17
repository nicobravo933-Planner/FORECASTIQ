# FORECASTIQ — Documento de Visión del Proyecto

## 1. Pitch (una línea)

> *Conectá tus ventas (CSV o base de datos), seleccioná tu columna de fecha y tu variable objetivo, y la app detecta automáticamente el mejor modelo de forecasting, genera predicciones y te las explica con IA en lenguaje natural.*

---

## 2. Stack real (solo lo que usamos, nada de relleno)

| Capa | Tecnología | Propósito |
|------|-----------|-----------|
| Backend | FastAPI + Python 3.12 | API REST con tipado fuerte y async |
| Dependencias | UV | Gestor moderno (reemplaza pip + poetry), 10-100x más rápido |
| ML | Prophet + LightGBM + Optuna | Forecasting clásico y ML según el caso |
| Jobs pesados | Celery + Redis | Forecasts largos sin bloquear la API |
| Cache | Upstash Redis | Cachear resultados de forecasts |
| Base de datos | Supabase (PostgreSQL) | Datos, auth y storage en un solo service (free tier) |
| Auth | Better Auth + OAuth2 | Login con Google/GitHub, RLS por usuario |
| Frontend | Next.js 14 + MUI v6 | Estándar empresarial, App Router, TypeScript |
| LLM | OpenRouter + streaming SSE | Multi-provider con modelos gratuitos seleccionables desde el front |
| CI/CD | GitHub Actions | Tests + lint en cada push, deploy automático en main |
| Contenedores | Docker + Docker Compose | Entorno reproducible local |
| Observabilidad | Sentry (free tier) | Errores en producción monitoreados |

---

## 3. Arquitectura general

```
Usuario → Browser (Next.js + MUI)
               ↓ REST / SSE
          FastAPI (backend)
               ↓
     ┌─────────┼─────────┐
     │         │         │
  Supabase  Celery    Redis
  (DB +     (ML job   (cache +
   Storage)  queue)    broker)
```

- Frontend deployado en **Vercel** (auto-deploy via GitHub integration)
- Backend deployado en **Railway** como contenedor Docker
- GitHub Actions automatiza: push → tests → build → deploy

---

## 4. Features clave

| Feature | Descripción |
|---------|-------------|
| Subida CSV | Arrastrá tu archivo, la app detecta columnas automáticamente |
| Auto-detección de modelo | FFT (estacionalidad) + Mann-Kendall (tendencia) + CV (ruido) → elige entre MA, Holt-Winters, Prophet o LightGBM |
| Forecast interactivo | Elegís horizonte (+3, +6, +12 meses), ves gráfico con intervalo de confianza |
| Calendario de eventos | Agregás promociones, feriados, eventos → impactan el forecast |
| Chat IA con streaming | Preguntás en lenguaje natural, la IA responde token por token con contexto del dataset |
| Auth + persistencia | Login con Google/GitHub, tus forecasts quedan guardados y son privados |

---

## 5. Vistas del sidebar

```
📁 Dataset          → Upload CSV / preview / selector de columnas
📅 Calendario       → Cargar eventos, promociones, feriados
⚙️ Configurar       → Columnas, frecuencia, horizonte
📈 Forecast         → Resultado + gráfico + modelo elegido
🔍 Diagnóstico      → Por qué eligió ese modelo, métricas (MAPE, RMSE, MAE)
🤖 Chat IA          → Preguntas en lenguaje natural sobre los datos
👤 Mi cuenta        → Login OAuth, historial de forecasts guardados
```

---

## 6. Lógica de selección automática de modelo

```
n < 52 obs                  → Moving Average (ponderado)
n ≥ 52 + estacionalidad     → Holt-Winters Triple Exponencial
n ≥ 200 + ruido bajo        → Prophet (con regresores de eventos)
n ≥ 200 + ruido alto        → LightGBM + Optuna HPO
```

Detección:
- **FFT** → detecta estacionalidad (períodos dominantes en la señal)
- **Mann-Kendall** → detecta tendencia estadísticamente significativa
- **CV** (coeficiente de variación) → mide nivel de ruido

---

## 7. LLM multi-provider con tools reales

El patrón se porta directamente del proyecto Priorizador de Peticiones (ya probado en producción):

```python
provider = session_context.get("active_provider") or os.getenv("LLM_PROVIDER", "openrouter")
model    = session_context.get("active_model")    or os.getenv("OPENROUTER_MODEL") or "deepseek/deepseek-r1-0528:free"
```

El modelo es seleccionable desde el frontend (mismo sidebar que el Priorizador).
Modelos gratuitos disponibles en OpenRouter:

```python
FREE_MODELS = [
    {"id": "deepseek/deepseek-r1-0528:free",   "label": "DeepSeek R1"},
    {"id": "meta-llama/llama-3.3-70b:free",    "label": "Llama 3.3 70B"},
    {"id": "google/gemini-2.0-flash:free",      "label": "Gemini 2.0 Flash"},
    {"id": "qwen/qwen3-235b-a22b:free",         "label": "Qwen3 235B"},
    {"id": "mistralai/mistral-7b-instruct:free","label": "Mistral 7B"},
]
```

**Tools del LLM** (el LLM puede actuar sobre los datos, no solo conversar):

| Tool | Qué hace |
|------|---------|
| `query_dataset(sql)` | DuckDB sobre el CSV del usuario |
| `get_forecast_summary()` | Métricas actuales del forecast |
| `get_events()` | Eventos activos del calendario |
| `suggest_model_change(reason)` | Propone cambiar el modelo ML con justificación |

**Diferencia con el Priorizador:** mismo patrón de tools, distinto dominio.
El Priorizador opera sobre logística (pedidos, sucursales, camiones).
ForecastIQ opera sobre forecasting ML (series de tiempo, modelos, eventos).

---

## 8. Roadmap por fases

| Fase | Qué se construye | Por qué en este orden |
|------|-----------------|----------------------|
| **0 — Fundación** | Repo, Docker, CI verde, estructura backend + frontend | Sin base no se construye nada |
| **1 — Datos + detección** | Upload CSV, selector de columnas, auto-detección de modelo | El usuario tiene que poder cargar datos primero |
| **2 — Forecast** | Motor ML (4 modelos), Celery, gráfico interactivo | El core del producto |
| **3 — Calendario** | CRUD de eventos, impacto en forecast | Diferenciador #1 |
| **4 — Chat IA** | SSE streaming real, OpenRouter multi-model, tools | Diferenciador #2 (el más impactante visualmente) |
| **5 — Auth** | OAuth2, RLS, historial por usuario | Diferencia un demo de un producto real |
| **6 — Deploy** | CI/CD completo, Railway, Vercel, Sentry | Todo en producción |

---

## 9. Lo que NO incluimos (y por qué)

| Tecnología | Motivo de exclusión |
|-----------|---------------------|
| **Kubernetes** | Overkill para un proyecto de portafolio. Manifiestos YAML pueden ir como documentación opcional en backlog. |
| **Nix/NixOS** | Curva de aprendizaje alta. Docker da el 90% de los beneficios con el 10% de la complejidad. |
| **Spark** | No necesitamos procesamiento distribuido para datasets de un usuario. Polars/Pandas alcanza perfectamente. |
| **Poetry** | Reemplazado por UV — más moderno, más rápido, mejor soporte de lockfile. |
| **Conexión directa a DB del usuario (v1)** | Seguridad. En v1 solo CSV. Conexión efímera va al backlog para v2. |

---

## 10. Dataset sintético de prueba

Generado con `scripts/generate_forecastiq_dataset.py`:

- **50 productos**, 5 categorías (Electrónica, Ropa, Alimentos, Hogar, Deportes)
- **~36,000 filas** de ventas diarias (2 años: 2023-2024)
- Estacionalidades reales: diciembre, invierno AR, Hot Sale, Black Friday
- Feriados nacionales argentinos incluidos
- Inflación ARS simulada (~130% anual 2023 / ~150% anual 2024)
- **~3.3 MB total** → 0.7% del free tier de Supabase (muy cómodo)

Tablas en Supabase:
```
products          →  50 filas   (catálogo maestro)
calendar_events   →  45 filas   (feriados + eventos comerciales)
sales             →  ~36k filas (la serie de tiempo principal)
forecasts         →  vacía      (se llena con el uso de la app)
```

---

## 11. Convenciones de desarrollo

Ver `CLAUDE.md` para el detalle completo. Resumen:

- **rem siempre, nunca px** en el frontend
- **Colores via tokens MUI**, nunca hardcodeados
- **UV siempre, nunca pip directo** en el backend
- **Nunca reescribir archivos > 30 líneas** — solo edits quirúrgicos
- **Leer antes de editar** — nunca asumir el contenido de un archivo
- **Actualizar TODO.md** al final de cada sesión de trabajo

---

## 12. Conclusión

ForecastIQ es un proyecto de portafolio público que demuestra en un solo producto:

**Python avanzado · ML aplicado · FastAPI · Next.js · MUI · Streaming SSE real · Docker · CI/CD · UV · Supabase · Redis · Celery · OpenRouter multi-modelo**

El orden de implementación está diseñado para tener algo visible y funcional lo antes posible — la Fase 1 ya muestra la auto-detección de modelo — y las features más vistosas (chat streaming, calendario de eventos) se agregan después sobre una base sólida.

---

*Stack: FastAPI + Next.js 14 + MUI v6 + Supabase + Upstash Redis + OpenRouter*
*Autor: Nicolás Bravo — nicobravo933@gmail.com*
