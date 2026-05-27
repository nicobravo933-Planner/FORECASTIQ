# TODO.md — ForecastIQ

> **Claude: leer este archivo al inicio de cada sesión.**
> Actualizar estado de tareas al finalizar. Agregar fila al Session Log.
> Foco: **educativo** — Data Scientists aprendiendo ML aplicado a forecasting.

---

## 🗺️ Estado general — todo el core implementado

| Bloque         | Estado  | Notas                                              |
| -------------- | ------- | -------------------------------------------------- |
| Base técnica   | ✅ Done | Fases 0–11: infra, modelos, deploy, MLOps, Spark   |
| E1–E9          | ✅ Done | EDA, ETL, Enciclopedia, Tuneo, Flujo, Benchmark... |
| UX-1 / UX-F    | ✅ Done | Forecast profesional, refactor vistas, Vandeput    |
| VIZ-1 / EXP-1  | ✅ Done | Gráficos interactivos, export Excel analítico      |
| UX-MS / MSE-1  | ✅ Done | Multi-serie completo: benchmark, gráfico, export   |
| MS-B3          | ✅ Done | LightGBM multi-serie con lags (paridad Streamlit)  |
| Linear Splines | ✅ Done | Regresión Lineal + Splines cúbicos elegible        |

---

## 🔧 Pendientes activos

### P1 — Excel real+predicho por entidad (gap crítico vs Streamlit)

> El export más valioso: una hoja en el Excel de multi-serie con
> fecha / entidad / real / predicho / error% para el período de test.
> Ese es el archivo que va a la reunión de S&OP.

- [x] `forecast_exporter.py`: agregar hoja "Test vs Real" a `generate_multi_serie_xlsx()`
- [x] En `run_batch_benchmark()`: guardar `test_vs_real` por entidad (modelo ganador)
- [x] En `run_batch_benchmark_lgbm()`: ídem + `_run_lgbm_single` retorna `preds_test_list`
- [x] Frontend tab Exportar: actualizar descripción del botón Excel para mencionar la hoja nueva (5 hojas)

### P2 — Nuevos modelos: SES + Holt Simple

> Ambos mencionados en la Enciclopedia Cap 6 pero no elegibles.
> Inconsistencia educativa: el usuario los lee, no los puede probar.

- [x] Backend `ses_model.py` — `SimpleExpSmoothing` statsmodels
- [x] Backend `holt_model.py` — `ExponentialSmoothing(trend='add', seasonal=None)`
- [x] Integrar ambos en `celery_app.py`: `model_map` + `_cv_cls_map` + `_extract_model_params`
- [x] Frontend `types.ts`: agregar `SESParams` y `HoltSimpleParams` a `ModelParams`
- [x] Frontend `ForecastConfigPanel.tsx`: SES y Holt Simple en `ALL_MODEL_OPTIONS`
- [x] Frontend `forecast/page.tsx`: agregar a `MODEL_LABELS`
- [x] Frontend `ParameterExplorer.tsx`: `SESPanel` + `HoltSimplePanel` + cases de render
- [x] Frontend `DetectionReportModal.tsx`: ya tenía ambos labels y colores ✓

### P3 — Fixes de alineación post-refactor

> Cosas que quedaron desincronizadas tras los cambios recientes.

- [x] `ParameterExplorer.tsx`: agregar caso `linear_splines` (panel read-only con chips)
- [x] `DetectionReportModal.tsx`: agregar `linear_splines` a `MODEL_LABELS` y `MODEL_COLORS`
- [x] `ForecastConfigPanel.tsx` y `BenchmarkTable.tsx`: ya tenían `linear_splines`
- [x] `batch.py` `BatchBenchmarkRequest.models` description: ya decía `| LightGBM`

### P4 — Enciclopedia: gaps de contenido

- [x] **Cap 6**: agregar sección 6-7 "SES y Holt Simple en ForecastIQ"
  - Mostrar la diferencia SES vs Holt vs HW con un gráfico conceptual ASCII
  - Agregar botón "Probar SES →" y "Probar Holt →" (igual que los otros modelos)
  - Explicar cuándo usar cada uno: SES=sin tendencia, Holt=tendencia sin estacional
- [x] **Cap 9**: agregar sección 9-6 "Optuna y el cache de hiperparámetros"
  - Explicar que la primera vez tarda ~60s y luego usa cache
  - Mostrar cómo activar "Re-optimizar" en ForecastIQ
  - Cuándo tiene sentido re-optimizar: datos nuevos con distinto rango, cambio estructural
- [x] **Cap 8, sección 8-6**: Regresión Lineal + Splines
  - `SplineTransformer` + `LinearRegression` con scikit-learn (código completo)
  - Tabla comparativa: Lineal / Splines / HW / LightGBM por interpretabilidad
  - `TryInForecastButton` para `linear_splines`

### P5 — UX: fricción identificada

- [x] **Home Stepper vs PipelineBar**:
  - Implementada Opción B: HomeDashboard usa `<PipelineBar activeStep="/dashboard/home" noMargin />`
  - PipelineBar extendido: union type agrega `/dashboard/home` + prop `noMargin`
  - Eliminado el Stepper inline (`pipelineSteps`, `activeStep` state) de HomeDashboard
- [x] **Aviso dataset multi-entidad en Forecast**:
  - Alert info cuando `entityCol !== null` y no hay drill-down activo
  - Botón "Ir a Multi-serie →" en el Alert
- [x] **Back desde Enciclopedia**:
  - `encyclopedia/page.tsx`: chip "← Volver a Forecast" si `document.referrer` incluye `/forecast` o `sessionStorage.enc_came_from === '/dashboard/forecast'`
  - Click en el chip limpia el flag y navega a `/dashboard/forecast`

### P6 — Chat IA: contexto enriquecido

- [x] Inyectar `detection_report` en el context del chat
  - El system prompt ya tiene `forecast_summary` pero no el reporte de detección
  - Agregar en `build_system_prompt()`: sección `## Model selection reason` con el `reason` del DetectionResult
- [x] Inyectar resultado multi-serie cuando aplica
  - Si el último resultado es un benchmark multi-serie, resumirlo en el prompt
- [x] Tool `get_encyclopedia_context(chapter_id)` — permite al LLM citar definiciones de la Enciclopedia
  - Implementación simple: dict hardcodeado con resúmenes de cada capítulo
  - El LLM lo usa cuando el usuario pregunta "¿qué es WAPE?" o "¿cuándo uso SARIMA?"

### P7 — Optuna cache en modo local sin Supabase

- [x] Implementar cache local SQLite en `~/.forecastiq/hpo_cache.db`
  - Solo cuando `server_tier == "local"` y Supabase no disponible
  - Key: `{dataset_id}_{freq}`
  - Eliminar del cache si `force_reoptimize = True`
  - Esto evita que Optuna corra 60s en cada run durante desarrollo

### Backlog diferido (sin fecha, sin prioridad inmediata)

- [x] Toggle "Tema pantalla Auth" en Settings (Space Dark / Minimal Light) — evento `fiq:auth-theme-change`, key `forecastiq:auth-theme`
- [ ] Landing page pública (hero + features + screenshots)
- [ ] Croston / TSB — demanda intermitente (muchos ceros)
- [ ] Ensemble TOP-3 (HW-add + HW-mul + ETS)
- [ ] i18n español / inglés
- [ ] Notificaciones email al terminar un job largo (Resend)
- [ ] CONTRIBUTING.md

---

## 📊 Comparación ForecastIQ vs Streamlit original

| Feature                                | Streamlit | ForecastIQ   |
| -------------------------------------- | --------- | ------------ |
| N departamentos desde CSV              | ✅        | ✅           |
| Train/test split configurable          | ✅        | ✅           |
| WAPE/BIAS por entidad por modelo       | ✅        | ✅           |
| Modelo ganador por entidad             | ✅        | ✅           |
| Ranking global de modelos              | ✅        | ✅           |
| Gráfico histórico + predicción inline  | ✅        | ✅           |
| Export Excel multi-hoja                | ✅        | ✅ (4 hojas) |
| **Export real+predicho en test**       | ✅        | ✅ P1 ✓      |
| LightGBM multi-serie con lags          | ✅        | ✅ MS-B3     |
| XGBoost / Ensemble                     | ✅        | ❌ fuera     |
| SES / Holt Simple                      | ✅        | ✅ P2 ✓      |
| Regresión Lineal + Splines             | ✅        | ✅           |
| EDA + Quality Score                    | ❌        | ✅ extra     |
| ETL before/after visual                | ❌        | ✅ extra     |
| Chat IA con contexto del dataset       | ❌        | ✅ extra     |
| Enciclopedia interactiva 12 capítulos  | ❌        | ✅ extra     |
| Auth OAuth + historial                 | ❌        | ✅ extra     |
| Rolling CV, intervalos de confianza    | ❌        | ✅ extra     |
| Detector transparente (por qué modelo) | ❌        | ✅ extra     |
| Deploy productivo EC2 + Vercel         | ❌        | ✅ extra     |

---

## 📋 Session Log

| Fecha      | Sesión              | Completado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-05-17 | base-0-2            | CI verde. Repo + GitHub Actions + Docker.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-17 | fase-1              | detector.py (MAD+FFT+SeasonalMK+CV), datasets.py, frontend layout + DropZone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-17 | fase-2              | evaluator.py (WAPE/MAE/BIAS/FVA), 4 modelos ML, Celery, ForecastChart, MetricsCard.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-17 | fase-3-4            | Calendario eventos + feriados AR. Chat SSE + DuckDB + OpenRouter 7 modelos.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-17 | fase-5              | Auth OAuth2 Google/GitHub + RLS Supabase + Settings page.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-18 | fase-6              | Deploy completo: CI/CD → Docker → EC2 + Vercel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-05-19 | fase-7              | structlog + OTel + Grafana Alloy. ROADMAP.md creado.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-19 | fase-7.5            | NavyPro theme, glass cards, login split, rate limiting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-20 | fase-8-9            | MLflow (Dagshub) + Evidently. Nixtla StatsForecast + Polars + DuckDB + Celery Beat.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-21 | fase-10-11          | Dataset sintético 25k SKUs → Cloudflare R2. PySpark notebook + benchmark.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-21 | ux-fixes            | appStore pre-fill, layout full-width, ForecastConfigPanel dropdowns.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-22 | chat-ux             | FloatingChat FAB + Drawer, WelcomeScreen, MessageBubble, ThinkingIndicator.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 2026-05-23 | theme-chat          | NavyPro theme modo light. Chat history migration + ConversationSidebar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 2026-05-23 | forecast-core       | ForecastChart reescrito (Brush/zonas/zoom). Hold-out manual test_periods.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-24 | forecast-pro        | Rolling CV K-folds. DemoSkuSearchDialog. UX-F F1–F4 (Vandeput completo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-24 | e1-e9               | E1 EDA completo. E2 ETL completo. E4 tuneo params. E5 flujo guiado. E6 detector. E9 calendario LightGBM.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-24 | ux-home-settings    | HomeDashboard hero + status cards + Stepper. Settings v2 (5 secciones). Sidebar auto-hide.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-24 | storage-stack       | storage.py abstracción. fe-stack-cleanup deps. E8 Parquet/ConnectDB. UX-1d/f/g/h.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 2026-05-24 | export-viz          | VIZ-1a–e (multi-modelo, error mensual, BIAS acum, heatmap, trend). EXP-1a–c (Excel analítico + benchmark).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 2026-05-24 | ci-bugfixes         | ruff/ESLint CI fixes. Hydration bug. Auth fix Vercel. Rate limit local bypass.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2026-05-25 | ux-ms-completo      | UX-MS completo: PipelineBar, vista Multi-serie, DatasetSelector, tier locks, DataGrid predicciones.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-25 | ms-benchmark        | MS-B1: `run_batch_benchmark` train/test split vectorizado, WAPE/BIAS real, ganador por entidad, Excel 4h.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-05-25 | ms-ux-grafico       | MS-UX1 tab Gráfico inline (Recharts histórico+predicción). MS-UX2 persistencia localStorage.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 2026-05-25 | ms-drilldown-export | Drill-down Multi-serie→Forecast (banner + botón volver). Export Excel multi-hoja 4 hojas funcional.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-05-25 | todo-cleanup        | TODO.md limpiado: eliminado historial acumulado, solo pendientes reales + tabla comparativa Streamlit.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-05-25 | linear-splines      | Regresión Lineal + Splines cúbicos: `linear_splines_model.py`, integración celery + frontend.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-25 | ms-b3               | LightGBM multi-serie con lags (MS-B3): `run_batch_benchmark_lgbm`, batch.py limpio, frontend tier locks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-25 | roadmap-v2          | TODO y ROADMAP reescritos: P1-P7 priorizados, comparativa Streamlit actualizada, chat/UX/enc analizados.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2026-05-25 | p3-p1-fixes         | P3 completado: `linear_splines` en `ParameterExplorer`, `DetectionReportModal` (MODEL_LABELS+COLORS). P1 backend: hoja "Test vs Real" en `forecast_exporter.py`, `nixtla_forecaster.py` guarda `test_vs_real` en ambos benchmarks. Pendiente: frontend botón Excel (P1 último step).                                                                                                                                                                                                                                                                                                             |
| 2026-05-25 | p1-complete         | P1 completado al 100%: frontend `page.tsx` ya tenía botón Excel actualizado (5 hojas, descripción Test vs Real S\&OP). Todos los `[x]` de P1 marcados. TODO.md y comparativa Streamlit actualizados.                                                                                                                                                                                                                                                                                                                                                                                             |
| 2026-05-25 | p2-ses-holt         | P2 completado: `ses_model.py` + `holt_model.py` ya existían. `celery_app.py` ya integrado. Frontend: `SESParams`/`HoltSimpleParams` en `types.ts`, `MODEL_LABELS` en `page.tsx`, `SESPanel`+`HoltSimplePanel` en `ParameterExplorer.tsx`. 7 modelos elegibles en Forecast.                                                                                                                                                                                                                                                                                                                       |
| 2026-05-25 | p4-encyclopedia     | P4 completado: Cap 6 sección 6-7 (SES+Holt en ForecastIQ, WhenToUseCards, botones Probar). Cap 9 sección 9-6 (Optuna cache, flujo 3 pasos, cuándo re-optimizar). Cap 8 sección 8-6 (Splines, SPLINES_CODE, tabla interpretabilidad). `TryInForecastButton` ampliado a 7 modelos. `ChapterSidebar` actualizado (3 nuevas secciones + readTimes).                                                                                                                                                                                                                                                  |
| 2026-05-25 | p5-ux-friction      | P5 completado: P5-1 HomeDashboard usa `<PipelineBar>` (Opción B, Stepper inline eliminado). P5-2 Alert info en Forecast cuando dataset tiene `entityCol`. P5-3 Chip "← Volver a Forecast" en Enciclopedia detectando referrer/sessionStorage.                                                                                                                                                                                                                                                                                                                                                    |
| 2026-05-26 | p6-chat-context     | P6 completado: `_format_detection_report` en `client.py` (sección `## Model selection reason` en system prompt). `ChatStreamRequest` extendido con `detection_report` + `multi_serie_summary`. `useChat` + `chat/page.tsx` leen appStore y envían al backend. Tool `get_encyclopedia_context` (12 capítulos) en `tools.py` + handler en `tool_executor.py`.                                                                                                                                                                                                                                      |
| 2026-05-26 | ci-fixes-2          | Ruff/mypy/ESLint fixes: `ses_model.py`+`holt_model.py` (`Any` import, `dict[str,Any]`, quitar `type:ignore[override]`). `batch.py` (`Response` import, `response_class=Response`). `MetricsCard`+`ModelRecommendation` (MODEL_LABELS/COLOR completos con 7 modelos). `multi-serie/page.tsx` (`&quot;` escape). `forecast_exporter.py` (colores locales renombrados, unused ignores). `nixtla_forecaster.py` (numpy import, `_build_lgbm_features` DatetimeIndex, `_run_lgbm_single` 4-tuple return, ExtensionArray cast, extend cast). `linear_splines_model.py` (`np.array` return, noqa N806). |
| 2026-05-26 | p7-hpo-local-cache  | P7 completado: `hpo_local_cache.py` (SQLite en `~/.forecastiq/hpo_cache.db`). Fallback en `lightgbm_model.py`: Supabase → SQLite local → Optuna. `save_local_hpo_cache` siempre se llama tras Optuna (doble escritura). README: tabla modelos actualizada (SES, Holt Simple, Splines), stack corregido (Railway→EC2, Better Auth + Guest). CLAUDE.md: CI/CD SSH EC2 clarificado.                                                                                                                                                                                                                 |
| 2026-05-26 | debt-cleanup        | README/ROADMAP/CLAUDE.md: eliminadas referencias a Railway. Contributing.md descartado (trabajo solo).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 2026-05-26 | ci-fixes-3          | Ruff/ESLint fixes finales: `forecast_exporter.py` B905 `zip(strict=False)`. `nixtla_forecaster.py` N806 `X`/`X_tr`/`X_full` (noqa) + B905 `zip(strict=False)`. `dataset/page.tsx` `useEffect` dep array agrega `dataset.uploadResponse`. CI verde.                                                                                                                                                                                                                                                                                                                                               |
| 2026-05-26 | demo-dataset-fix    | Bug fix: dataset demo ahora usa `dataset_id = 'demo_{sku_id}'` fijo. `storage.py`: `load_dataset()` detecta prefijo `demo_` y llama `_load_demo_from_r2()` directo a Cloudflare R2 vía DuckDB (sin Supabase Storage, sin TTL). `DatasetSelector.tsx`: elimina `demo/load` POST, asigna `dataset_id` determinístico en el cliente. EDA, Forecast y todos los endpoints que usan `load_dataset()` quedan cubiertos automáticamente.                                                                                                                                                                |
| 2026-05-26 | cloud-fixes         | 3 bugs nube: (1) `config.py` default `server_tier` cambiado a `"ec2"` — imagen vieja no enviaba `hardware_label`/`tier_label` al frontend. (2) Chat 429: causa = IP AWS bloqueada por modelos `:free` de OpenRouter + `OPENROUTER_API_KEY` ausente en `.env` EC2. Fix vía `.env` EC2 (key + modelo). (3) `/dashboard/` sin `page.tsx` caía al primer child alfabético (`data/`) — fix: crear `frontend/app/dashboard/page.tsx` con redirect a `/dashboard/home`.                                                                                                                                 |
| 2026-05-26 | ux-eda-forecast-polish | **UX EDA + Forecast polish**: (1) `ForecastConfigPanel` rediseñado en grid 2-col (columnas, freq+modelo, horizonte+test, train+cv) — ~50% menos scroll. Tooltips cortos sin `\n`. `toggleBtnSx` helper compartido. (2) `ModelsAvailablePanel` reescrito: chips horizontales compactos + CTA ETL, reemplaza la lista vertical de cards. (3) EDA Fila 1 ahora 3-col `[18rem quality] [1fr chart] [15rem models]` con `alignItems:stretch` — misma altura. `DataCompletenessBar` eliminada (redundante con Quality Score). (4) `DatasetPicker` bug fix: filenames que parecen UUID usan `storedFilename` (el nombre original del archivo) como label legible; badge `· ETL` en sublabel para datasets derivados. |
| 2026-05-26 | auth-space-theme     | Tema dark espacial en vista auth. `spaceAuth` en `themePresets.ts` (tema MUI dark con tokens `#050b18`/`#38bdf8`/`#8b5cf6`). `AuthThemeRegistry.tsx` Client Component aislado del dashboard ThemeRegistry. `(auth)/layout.tsx` wrappea con `AuthThemeRegistry`. `login/page.tsx` reescrito: canvas de partículas animadas con `useEffect`+`useRef`, glass card, tokens MUI puros. Toggle Settings "Tema pantalla de acceso" (Space Dark / Minimal Light) en sección Apariencia. |
| 2026-05-26 | landing-fix-vercel  | Fix landing no se mostraba en Vercel. |
| 2026-05-26 | home-dashboard-v5   | `HomeDashboard.tsx` v5: nombre usuario hidratado en useEffect (SSR fix). KPIs removidos → 4 donuts SVG animados (ease-out cubic 800ms). Detección automática último análisis (serie única vs multi-serie por timestamp). `ProfessionalChart`: líneas finas 1.6px, area fill degradado, tooltip div flotante viewport-positioned, range slider MUI zoom 0-100%. `DemoChart` limpio sin labels. `MultiSerieSummary` para batch. |
| 2026-05-26 | home-dashboard-v3   | `HomeDashboard.tsx` reescrito: pipeline incrustado en hero (centro). Chart full-width — demo SVG animado stroke-dashoffset loop 5s sin datos; `RealChart` hover+crosshair+tooltip con datos. Panel métricas lateral (WAPE/FVA/MAE/BIAS/RMSE + próx.período + pico). KPI strip 4 cards intactas. Acciones rápidas y Próximos eventos → FAB pills + Drawers laterales. |
| 2026-05-26 | home-chart-polish | **Home chart polish**: (1) Eliminada mini-timeline bar (Box degradado) sobre el Slider — solo queda una barra de control. (2) Padding contenedor chart reducido `0.875rem 1rem → 0.625rem 0.75rem` para menos espacio en blanco. (3) ViewBox `H=210→270` + `PAD t/b 28/24→26/22` en ambos charts (ProfessionalChart y DemoChart) para mayor altura visual de la gráfica. |
| 2026-05-26 | auth-logo-divider   | **Auth divider fix**: Divider movido de `borderLeft` en el panel derecho a pseudo-elemento `::after` del panel izquierdo (zIndex:1). Logo container mantiene zIndex:10 — ahora pinta SOBRE la línea. Padding del contenedor del logo aumentado `0.5rem→0.875rem` para que el fondo sólido tape el borde a ambos lados. **Home chart fix**: (1) Label `FORECAST →` bajado de `y=PAD.t-8` a `y=PAD.t+16` para no superponerse con la leyenda. (2) Intervalo demo loop aumentado `5000ms→9000ms` para aparición más lenta. |
| 2026-05-26 | ts-eslint-fixes-4   | **TS/ESLint fixes**: `HomeDashboard.tsx` — `all` array annotated with explicit type `{ date; value; isFx; lower?; upper? }[]` (8 TS2339 errors). `DatasetPicker.tsx` — `UUID_RE` hoisted to module-level constant (ESLint `react-hooks/exhaustive-deps` warning). |
| 2026-05-26 | legend-below-chart  | **Leyenda sacada del SVG**: eliminada del área `top-right` del SVG en `ProfessionalChart` y `DemoChart` donde colisionaba con label `FORECAST`. Ahora renderizada como HTML centrado debajo del chart: `ProfessionalChart` → integrada en la fila del range slider (entre “Histórico” y “Forecast” con `flex:1` centrado). `DemoChart` → Box HTML bajo el SVG con fade-in `opacity:0 → dF 4.2s`. Includes SVG dashed line para “Forecast” con `repeating-linear-gradient`. |
