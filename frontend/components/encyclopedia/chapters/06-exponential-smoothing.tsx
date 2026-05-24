"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { FormulaBlock } from "../FormulaBlock"
import { PythonCodeBlock } from "../PythonCodeBlock"
import { WhenToUseCard } from "../WhenToUseCard"

const SES_CODE = `from statsmodels.tsa.holtwinters import SimpleExpSmoothing, ExponentialSmoothing

# SES — Solo nivel (sin tendencia ni estacionalidad)
model_ses = SimpleExpSmoothing(train, initialization_method='estimated')
fit_ses   = model_ses.fit(optimized=True)  # statsmodels optimiza alpha
forecast  = fit_ses.forecast(steps=horizon)`

const HW_CODE = `from statsmodels.tsa.holtwinters import ExponentialSmoothing

# Holt-Winters Triple Exponencial
model = ExponentialSmoothing(
    train,
    trend='add',        # tendencia aditiva
    seasonal='add',     # estacionalidad aditiva ('mul' para multiplicativa)
    seasonal_periods=12 # 12 para mensual, 52 para semanal
)
fit = model.fit(optimized=True)  # optimiza alpha, beta, gamma con MLE

# Parámetros aprendidos
print(f'alpha (nivel):          {fit.params["smoothing_level"]:.3f}')
print(f'beta  (tendencia):      {fit.params["smoothing_trend"]:.3f}')
print(f'gamma (estacionalidad): {fit.params["smoothing_seasonal"]:.3f}')

forecast = fit.forecast(steps=horizon)`

export function Chapter06() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>〰️ Suavizamiento Exponencial</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        SES, Holt y Holt-Winters triple: la familia de modelos estadísticos más usada en industria
      </Typography>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.1 La idea central: pesos decrecientes</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El Moving Average asigna el <strong>mismo peso</strong> a todos los períodos históricos. Eso es
        subóptimo: lo que pasó hace 2 meses debería importar más que lo que pasó hace 2 años.
        El suavizamiento exponencial resuelve esto asignando pesos que <em>decrecen exponencialmente</em>
        hacia el pasado.
      </Typography>

      <FormulaBlock
        label="Suavizamiento Exponencial Simple (SES)"
        formula="\hat{y}_{t+1} = \alpha \cdot y_t + (1-\alpha) \cdot \hat{y}_t"
        description="α ∈ (0,1) controla la memoria: α alto → reactivo (más peso al presente). α bajo → suave (memoria larga)."
      />

      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El parámetro α se <strong>optimiza automáticamente</strong> minimizando el error cuadrático (MLE).
        No es necesario elegirlo a mano, aunque entender qué hace es clave para interpretar el modelo.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.2 Holt — SES + Tendencia (doble)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        SES no puede proyectar tendencia: su pronóstico futuro es plano. Holt agrega una
        <strong> ecuación de tendencia</strong> que sí puede extrapolarse.
      </Typography>

      <FormulaBlock
        label="Holt — Nivel"
        formula="\ell_t = \alpha \cdot y_t + (1-\alpha)(\ell_{t-1} + b_{t-1})"
        description="ℓ_t = nivel en t. El nivel se actualiza combinando la observación actual con la proyección anterior."
      />
      <FormulaBlock
        label="Holt — Tendencia"
        formula="b_t = \beta (\ell_t - \ell_{t-1}) + (1-\beta) b_{t-1}"
        description="b_t = tendencia en t. β controla la suavidad de la tendencia."
      />
      <FormulaBlock
        label="Holt — Pronóstico h pasos"
        formula="\hat{y}_{t+h} = \ell_t + h \cdot b_t"
        description="La tendencia se extrapola linealmente. Para horizontes largos, usar damped trend (tendencia amortiguada)."
      />

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.3 Holt-Winters Triple — el modelo principal</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Agrega una tercera ecuación para capturar la <strong>estacionalidad</strong>. Es el workhorse del
        forecasting estadístico para series con tendencia y estacionalidad clara.
      </Typography>

      <FormulaBlock
        label="Holt-Winters — Nivel (aditivo)"
        formula="\ell_t = \alpha (y_t - s_{t-m}) + (1-\alpha)(\ell_{t-1} + b_{t-1})"
        description="m = número de períodos en un ciclo (12 mensual, 52 semanal). Se elimina la componente estacional antes de actualizar el nivel."
      />
      <FormulaBlock
        label="Holt-Winters — Estacionalidad"
        formula="s_t = \gamma (y_t - \ell_{t-1} - b_{t-1}) + (1-\gamma) s_{t-m}"
        description="γ controla la suavidad de la estacionalidad. El factor estacional se actualiza período a período."
      />
      <FormulaBlock
        label="Holt-Winters — Pronóstico"
        formula="\hat{y}_{t+h} = \ell_t + h \cdot b_t + s_{t+h-m}"
        description="La estacionalidad del ciclo anterior se reutiliza para el futuro."
      />

      <Alert severity="info" sx={{ my: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Aditivo o multiplicativo?</strong> Si la amplitud de la estacionalidad crece proporcionalmente
        al nivel (ej: picos de verano son siempre el doble del promedio), usar <code>seasonal=&apos;mul&apos;</code>.
        Si los picos tienen amplitud constante independientemente del nivel, usar <code>&apos;add&apos;</code>.
      </Alert>

      <PythonCodeBlock code={SES_CODE} title="SES con statsmodels" />
      <PythonCodeBlock code={HW_CODE} title="Holt-Winters Triple con statsmodels" />

      <Divider sx={{ my: "1.5rem" }} />

      <WhenToUseCard
        model="Holt-Winters Triple"
        minObservations={52}
        requirements={[
          { condition: "Observaciones", value: "≥ 52 (1 año de datos)" },
          { condition: "Estacionalidad", value: "Detectada (FFT dominante)" },
          { condition: "CV", value: "< 1.0 (demanda no caótica)" },
          { condition: "Quality Score", value: "≥ 30 pts" },
        ]}
        proscons={{
          pros: [
            "Captura nivel + tendencia + estacionalidad",
            "Parámetros optimizados automáticamente (MLE)",
            "Intervalos de confianza nativos",
            "Muy eficiente computacionalmente",
          ],
          cons: [
            "No usa variables externas (promociones, precios)",
            "Asume estacionalidad estable",
            "Puede divergir con tendencias fuertes (usar damped)",
            "Necesita al menos 1 ciclo estacional completo",
          ],
        }}
      />
    </Box>
  )
}
