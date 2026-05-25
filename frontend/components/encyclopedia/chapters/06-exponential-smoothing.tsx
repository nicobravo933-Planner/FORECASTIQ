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

const SES_CODE = `from statsmodels.tsa.holtwinters import SimpleExpSmoothing

# SES — Solo nivel (sin tendencia ni estacionalidad)
model_ses = SimpleExpSmoothing(train, initialization_method='estimated')
fit_ses   = model_ses.fit(optimized=True)  # statsmodels optimiza alpha con MLE
print(f'alpha optimizado: {fit_ses.params["smoothing_level"]:.3f}')
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

const DAMPED_CODE = `from statsmodels.tsa.holtwinters import ExponentialSmoothing

# Holt-Winters con Damped Trend — previene divergencia en horizontes largos
model = ExponentialSmoothing(
    train,
    trend='add',
    damped_trend=True,  # amortiguamiento de la tendencia
    seasonal='add',
    seasonal_periods=12
)
fit = model.fit(optimized=True)

# phi es el factor de amortiguamiento (0 < phi < 1)
# phi ~ 0.9 → tendencia casi lineal (amortiguamiento suave)
# phi ~ 0.5 → tendencia se aplana rápido
print(f'phi (damping): {fit.params["damping_trend"]:.3f}')
forecast = fit.forecast(steps=horizon)`

export function Chapter06() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>〰️ Suavizamiento Exponencial</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        SES, Holt y Holt-Winters triple: la familia de modelos estadísticos más usada en industria
      </Typography>

      {/* 6-1 */}
      <SectionAnchor id="6-1" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.1 La idea central: pesos decrecientes</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El Moving Average asigna el <strong>mismo peso</strong> a todos los períodos históricos. Eso es
        subóptimo: lo que pasó hace 2 meses debería importar más que lo que pasó hace 2 años.
        El suavizamiento exponencial resuelve esto asignando pesos que <em>decrecen exponencialmente</em>
        hacia el pasado.
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        La belleza del método es que con un solo parámetro (α) se representa una historia infinita:
        el nivel actual ya &ldquo;contiene&rdquo; implícitamente todo el pasado, ponderado exponencialmente.
        Esto lo hace computacionalmente muy eficiente para pronosticar miles de SKUs.
      </Typography>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 6-2 */}
      <SectionAnchor id="6-2" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.2 SES — Solo nivel</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El Suavizamiento Exponencial Simple (SES) modela una sola componente: el <strong>nivel</strong>.
        Es apropiado para series sin tendencia ni estacionalidad clara. Su pronóstico futuro es plano
        (igual al nivel actual), similar al MA, pero con memoria adaptiva.
      </Typography>

      <FormulaBlock
        label="SES — Actualización del nivel"
        formula="\hat{y}_{t+1} = \alpha \cdot y_t + (1-\alpha) \cdot \hat{y}_t"
        description="α ∈ (0,1) controla la memoria: α alto → reactivo (más peso al presente). α bajo → suave (memoria larga). statsmodels optimiza α automáticamente."
      />

      <PythonCodeBlock code={SES_CODE} title="SES con statsmodels" />

      <Divider sx={{ my: "1.75rem" }} />

      {/* 6-3 */}
      <SectionAnchor id="6-3" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.3 Holt — Nivel + Tendencia (doble)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        SES no puede proyectar tendencia: su pronóstico futuro es plano. Holt agrega una
        <strong> ecuación de tendencia</strong> que sí puede extrapolarse en el tiempo.
        También se llama &ldquo;suavizamiento exponencial doble&rdquo; (dos componentes).
      </Typography>

      <FormulaBlock
        label="Holt — Nivel"
        formula="\ell_t = \alpha \cdot y_t + (1-\alpha)(\ell_{t-1} + b_{t-1})"
        description="ℓ_t = nivel en t. Combina la observación actual con la proyección anterior (nivel + tendencia)."
      />
      <FormulaBlock
        label="Holt — Tendencia"
        formula="b_t = \beta (\ell_t - \ell_{t-1}) + (1-\beta) b_{t-1}"
        description="b_t = tendencia en t. β controla la suavidad de la tendencia. β alto → la tendencia reacciona rápido a cambios."
      />
      <FormulaBlock
        label="Holt — Pronóstico h pasos"
        formula="\hat{y}_{t+h} = \ell_t + h \cdot b_t"
        description="La tendencia se extrapola linealmente h períodos. Para horizontes largos esto puede divergir — ver Damped Trend."
      />

      <Divider sx={{ my: "1.75rem" }} />

      {/* 6-4 */}
      <SectionAnchor id="6-4" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.4 Holt-Winters Triple — el modelo principal</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Agrega una tercera ecuación para capturar la <strong>estacionalidad</strong>. Es el workhorse del
        forecasting estadístico para series con tendencia y estacionalidad clara. Tres parámetros (α, β, γ)
        se optimizan simultáneamente por Máxima Verosimilitud (MLE).
      </Typography>

      <FormulaBlock
        label="Holt-Winters — Nivel (aditivo)"
        formula="\ell_t = \alpha (y_t - s_{t-m}) + (1-\alpha)(\ell_{t-1} + b_{t-1})"
        description="m = períodos en un ciclo (12 mensual, 52 semanal). Se elimina la componente estacional antes de actualizar el nivel."
      />
      <FormulaBlock
        label="Holt-Winters — Estacionalidad"
        formula="s_t = \gamma (y_t - \ell_{t-1} - b_{t-1}) + (1-\gamma) s_{t-m}"
        description="γ controla la velocidad de actualización de la estacionalidad. El factor del ciclo anterior se actualiza con cada nueva observación."
      />
      <FormulaBlock
        label="Holt-Winters — Pronóstico"
        formula="\hat{y}_{t+h} = \ell_t + h \cdot b_t + s_{t+h-m}"
        description="La estacionalidad del ciclo anterior se reutiliza. Para h > m, se reutiliza el factor del último ciclo conocido."
      />

      <PythonCodeBlock code={HW_CODE} title="Holt-Winters Triple con statsmodels" />

      <Divider sx={{ my: "1.75rem" }} />

      {/* 6-5 */}
      <SectionAnchor id="6-5" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.5 Aditivo vs Multiplicativo</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Holt-Winters viene en dos sabores según cómo se comporta la estacionalidad:
      </Typography>
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Variante", "Cuándo usarla", "Fórmula pronóstico", "Ejemplo"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Aditiva", "Amplitud de picos constante", "ℓ + h·b + s", "Ventas de helado: +200 en verano siempre"],
              ["Multiplicativa", "Amplitud crece con el nivel", "( ℓ + h·b ) × s", "Ventas de lujo: +30% en diciembre siempre"],
            ].map(([v, w, f, e], i) => (
              <tr key={v as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: 600 }}>{v as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{w as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace", fontSize: "0.8125rem" }}>{f as string}</td>
                <td style={{ padding: "0.4rem 1rem", color: "#6b7280" }}>{e as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Alert severity="info" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Cómo elegir?</strong> Graficá la serie. Si los picos de verano siempre tienen la misma altura en
        unidades absolutas → aditivo. Si los picos crecen proporcionalmente cuando crece el nivel → multiplicativo.
        En caso de duda, probá los dos y elegí el que tenga menor AIC.
      </Alert>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 6-6 */}
      <SectionAnchor id="6-6" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>6.6 Damped Trend</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Holt y Holt-Winters con tendencia extrapolapla linealmente hacia el futuro. Para horizontes cortos
        esto está bien. Para horizontes largos (12+ meses), la tendencia puede <strong>divergir</strong>
        hacia valores irreales.
      </Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El <strong>Damped Trend</strong> agrega un factor de amortiguamiento φ (phi) que hace que la tendencia
        se aplaque gradualmente hacia cero. Con φ = 0.9 la tendencia se mantiene casi lineal a corto plazo pero
        converge a una constante en el largo plazo.
      </Typography>

      <FormulaBlock
        label="Damped Trend — Pronóstico"
        formula="\hat{y}_{t+h} = \ell_t + (\phi + \phi^2 + \cdots + \phi^h) b_t"
        description="φ ∈ (0,1) es el factor de amortiguamiento. Con φ→1 equivale a Holt normal. Con φ→0 la tendencia desaparece de inmediato."
      />

      <PythonCodeBlock code={DAMPED_CODE} title="Holt-Winters Damped Trend" />

      <Alert severity="success" sx={{ mt: "1rem", mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Recomendación práctica:</strong> Siempre probá la variante con <code>damped_trend=True</code> cuando
        el horizonte supera los 6 períodos. En benchmarks industriales, el Damped Holt-Winters suele ganar
        al HW estándar para horizontes medianos y largos.
      </Alert>

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

      <TryInForecastButton modelId="holt_winters" label="Probar Holt-Winters en Forecast" />
    </Box>
  )
}
