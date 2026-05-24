# ROADMAP.md — ForecastIQ

> Mapa de aprendizaje y desarrollo del proyecto.
> El tracking operativo (tareas, checkboxes) está en **TODO.md**.
> Este archivo explica el _por qué_ de cada etapa y las decisiones de diseño.

---

## La visión educativa

ForecastIQ no es solo una herramienta de forecasting — es un **ambiente de aprendizaje** donde el usuario va avanzando de etapa en etapa, exactamente como lo haría un Data Scientist en un proyecto real.

La filosofía del proyecto sigue a **Nicolás Vandeputt** (autor de _"Demand Forecasting Best Practices"_):

- Primero entendé tus datos (EDA)
- Después elegí el modelo correcto según esos datos
- Siempre compará contra un baseline ingenuo (FVA)
- Las métricas son WAPE, MAE, BIAS — en ese orden de importancia
- El sesgo sistemático (BIAS) es más peligroso que el error promedio (MAE)

---

## El journey del usuario dentro de la app

```
┌─────────────────────────────────────────────────────────────┐
│  NIVEL 1: Entiendo mis datos                                 │
│  ──────────────────────────────────────────────────────── │
│  • Subir CSV / Excel / Parquet / conectar DB                 │
│  • EDA: completitud, distribución, outliers, historia        │
│  • ETL: winsorización MAD, imputación de gaps                │
│  • Quality Score: semáforo que desbloquea modelos            │
│                                                             │
│  NIVEL 2: Entiendo los modelos                               │
│  ──────────────────────────────────────────────────────── │
│  • Enciclopedia: fórmulas, código Python, cuándo usar        │
│  • Detector transparente: por qué eligió ESTE modelo         │
│  • Benchmarking: siempre 2-3 modelos + baseline naive        │
│  • FVA: ¿el modelo aporta valor vs copiar el año pasado?     │
│                                                             │
│  NIVEL 3: Mejoro el modelo                                   │
│  ──────────────────────────────────────────────────────── │
│  • Tuneo de parámetros: sliders + ver qué pasa               │
│  • Overfitting: cuando train WAPE << test WAPE → warning      │
│  • Eventos externos: avisarle al modelo lo que va a pasar    │
│  • Rolling CV: validación honesta con K folds temporales     │
│                                                             │
│  NIVEL 4: Escalo y automatizo                                │
│  ──────────────────────────────────────────────────────── │
│  • Multi-serie (batch): 25k SKUs en paralelo con Nixtla      │
│  • Segmentación ABC-XYZ: modelo por segmento                 │
│  • Chat IA: preguntarle a los datos en lenguaje natural      │
│  • MLflow: tracking de experimentos, comparación de runs     │
└─────────────────────────────────────────────────────────────┘
```

---

## E1 — Vista EDA (Próxima fase activa)

### Por qué es la prioridad número uno

Hoy el flujo es: `subí CSV → forecast`. Esto está mal pedagógicamente.

En la práctica real del ML, el **70% del tiempo** es exploración y limpieza de datos. Un Data Scientist experimentado jamás corre un modelo sin haber visto la distribución de sus datos, detectado outliers y entendido cuánta historia tiene.

La app debe reflejar eso. El EDA no es optativo — es el **Paso 0**.

### Qué debe mostrar el EDA

```
Estadísticas básicas:
  → n observaciones, rango de fechas, frecuencia detectada
  → min / max / media / mediana / std / skewness
  → % de valores nulos por columna

Calidad temporal:
  → ¿Cuántos años de historia? → semáforo
  → ¿Hay gaps en la serie? → detectarlos y contarlos
  → ¿La frecuencia es consistente? (no mezcla diario/semanal)

Outliers:
  → Detección con MAD modificado (threshold=3.0)
  → Visualización en el gráfico de la serie (puntos rojos)
  → Límites de Winsorización p5/p95 calculados

Quality Score (0-100):
  → Completitud    (30 pts) — % de valores no nulos
  → Historia       (25 pts) — longitud de la serie
  → Regularidad    (25 pts) — gaps y consistencia de frecuencia
  → Outliers       (20 pts) — proporción de valores extremos

Modelos disponibles según score:
  → < 30 pts → solo Moving Average
  → 30-60    → MA + Holt-Winters simple (SES/Holt)
  → 60-80    → + Holt-Winters triple + SARIMA
  → > 80     → todos, incluyendo LightGBM
```

---

## E2 — Vista ETL

### Por qué después del EDA

El ETL es consecuencia del EDA. Primero ves el problema, después lo resolvés.

### Qué debe mostrar

```
Winsorización MAD:
  → Slider de percentiles (default p5/p95)
  → Gráfico antes/después superpuesto
  → Cuántos valores fueron modificados

Imputación de gaps:
  → Forward fill vs interpolación lineal (selector)
  → Gráfico mostrando los puntos imputados con color diferente

Re-evaluación post-ETL:
  → Quality Score se recalcula automáticamente
  → Si mejoró: "¡Holt-Winters desbloqueado!" (notificación)

Export:
  → Descargar Parquet optimizado con los datos limpios
```

---

## E3 — Enciclopedia

### La idea

Un modal/página tipo libro con navegación lateral. Cuando el usuario está en el Forecast y ve que se eligió Holt-Winters, puede hacer click en "¿Qué es Holt-Winters?" y abrirse la Enciclopedia en ese capítulo.

La integración es bidireccional: la app usa los modelos → la Enciclopedia explica por qué.

### Estructura de capítulos

```
Cap 1: ¿Por qué forecasteamos?
       Demanda vs ventas. El círculo vicioso del forecast de ventas.
       Fuente: Vandeputt cap 1-2

Cap 2: Entender los datos
       EDA, completitud, calidad, historia mínima.
       Fuente: FUENTE 2 cap 1-2

Cap 3: Segmentación ABC-XYZ
       Clasificar productos por volumen y variabilidad.
       Fuente: FUENTE 2 cap 3

Cap 4: Métricas de error
       WAPE, MAE, BIAS, RMSE, MAPE, FVA — fórmulas y cuándo usar cada una.
       Fuente: FUENTE 2 cap 4 + Vandeputt

Cap 5: Moving Average y Seasonal Naive
       El modelo más simple. Por qué siempre hay que empezar aquí.
       Fuente: FUENTE 3 cap 1

Cap 6: Suavizamiento exponencial
       SES (α), Holt (α+β), Holt-Winters triple (α+β+γ).
       Fórmulas. Cómo se optimizan los parámetros.
       Fuente: FUENTE 2 cap 6 + FUENTE 3

Cap 7: ARIMA y SARIMA
       Diferenciación, autocorrelación, parámetros p,d,q.
       Cuándo usar SARIMA vs Holt-Winters.
       Fuente: FUENTE 2 cap 7 + FUENTE 3

Cap 8: Feature engineering
       Lags, rolling windows, variables de calendario.
       Cómo convertir una serie en un dataset tabular para ML.
       Fuente: FUENTE 2 cap 8

Cap 9: LightGBM y Machine Learning
       Gradient boosting. Por qué LightGBM para series de tiempo.
       Optuna: búsqueda bayesiana de hiperparámetros.
       Fuente: FUENTE 2 cap 9

Cap 10: Validación y overfitting
        TimeSeriesSplit. Por qué no se puede usar K-fold aleatorio.
        Rolling CV. Hold-out temporal.
        Fuente: FUENTE 2 cap 10

Cap 11: FVA — Valor Añadido del Pronóstico
        ¿Tu modelo es mejor que el naive? Si no, usá el naive.
        Fuente: FUENTE 2 cap 18 + Vandeputt

Cap 12: Sesgos humanos en forecasting
        Por qué los humanos sistemáticamente sesgan los pronósticos.
        Fuente: FUENTE 2 cap 19 + Vandeputt
```

### Por qué NO incluir caps 11-17 de FUENTE 2

Los capítulos 11-17 de FUENTE 2 (costos de inventario, EOQ, punto de reorden, stock de seguridad, Monte Carlo, MEIO) son **supply chain operativo**, no ML. Son valiosos en su contexto pero se salen del scope de ForecastIQ. La app es sobre **forecasting** — no sobre gestión de inventario.

---

## E4 — Tuneo interactivo de parámetros

### La pregunta educativa clave

> "¿Qué pasa si cambio α de 0.3 a 0.8 en Holt-Winters?"

La respuesta visual es la mejor forma de aprender qué hace cada parámetro.

### Diseño

```
Para cada modelo, mostrar después del forecast:

Holt-Winters:
  → α (suavizamiento nivel): slider 0.01 → 0.99
  → β (suavizamiento tendencia): slider 0.01 → 0.99
  → γ (suavizamiento estacionalidad): slider 0.01 → 0.99
  → Botón "Re-run" → nuevo gráfico superpuesto (gris=auto, color=manual)
  → Indicador: WAPE auto vs WAPE manual

SARIMA:
  → Mostrar (p,d,q)(P,D,Q,s) elegidos automáticamente
  → Posibilidad de sobrescribir con inputs numéricos
  → Warning si los parámetros son inválidos

LightGBM:
  → Mostrar top-10 feature importance como barras
  → Mostrar parámetros Optuna: n_estimators, max_depth, learning_rate, etc.
  → No hay tuneo manual (Optuna lo hace mejor que a mano)
```

---

## E5 — Flujo guiado

### La metáfora del semáforo

La app no debería dejar al usuario llegar al Forecast con datos sucios sin avisarle.

```
Dataset subido
     ↓
EDA automático al subir
     ↓
Quality Score calculado
     ↓
  Score < 30?  → Banner "⚠️ Datos insuficientes — solo Moving Average disponible"
                  Link "Ir a EDA para ver los problemas"
     ↓
  Score 30-80? → Banner "🟡 Datos aceptables — podés mejorarlos en ETL"
                  Algunos modelos desbloqueados
     ↓
  Score > 80?  → Banner "✅ Datos de buena calidad — todos los modelos disponibles"
```

---

## E6 — Detector transparente

### Por qué no puede ser una caja negra

El detector automático (MAD + FFT + Seasonal Mann-Kendall) es uno de los elementos más interesantes de la app. Pero si el usuario solo ve "modelo seleccionado: Holt-Winters" sin entender por qué, pierde todo el valor educativo.

### El reporte de detección debe mostrar

```
Paso 1 — Outliers (MAD):
  "Se detectaron 3 outliers con MAD modificado (threshold=3.0).
   Los valores extremos fueron: [fecha, valor, zscore_modificado]"

Paso 2 — Estacionalidad (FFT):
  "FFT detectó período dominante = 12 (frecuencia mensual).
   Potencia espectral del pico: 0.73 (umbral: 0.25)"

Paso 3 — Tendencia (Seasonal Mann-Kendall):
  "Seasonal MK test: p-value = 0.003 (< 0.05)
   Tendencia: CRECIENTE (tau = 0.42)"

Paso 4 — CV:
  "Coeficiente de variación = 0.68 (umbral LightGBM: > 1.0)"

Árbol de decisión:
  ✓ n_obs = 156 (≥ 104)
  ✓ Estacionalidad detectada (FFT)
  ✓ Tendencia detectada (MK)
  ✗ CV < 1.0 (no aplica LightGBM)
  → MODELO SELECCIONADO: Holt-Winters Triple Exponencial
```

---

## E7 — Benchmarking multi-modelo

### La regla de Vandeputt

> "Nunca reportes un solo modelo. Siempre comparalo contra el naive."

El FVA (Forecast Value Added) mide exactamente eso: ¿cuánto mejor es tu modelo sofisticado respecto a simplemente copiar el período anterior?

### Estructura del benchmark

```
Modelos siempre incluidos:
  1. Seasonal Naive (baseline obligatorio)
  2. Moving Average (baseline estadístico)
  + los modelos disponibles según quality score

Tabla de resultados:
  Modelo          | WAPE  | MAE  | BIAS  | FVA vs Naive
  Moving Average  | 18.3% | 142  | -2.1% | baseline
  Holt-Winters    | 12.7% | 98   | +0.8% | +31%
  SARIMA          | 11.2% | 87   | +1.2% | +39%
  LightGBM        | 9.8%  | 76   | -0.3% | +47%  ← ganador

Conclusión automática:
  "LightGBM ganó con WAPE=9.8%. Mejora del 47% sobre el modelo naive."
  "El BIAS de LightGBM es casi cero (-0.3%) — no hay sobreestimación sistemática."
```

---

## E8 — Ingesta avanzada

### Por qué Parquet es esencial para ML

```
CSV   → texto plano, lento de leer, sin tipos de datos
Excel → binario propietario, lento, límite de filas
Parquet → columnar, comprimido (3-5x vs CSV), tipos de datos preservados,
          DuckDB y Pandas lo leen con pushdown de predicados
```

Para datasets de Kaggle con millones de filas, Parquet es el formato correcto.

### Límites pensados para el EC2 t3.micro

```
El EC2 t3.micro tiene 1 vCPU y 1 GB RAM.
Un CSV de 10 MB puede expandirse a 100 MB en memoria.
Un Parquet de 25 MB puede ser 500 MB en memoria si se lee completo.

Por eso los límites son:
  Local: 50 MB (RAM suficiente)
  EC2:   10 MB CSV/Excel, 25 MB Parquet
  → Para más: usar la instancia local o el dataset sintético del proyecto
```

---

## E9 — Calendario de eventos (LightGBM features)

### El concepto educativo

Los eventos no son solo "notas en el calendario" — son **variables explicativas** que el modelo ML debe conocer para mejorar sus predicciones.

```
Evento "Navidad" el 25 de diciembre:
  → En el dataset de training: columna "es_navidad" = 1 ese día, 0 el resto
  → LightGBM aprende: "cuando es_navidad=1, las ventas suben 40%"
  → En el forecast futuro: "el 25/12 del próximo año también es Navidad"
  → El modelo ya sabe qué esperar

Sin eventos:
  → LightGBM ve el pico de Navidad en los datos históricos
  → Lo interpreta como ruido o outlier
  → No puede predecir el próximo pico de Navidad
```

### Para modelos estadísticos (HW, SARIMA)

La estacionalidad captura Navidad implícitamente si se repite cada año.
Pero eventos únicos (una promoción especial, un shock de demanda) necesitan el enfoque multiplicativo que ya existe.

---

## Decisiones de arquitectura (cerradas)

### Formato de datos

- **CSV/Excel**: para datasets pequeños (< 10 MB), compatibilidad universal
- **Parquet**: para datasets medianos-grandes, siempre mejor que CSV para ML
- **Cloudflare R2**: para el dataset de 25k SKUs (256 MB, egress gratuito)
- **Supabase Storage**: solo para CSVs de usuario (< 10 MB per file)
- **Regla**: nunca subir archivos > 50 MB a Supabase Storage (egress $0.09/GB)

### Modelos en scope

```
moving_average    → baseline, series cortas o muy ruidosas
seasonal_naive    → baseline FVA obligatorio
holt_winters      → tendencia + estacionalidad (workhorse)
sarima            → riguroso, con intervalos de confianza
lightgbm + optuna → alta variabilidad + features externas
prophet           → DESCARTADO (mala reputación, dependencias C, lento)
```

### Stack de frecuencias

```python
# Importante: DuckDB date_trunc y pandas/StatsForecast deben alinearse
"D"  → diario → pandas "D"
"W"  → semanal → date_trunc('week') = lunes → pandas "W-MON"
"M"  → mensual → date_trunc('month') = 1ro del mes → pandas "MS" (Month Start)
"Q"  → trimestral → date_trunc('quarter') → pandas "QS"
# NUNCA usar "M" o "ME" — siempre "MS" para mensual
```

### Métricas de evaluación (prioridad Vandeputt)

```
1. WAPE  — métrica principal, robusta a ceros, estándar industria
2. MAE   — interpretable en unidades de negocio
3. BIAS  — sobreestimación/subestimación sistemática (crítico para inventario)
4. RMSE  — penaliza errores grandes, útil para selección de modelo
5. FVA   — obligatorio siempre: ¿el modelo gana al naive?
```

### Detector automático (inmutable)

```
Pipeline de detección (en orden):
1. MAD (Modified Z-score, threshold=3.0) → detecta outliers
2. Winsorización p5/p95 → normaliza antes de análisis
3. FFT (numpy) → detecta estacionalidad por frecuencia dominante
4. Seasonal Mann-Kendall (pymannkendall) → detecta tendencia
5. CV = std/media → mide volatilidad
6. Árbol de decisión → elige modelo

Reglas del árbol:
  n < 52                          → Moving Average
  n ≥ 52  + estacionalidad (FFT)  → Holt-Winters Triple
  n ≥ 104 + tendencia sin estac.  → SARIMA
  n ≥ 104 + CV > 1.0             → LightGBM + Optuna
```

---

## Fuentes de la Enciclopedia

### En scope (usar como base del contenido)

| Fuente    | Archivo                                          | Capítulos relevantes                                          |
| --------- | ------------------------------------------------ | ------------------------------------------------------------- |
| Vandeputt | `FUENTE 3/Demand Forecasting Best Practices.qmd` | Caps 1-16 completos — el marco conceptual                     |
| Vandeputt | `FUENTE 3/Data Science for Supply Chain.qmd`     | Código Python de cada modelo                                  |
| FUENTE 2  | `cap-1` a `cap-10`                               | EDA, ABC-XYZ, métricas, modelos estadísticos, ML, overfitting |
| FUENTE 2  | `cap-18` (FVA), `cap-19` (sesgos)                | Conceptos clave de proceso                                    |

### Fuera de scope (no incluir en la Enciclopedia)

| Fuente   | Archivo                      | Por qué no                                                         |
| -------- | ---------------------------- | ------------------------------------------------------------------ |
| FUENTE 3 | `Inventory Optimization.qmd` | EOQ, ROP, stock de seguridad — supply chain operativo              |
| FUENTE 2 | `cap-11` a `cap-17`          | Costos inventario, Monte Carlo, MEIO — fuera del scope ML          |
| FUENTE 2 | `cap-20`                     | S&OP / planeación maestra — proceso empresarial, no ML             |
| FUENTE 1 | —                            | Material propio del autor, puede usarse como referencia secundaria |

---

## Stack frontend — decisiones cerradas

```
Core UI:       Next.js 14 + TypeScript + MUI v6
Data fetching: TanStack Query v5 (reemplazó SWR)
Formularios:   React Hook Form v7 + Zod v3
Fechas:        date-fns v3 (reemplaza strings ad-hoc)
Animaciones:   Framer Motion v11 (solo para animaciones de estado)
Charts:        Recharts v2 (ForecastChart complejo con Brush/zonas)
               MUI X Charts v7 (SparkLine en KPI cards, charts simples)
Tablas:        MUI X DataGrid v7 Community (preview de datos en EDA)
Fechas UI:     MUI X Date Pickers v7 (filtros de EDA, Calendario de eventos)
```

### Cuándo usar Recharts vs MUI X Charts

```
Recharts:      ForecastChart — necesita Brush, ReferenceArea, zonas coloreadas,
               tooltip customizado. Recharts tiene más control fino.

MUI X Charts:  SparkLine en KPI cards, LineChart simple en EDA overview,
               BarChart en benchmarking. Ventaja: theme MUI automático,
               menos boilerplate para charts simples.

Regla: si el chart tiene interacciones complejas (brush, zoom, zonas)
       usar Recharts. Si es una visualización de datos estática o simple
       usar MUI X Charts.
```

### Cuándo usar TanStack Query vs fetch directo

```
useQuery:    para GET requests que cachean y re-fetchen automáticamente
             Ejemplos: cargar dataset, obtener quality score, listar forecasts

useMutation: para POST/DELETE con invalidación de cache automática
             Ejemplos: subir dataset, correr forecast, guardar evento

fetch directo: solo para SSE streaming (chat) donde TanStack Query no aplica

NO migrar los hooks existentes solo para migrar. Migrar cuando se toquen.
```

---

_Última actualización: 2026-05-24 — Proyecto reorientado a foco educativo. Fases E1-E9 definidas._
