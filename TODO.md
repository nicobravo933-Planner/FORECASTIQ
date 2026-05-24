# TODO.md — ForecastIQ

> **Claude: leer este archivo al inicio de cada sesión.**
> Actualizar estado de tareas al finalizar. Agregar fila al Session Log.
> El foco del proyecto es **educativo**: Data Scientists aprendiendo ML aplicado a forecasting.

---

## 🗺️ Estado general

| Bloque           | Descripción                                                                         | Estado                                  |
| ---------------- | ----------------------------------------------------------------------------------- | --------------------------------------- |
| **Base técnica** | Fases 0–11 completadas (infra, modelos, deploy, MLOps, Spark)                       | ✅ Done                                 |
| **FE-Stack**     | Migración frontend stack (TanStack Query, RHF, Zod, date-fns, Framer Motion, MUI X) | ⏳ Pendiente                            |
| **E1**           | Vista EDA — análisis exploratorio de datos                                          | ✅ Done                                 |
| **E2**           | Vista ETL — limpieza, winsorización, calidad de datos                               | ✅ Done                                 |
| **E3**           | Enciclopedia integrada — libro interactivo en la app                                | ✅ Done                                 |
| **E4**           | Tuneo interactivo de parámetros + visualización                                     | ✅ Done                                 |
| **E5**           | Flujo guiado — semáforo de calidad → modelos disponibles                            | ✅ Done                                 |
| **E6**           | Detector transparente — explicar por qué eligió el modelo                           | ✅ Done                                 |
| **E7**           | Benchmarking multi-modelo — correr 2-3 modelos en paralelo                          | ✅ Done                                 |
| **E8**           | Ingesta avanzada — Parquet upload + export + connect DB                             | ✅ Done                                 |
| **E9**           | Calendario de eventos mejorado — persistencia + impacto LightGBM                    | ✅ Done ("Impacto observado" pospuesto) |
| **Fixes**        | Bugs y correcciones menores pendientes                                              | Ver sección abajo                       |

---

## ✅ Base técnica completada (Fases 0–11)

> Detalle completo en el Session Log. Esto ya está hecho — no retrabajarlo.

- [x] **Fase 0** — Repo + CI/CD + Docker + GitHub Actions → AWS EC2 + Vercel
- [x] **Fase 1** — Subida CSV + detector automático (MAD + FFT + Seasonal Mann-Kendall)
- [x] **Fase 2** — Motor forecast: MA, Holt-Winters, SARIMA, LightGBM + Optuna + WAPE/MAE/BIAS/FVA
- [x] **Fase 3** — Calendario de eventos + feriados AR + post-processing multiplicativo
- [x] **Fase 4** — Chat IA con SSE streaming + DuckDB tools + OpenRouter multi-model
- [x] **Fase 5** — Auth OAuth2 (Google/GitHub) + historial por usuario + RLS Supabase
- [x] **Fase 6** — Deploy completo: CI/CD GitHub Actions → Docker → EC2 + Vercel
- [x] **Fase 7** — Observability: structlog JSON + OTel traces → Grafana Cloud
- [x] **Fase 7.5** — UI Polish: NavyPro theme + glass cards + split login + rate limiting
- [x] **Fase 8** — MLOps: MLflow (Dagshub) + Evidently drift detection
- [x] **Fase 9** — Scale Engine: Nixtla StatsForecast + Polars + DuckDB + Celery Beat
- [x] **Fase 10** — Dataset sintético: 25k SKUs × 3 años → Parquet en Cloudflare R2
- [x] **Fase 11** — PySpark: docker-compose.spark.yml + notebook pipeline + benchmark

---

## ⏳ FE-Stack — Migración del stack frontend

> Prerrequisito para E1. Los nuevos componentes de EDA usan TanStack Query, MUI X Charts y DataGrid.
> Hacer gradualmente — no reescribir todo a la vez. Migrar al usar cada componente.

### Instalación (ya ejecutada)

- [x] `npm install @mui/x-charts @mui/x-data-grid @mui/x-date-pickers`
- [ ] `npm install @tanstack/react-query date-fns framer-motion react-hook-form zod`
- [ ] `npm uninstall swr` — reemplazado por TanStack Query

### TanStack Query — reemplazar SWR gradualmente

- [ ] `frontend/lib/queryClient.ts` — crear instancia global de `QueryClient`
- [ ] `frontend/app/layout.tsx` — envolver en `<QueryClientProvider>`
- [ ] Al crear componentes nuevos (EDA, ETL, etc.) usar `useQuery`/`useMutation` en lugar de `useSWR`
- [ ] Migrar hooks existentes (`useDataset`, `useForecast`, `useEvents`) cuando se toquen por otra razón — no migrar por migrar

### MUI X — cuándo usar qué

```
@mui/x-data-grid  → tabla de preview de datos en EDA (sorting, filtering, paginación)
@mui/x-charts     → SparkLine en KPI cards, LineChart simple en EDA overview
                    Recharts se mantiene para el ForecastChart (Brush + zonas coloreadas)
@mui/x-date-pickers → DateRangePicker en filtros de EDA, DateCalendar en Calendario de eventos
```

### React Hook Form + Zod — para formularios nuevos

- [ ] Usar en el form de configuración del forecast (ForecastConfigPanel) cuando se refactorice
- [ ] Usar en ConnectDbCard (form con host/user/password/tabla)
- [ ] Usar en WinsorizationPanel del ETL (percentiles, umbrales)
- [ ] Schema Zod reutilizable: `frontend/lib/schemas/forecast.ts`, `eda.ts`

### date-fns — reemplazar strings de fecha ad-hoc

- [ ] Formateo de fechas en EDA: `formatDistance(parseISO(date), new Date())` para "hace 3 años"
- [ ] Rangos en el EDA summary card: `differenceInYears`, `differenceInMonths`
- [ ] Formateo de ejes en gráficos donde corresponda

### Framer Motion — solo para animaciones de estado

- [ ] Animación de desbloqueo de modelos en E5 (cuando el quality score sube)
- [ ] Transición entre pasos del flujo guiado EDA → ETL → Forecast
- [ ] NO reemplazar las CSS animations actuales que ya funcionan bien

### Backend — limpieza de deps muertas (ya aplicado en pyproject.toml)

- [x] Quitar `sqlalchemy[asyncio]` → `sqlalchemy` (sólo sync para connect-db)
- [x] Quitar `asyncpg` (sin uso)
- [x] Quitar `alembic` (sin uso — migraciones son SQL manuales en Supabase)
- [x] Quitar `python-jose` + `passlib` (sin uso — auth via Better Auth/httpx)
- [x] Quitar `sentry-sdk` (DSN nunca configurado, sin valor actual)
- [ ] Ejecutar `uv sync` local para regenerar el lockfile
- [ ] Verificar que CI siga verde después del `uv sync`

---

## 🔄 E1 — Vista EDA (Análisis Exploratorio de Datos)

> **Prioridad máxima.** Sin EDA, el usuario sube cualquier CSV y el modelo da basura sin explicación.
> Objetivo: antes de hacer cualquier forecast, entender qué tan buenos son los datos.

### Backend

- [x] `api/eda.py` — nuevo router con endpoints de análisis
- [x] `GET /api/eda/{dataset_id}/summary` — estadísticas básicas: min/max/media/std/skewness/kurtosis, % nulls, rango de fechas, frecuencia detectada, cantidad de observaciones
- [x] `GET /api/eda/{dataset_id}/outliers` — detección MAD (threshold=3.0), retorna índices + valores + límites winsor p5/p95
- [x] `GET /api/eda/{dataset_id}/quality-score` — score 0-100 con semáforo
- [x] `GET /api/eda/{dataset_id}/models-available` — basado en quality-score: qué modelos están desbloqueados y por qué
- [x] `main.py` — registrar `eda_router`

### Frontend

- [x] `components/eda/QualityScoreCard.tsx` — semáforo visual (🔴🟡🟢) con breakdown de criterios
- [x] `components/eda/OutlierChart.tsx` — Recharts con puntos outlier marcados en rojo sobre la serie
- [x] `components/eda/SeriesSummaryTable.tsx` — tabla de estadísticas básicas
- [x] `components/eda/ModelsAvailablePanel.tsx` — chips de modelos desbloqueados con tooltip de razón
- [x] `components/eda/DataCompletenessBar.tsx` — barra de completitud por columna
- [x] `app/dashboard/eda/page.tsx` — página integradora, recibe dataset_id desde appStore
- [x] `hooks/useEda.ts` — hook centralizado con fetch paralelo de los 4 endpoints
- [x] Sidebar: agregar `eda` item con `AssessmentIcon` entre Inicio y Forecast

### Done when

- [x] Subir un CSV limpio → quality score verde → modelos disponibles correctos
- [x] Subir un CSV con muchos nulls → quality score rojo → solo Moving Average disponible
- [x] Subir un CSV con < 24 obs → warning "historia insuficiente para Holt-Winters" (banner automático en la UI)
- [x] Los outliers se visualizan marcados en el gráfico

---

## ⏳ E2 — Vista ETL (Limpieza de Datos)

> Continuación del EDA. Mostrar el efecto de limpiar los datos.

- [x] `GET /api/eda/{dataset_id}/winsorize` — aplica winsorización p5/p95, retorna serie antes/después
- [x] `GET /api/eda/{dataset_id}/fill-gaps` — imputa gaps temporales (forward fill / interpolación lineal)
- [x] `components/etl/BeforeAfterChart.tsx` — Recharts comparando serie original vs limpia (dos líneas)
- [x] `components/etl/WinsorizationPanel.tsx` — sliders (local) o inputs+botón (ec2/cloud) + preview del efecto
- [x] `components/etl/FillGapsPanel.tsx` — selector de método + preview del efecto
- [x] `hooks/useEtl.ts` — hook centralizado con applyWinsorize / applyFillGaps / resetToOriginal
- [x] `app/dashboard/etl/page.tsx` — página integradora con 2 tabs (winsorizar / imputar gaps)
- [x] Sidebar: agregar `etl` item con `CleaningServicesIcon` entre EDA y Forecast
- [x] Después del ETL: appStore se actualiza al cleaned_dataset_id → Forecast usa los datos limpios automáticamente
- [x] Re-evaluar quality-score post-ETL (mostrado en panel de resultados)
- [ ] Tier-adaptive UI: local=sliders debounce, cloud=inputs+botón ✅ implementado en WinsorizationPanel

---

## ⏳ E3 — Enciclopedia integrada

> Libro interactivo dentro de la app. El corazón educativo del proyecto.
> Basado en: FUENTE 2 (caps 1-10, 18-19) + FUENTE 3 (Vandeputt qmd).

### Estructura de capítulos

```
1. ¿Por qué forecasteamos? (Vandeputt cap 1-2)
2. Entender los datos: EDA y calidad (FUENTE 2 cap 1-2)
3. Segmentación ABC-XYZ (FUENTE 2 cap 3)
4. Métricas: WAPE, MAE, BIAS, FVA (FUENTE 2 cap 4 + Vandeputt)
5. Modelo ingenuo / Moving Average (FUENTE 3 cap 1)
6. Suavizamiento exponencial: SES, Holt, Holt-Winters (FUENTE 2 cap 6 + FUENTE 3)
7. ARIMA y SARIMA (FUENTE 2 cap 7 + FUENTE 3)
8. Feature engineering (FUENTE 2 cap 8)
9. LightGBM y Machine Learning (FUENTE 2 cap 9)
10. Validación cruzada y overfitting (FUENTE 2 cap 10)
11. FVA — Valor Añadido del Pronóstico (FUENTE 2 cap 18)
12. Sesgos humanos en forecasting (FUENTE 2 cap 19)
```

### Tareas

- [x] `app/dashboard/encyclopedia/page.tsx` — layout tipo libro: sidebar izquierdo con capítulos + área de contenido
- [x] `components/encyclopedia/ChapterSidebar.tsx` — navegación con progress indicator
- [x] `components/encyclopedia/FormulaBlock.tsx` — bloque de fórmula con KaTeX
- [x] `components/encyclopedia/PythonCodeBlock.tsx` — código Python resaltado (no ejecutable) con copy button
- [x] `components/encyclopedia/WhenToUseCard.tsx` — card "¿Cuándo usar este modelo?" con tabla de mínimos
- [x] Sidebar nav: agregar `encyclopedia` item con `MenuBookIcon`
- [x] Contenido de cada capítulo como `.tsx` separados (12 capítulos)

---

## ⏳ E4 — Tuneo interactivo de parámetros

> "Tocá un slider y ve qué pasa con el forecast." Aprender haciendo.

- [x] Exponer parámetros por modelo en el resultado del forecast: `alpha`, `beta`, `gamma` (HW), `order` (SARIMA), feature importance (LightGBM)
- [x] `components/forecast/ParameterExplorer.tsx` — sliders por modelo + botón "Re-run con estos parámetros"
- [x] Visualización clara de overfitting: cuando WAPE > 40%, mostrar warning con explicación
- [ ] `GET /api/forecast/explain/{job_id}` — descartado (Opción A: params en el resultado, más limpio)

---

## ⏳ E5 — Flujo guiado (semáforo de calidad → modelos)

> La app lleva de la mano al usuario según la calidad de sus datos.

### Lógica del semáforo

```
Quality score < 30  → Solo Moving Average. "Tus datos necesitan limpieza primero."
Quality score 30-60 → MA + Holt-Winters. "Podés mejorar limpiando outliers."
Quality score 60-80 → MA + HW + SARIMA. "Buenos datos. Considerá más historia."
Quality score > 80  → Todos los modelos. "Datos excelentes. LightGBM disponible."
```

- [x] Integrar quality-score en el flujo Dataset → EDA → Forecast (`appStore.setQualityScore` en EDA page)
- [x] `components/forecast/ModelGatingPanel.tsx` — modelos con lock/unlock según calidad (colapsable, chip quickselect, botones EDA/ETL)
- [x] Mensaje contextual en cada etapa: "¿Por qué no puedo usar SARIMA todavía?" (tooltip/reason en cada modelo bloqueado)
- [x] Cuando el usuario limpia datos en ETL → re-evaluar y notificar "¡SARIMA desbloqueado!" (Snackbar verde)
- [x] `ForecastConfigPanel` bloquea modelos no disponibles según quality score (doble lock: tier + calidad)
- [x] `forecast/page.tsx` integra `ModelGatingPanel` siempre visible cuando hay dataset activo

---

## ⏳ E6 — Detector transparente

> "¿Por qué eligió Holt-Winters y no LightGBM?" — nunca debe ser magia negra.

- [x] `GET /api/forecast/detection-report/{dataset_id}` — retorna:
  - Resultado del MAD (outliers encontrados, umbral usado)
  - Resultado del FFT (frecuencias dominantes, estacionalidad detectada)
  - Resultado del Seasonal Mann-Kendall (p-value, tendencia detectada)
  - CV calculado + umbral
  - Árbol de decisión: "porque CV > 1.0 Y obs > 104 → LightGBM"
- [x] `components/forecast/DetectionReportModal.tsx` — modal con timeline de decisiones
- [x] Botón "¿Por qué este modelo?" en ForecastConfigPanel + en los resultados

---

## ⏳ E7 — Benchmarking multi-modelo

> Siempre correr al menos 2-3 modelos y comparar. El ingenuo como baseline obligatorio.

- [x] Backend: `POST /api/forecast/benchmark` — corre MA + HW + SARIMA (o los disponibles según tier/calidad) en paralelo, retorna tabla comparativa
- [x] `components/forecast/BenchmarkTable.tsx` — tabla con WAPE/MAE/BIAS/FVA por modelo, color semafórico, modelo ganador destacado
- [x] FVA obligatorio: siempre comparar contra Seasonal Naive. "¿Tu modelo es mejor que copiar el año pasado?"
- [x] Seasonal Naive siempre incluido como baseline — no es opcional

---

## ⏳ E8 — Ingesta avanzada de datos

> Parquet, Excel, DB connections. Para datasets más grandes que un CSV.

### Parquet upload

- [x] Frontend: aceptar `.parquet` en el DropZone (ya soportado en backend con pyarrow)
- [x] `POST /api/datasets/upload` acepta Parquet — validar con pyarrow antes de procesar
- [x] Export: `GET /api/datasets/{id}/export?format=parquet` — generar Parquet optimizado post-ETL
- [x] Frontend: botón "Descargar Parquet limpio" después del ETL

### Conectar base de datos (Tab 3 del dataset)

- [x] `ConnectDbCard.tsx` — form: tipo DB (PostgreSQL, MySQL, SQLite, SQL Server), host, port, user, password, tabla
- [x] `POST /api/datasets/from-db` — conexión efímera (nunca persistir credenciales), query, retorna preview + columnas
- [ ] Export a Parquet de los datos seleccionados de la DB
- [x] **Nota de seguridad:** la connection string NUNCA se guarda en base de datos. Solo en memoria durante la sesión.
- [x] Límite: máximo 500k filas en la query para no colapsar el EC2 t3.micro

### Límites de subida por tier

```
local  → 50 MB (CSV/Excel/Parquet)
ec2    → 10 MB (CSV/Excel), 25 MB (Parquet)
cloud  → N/A (solo frontend)
```

---

## ⏳ E9 — Calendario de eventos mejorado

> Eventos y promociones que el modelo debe capturar como variables externas.

### Contexto

El Calendario ya existe (Fase 3) pero es básico. Los eventos actualmente impactan via post-processing multiplicativo.
Para LightGBM el impacto es mucho más correcto como **feature** — una columna binaria `es_promo_navidad` en el dataset de entrenamiento.

### Tareas

- [x] Revisar modelo actual de eventos en Supabase (`migrations/002_events.sql`)
- [x] Agregar campo `dataset_id UUID NULL` a la tabla de eventos (`migrations/007_events_dataset.sql`)
- [x] `GET /api/events/as-features` — convierte eventos a DataFrame de features con columnas binarias por tipo de evento
- [x] Eventos auto-generados: Black Friday, Cyber Monday, Día del Niño AR, Hot Sale AR, CyberWeek AR — función `get_ar_commercial_events(year)` en `services/events.py`
- [x] Endpoint PATCH `/api/events/{id}` — edición parcial de eventos manuales
- [x] `services/events.py`: `create_event` acepta `dataset_id`, nueva función `update_event`, `events_to_features_df()`
- [x] `api/events.py`: `EventUpdateRequest`, badge `source`, `dataset_id` en respuesta, `EventFeaturesResponse`, endpoint `GET /as-features`
- [x] `lib/types.ts`: `CalendarEvent` con `source`, `dataset_id`, `user_id`
- [x] `lib/api.ts`: método `api.patch()`
- [x] `hooks/useEvents.ts`: `updateEvent` + `UpdateEventPayload`
- [x] `EventForm.tsx`: modo create/edit unificado con `initialData` + `onUpdate`
- [x] `EventChip.tsx`: `AutoBadge` para eventos auto-generados
- [x] `calendar/page.tsx`: botón Edit, badge Auto, botón Ocultar (dismiss sin borrar), delete solo para manuales
- [x] LightGBM model: `_make_features()` acepta `event_features` DataFrame; `__init__` + `fit` + `predict` propagados; `_event_cols` guardado post-fit
- [x] `celery_app.py`: carga eventos del usuario + auto antes de instanciar LightGBM, pasa `event_features`; `_extract_model_params` incluye `event_cols`
- [ ] Frontend: en el Calendario, mostrar cómo cada evento impactó el último forecast (columna "Impacto observado") — pospuesto, requiere guardar feature importance por evento en el resultado
- [x] Documentar en la Enciclopedia: "¿Cómo avisarle al modelo que va a pasar algo?" (E9.6) — Sección 8.4 en capítulo Feature Engineering

---

## 🐛 Fixes pendientes

- [x] `DemoDatasetCard.tsx` + `HomeDashboard.tsx`: texto "Supabase Storage" → "Cloudflare R2" — corregido en caption y status card
- [x] Login anónimo: redirect roto `/dashboard/datasets` → `/dashboard/dataset` (sin s); reemplazado `void .then()` por `async/await` con try/catch — si falla Better Auth en Vercel, redirige igual sin romper la UX
- [ ] Login anónimo: posible 404 en Vercel por variable `SUPABASE_DB_PASSWORD` no configurada — verificar en Vercel Dashboard > Environment Variables que la variable exista y sea correcta
- [ ] HomeDashboard: revisar que los status cards reflejen estado real del sistema (API health, Redis, EC2)
- [ ] `uv sync` local — correr en terminal tras limpieza de deps en pyproject.toml
- [ ] `npm install` frontend — correr para asegurar node_modules actualizado
- [ ] Sentry: DSN no configurado (quedó pendiente de Fase 7) — bajo prioridad
- [ ] CONTRIBUTING.md: no existe — bajo prioridad

---

## 📚 Backlog general

- [ ] Landing page pública con hero + features + screenshots
- [ ] i18n español / inglés
- [ ] Export forecast a Excel / PDF
- [ ] Notificaciones email cuando termina un job largo (Resend/SendGrid)
- [ ] BYOK — el usuario trae su propia OpenRouter API key (ya hay base en Settings)
- [ ] Modelo de demanda intermitente (Croston / TSB) — para productos con muchos ceros
- [ ] Detección automática de categorías dentro de un dataset (multi-SKU EDA)

---

## 📋 Session Log

| Fecha      | Sesión    | Completado                                                                                                                                                                                                                                                                                                               |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-17 | 2         | CI verde en ambos jobs (backend + frontend). Phase 0 cerrada.                                                                                                                                                                                                                                                            |
| 2026-05-17 | 3         | Phase 1 backend: detector.py (MAD+FFT+SeasonalMK+CV), datasets.py, tests.                                                                                                                                                                                                                                                |
| 2026-05-17 | 4         | Fixes CI: ruff, pyproject, deploy.yml deshabilitado. Dataset scripts + CSVs.                                                                                                                                                                                                                                             |
| 2026-05-17 | 5         | Phase 1 frontend: dashboard layout, DropZone, ColumnSelector, ModelRecommendation.                                                                                                                                                                                                                                       |
| 2026-05-17 | 6         | Phase 2 backend: evaluator.py (WAPE/MAE/BIAS/RMSE/MAPE), 4 modelos ML, Celery, migrations.                                                                                                                                                                                                                               |
| 2026-05-17 | 7         | Phase 2 frontend + fixes: useForecast.ts, ForecastChart, MetricsCard. Phase 2 cerrada.                                                                                                                                                                                                                                   |
| 2026-05-17 | 8         | FVA agregado a evaluator.py, MetricsCard semafórico. Backlog Enterprise documentado.                                                                                                                                                                                                                                     |
| 2026-05-17 | 9         | Fase 3 completa: eventos CRUD + feriados AR + compare endpoint + frontend Calendar.                                                                                                                                                                                                                                      |
| 2026-05-17 | 10        | Fase 4 completa: chat SSE + DuckDB tools + OpenRouter + 7 modelos free.                                                                                                                                                                                                                                                  |
| 2026-05-17 | 13        | Fase 5 backend: dependencies.py, api/me.py, supabase get_forecast_history.                                                                                                                                                                                                                                               |
| 2026-05-17 | 14        | Migration 003: datasets table + RLS por usuario.                                                                                                                                                                                                                                                                         |
| 2026-05-17 | 17        | Fase 5 cerrada: Settings page + BYOK localStorage + Bearer token.                                                                                                                                                                                                                                                        |
| 2026-05-18 | 18        | Fase 6: deploy.yml, railway.toml, Dockerfile.worker, Vercel. Login Google en prod.                                                                                                                                                                                                                                       |
| 2026-05-18 | 19        | Roadmap Enterprise documentado. Script generate_massive_dataset.py (27M filas).                                                                                                                                                                                                                                          |
| 2026-05-19 | 20        | Fase 7: structlog + OTel SDK + Grafana Alloy en Railway + dashboard prod.                                                                                                                                                                                                                                                |
| 2026-05-19 | 21        | ROADMAP.md creado. TODO.md reestructurado. README actualizado.                                                                                                                                                                                                                                                           |
| 2026-05-19 | 22        | Fase 7.5 frontend: login split layout, logo sidebar.                                                                                                                                                                                                                                                                     |
| 2026-05-19 | 24        | Fase 7.5 backend: rate limiting (5 uploads/h, 10 forecasts/h). Fase 7.5 cerrada.                                                                                                                                                                                                                                         |
| 2026-05-20 | 26        | Migración Railway → AWS EC2 + Dagshub. deploy.yml SSH. infra/aws/ creado.                                                                                                                                                                                                                                                |
| 2026-05-20 | 27        | Setup completo AWS EC2: Docker, 3 contenedores, systemd, healthcheck ✅.                                                                                                                                                                                                                                                 |
| 2026-05-20 | 28        | Fase 8 backend: mlflow_tracker.py, drift_detector.py, api/mlops.py.                                                                                                                                                                                                                                                      |
| 2026-05-20 | 29        | Fase 8 frontend: ExperimentTable, DriftCard, MLflowLink, dashboard/mlops.                                                                                                                                                                                                                                                |
| 2026-05-20 | 30        | Fase 9: nixtla_forecaster.py, api/batch.py, WapeTrendChart.                                                                                                                                                                                                                                                              |
| 2026-05-20 | 31        | Fase 9 casi cerrada: benchmark_models.py, /dashboard/batch, Celery Beat 02:00 AR.                                                                                                                                                                                                                                        |
| 2026-05-21 | 32        | Celery Beat como servicio docker. Fase 10: 27M filas Parquet → Cloudflare R2.                                                                                                                                                                                                                                            |
| 2026-05-21 | 33        | Fase 11: docker-compose.spark.yml, spark_forecast_pipeline.ipynb, spark_benchmark.py.                                                                                                                                                                                                                                    |
| 2026-05-21 | 35        | Fix EC2 CELERY_TASK_ALWAYS_EAGER. UX: appStore, forecast pre-fill, layout full-width.                                                                                                                                                                                                                                    |
| 2026-05-21 | 36        | UX-3: ForecastConfigPanel con dropdowns + tipos de columna + validación inline.                                                                                                                                                                                                                                          |
| 2026-05-21 | 38        | UX-4a: FloatingChat (FAB + Drawer).                                                                                                                                                                                                                                                                                      |
| 2026-05-21 | 39        | UX-4b: WelcomeScreen, MessageBubble rediseñado, ChatBox, ThinkingIndicator.                                                                                                                                                                                                                                              |
| 2026-05-22 | 40        | Bugs UX: getPreferredModel, FloatingChat Popper, RobotAvatar Lottie.                                                                                                                                                                                                                                                     |
| 2026-05-23 | 43        | UX-5 NavyPro: theme.ts modo light, sidebar blanco, header navy.                                                                                                                                                                                                                                                          |
| 2026-05-23 | 44        | Chat history: migration 004, ConversationSidebar, useConversations, auto-save.                                                                                                                                                                                                                                           |
| 2026-05-23 | 49-51     | Fixes mypy residuales. Browser tab title. Fix categoría con tilde.                                                                                                                                                                                                                                                       |
| 2026-05-23 | 55        | Fix frecuencia mensual (MS), horizonte mínimo 1, máximo dinámico.                                                                                                                                                                                                                                                        |
| 2026-05-23 | P1-P6     | ForecastChart reescrito: Brush, 3 zonas, zoom rápido, 460px.                                                                                                                                                                                                                                                             |
| 2026-05-23 | P2        | Hold-out manual: test_periods en backend + frontend.                                                                                                                                                                                                                                                                     |
| 2026-05-24 | fix-auth  | Fix login local + Vercel: Transaction Pooler, BETTER_AUTH_SECRET sin chars especiales.                                                                                                                                                                                                                                   |
| 2026-05-24 | P1-P4     | Rolling CV K-folds (CvResultsCard). Analytics selector modelo + validación mínimos.                                                                                                                                                                                                                                      |
| 2026-05-24 | P5        | DemoSkuSearchDialog: buscar SKU en dataset demo desde Forecast.                                                                                                                                                                                                                                                          |
| 2026-05-24 | fixes-CD  | ActiveDatasetBar quitada. Tier chip simplificado. CI fixes B007 + mypy.                                                                                                                                                                                                                                                  |
| 2026-05-24 | UX-Home   | HomeDashboard: hero strip, status cards, acceso rápido, reloj en vivo.                                                                                                                                                                                                                                                   |
| 2026-05-24 | doc-reorg | README limpio (educativo) con link Vercel visible. INSTRUCTIVO.md creado (setup completo). TODO.md reescrito: fases E1-E9 con tareas concretas. ROADMAP.md reescrito: journey de aprendizaje + decisiones de diseño. CLAUDE.md actualizado: enfoque ML/DS, Quality Score, frecuencias pandas, Enterprise Stack removido. |

| 2026-05-24 | fe-stack-cleanup | `pyproject.toml`: quitados asyncpg, alembic, python-jose, passlib, sentry-sdk, sqlalchemy[asyncio]→sqlalchemy. `package.json`: agregados @tanstack/react-query, date-fns, framer-motion, react-hook-form, zod, MUI X (charts/data-grid/date-pickers); quitado swr. TODO.md: sección FE-Stack con tareas de instalación y migración. ROADMAP.md: stack frontend documentado con reglas Recharts vs MUI X. type-check ✅ limpio. |
| 2026-05-24 | storage-refactor | Nuevo `app/services/storage.py` (abstracción supabase/local). `config.py` +5 vars. `datasets.py` + `celery_app.py`: todos los upload_csv/download_csv → save_dataset/load_dataset. Oracle/MSSQL bloqueados en cloud. docker-compose.yml: concurrencia dinámica desde config. `.env.example` actualizado. |
| 2026-05-24 | E1-completo | E1 cerrado. `DataCompletenessBar.tsx`: barra segmentada verde/naranja/rojo (completo/nulos/gaps) con mensajes contextuales. `page.tsx`: integrada la barra, banners de warning/error para series < 24 obs (Holt-Winters) y < 8 obs (MA). Eliminado `useMemo` no usado. Todos los "Done when" de E1 cubiertos por lógica de la UI. |
| 2026-05-24 | bugfixes | 3 bugs: (1) Hydration error reloj Home. (2) download_csv undefined en datasets.py. (3) 4 errores mypy en eda.py. |
| 2026-05-24 | E2 | E2 implementado. Backend: `/winsorize` + `/fill-gaps` en `eda.py` (guarda `_etl` en storage, recalcula quality score). Frontend: `useEtl.ts`, `BeforeAfterChart.tsx`, `WinsorizationPanel.tsx` (sliders en local / inputs+botón en cloud), `FillGapsPanel.tsx`, `etl/page.tsx` (2 tabs). Sidebar con CleaningServicesIcon. appStore apunta al dataset limpio post-ETL. | — `useState<Date|null>(null)` + init en useEffect + render condicional `now?...: `. (2) `download_csv` undefined en `datasets.py:1114` — reemplazado por `load_dataset` + `FileNotFoundError`. (3) 4 errores mypy en `eda.py` — `delta_days` via `pd.Timedelta(...).days` + `np.percentile` sobre `.to_numpy(dtype=float)`. |

| 2026-05-24 | E8 | E8 implementado. Backend: `GET /api/datasets/{id}/export?format=parquet|csv` (FileResponse directo, Opción A, sin deps extra). Frontend: `ExportButton.tsx` (split button Parquet+CSV, blob download nativo sin salir de la página). Integrado en `etl/page.tsx` (header junto a "Ir a Forecast", apunta al dataset limpio si hay ETL) y `forecast/page.tsx` (debajo de MetricsCard). Parquet upload y ConnectDbCard ya existían desde sesiones anteriores. |

---

_Actualizar este archivo al final de cada sesión. Marcar tareas `[x]` al completar._

| 2026-05-24 | E4 | E4 implementado. Backend: `_extract_model_params()` en `celery_app.py` extrae alpha/beta/gamma (HW), order/seasonal*order (SARIMA), best_params Optuna (LightGBM), window (MA) post-fit. `manual_params` propagado por todo el stack (ForecastRunRequest → task → instanciación de modelos). HW y SARIMA aceptan params manuales en `__init__`. Frontend: `ParameterExplorer.tsx` con sliders HW, inputs SARIMA, read-only LightGBM/MA. Overfitting warning (WAPE > 40%). Re-run con params manuales desde el resultado. `types.ts`: ModelParams interfaces + `manual_params` en ForecastRunRequest. |
| 2026-05-24 | E5 | E5 implementado. `appStore.ts`: +3 claves (qualityScore/Label/modelsAvail) + get/set/clear. `eda/page.tsx`: useEffect guarda quality score en store cuando llegan los datos. `ModelGatingPanel.tsx` (nuevo): panel colapsable con score badge, barra de progreso coloreada, chips quickselect, detalle expandible locked/unlocked, botones EDA/ETL. `ForecastConfigPanel.tsx`: prop `availableModelIds` → doble lock (tier + calidad) con tooltip explicativo. `forecast/page.tsx`: integra ModelGatingPanel, lee qualityData del store, re-lee cuando cambia dataset. `etl/page.tsx`: useEffect detecta cruce de umbrales post-ETL → Snackbar verde "SARIMA desbloqueado". E2, E3, E4 corregidos a Done en tabla estado. |
| 2026-05-24 | E6 | E6 implementado (Opción C — enriquecer DetectionResult). `detector.py`: +`DecisionStep` model + `decision_steps` en `DetectionResult` + `_build_decision_steps()` con 5 pasos (historia, outliers MAD, estacionalidad FFT, tendencia MK, volatilidad CV). `types.ts`: +`DecisionStep` interface + `decision_steps` en `DetectionResult`. `appStore.ts`: +clave `detectionReport` + `setDetectionReport/getDetectionReport/clearDetectionReport`. `DetectionReportModal.tsx` (nuevo): modal con header de modelo elegido, barra de confianza, stats rápidas, timeline de 5 pasos con icono ✓/✗, nota educativa. `ForecastConfigPanel.tsx`: +props `onOpenDetectionReport` + estados `detecting/detectError` + handler `handleDetect` (llama POST /detect, guarda en store, abre modal) + chip "Analizar serie" + link "Ver último reporte". `forecast/page.tsx`: +import modal + estados `detectionModalOpen/detectionReport` + `handleOpenDetectionReport` + chip "¿Por qué este modelo?" post-MetricsCard + `DetectionReportModal` al final del return. |
| 2026-05-24 | E9.3-E9.4 | `services/events.py`: `events_to_features_df()` — convierte lista de eventos a DataFrame de columnas binarias is*_ con merge por fecha, backward-compatible. `api/events.py`: `EventFeatureColumn` + `EventFeaturesResponse` schemas; endpoint `GET /api/events/as-features` con inferencia automática de rango desde el dataset, cubre todos los años del rango. `lightgbm_model.py`: `_make_features()` acepta `event_features` DataFrame (join por fecha, fillna=0, solo columnas is\__); `__init__` +`event_features` +`_event_cols`; `fit()` y `predict()` propagados. `celery_app.py`: carga eventos antes de instanciar LightGBM (try/catch — nunca rompe el pipeline); `_extract_model_params` incluye `event_cols`. |
| 2026-05-24 | E9.6 | Enciclopedia Cap 8 sección 8.4 “¿Cómo avisarle al modelo que va a pasar algo?”: concepto de features binarias, tabla de casos de uso (Black Friday/cierre/Hot Sale/promo nueva), comparación HW-SARIMA vs LightGBM, warnings de evento sin historia y de gaps con cero, código `events_to_features()`, Alert final vinculando con el Calendario de ForecastIQ. E9 cerrado. |
