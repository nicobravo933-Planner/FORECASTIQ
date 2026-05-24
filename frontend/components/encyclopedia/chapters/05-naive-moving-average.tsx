"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { FormulaBlock } from "../FormulaBlock"
import { PythonCodeBlock } from "../PythonCodeBlock"
import { WhenToUseCard } from "../WhenToUseCard"

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

const NAIVE_CODE = `def seasonal_naive(d, season_length=12, extra_periods=1):
    """
    Seasonal Naive: repite el valor del mismo período del año anterior.
    Siempre es el baseline obligatorio contra el que comparar cualquier modelo.
    """
    cols = len(d)
    d    = np.append(d, [np.nan] * extra_periods)
    f    = np.full(cols + extra_periods, np.nan)

    for t in range(season_length, cols + extra_periods):
        f[t] = d[t - season_length]   # copio el valor de hace 1 ciclo

    return pd.DataFrame({'Demand': d, 'Forecast': f, 'Error': d - f})`

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

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.2 Moving Average (Promedio Móvil)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Promedia los últimos <strong>n períodos</strong> para generar el próximo pronóstico. El parámetro n
        controla el equilibrio entre <em>reactividad</em> (n pequeño) y <em>suavidad</em> (n grande).
      </Typography>

      <FormulaBlock
        label="Moving Average"
        formula="\hat{y}_{t+1} = \frac{1}{n} \sum_{i=0}^{n-1} y_{t-i}"
        description="Promedio de los últimos n valores observados. El pronóstico futuro es plano (no proyecta tendencia)."
      />

      <PythonCodeBlock code={MA_CODE} title="moving_average() — con pronóstico futuro" />

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>5.3 Cuándo elegir n</Typography>
      <Box sx={{ overflowX: "auto" }}>
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

      <Divider sx={{ my: "1.5rem" }} />

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
    </Box>
  )
}
