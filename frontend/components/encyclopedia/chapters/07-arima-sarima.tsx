"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { FormulaBlock } from "../FormulaBlock"
import { PythonCodeBlock } from "../PythonCodeBlock"
import { WhenToUseCard } from "../WhenToUseCard"

const SARIMA_CODE = `import pmdarima as pm

# auto_arima — encuentra los mejores parámetros automáticamente
model = pm.auto_arima(
    train,
    seasonal=True,
    m=12,              # longitud del ciclo estacional
    stepwise=True,     # búsqueda eficiente (no fuerza bruta)
    information_criterion='aic',
    max_p=3, max_q=3,
    max_P=2, max_Q=2,
    d=None,            # detecta d automáticamente (test ADF)
    D=None,            # detecta D automáticamente
    suppress_warnings=True,
    error_action='ignore',
)

print(model.summary())
print(f'Orden: {model.order}  Orden estacional: {model.seasonal_order}')

# Pronóstico con intervalos de confianza
forecast, conf_int = model.predict(n_periods=horizon, return_conf_int=True)`

export function Chapter07() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>🌊 ARIMA y SARIMA</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Diferenciación, autocorrelación y parámetros p, d, q
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem" }}>
        <strong>SARIMA vs Holt-Winters:</strong> Ambos capturan tendencia y estacionalidad. SARIMA es más
        riguroso estadísticamente y da mejores intervalos de confianza. Holt-Winters es más rápido y más
        fácil de interpretar. Con suficientes datos (≥ 104 obs), SARIMA suele ganar.
      </Alert>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>7.1 ¿Qué es una serie estacionaria?</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        ARIMA requiere que la serie sea <strong>estacionaria</strong>: media y varianza constantes en el tiempo,
        sin tendencia. La diferenciación (<em>d</em>) transforma la serie para lograr esto. Una diferencia
        de primer orden convierte niveles en cambios: Δyₜ = yₜ − yₜ₋₁.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>7.2 Los parámetros ARIMA(p, d, q)</Typography>
      {[
        ["p — AR (autoregresivo)", "Cuántos valores pasados de la serie se usan directamente como predictores.", "AR(1): ŷ_t = φ₁·y_{t-1} + ε"],
        ["d — Differencing", "Cuántas veces hay que diferenciar para obtener estacionariedad.", "d=1: usa cambios. d=2: usa cambios de cambios."],
        ["q — MA (media móvil)", "Cuántos errores de pronóstico pasados se usan como predictores.", "MA(1): ŷ_t = θ₁·ε_{t-1} + ε"],
      ].map(([param, def, ex]) => (
        <Box key={param as string} sx={{ mb: "1rem", p: "0.875rem 1rem", bgcolor: "action.hover", borderRadius: "0.5rem" }}>
          <Typography sx={{ fontWeight: 700, fontSize: "0.875rem", mb: "0.25rem", color: "primary.main" }}>{param as string}</Typography>
          <Typography sx={{ fontSize: "0.875rem", mb: "0.25rem" }}>{def as string}</Typography>
          <Typography sx={{ fontSize: "0.8125rem", fontFamily: "monospace", color: "text.secondary" }}>{ex as string}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>7.3 SARIMA(p,d,q)(P,D,Q)[s]</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        La versión estacional agrega un segundo set de parámetros que operan sobre los <em>lags estacionales</em>
        (cada s períodos). Ejemplo: SARIMA(1,1,1)(1,1,1)[12] para datos mensuales.
      </Typography>

      <FormulaBlock
        label="SARIMA completo"
        formula="\Phi_P(B^s)\phi_p(B)(1-B)^d(1-B^s)^D y_t = \Theta_Q(B^s)\theta_q(B)\varepsilon_t"
        description="B = operador de retardo (backshift). φ,θ = polinomios no-estacionales. Φ,Θ = polinomios estacionales."
      />

      <Alert severity="success" sx={{ my: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>En la práctica:</strong> No hace falta entender la ecuación completa. <code>auto_arima</code> de
        pmdarima encuentra los mejores parámetros automáticamente usando criterios de información (AIC/BIC).
        Lo importante es entender qué controla cada parámetro.
      </Alert>

      <PythonCodeBlock code={SARIMA_CODE} title="auto_arima con pmdarima" />

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>7.4 SARIMA vs Holt-Winters — ¿cuándo usar cada uno?</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Criterio", "Holt-Winters", "SARIMA"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Datos mínimos", "52 obs (1 año)", "104 obs (2 años)"],
              ["Velocidad", "Muy rápido", "Moderado (auto_arima)"],
              ["Intervalos de confianza", "Aproximados", "Exactos (MLE)"],
              ["Estacionariedad", "No requerida", "Se logra con diferenciación"],
              ["Interpretabilidad", "Alta (α, β, γ)", "Media (p,d,q estadístico)"],
              ["Variables externas", "No", "Sí (SARIMAX)"],
            ].map(([crit, hw, sarima], i) => (
              <tr key={crit as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: 600 }}>{crit as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{hw as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{sarima as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Divider sx={{ my: "1.5rem" }} />

      <WhenToUseCard
        model="SARIMA"
        minObservations={104}
        requirements={[
          { condition: "Observaciones", value: "≥ 104 (2 años)" },
          { condition: "Tendencia detectada", value: "Seasonal Mann-Kendall p < 0.05" },
          { condition: "Sin estacionalidad fuerte", value: "FFT no dominante (sino HW gana)" },
          { condition: "Quality Score", value: "≥ 60 pts" },
        ]}
        proscons={{
          pros: [
            "Intervalos de confianza estadísticamente válidos",
            "Puede extenderse con variables externas (SARIMAX)",
            "Fundamento teórico sólido",
            "auto_arima automatiza la selección de parámetros",
          ],
          cons: [
            "Necesita más datos que Holt-Winters",
            "Más lento de entrenar",
            "Difícil de interpretar para no estadísticos",
            "Sensible a outliers no corregidos",
          ],
        }}
      />
    </Box>
  )
}
