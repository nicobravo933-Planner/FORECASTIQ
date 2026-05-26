"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { PythonCodeBlock } from "../PythonCodeBlock"
import { TryInForecastButton } from "../TryInForecastButton"

function SectionAnchor({ id }: { id: string }) {
  return <Box component="span" data-section-id={id} sx={{ display: "block", mt: "-1rem", pt: "1rem" }} />
}

const FE_CODE = `import pandas as pd
import numpy as np

def create_features(df, target_col='demand', date_col='date', lags=[1,2,3,12], windows=[4,12]):
    """
    Genera features para un modelo ML sobre series de tiempo.
    df         : DataFrame con columnas [date, demand]
    lags       : períodos de lag a incluir
    windows    : ventanas para rolling mean/std
    """
    df = df.copy().sort_values(date_col)
    df[date_col] = pd.to_datetime(df[date_col])

    # ── Lags ─────────────────────────────────────────────────────────────
    for lag in lags:
        df[f'lag_{lag}'] = df[target_col].shift(lag)

    # ── Rolling statistics ────────────────────────────────────────────────
    for w in windows:
        df[f'roll_mean_{w}'] = df[target_col].shift(1).rolling(w).mean()
        df[f'roll_std_{w}']  = df[target_col].shift(1).rolling(w).std()

    # ── Variables de calendario ───────────────────────────────────────────
    df['month']       = df[date_col].dt.month
    df['quarter']     = df[date_col].dt.quarter
    df['week_of_year']= df[date_col].dt.isocalendar().week.astype(int)
    df['year']        = df[date_col].dt.year
    df['month_sin']   = np.sin(2 * np.pi * df['month'] / 12)  # encoding cíclico
    df['month_cos']   = np.cos(2 * np.pi * df['month'] / 12)

    return df.dropna()   # eliminar filas sin suficiente historia para los lags`

const EVENTS_CODE = `import pandas as pd
import re

def events_to_features(events, date_index):
    """
    Convierte una lista de eventos en columnas binarias para LightGBM.

    events     : lista de dicts con keys 'name', 'start_date', 'end_date'
    date_index : DatetimeIndex del dataset (mensual, semanal o diario)

    Retorna un DataFrame con una columna is_<nombre> por evento.
    """
    df = pd.DataFrame({'date': date_index})
    df['date'] = pd.to_datetime(df['date'])

    def sanitize(name):
        slug = re.sub(r'[^a-z0-9]+', '_', name.lower().strip())
        return f'is_{slug.strip("_")}'

    for ev in events:
        col   = sanitize(ev['name'])
        start = pd.to_datetime(ev['start_date'])
        end   = pd.to_datetime(ev['end_date'])
        mask  = (df['date'] >= start) & (df['date'] <= end)

        if col in df.columns:               # dos eventos con mismo slug → OR
            df[col] = (df[col].astype(bool) | mask).astype('int8')
        else:
            df[col] = mask.astype('int8')

    return df


# Ejemplo de uso con Black Friday y cierre de enero
events = [
    {'name': 'Black Friday',     'start_date': '2024-11-29', 'end_date': '2024-11-29'},
    {'name': 'Cierre enero',     'start_date': '2025-01-01', 'end_date': '2025-01-31'},
    {'name': 'Hot Sale',         'start_date': '2025-05-12', 'end_date': '2025-05-14'},
]
date_idx = pd.date_range('2024-01-01', '2025-12-01', freq='MS')
features = events_to_features(events, date_idx)
print(features[features.sum(axis=1) > 0])

# Salida esperada:
#          date  is_black_friday  is_cierre_enero  is_hot_sale
# 10  2024-11-01               1                0            0
#  0  2025-01-01               0                1            0
#  4  2025-05-01               0                0            1`

const SPLINES_CODE = `import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import SplineTransformer
from sklearn.pipeline import make_pipeline

def fit_linear_splines(train: pd.Series, n_knots: int = 5) -> tuple:
    """
    Ajusta un modelo de Regresión Lineal con Splines cúbicos naturales.

    train    : pd.Series con DatetimeIndex mensual
    n_knots  : cantidad de knots (puntos de corte). Más knots = más flexibilidad.
               Regla práctica: 1 knot por año de datos (mín 3, máx 8).

    Retorna el modelo entrenado y el índice numérico usado para el fit.
    """
    # Convertir índice temporal a valores numéricos (0, 1, 2, ...)
    t = np.arange(len(train)).reshape(-1, 1)
    y = train.values

    # Pipeline: SplineTransformer + Regresión Lineal
    model = make_pipeline(
        SplineTransformer(n_knots=n_knots, degree=3, knots='quantile'),
        LinearRegression()
    )
    model.fit(t, y)

    print(f'R² en train: {model.score(t, y):.3f}')
    return model, len(train)  # guardamos n para extrapolar


def predict_splines(model, n_train: int, horizon: int) -> np.ndarray:
    """
    Extrapola el modelo de splines horizon pasos hacia adelante.
    Nota: los splines extrapolados fuera del rango de entrenamiento
    son LINEALES (natural boundary condition) — no inventan curvatura.
    """
    t_future = np.arange(n_train, n_train + horizon).reshape(-1, 1)
    return model.predict(t_future)


# Ejemplo de uso
model, n_train = fit_linear_splines(train_series, n_knots=4)
forecast = predict_splines(model, n_train, horizon=12)
print(f'Predicción 12 meses: {forecast.round(1)}')`

export function Chapter08() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>⚙️ Feature Engineering</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Convertir una serie de tiempo en un dataset tabular para ML
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem" }}>
        <strong>El salto conceptual más importante:</strong> Los modelos como LightGBM no &quot;ven&quot; una
        serie de tiempo — ven una tabla de filas y columnas. El Feature Engineering es la clave para
        transformar la serie en ese formato sin perder información temporal.
      </Alert>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>8.1 Lags — la memoria del modelo</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Un <strong>lag</strong> es el valor de la serie <em>k períodos atrás</em>. Al incluir
        <code> lag_1</code> (el mes anterior), <code>lag_12</code> (el mismo mes del año pasado), estás
        dándole al modelo acceso explícito a su propio pasado.
      </Typography>
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Feature", "Qué captura"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["lag_1", "Autocorrelación de corto plazo — ¿cuánto influyó el mes pasado?"],
              ["lag_12", "Misma época del año anterior — captura estacionalidad anual"],
              ["lag_52", "Misma semana del año anterior (datos semanales)"],
              ["roll_mean_4", "Tendencia de corto plazo (promedio móvil de 4 períodos)"],
              ["roll_std_12", "Volatilidad reciente — útil para LightGBM con CV alto"],
            ].map(([f, d], i) => (
              <tr key={f as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace", color: "#3b82f6", fontWeight: 600 }}>{f as string}</td>
                <td style={{ padding: "0.4rem 1rem", color: "#374151" }}>{d as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>8.2 Variables de calendario</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El mes, el día de la semana, el trimestre — son features que el modelo puede usar para aprender
        patrones estacionales directamente.
      </Typography>
      <Alert severity="warning" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Encoding cíclico:</strong> Diciembre (mes 12) y Enero (mes 1) son cercanos en el tiempo
        pero numérica- mente lejanos (12 vs 1). Usar <code>sin(2π·mes/12)</code> y <code>cos(2π·mes/12)</code>
        para que el modelo entienda que son consecutivos.
      </Alert>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>8.3 Variables externas</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Esta es la mayor ventaja de LightGBM sobre los modelos estadísticos: puede incorporar cualquier
        variable externa como feature adicional:
      </Typography>
      {[
        ["Precio", "lag_precio_1, precio_vs_competencia"],
        ["Promociones", "es_promo_tv, es_descuento_20pct (binarias)"],
        ["Clima", "temperatura_media, mm_lluvia"],
        ["Feriados", "es_feriado, dias_hasta_navidad"],
        ["Stock", "stock_inicial (si hubo restricción de oferta)"],
      ].map(([cat, feats]) => (
        <Box key={cat as string} sx={{ display: "flex", gap: "0.75rem", mb: "0.75rem" }}>
          <Typography sx={{ minWidth: "7rem", fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>{cat as string}</Typography>
          <Typography sx={{ fontSize: "0.875rem", fontFamily: "monospace", color: "text.secondary" }}>{feats as string}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <PythonCodeBlock code={FE_CODE} title="create_features() — pipeline completo" />

      <Alert severity="success" sx={{ mt: "1rem", fontSize: "0.8125rem" }}>
        <strong>Regla clave — Data Leakage:</strong> Los features siempre deben ser generados con
        <code> .shift(1)</code> mínimo antes de calcular estadísticas. Si incluís el valor actual en el
        feature del mismo período, el modelo aprende del futuro y da resultados irreales en producción.
      </Alert>

      <Divider sx={{ my: "2rem" }} />

      {/* Sección 8.4 — E9: Eventos del calendario como features */}
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>8.4 ¿Cómo avisarle al modelo que va a pasar algo?</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        LightGBM puede aprender los efectos de eventos como Black Friday, un cierre de planta o
        una promoción interna — pero <strong>sólo si sabe que ocurrieron</strong>. Sin esa información,
        ve los picos y caídas como ruido o como parte de la estacionalidad genérica.
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem" }}>
        <strong>El concepto:</strong> cada evento se convierte en una columna binaria
        (<code>is_black_friday</code>, <code>is_cierre_enero</code>). En entrenamiento, el modelo
        aprende el coeficiente real de ese evento a partir de los datos históricos.
        En el forecast, si marcaste Black Friday en el calendario, el modelo aplica
        ese coeficiente automáticamente. <strong>Vos no estimás el porcentaje — el modelo lo aprende solo.</strong>
      </Alert>

      {/* Tabla: casos de uso */}
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Situación", "Feature correcto", "Qué aprende LightGBM"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Black Friday (varía de fecha cada año)",     "is_black_friday = 1",       "ventas × 3.2 ese día"],
              ["Feriado nacional",                          "is_feriado = 1",            "ventas × 0.05 (casi cero)"],
              ["Cierre de planta (todo enero)",             "is_cierre_enero = 1",       "ventas = 0 durante todo el mes"],
              ["Hot Sale (3 días en mayo)",                "is_hot_sale = 1",           "ventas × 2.1 esos días"],
              ["Promoción nueva (sin historia)",            "is_promo_nueva = 1 + impacto_pct manual", "sin historia: usá el ajuste multiplicativo"],
            ].map(([sit, feat, aprende], i) => (
              <tr key={sit as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>{sit as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace", color: "#3b82f6", fontSize: "0.8125rem" }}>{feat as string}</td>
                <td style={{ padding: "0.4rem 1rem", color: "#374151", fontSize: "0.8125rem" }}>{aprende as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      {/* Comparación: HW/SARIMA vs LightGBM */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: "0.5rem", color: "text.secondary" }}>
        ¿Qué pasa con Holt-Winters y SARIMA?
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8, fontSize: "0.9rem" }}>
        Los modelos estadísticos <strong>no tienen features externas</strong>. Para ellos, el campo
        <code> impacto_pct</code> del calendario funciona como un multiplicador post-proceso:
        el modelo predice 100 unidades y el sistema aplica ×1.20 si pusiste +20%. Es una estimación
        manual — útil cuando no hay suficiente historia del evento para que LightGBM aprenda.
        Con 2+ años de datos y el mismo evento cada año, LightGBM siempre va a estimar mejor que
        cualquier porcentaje manual.
      </Typography>

      {/* Cuidado: eventos sin historia */}
      <Alert severity="warning" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Evento nuevo sin historia:</strong> Si es la primera vez que hacés una promoción,
        LightGBM nunca la vio en el pasado. El coeficiente que aprende será prácticamente cero o
        ruidoso. En ese caso, usá el <code>impacto_pct</code> manual como piso, y dejalo aprender
        en los años siguientes.
      </Alert>

      {/* Cuidado: ceros vs ausencias */}
      <Alert severity="warning" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Cero de ventas vs ausencia de datos:</strong> Si cerraste en enero y en tus datos
        hay ceros, el modelo aprende bien con <code>is_cierre_enero = 1</code>. Pero si enero
        directamente no aparece en el CSV (gap), el pipeline va a imputar con el valor anterior.
        Siempre mejor tener el período con valor 0 y el feature de cierre marcado.
      </Alert>

      <PythonCodeBlock code={EVENTS_CODE} title="events_to_features() — columnas binarias desde el calendario" />

      <Alert severity="success" sx={{ mt: "1rem", fontSize: "0.8125rem" }}>
        <strong>En ForecastIQ:</strong> el Calendario de Eventos hace esto automáticamente.
        Black Friday, Cyber Monday, Hot Sale y los feriados AR se cargan solos.
        Cuando correás LightGBM, estas columnas ya están en el dataset de training
        sin que tengas que hacer nada. Los eventos manuales que agregues también se incluyen.
      </Alert>

      <Divider sx={{ my: "2rem" }} />

      {/* Sección 8-6 — Regresión Lineal + Splines */}
      <SectionAnchor id="8-6" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>8.6 Regresión Lineal + Splines cúbicos</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        La Regresión Lineal es el modelo más interpretable de todos: un coeficiente por variable,
        fácil de explicar al negocio. Pero una tendencia real rara vez es perfectamente lineal
        — puede acelerar, desacelerarse, o cambiar de dirección. Los <strong>Splines cúbicos
        naturales</strong> resuelven esto sin perder interpretabilidad.
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Qué es un Spline?</strong> Un spline es una función a tramos: divide el eje
        temporal en segmentos y ajusta un polinomio cúbico en cada uno, con la restricción de
        que los segmentos &quot;se unen suavemente&quot; en los puntos de corte (<em>knots</em>).
        El resultado es una curva continua y derivable que puede capturar tendencias no lineales
        sin sobreajustar.
      </Alert>

      {/* Comparison table */}
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Modelo", "Tendencia", "Estacional", "Variables externas", "Interpretabilidad"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Regresión Lineal",     "Lineal only",    "Codificada (meses)", "Sí", "★★★★★ Máxima"],
              ["Lineal + Splines",     "Curvas suaves",  "Codificada (meses)", "Sí", "★★★★☆ Alta"],
              ["Holt-Winters",         "Sí (beta)",      "Sí (gamma)",        "No", "★★★☆☆ Media"],
              ["LightGBM",             "Implícita",      "Implícita (lags)",   "Sí", "★★☆☆☆ Baja"],
            ].map(([mod, trend, seas, ext, interp], i) => (
              <tr key={mod as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: 600 }}>{mod as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>{trend as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>{seas as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>{ext as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontSize: "0.8125rem" }}>{interp as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <PythonCodeBlock code={SPLINES_CODE} title="Regresión Lineal + Splines con scikit-learn" />

      <Alert severity="success" sx={{ mt: "1rem", mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Cuándo usar Splines sobre LightGBM?</strong> Cuando necesitás <em>explicar</em>
        el modelo al management: &quot;las ventas suben 200 unidades por mes en promedio, con
        aceleración en el trimestre 3&quot;. LightGBM es una caja negra; los Splines son una
        ecuación que se puede mostrar en una reunión de S&OP.
      </Alert>

      <Alert severity="warning" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Limitación clave:</strong> Lineal + Splines modela tendencia pero no captura
        estacionalidad compleja automáticamente. ForecastIQ incorpora dummies de mes para
        capturar el ciclo estacional anual. Si la estacionalidad es semanal o más compleja,
        Holt-Winters o LightGBM son mejores opciones.
      </Alert>

      <TryInForecastButton modelId="linear_splines" label="Probar Regresión Lineal + Splines en Forecast" />
    </Box>
  )
}
