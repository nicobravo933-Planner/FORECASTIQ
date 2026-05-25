"use client"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import Typography from "@mui/material/Typography"
import { FormulaBlock } from "../FormulaBlock"
import { PythonCodeBlock } from "../PythonCodeBlock"
import { WhenToUseCard } from "../WhenToUseCard"
import { TryInForecastButton } from "../TryInForecastButton"

function SectionAnchor({ id }: { id: string }) {
  return <Box component="span" data-section-id={id} sx={{ display: "block", mt: "-1rem", pt: "1rem" }} />
}

const NAIVE_CODE = `def seasonal_naive(d, season_length=12, extra_periods=1):
    """
    Seasonal Naive: repite el valor del mismo período del año anterior.
    Siempre es el baseline obligatorio contra el que comparar cualquier modelo.
    """
    import numpy as np
    import pandas as pd
    cols = len(d)
    d    = np.append(d, [np.nan] * extra_periods)
    f    = np.full(cols + extra_periods, np.nan)

    for t in range(season_length, cols + extra_periods):
        f[t] = d[t - season_length]   # copio el valor de hace 1 ciclo

    return pd.DataFrame({'Demand': d, 'Forecast': f, 'Error': d - f})`

const MA_CODE = `import numpy as np
import pandas as pd

def moving_average(d, extra_periods=1, n=3):
    """
    Promedio Móvil simple.
    d             : array de demanda histórica
    extra_periods : períodos futuros a pronosticar
    n             : ventana (memoria) del promedio
    """
    cols = len(d)
    d    = np.append(d, [np.nan] * extra_periods)
    f    = np.full(cols + extra_periods, np.nan)

    # Cálculo dentro de la historia
    for t in range(n, cols):
        f[t] = np.mean(d[t - n : t])

    # Pronóstico futuro plano (promedio de los últimos n valores)
    f[cols:] = np.mean(d[cols - n : cols])

    return pd.DataFrame({'Demand': d, 'Forecast': f, 'Error': d - f})


# Ejemplo de uso
d  = [28, 19, 18, 13, 19, 16, 19, 18, 13, 16, 16, 11, 18, 15, 13]
df = moving_average(d, extra_periods=4, n=3)
print(df.tail(6))`

const WMA_CODE = `def weighted_moving_average(d, extra_periods=1, weights=None):
    """
    Promedio Móvil Ponderado.
    Asigna mayor peso a los períodos más recientes.
    weights: lista de pesos (el último se aplica al período más reciente)
    """
    import numpy as np
    import pandas as pd

    if weights is None:
        weights = [1, 2, 3]   # más peso al presente

    n    = len(weights)
    w    = np.array(weights) / sum(weights)   # normalizar a 1
    cols = len(d)
    d    = np.append(d, [np.nan] * extra_periods)
    f    = np.full(cols + extra_periods, np.nan)

    for t in range(n, cols):
        f[t] = np.dot(w, d[t - n : t])

    # Pronóstico futuro: aplicar pesos a los últimos n observados
    f[cols:] = np.dot(w, d[cols - n : cols])

    return pd.DataFrame({'Demand': d, 'Forecast': f, 'Error': d - f})

# Pesos de ejemplo: [1, 2, 3] → t-2 pesa 1/6, t-1 pesa 2/6, t pesa 3/6
df = weighted_moving_average(d, extra_periods=3, weights=[1, 2, 3])`

export function Chapter05() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>📏 Modelo ingenuo y Moving Average</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        El baseline que todo modelo sofisticado debe superar
      </Typography>

      <Alert severity="warning" sx={{ mb: "1.5rem" }}>
        <strong>Regla de Vandeputt:</strong> Nunca presentes un solo modelo. Siempre comparalo contra el
        Seasonal Naive. Si tu modelo no gana al naive, usá el naive — es más barato y más honesto.
      </Alert>

      {/* 5-1 */}
      <SectionAnchor id="5-1" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.1 Seasonal Naive — el baseline obligatorio</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El pronóstico más simple posible: el valor de la semana (o mes) equivalente del <strong>año anterior</strong>.
        Si vendiste 200 unidades en enero del año pasado, el naive pronostica 200 para enero de este año.
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Parece trivial, pero captura la estacionalidad perfectamente sin ningún parámetro. Por eso es tan difícil
        de superar: cualquier modelo sofisticado tiene que aprender lo mismo que el naive, más algo extra.
      </Typography>

      <FormulaBlock
        label="Seasonal Naive"
        formula="\hat{y}_{t} = y_{t - s}"
        description="ŷ_t = pronóstico para el período t. s = longitud de la estación (12 para mensual anual, 52 para semanal anual)."
      />

      <PythonCodeBlock code={NAIVE_CODE} title="seasonal_naive() — baseline obligatorio" />

      <Divider sx={{ my: "1.75rem" }} />

      {/* 5-2 */}
      <SectionAnchor id="5-2" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.2 Moving Average (Promedio Móvil)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Promedia los últimos <strong>n períodos</strong> para generar el próximo pronóstico. El parámetro n
        controla el equilibrio entre <em>reactividad</em> (n pequeño) y <em>suavidad</em> (n grande).
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        A diferencia del Seasonal Naive, el Moving Average <strong>no captura estacionalidad</strong>. Su
        pronóstico futuro siempre es plano — el promedio de los últimos n valores. Esto lo hace inadecuado para
        series con estacionalidad clara, pero robusto para series cortas o muy ruidosas donde cualquier modelo más
        complejo sobreajusta.
      </Typography>

      <FormulaBlock
        label="Moving Average"
        formula="\hat{y}_{t+1} = \frac{1}{n} \sum_{i=0}^{n-1} y_{t-i}"
        description="Promedio de los últimos n valores observados. El pronóstico futuro es plano (no proyecta tendencia)."
      />

      <PythonCodeBlock code={MA_CODE} title="moving_average() — con pronóstico futuro" />

      <Divider sx={{ my: "1.75rem" }} />

      {/* 5-3 */}
      <SectionAnchor id="5-3" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.3 Elegir el parámetro n</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        La elección de n es el único hyperparámetro del MA. No existe un valor universal — depende del
        comportamiento de la serie. La regla práctica: minimizar el WAPE en un período de test hold-out.
      </Typography>
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["n", "Comportamiento", "Úsalo cuando"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["1", "Naive puro — copia el último valor", "Demanda muy reactiva, sin patrón"],
              ["3", "Muy reactivo", "Demanda cambia rápido, poca estacionalidad"],
              ["6", "Balance reactivo/estable", "Demanda semanal con algo de estabilidad"],
              ["12", "Suave, lento para reaccionar", "Demanda mensual muy estable"],
            ].map(([n, beh, use], i) => (
              <tr key={n as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: 700, fontFamily: "monospace" }}>{n as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{beh as string}</td>
                <td style={{ padding: "0.4rem 1rem", color: "#6b7280" }}>{use as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 5-4 */}
      <SectionAnchor id="5-4" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.4 Weighted Moving Average</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El MA simple asigna el <strong>mismo peso</strong> a todos los n períodos. Una variante natural es el
        <strong> Weighted Moving Average (WMA)</strong>, que asigna pesos crecientes hacia el presente. Esto captura
        mejor los cambios recientes de nivel sin abandonar la suavidad del MA.
      </Typography>

      <FormulaBlock
        label="Weighted Moving Average (WMA)"
        formula="\hat{y}_{t+1} = \sum_{i=0}^{n-1} w_i \cdot y_{t-i} \quad \text{con} \quad \sum w_i = 1"
        description="w_i son los pesos normalizados. Ejemplo: [1, 2, 3] → t-2 tiene 1/6, t-1 tiene 2/6, t tiene 3/6 del peso total."
      />

      <PythonCodeBlock code={WMA_CODE} title="weighted_moving_average() — con pesos personalizables" />

      <Alert severity="info" sx={{ mt: "1rem", mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿WMA vs SES?</strong> El WMA con pesos [1, 2, 3, ...] es una aproximación manual de lo que el
        Suavizamiento Exponencial Simple (SES) hace automáticamente con el parámetro α. En la práctica, el SES
        es superior porque optimiza los pesos de forma continua. Ver Capítulo 6.
      </Alert>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 5-5 */}
      <SectionAnchor id="5-5" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.5 Cuándo usar MA vs Naive</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Ambos modelos son simples, pero cada uno tiene su niche. La elección depende de si la serie tiene
        estructura estacional clara y de cuántos datos históricos están disponibles.
      </Typography>
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Criterio", "Seasonal Naive", "Moving Average"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Estacionalidad", "✅ La captura perfectamente", "❌ No la captura"],
              ["Historia mínima", "1 ciclo completo (ej: 12 meses)", "4-8 períodos"],
              ["Tendencia", "❌ No la proyecta", "❌ No la proyecta"],
              ["Demanda cero/irregular", "⚠️ Propaga los ceros", "✅ Los suaviza"],
              ["Series muy cortas (< 12 obs)", "❌ No suficiente historia", "✅ Funciona con 4+ obs"],
              ["Uso principal", "Baseline obligatorio para FVA", "Fallback para series cortas"],
            ].map(([c, sn, ma], i) => (
              <tr key={c as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: 600 }}>{c as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{sn as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{ma as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <WhenToUseCard
        model="Moving Average"
        minObservations={8}
        requirements={[
          { condition: "Observaciones", value: "≥ 8 períodos" },
          { condition: "Tendencia", value: "No requerida (no la captura)" },
          { condition: "Estacionalidad", value: "No requerida (no la captura)" },
          { condition: "Quality Score", value: "Cualquier score" },
        ]}
        proscons={{
          pros: [
            "Sin parámetros (solo n)",
            "Funciona con muy pocos datos",
            "Robusto a ruido con n grande",
            "Siempre disponible como fallback",
          ],
          cons: [
            "No captura tendencia",
            "No captura estacionalidad",
            "Pronóstico futuro siempre plano",
            "Pesos iguales a todos los períodos",
          ],
        }}
      />

      <TryInForecastButton modelId="moving_average" label="Probar Moving Average en Forecast" />
    </Box>
  )
}
