# ROADMAP.md — ForecastIQ

> Mapa de desarrollo y decisiones de diseño del proyecto.
> El tracking operativo (tareas, checkboxes) está en **TODO.md**.
> Este archivo explica el _por qué_ de cada etapa.

---

## Estado actual: Epics E1–E9 + UX-1 + UX-F completados

Todo el flujo educativo core está implementado. Lo que sigue es pulido de UX vista a vista.

### Lo que está construido

| Área             | Qué hay                                                                     | Estado |
| ---------------- | --------------------------------------------------------------------------- | ------ |
| **Datos**        | Upload CSV/Excel/Parquet, connect DB, explorer paginado, demo 25k SKUs      | ✅     |
| **EDA**          | Quality Score 0-100, outliers MAD, completitud, gaps, modelos desbloqueados | ✅     |
| **ETL**          | Winsorización MAD, imputación de gaps, before/after chart, export Parquet   | ✅     |
| **Forecast**     | 4 modelos + auto-detección transparente, hold-out, Rolling CV, benchmarking | ✅     |
| **Tuneo**        | ParameterExplorer sliders HW/SARIMA, re-run con params manuales             | ✅     |
| **Calendario**   | CRUD eventos, feriados AR, Black Friday/Hot Sale auto, features LightGBM    | ✅     |
| **Chat IA**      | SSE streaming, DuckDB tools, OpenRouter 7 modelos, historial por usuario    | ✅     |
| **MLOps**        | MLflow (Dagshub), Evidently drift detection, WAPE trend chart               | ✅     |
| **Batch**        | Nixtla StatsForecast vectorizado, 25k SKUs, drill-down a Forecast           | ✅     |
| **Enciclopedia** | 12 capítulos interactivos, progreso localStorage, KaTeX, code blocks        | ✅     |
| **Auth**         | OAuth Google/GitHub, RLS Supabase, sesiones por usuario                     | ✅     |
| **Deploy**       | CI/CD GitHub Actions → Docker → AWS EC2 + Vercel                            | ✅     |
| **MLOps infra**  | MLflow + Evidently, Celery Beat, Grafana Alloy                              | ✅     |

---

## La filosofía educativa

ForecastIQ sigue a **Nicolás Vandeputt** (_"Demand Forecasting Best Practices"_):

- Primero entendé tus datos (EDA)
- Después elegí el modelo correcto según esos datos
- Siempre compará contra un baseline ingenuo (FVA)
- Las métricas son WAPE, MAE, BIAS — en ese orden de importancia
- El sesgo sistemático (BIAS) es más peligroso que el error promedio (MAE)

---

## Fases completadas: UX-1 + UX-F (cerradas)

UX-1 (refactor de vistas) y UX-F (Forecast profesional) están cerradas.
Ver TODO.md para detalle de tareas completadas.

---

## ── NUEVA FASE ACTIVA ──────────────────────────────────────────────────────

## Fase VIZ-1: Gráficos interactivos nivel producción

> El Streamlit de referencia usaba Apache ECharts vía `streamlit-echarts`.
> ForecastIQ usa Recharts. La brecha no es de librería — es de features:
> falta el `dataZoom` (range slider), comparación multi-modelo simultánea,
> y gráficos analíticos derivados (error mensual, BIAS acumulado, heatmap).
>
> **Decisión de arquitectura:** mantener Recharts para ForecastChart (ya tiene
> Brush, zonas coloreadas, CI) y agregar los gráficos nuevos con Recharts también.
> No introducir ECharts — sería una dependencia pesada para 3 gráficos.
> Recharts puede hacer todo lo que necesitamos con ComposedChart + ResponsiveContainer.

### VIZ-1a — ForecastChart con dataZoom y multi-modelo

> El chart principal de Forecast hoy muestra 1 modelo. El Streamlit mostraba
> histórico + real test + N líneas punteadas (una por modelo) + forecast futuro
> + range slider. Ese es el target.

Qué agregar al ForecastChart existente:
- `dataZoom` = Recharts `<Brush>` ya existe, pero solo abarca el ancho del gráfico.
  Convertirlo en un range slider visible y persistente debajo del gráfico (ya hay
  código — revisar si el startIndex/endIndex está bien configurado).
- **Multi-modelo overlay**: cuando el Benchmark corre, guardar las predicciones de
  cada modelo en el resultado. En el tab "Forecast", mostrar checkbox por modelo →
  línea punteada de color distinto por modelo activo. Máximo 4 modelos simultáneos.
- **Animación de entrada**: `isAnimationActive={true}` en cada `<Line>` con
  `animationDuration={800}` y `animationEasing="ease-out"` — Recharts ya soporta esto.
- **Tooltip rico**: mostrar todos los modelos activos en el mismo tooltip al hacer hover.

### VIZ-1b — Gráfico de error mensual

> El Streamlit tenía barras verdes/rojas de error % mes a mes.
> En ForecastIQ esto no existe. Se agrega como tab nuevo "Error mensual" en los resultados.

- `ErrorMonthlyChart.tsx` — `<BarChart>` de Recharts con `<Cell>` coloreado:
  - Verde: `|error| < 20%`
  - Rojo: `|error| >= 20%`
  - Gris: real ≤ 0 (no calculable)
  - `<ReferenceLine y={0}/>` en cero y líneas punteadas en ±20%
  - Tooltip: `"Pred: X | Real: Y | Error: Z%"`
- Datos: calculados en el frontend desde `result.predictions` (fecha, real, predicho)
- Condicional: solo visible cuando `testPeriods > 0`

### VIZ-1c — Gráfico de BIAS acumulado

> Identifica sobrestock (modelo sobreestima sistemáticamente) o riesgo de quiebre
> (modelo subestima). Muy útil para analistas de demanda.

- `CumulativeBiasChart.tsx` — `<LineChart>` de Recharts:
  - Línea de BIAS acumulado mes a mes
  - `<ReferenceArea>` verde entre -10% y +10% (zona aceptable)
  - `<ReferenceArea>` rojo/naranja fuera de ese rango
  - `<ReferenceLine y={0}/>` con label
  - Tooltip: `"BIAS acum: X% → riesgo quiebre"` / `"→ sobrestock"`
- Fórmula: `bias_acum[t] = cumsum((pred_i - real_i) / sum(real) * 100)`

### VIZ-1d — Heatmap de estacionalidad (año × mes)

> El Streamlit tenía un heatmap para visualizar la estacionalidad.
> En ForecastIQ existe el detector de estacionalidad (FFT) pero no una visualización.

- `SeasonalityHeatmap.tsx` — tabla pivotada años × meses con colores:
  - Filas: años de historia
  - Columnas: meses (Ene-Dic)
  - Color: intensidad del valor (blanco → azul oscuro)
  - Implementar como `<table>` con CSS `background` calculado (no necesita Recharts)
  - Incluir en tab "Diagnóstico" de la vista Forecast

### VIZ-1e — Tendencia interanual (líneas por año)

> "¿Creció el año 2024 vs 2023?" — una línea por año sobre el mismo eje mensual.

- `YearlyTrendChart.tsx` — `<LineChart>` con una línea de color distinto por año
- Eje X: meses (Ene-Dic), eje Y: valor de la serie
- Paleta de colores automática por año (hasta 6 años)
- Condicional: solo visible cuando la serie tiene >= 2 años de historia
- Incluir en tab "Diagnóstico" de la vista Forecast

---

## Fase EXP-1: Exportación de resultados analíticos

> El gap más crítico respecto al Streamlit. El Excel con 12 hojas era el
> entregable final del análisis. ForecastIQ hoy solo exporta datos crudos.
> El objetivo: que el usuario pueda llevarse un Excel profesional con todo
> el análisis, listo para compartir con su equipo.

### EXP-1a — Backend: endpoint de export analítico

- `GET /api/forecast/{job_id}/export?format=xlsx|csv|json` — genera el archivo
  en memoria (BytesIO) y lo retorna como `FileResponse`
- Contenido del Excel (siguiendo estructura del Streamlit, adaptado a ForecastIQ):
  - Hoja 1: **Resumen** — dataset, modelo usado, métricas (WAPE/MAE/BIAS/FVA), fecha
  - Hoja 2: **Predicciones** — fecha, predicho, lower_ci, upper_ci
  - Hoja 3: **Benchmark** — tabla de todos los modelos con sus métricas
  - Hoja 4: **Error mensual** — fecha, real, predicho, error%, color semáforo
  - Hoja 5: **Serie histórica** — datos originales del dataset
  - Hoja 6: **Parámetros del modelo** — alpha, beta, gamma, order, etc.
- Librerías: `openpyxl` (ya disponible en el proyecto del Streamlit)
- El endpoint debe reconstruir los datos desde el job_id en Supabase

### EXP-1b — Frontend: botón export mejorado

- Mejorar `ExportButton.tsx` actual (que solo exporta CSV/Parquet del dataset)
- Nuevo `ForecastExportButton.tsx` en la vista Forecast, tab "Forecast":
  - Split button: **Excel analítico** / CSV predicciones / JSON
  - Muestra loader mientras descarga
  - Aparece solo cuando `result !== null`

### EXP-1c — Export de benchmark multi-modelo

- Cuando el Benchmark corrió (tab "Benchmark"), agregar botón:
  - `GET /api/forecast/benchmark/{job_id}/export?format=xlsx`
  - Excel con una hoja por modelo + hoja de comparación

---

## Fase MSE-1: Análisis multi-entidad desde un solo CSV

> El Streamlit procesaba 64 departamentos desde un CSV con columna `Departamento`.
> ForecastIQ ya tiene `batch.py` con Nixtla, pero está desconectado del flujo
> normal de upload. El objetivo: que cualquier CSV con una columna de agrupación
> pueda tratarse como multi-serie desde la misma interfaz.

### MSE-1a — Detección de columna de agrupación

- En el paso de selección de columnas (Dataset page), agregar un selector opcional:
  `"Columna de entidad / agrupación"` (ej: SKU, Departamento, Tienda, Producto)
- Si se selecciona: el job se encola como batch, no como forecast individual
- Si no se selecciona: comportamiento actual (serie única)
- Backend: `ForecastRunRequest` acepta `entity_col: str | None`

### MSE-1b — Resultados multi-entidad

- Vista `/dashboard/batch` mejorada:
  - Selector de entidad para drill-down (igual que el Streamlit con el depto selector)
  - Chart principal = `ForecastChart` filtrado por entidad seleccionada
  - Tabla de ranking de entidades por WAPE (mejor → peor)
  - Export Excel con una hoja por entidad + hoja resumen

### MSE-1c — Compatibilidad con el dataset del Streamlit

- El CSV del Streamlit tiene columnas: `Fecha`, `Departamento`, `Cantidad Bultos`
- ForecastIQ debe poder cargar ese CSV exactamente → seleccionar columnas →
  elegir `Departamento` como entidad → correr batch → obtener resultados similares
- Esto valida que ForecastIQ puede reemplazar al Streamlit para ese caso de uso

---

## Fase UX-1: Refactor de vistas (fase activa, previo — CERRADA)

Cada vista tiene mejoras identificadas. Se implementan de a una, con criterio de calidad
antes de pasar a la siguiente. Las tareas detalladas están en **TODO.md → sección UX-1**.

### Prioridad y orden

```
UX-1a: Forecast    → Tabs (Forecast / Benchmark / Diagnóstico / Parámetros)
UX-1b: Calendario  → MUI X DateCalendar + diseño alineado al resto de la app
UX-1c: Batch       → MUI X DataGrid en tabla de predicciones
UX-1d: EDA         → MiniHistograma + visualización de gaps en la serie
UX-1e: Enciclopedia→ Buscador de capítulos + links "Probar en Forecast"
UX-1f: Chat        → Quitar mic placeholder + fix altura con HEADER_HEIGHT token
UX-1g: MLOps       → Equal-height cards + drill-down a Forecast desde tabla
UX-1h: Home        → Stepper educativo EDA→ETL→Forecast visible
```

### Criterio de done por vista

- Diseño consistente con el resto (glass cards, tokens MUI, rem)
- Funcionalidades MUI X aprovechadas donde corresponde
- Sin valores hardcodeados ni rutas incorrectas
- TypeScript limpio, sin `any` innecesarios

---

## Fase UX-F: Forecast profesional — flujo Vandeput (CERRADA)

> El corazón de ForecastIQ. Esta fase convierte la vista Forecast en una herramienta
> de análisis real, siguiendo el flujo que describe Vandeput en _Demand Forecasting Best Practices_.

### Filosofía de diseño

Un analista de demanda real trabaja así:

```
1. Preparar datos → elegir serie, granularidad, ventana de historia
2. Definir validación → split train/test, horizonte = períodos de test
3. Seleccionar modelo → según historia disponible, estacionalidad, volatilidad
4. Evaluar → WAPE principal, BIAS crítico, FVA obligatorio vs Seasonal Naive
5. Proyectar → solo con el modelo ganador de la evaluación
```

Hoy ForecastIQ cubre los pasos 3-5 pero los pasos 1-2 están incompletos o rotos.
El objetivo de esta fase es completar el flujo sin romper lo que ya funciona.

### Conexiones entre vistas (mapa real)

```
Dataset upload
    │
    ▼
appStore {datasetId, dateCol, targetCol, freq}
    │
    ├──► EDA page  ──► setQualityScore() ──────────────────────► Forecast lee modelos disponibles
    │                                                              Forecast muestra score en ContextBar
    │
    ├──► ETL page  ──► setActiveDataset(cleanedId) ────────────► Forecast usa datos limpios (badge ETL)
    │
    └──► Forecast page ──► setActiveJobId() ────────────────────► Home muestra último forecast
                       ──► Enciclopedia muestra capítulo del modelo usado
```

**Gap actual:** si el usuario va directo a Forecast sin pasar por EDA/ETL, no sabe
si sus datos son buenos ni si está usando datos limpios. No hay indicador visual.

### F1 — Arreglar lo que está roto (quirúrgico)

> Solo fixes. Sin cambios de layout. Prioridad máxima.

- [ ] **F1.1** `HorizonSelector.tsx` — bug: click en "Otro" no activa el input porque `handleQuick` hace `return` cuando `newVal === "custom"`. Fix: estado local `isCustomMode` separado del valor.
- [ ] **F1.2** `ForecastConfigPanel.tsx` — `testPeriods` adaptativo por frecuencia:
  - `D` (diaria): opciones 7 / 30 / 90 / manual
  - `W` (semanal): opciones 4 / 8 / 13 / manual
  - `M` (mensual): opciones 3 / 6 / 12 / manual ← actual
  - `Q` (trimestral): opciones 2 / 4 / 8 / manual
  - Siempre con input libre adicional
- [ ] **F1.3** Validación pre-run: si `testPeriods > totalRows * 0.5` → warning inline (no bloquea, solo advierte)
- [ ] **F1.4** Checkbox "Vincular horizonte = test": cuando activo, `onChange({ testPeriods: horizon })` y viceversa. Vandeput recomienda que el horizonte de proyección sea igual al período de evaluación.

### F2 — Barra de contexto + ventana de train

> Hace visible la conexión EDA → ETL → Forecast.

- [ ] **F2.1** `ForecastContextBar.tsx` (nuevo componente): barra compacta arriba del panel de config que muestra:
  - Nombre del dataset (con badge "ETL ✓" naranja si `cleanedDatasetId` existe en store, "Original" gris si no)
  - `N obs · Frecuencia detectada`
  - Quality Score como chip de color (verde/amarillo/rojo)
  - Botones "→ EDA" y "→ ETL" si el score es < 60
- [ ] **F2.2** `appStore.ts` — agregar `cleanedDatasetId` para que Forecast sepa si debe ofrecer usar el dataset limpio del ETL:
  ```typescript
  setCleanedDataset(id: string): void
  getCleanedDatasetId(): string | null
  clearCleanedDataset(): void
  ```
  El ETL page ya llama `appStore.setActiveDataset(cleanedId, ...)` — pero no hay forma de saber si ese id es el limpio o el original.
- [ ] **F2.3** Selector "Ventana de entrenamiento": dropdown en ForecastConfigPanel con opciones:
  - Auto (toda la historia) ← default
  - Últimos 1 año
  - Últimos 2 años
  - Últimos 3 años
  - Desde fecha (DatePicker MUI X)
    Agrega campo `train_start_date: string | null` a `ForecastRunRequest` en `types.ts`.
- [ ] **F2.4** Backend `celery_app.py` — si `train_start_date` viene en el request, recortar la serie:
  ```python
  if config.get("train_start_date"):
      series = series[series.index >= pd.Timestamp(config["train_start_date"])]
  ```
  Cambio de ~5 líneas.

### F3 — Nuevo layout 2 filas

> Reestructura visual. El gráfico aprovecha todo el ancho horizontal.

- [ ] **F3.1** `page.tsx` — layout 2 filas:
  - Fila 1: panel de config full-width (sin columna lateral)
  - Fila 2: resultados full-width (tabs + gráfico + métricas)
  - Eliminar el grid `26rem 1fr` actual
- [ ] **F3.2** Panel de config colapsable post-run: usar `Accordion` MUI. Tras el primer forecast, la config se colapsa mostrando 1 línea de resumen (dataset · modelo · horizonte · test). Botón "Editar configuración" para re-expandir.
- [ ] **F3.3** `ForecastChart` — aumentar altura a `540px` al tener ancho completo. Mejorar labels en eje Y (abreviar números grandes: 1.2M, 45K).
- [ ] **F3.4** `MetricsCard.tsx` — variante horizontal: 4 chips en fila (WAPE · MAE · BIAS · FVA) con color semáforo. La variante vertical existente se mantiene para cuando el ancho es < md.

### F4 — Educación integrada (conexión con Enciclopedia)

> Cada decisión que toma el usuario tiene un "¿por qué?" accesible sin salir de la vista.

- [ ] **F4.1** Tooltips educativos con link a capítulo de Enciclopedia en cada selector:
  - Horizonte → Cap 1 (¿por qué forecastear?)
  - Test periods → Cap 4 (métricas y evaluación)
  - CV Folds → Cap 10 (validación cruzada)
  - Ventana de train → Cap 2 (entender los datos)
- [ ] **F4.2** Alerta BIAS: cuando `|bias| > 0.05` (5%), mostrar chip explicativo bajo MetricsCard:
  - BIAS positivo: "Sobreestimás +X%. Riesgo de sobrestock. [Ver Cap. 4]"
  - BIAS negativo: "Subestimás X%. Riesgo de quiebre de stock. [Ver Cap. 4]"
- [ ] **F4.3** Alerta FVA: cuando `fva < 0`, mostrar alerta:
  - "Tu modelo rinde peor que copiar el año pasado (Seasonal Naive). Probá con más historia o limpiá los datos. [Ver Cap. 11]"
- [ ] **F4.4** Badge "Vandeput recomienda" en test periods: tooltip fijo que dice
      "Reservar al menos 1 ciclo completo de estacionalidad como test (ej: 12 meses para datos mensuales)"

---

## Fase UX-2: Mejoras cruzadas (backlog diferido)

```
UX-2a: Stepper educativo en EDA/ETL/Forecast (journey visible en header)
UX-2b: Framer Motion en transiciones de estado (idle→running→done en Forecast)
UX-2c: TanStack Query en hooks existentes cuando se toquen por otra razón
UX-2d: date-fns para formateo de rangos y fechas relativas en EDA
```

---

## Decisiones de arquitectura (cerradas, no modificar)

### Detector automático — pipeline inmutable

```
1. MAD (Modified Z-score, threshold=3.0)  → detecta outliers
2. Winsorización p5/p95                   → normaliza para análisis
3. FFT (numpy)                             → detecta estacionalidad
4. Seasonal Mann-Kendall (pymannkendall)   → detecta tendencia
5. CV = std / media                        → mide volatilidad
6. Árbol de decisión → elige modelo

Reglas:
  n < 52                         → Moving Average
  n ≥ 52  + estacionalidad (FFT) → Holt-Winters Triple
  n ≥ 104 + tendencia sin estac.  → SARIMA
  n ≥ 104 + CV > 1.0            → LightGBM + Optuna
```

### Métricas (prioridad Vandeputt)

```
1. WAPE  — métrica principal, robusta a ceros
2. MAE   — interpretable en unidades de negocio
3. BIAS  — sobreestimación/subestimación sistemática
4. RMSE  — penaliza errores grandes
5. FVA   — obligatorio siempre: ¿el modelo gana al naive?
```

### Stack de frecuencias — pandas alineado con DuckDB

```python
"MS"     # Month Start   → date_trunc('month') en DuckDB
"W-MON"  # Week Monday   → date_trunc('week') en DuckDB
"QS"     # Quarter Start → date_trunc('quarter') en DuckDB
# NUNCA "M", "ME", "W" sin día — causan desalineación
```

### Modelos en scope (cerrado)

```
moving_average    → baseline, series cortas o ruidosas
seasonal_naive    → baseline FVA obligatorio
holt_winters      → tendencia + estacionalidad (workhorse)
sarima            → riguroso, intervalos de confianza
lightgbm + optuna → alta variabilidad + features externas
prophet           → DESCARTADO (lento, dependencias C, mala reputación)
```

### Stack frontend (cerrado)

```
Core:         Next.js 14 + TypeScript + MUI v6
Data fetch:   TanStack Query v5 (reemplazó SWR — migrar al tocar cada hook)
Formularios:  React Hook Form v7 + Zod v3 (formularios nuevos)
Fechas:       date-fns v3 (reemplaza strings ad-hoc)
Animaciones:  Framer Motion v11 (solo transiciones de estado)
Charts:       Recharts v2 (ForecastChart complejo con Brush/zonas)
              MUI X Charts v7 (SparkLine en KPI cards, charts simples)
Tablas:       MUI X DataGrid v7 Community (cuando hay sorting/filtering)
Fechas UI:    MUI X Date Pickers v7 (Calendario, filtros de EDA)

Regla Recharts vs MUI X Charts:
  Recharts   → chart con interacciones complejas (Brush, zoom, ReferenceArea)
  MUI X      → visualizaciones simples o cuando theme MUI automático es ventaja
```

---

## Fuentes de la Enciclopedia

| Fuente                                          | Qué cubre                               | Scope              |
| ----------------------------------------------- | --------------------------------------- | ------------------ |
| Vandeputt — _Demand Forecasting Best Practices_ | Marco conceptual, FVA, sesgos           | En scope           |
| FUENTE 2 — caps 1-10, 18-19                     | EDA, métricas, modelos, ML, overfitting | En scope           |
| FUENTE 3 — Data Science for Supply Chain        | Código Python de cada modelo            | En scope           |
| FUENTE 2 — caps 11-17                           | Costos inventario, EOQ, Monte Carlo     | **Fuera de scope** |
| FUENTE 3 — Inventory Optimization               | EOQ, ROP, stock de seguridad            | **Fuera de scope** |

---

_Última actualización: 2026-05-24 — Epics E1-E9 completados. Fase UX-1 activa._
