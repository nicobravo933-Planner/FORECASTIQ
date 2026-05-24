<p align="center">
  <img src="logo.png" alt="ForecastIQ logo" width="280"/><br/>
  <em>Aprendé Machine Learning aplicado a series de tiempo — con datos reales, modelos reales y código real.</em>
  <br/><br/>
  <!-- Stack principal -->
  <img src="https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white"/>
  <img src="https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white"/>
  <img src="https://img.shields.io/badge/Next.js-14-000000?logo=next.js&logoColor=white"/>
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white"/>
  <img src="https://img.shields.io/badge/MUI-v6-007FFF?logo=mui&logoColor=white"/>
  <br/>
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white"/>
  <img src="https://img.shields.io/badge/Redis-Upstash-00E9A3?logo=upstash&logoColor=white"/>
  <img src="https://img.shields.io/badge/Celery-worker-37814A?logo=celery&logoColor=white"/>
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white"/>
  <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white"/>
  <br/>
  <img src="https://img.shields.io/badge/ML-Holt--Winters-4285F4"/>
  <img src="https://img.shields.io/badge/ML-SARIMA-0ea5e9"/>
  <img src="https://img.shields.io/badge/ML-LightGBM-green"/>
  <img src="https://img.shields.io/badge/HPO-Optuna-6236FF"/>
  <img src="https://img.shields.io/badge/LLM-OpenRouter-FF6B35"/>
  <img src="https://img.shields.io/badge/License-MIT-6366F1"/>
  <br/><br/>
  <!-- Acceso rápido — MUY VISIBLE -->
  <a href="https://forecastiq.vercel.app">
    <img src="https://img.shields.io/badge/🌐%20Abrir%20ForecastIQ-forecastiq.vercel.app-6366f1?style=for-the-badge&logoColor=white"/>
  </a>
  &nbsp;
  <a href="INSTRUCTIVO.md">
    <img src="https://img.shields.io/badge/⚙️%20Setup%20local-INSTRUCTIVO.md-22c55e?style=for-the-badge"/>
  </a>
</p>

---

## ¿Qué es ForecastIQ?

**ForecastIQ** es un proyecto educativo open-source de forecasting con Machine Learning.

La idea es simple: en lugar de aprender ML en notebooks aislados, aprendés dentro de una aplicación web real — con backend en producción, base de datos, jobs asíncronos, streaming de IA y CI/CD automatizado. Cada modelo que usás tiene su explicación, sus fórmulas y su código Python visible en la **Enciclopedia** integrada.

> Está pensado para Data Scientists y Data Engineers que quieren entender cómo se aplica el ML al forecasting de series de tiempo en un contexto de negocio real — no solo en un Jupyter notebook.

---

## ¿Qué aprendés usando esta app?

```
EDA → ¿Qué tan buenos son mis datos?
ETL → Limpiar, detectar outliers, winsorizar
Modelos estadísticos → Moving Average, Holt-Winters, SARIMA
Modelos ML → LightGBM con feature engineering + Optuna HPO
Evaluación → WAPE, MAE, BIAS, FVA, benchmarking
Interpretación → ¿Por qué eligió ese modelo y no otro?
Eventos → ¿Cómo impactan las promociones y feriados al forecast?
```

---

## El journey de aprendizaje dentro de la app

```Plaintext
┌─────────────────────────────────────────────────────────────┐
│  1. DATOS        Subí tu CSV, Excel, Parquet o conectá DB   │
│                  EDA: completitud, outliers, historia        │
│                  ETL: winsorización MAD, limpieza            │
│                                                             │
│  2. ANÁLISIS     El detector automático te dice qué modelo  │
│                  es apropiado y por qué (transparente)       │
│                                                             │
│  3. MODELOS      Corrés 2-3 modelos en paralelo             │
│                  Comparás WAPE / MAE / BIAS / FVA            │
│                  Entendés overfitting vs underfitting         │
│                                                             │
│  4. EVENTOS      Agregás promociones, feriados, campañas    │
│                  El modelo los captura como variables        │
│                                                             │
│  5. ENCICLOPEDIA Libro interactivo dentro de la app:        │
│                  fórmulas, código Python, cuándo usar cada  │
│                  modelo, qué significa cada métrica          │
│                                                             │
│  6. CHAT IA      Preguntale a tus datos en lenguaje natural │
└─────────────────────────────────────────────────────────────┘
```

---

## Modelos disponibles

| Modelo                    | Cuándo usarlo                                                   | Mínimo de datos |
| ------------------------- | --------------------------------------------------------------- | --------------- |
| **Moving Average**        | Baseline rápido, datos cortos o muy ruidosos                    | 8 obs           |
| **Seasonal Naive**        | FVA benchmark — "¿el modelo es mejor que copiar el año pasado?" | 1 temporada     |
| **Holt-Winters (triple)** | Tendencia + estacionalidad clara                                | 2 temporadas    |
| **SARIMA**                | Tendencia sin estacionalidad fuerte, con CI riguroso            | 104 obs         |
| **LightGBM + Optuna**     | Alta variabilidad, con features externas (eventos, precio)      | 104 obs         |

> El detector automático (MAD + FFT + Seasonal Mann-Kendall) elige el modelo más adecuado para tus datos. Siempre podés ver el razonamiento detrás de la elección.

---

## Métricas de evaluación (siguiendo a Vandeputt)

| Métrica  | Qué mide                                            | Cuándo usarla             |
| -------- | --------------------------------------------------- | ------------------------- |
| **WAPE** | Error relativo ponderado — robusto a ceros          | Métrica principal siempre |
| **MAE**  | Error absoluto promedio — interpretable en unidades | Para comunicar a negocio  |
| **BIAS** | Sobreestimación vs subestimación sistemática        | Crítico para inventario   |
| **RMSE** | Penaliza errores grandes — para selección de modelo | Comparación entre modelos |
| **FVA**  | ¿El modelo mejora al naive? ¿Cuánto valor agrega?   | Validación mínima siempre |

---

## Stack técnico

```
Frontend    Next.js 14 + TypeScript + MUI v6   → Vercel
Backend     FastAPI + Python 3.12 + UV         → AWS EC2 t3.micro
Queue       Celery + Redis (Upstash)            → jobs ML asíncronos
Database    Supabase (PostgreSQL + Storage)     → datos + auth + RLS
Auth        Better Auth (Google + GitHub OAuth) → sesiones por usuario
LLM         OpenRouter (modelos gratuitos)      → chat IA streaming
CI/CD       GitHub Actions → Docker → EC2       → deploy automatizado
```

---

## Estructura del proyecto

```
forecastiq/
├── backend/                    # FastAPI + ML
│   └── app/
│       ├── ml/
│       │   ├── detector.py     # MAD + FFT + Mann-Kendall → selección automática
│       │   └── models/         # MA, Holt-Winters, SARIMA, LightGBM
│       ├── api/                # datasets, forecast, chat, events, mlops
│       └── services/           # Supabase, Redis, Celery, LLM router
├── frontend/                   # Next.js 14
│   └── app/dashboard/
│       ├── home/               # Panel principal + estado del sistema
│       ├── dataset/            # Subida + EDA + ETL (en desarrollo)
│       ├── forecast/           # Resultados + gráfico interactivo
│       ├── calendar/           # Eventos y promociones
│       ├── chat/               # Asistente IA con streaming
│       ├── mlops/              # MLflow experiments + drift
│       └── batch/              # Forecasting multi-serie (25k SKUs)
├── ENCICLOPEDIA/               # Fuentes de aprendizaje (Vandeputt)
├── notebooks/                  # PySpark pipeline + benchmark
├── scripts/                    # Dataset sintético + benchmarks
├── infra/                      # AWS EC2 + Grafana Alloy
├── INSTRUCTIVO.md              # ← Setup local paso a paso
├── CLAUDE.md                   # ← Convenciones para desarrollar
└── TODO.md                     # ← Fases activas y backlog
```

---

## Fuentes de aprendizaje (Enciclopedia)

El contenido educativo de la app está basado en:

- **Nicolás Vandeputt** — _"Demand Forecasting Best Practices"_ y _"Data Science for Supply Chain Forecasting"_
  - Marco de 5 pasos para la excelencia en forecasting
  - Por qué pronosticar demanda no restringida (nunca ventas)
  - Métricas WAPE, MAE, BIAS, FVA — en ese orden de prioridad
  - Modelos estadísticos con código Python real

---

## Contribuciones

Leé [`CLAUDE.md`](CLAUDE.md) antes de abrir un PR. Convenciones estrictas de código, rem en lugar de px, MUI tokens, etc.

---

## Contacto

<p align="center">
  <strong>Nicolás Bravo</strong> — Data Scientist & Full-Stack Developer<br/><br/>
  <a href="mailto:nicobravo933@gmail.com"><img src="https://img.shields.io/badge/Email-nicobravo933%40gmail.com-ea4335?logo=gmail&logoColor=white"/></a>
  <a href="https://www.linkedin.com/in/nicolás-adrian-bravo-675070b8/"><img src="https://img.shields.io/badge/LinkedIn-Nicol%C3%A1s%20Bravo-0077b5?logo=linkedin&logoColor=white"/></a>
  <a href="https://github.com/nicobravo"><img src="https://img.shields.io/badge/GitHub-nicobravo-181717?logo=github&logoColor=white"/></a>
</p>

---

<p align="center">
  <sub>MIT © Nicolás Bravo · Python 🐍 · FastAPI · Next.js · MUI · Supabase · Upstash · AWS EC2 · OpenRouter</sub>
</p>
