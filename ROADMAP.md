# ROADMAP.md — ForecastIQ

> Mapa de desarrollo y decisiones de diseño.
> El tracking operativo (tareas pendientes) está en **TODO.md**.

---

## Estado — 25/05/2026

**Todo el core está implementado y funcional.** Lo que sigue son mejoras de
calidad, cobertura educativa y cierre de gaps vs el Streamlit de referencia.

| Área               | Estado                                   |
| ------------------ | ---------------------------------------- |
| Datos, EDA, ETL    | ✅                                       |
| Forecast completo  | ✅                                       |
| Multi-serie        | ✅                                       |
| Enciclopedia       | ✅ (gaps menores)                        |
| Chat IA            | ✅ (contexto mejorable)                  |
| Export Excel       | ✅ (falta hoja real+predicho)            |
| Modelos activos    | MA, HW, SARIMA, LightGBM, Linear+Splines |
| Modelos pendientes | SES, Holt Simple                         |

---

## Prioridades de desarrollo

### 🔴 P1 — Excel real+predicho en test (impacto directo en negocio)

El export más valioso del proyecto. Cierra el gap crítico vs el Streamlit.

**¿Qué es?** Una hoja en el Excel de multi-serie con:

```
entidad | fecha | real | predicho | error_pct | bias_acum_pct
```

Para el período de test (2025 en el caso de los 64 departamentos).
Es el archivo que llega a la reunión de S&OP y permite validar el modelo
con el equipo de negocio antes de usarlo para decisiones reales.

**Archivos a tocar:**

- `backend/app/services/forecast_exporter.py` → nueva hoja en `generate_multi_serie_xlsx`
- `backend/app/services/nixtla_forecaster.py` → guardar test_actual por entidad en el resultado
- `frontend/app/dashboard/multi-serie/page.tsx` → actualizar descripción del botón

---

### 🟠 P2 — SES + Holt Simple (coherencia educativa)

La Enciclopedia Cap 6 explica SES y Holt Simple con código Python,
pero esos modelos no son elegibles en el Forecast. Eso crea confusión.

**SES (Simple Exponential Smoothing):**

- Solo nivel, sin tendencia ni estacionalidad
- Ideal para series muy cortas o muy ruidosas
- Parámetro: `alpha` (peso del nivel más reciente)
- Código: `statsmodels.tsa.holtwinters.SimpleExpSmoothing`

**Holt Simple (Double Exponential Smoothing):**

- Nivel + tendencia, sin estacionalidad
- Para series con tendencia clara pero sin ciclo estacional
- Parámetros: `alpha` (nivel), `beta` (tendencia)
- Código: `ExponentialSmoothing(trend='add', seasonal=None)`

**Scope:** `ses_model.py` + `holt_model.py` en `app/ml/models/`, integración
en `celery_app.py` y frontend. 2-3h de trabajo por modelo.

---

### 🟡 P3 — Fixes de alineación (deuda técnica menor)

Cosas concretas que quedaron desincronizadas:

1. `ParameterExplorer.tsx` → agregar caso `linear_splines` (UI read-only, sin sliders)
2. `MODEL_LABELS` en `BenchmarkTable`, `DetectionReportModal`, `ForecastContextBar`
   → agregar `linear_splines` para que no aparezca `undefined`
3. `BatchBenchmarkRequest.models` description → agregar `| LightGBM`

Tiempo estimado: 30 minutos.

---

### 🟡 P4 — Enciclopedia: 3 gaps de contenido

1. **Cap 6, sección 6-7** — SES y Holt Simple en ForecastIQ
   - Diferencia visual entre los tres niveles de suavizamiento
   - Botones "Probar SES →" y "Probar Holt →"

2. **Cap 9, sección 9-6** — Optuna y el cache de HPO
   - Por qué la primera vez tarda 60s y la segunda es instantánea
   - Cómo activar "Re-optimizar" desde la UI
   - Cuándo conviene re-optimizar

3. **Cap 8 o nuevo Cap 13** — Regresión Lineal + Splines
   - Qué son los splines naturales
   - Por qué es el modelo más interpretable
   - Cuándo usar Splines vs Holt-Winters vs LightGBM

---

### 🟢 P5 — UX: 3 puntos de fricción

1. **Stepper del Home vs PipelineBar** → son lo mismo, unificarlos
   - Reemplazar el `Stepper` de Home por el mismo `PipelineBar` de las vistas
   - Resultado: una sola metáfora de navegación en toda la app

2. **Aviso dataset multi-entidad en Forecast**
   - Si `entityCol !== null`, mostrar Alert info en Forecast con botón "Ir a Multi-serie →"

3. **Back desde Enciclopedia**
   - Chip "← Volver" cuando el usuario llega desde un chip `?` del Forecast

---

### 🟢 P6 — Chat IA: contexto enriquecido

El chat YA puede:

- Ejecutar SQL sobre el dataset del usuario (DuckDB tool)
- Ver métricas del último forecast (get_forecast_summary tool)
- Ver eventos del calendario (get_events tool)

Lo que falta:

- Inyectar el `reason` del DetectionResult en el system prompt
  ("El modelo elegido fue Holt-Winters porque se detectó estacionalidad mensual...")
- Inyectar resultado del benchmark multi-serie cuando aplica
- Tool `get_encyclopedia_context(chapter_id)` para que el LLM cite la Enciclopedia

---

### 🟢 P7 — Optuna cache local sin Supabase

En modo dev local sin Supabase, el cache HPO no funciona y Optuna corre
siempre (~60s por forecast). Fix: SQLite en `~/.forecastiq/hpo_cache.db`
cuando `server_tier == "local"`.

---

## Decisiones de arquitectura (cerradas)

### Modelos en scope

```
Serie única:
  moving_average    → baseline, series cortas
  ses               → nivel solo, series muy cortas o ruidosas     [P2]
  holt_simple       → nivel + tendencia, sin estacionalidad        [P2]
  holt_winters      → triple (nivel + tendencia + estacional)
  sarima            → riguroso, IC estadísticos
  linear_splines    → interpretable, tendencias suaves
  lightgbm + optuna → alta volatilidad + features externas
  prophet           → DESCARTADO

Multi-serie (StatsForecast vectorizado):
  SeasonalNaive  → baseline, todos los tiers
  AutoETS        → series estacionales, todos los tiers
  AutoARIMA      → solo tier local
  LightGBM lags  → solo tier local (MS-B3)
```

### Restricciones por tier

| Feature                    | local         | EC2           | cloud        |
| -------------------------- | ------------- | ------------- | ------------ |
| Upload dataset propio      | ✅ 50 MB      | ✅ 10 MB      | ✅ 10 MB     |
| Forecast serie única       | ✅ 6 modelos  | ✅ sin LGBM   | ✅ sin LGBM  |
| Rolling CV SARIMA          | ✅            | ❌            | ❌           |
| Multi-serie dataset propio | ✅ 500 series | ✅ 150 series | ✅ 50 series |
| AutoARIMA multi-serie      | ✅            | ❌            | ❌           |
| LightGBM multi-serie       | ✅            | ❌            | ❌           |
| LightGBM serie única       | ✅            | ❌            | ❌           |

### Stack de frecuencias

```python
"MS"     # Month Start   → date_trunc('month') en DuckDB
"W-MON"  # Week Monday   → date_trunc('week') en DuckDB
"QS"     # Quarter Start → date_trunc('quarter') en DuckDB
# NUNCA "M", "ME", "W" sin día
```

### Métricas (prioridad Vandeputt)

```
1. WAPE  — métrica principal, robusta a ceros
2. MAE   — interpretable en unidades de negocio
3. BIAS  — sobreestimación/subestimación sistemática
4. RMSE  — penaliza errores grandes
5. FVA   — obligatorio: ¿el modelo gana al naive?
```

### Fuentes de la Enciclopedia

| Fuente                                          | Scope       |
| ----------------------------------------------- | ----------- |
| Vandeputt — _Demand Forecasting Best Practices_ | ✅ En scope |
| FUENTE 2 — caps 1-10, 18-19                     | ✅ En scope |
| FUENTE 3 — Data Science for Supply Chain        | ✅ En scope |
| FUENTE 2 — caps 11-17 (inventario, EOQ)         | ❌ Fuera    |
| FUENTE 3 — Inventory Optimization               | ❌ Fuera    |

---

_Última actualización: 2026-05-25_
_Estado: core completo. Próximos pasos en TODO.md P1–P7._
