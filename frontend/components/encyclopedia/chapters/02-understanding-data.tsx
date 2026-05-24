"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"

export function Chapter02() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>🔍 Entender los datos</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        EDA, calidad y completitud antes de cualquier modelo
      </Typography>

      <Alert severity="warning" sx={{ mb: "1.5rem" }}>
        <strong>Regla de oro:</strong> Nunca entrenes un modelo sin haber auditado tus datos primero.
        El 70% del tiempo de un Data Scientist es exploración y limpieza — no modelado.
      </Alert>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>2.1 Auditoría de calidad</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Antes de elegir un modelo, necesitás responder cuatro preguntas sobre tus datos:
      </Typography>
      {[
        ["Completitud", "¿Cuántos valores nulos hay? ¿En qué columnas?"],
        ["Historia", "¿Cuántos años de datos tenés? ¿Son suficientes para detectar estacionalidad?"],
        ["Regularidad", "¿Hay gaps temporales? ¿La frecuencia es consistente (no mezcla mensual/semanal)?"],
        ["Outliers", "¿Hay valores extremos que pueden engañar al modelo?"],
      ].map(([k, v]) => (
        <Box key={k as string} sx={{ display: "flex", gap: "0.75rem", mb: "0.875rem" }}>
          <Typography sx={{ minWidth: "6.5rem", fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>{k as string}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.7 }}>{v as string}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>2.2 History mínima por modelo</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Modelo", "Mínimo observaciones", "Por qué"].map(h => (
                <th key={h} style={{ padding: "0.625rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Moving Average", "< 52 obs", "Solo necesita promediar períodos recientes"],
              ["Holt-Winters", "≥ 52 obs (1 año)", "Necesita al menos un ciclo estacional completo"],
              ["SARIMA", "≥ 104 obs (2 años)", "Estimación de parámetros estacionales requiere historia"],
              ["LightGBM", "≥ 104 obs + CV > 1.0", "Feature engineering necesita suficientes filas para aprender"],
            ].map(([model, min, why], i) => (
              <tr key={model as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.5rem 1rem", fontWeight: 600 }}>{model as string}</td>
                <td style={{ padding: "0.5rem 1rem", fontFamily: "monospace", color: "#3b82f6" }}>{min as string}</td>
                <td style={{ padding: "0.5rem 1rem", color: "#6b7280" }}>{why as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>2.3 El Quality Score de ForecastIQ</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        ForecastIQ calcula automáticamente un <strong>Quality Score de 0 a 100</strong> que combina los cuatro
        criterios de calidad en un semáforo visual. El score determina qué modelos podés usar:
      </Typography>
      {[
        ["🔴 < 30", "Solo Moving Average. Limpiá los datos primero."],
        ["🟡 30–60", "MA + Holt-Winters simple. Podés mejorar limpiando outliers."],
        ["🟢 60–80", "MA + HW + SARIMA. Buenos datos, considerá más historia."],
        ["✅ > 80", "Todos los modelos disponibles, incluyendo LightGBM."],
      ].map(([score, msg]) => (
        <Box key={score as string} sx={{ display: "flex", gap: "0.75rem", mb: "0.5rem", alignItems: "center" }}>
          <Typography sx={{ minWidth: "5rem", fontWeight: 700, fontSize: "0.875rem" }}>{score as string}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.875rem" }}>{msg as string}</Typography>
        </Box>
      ))}
    </Box>
  )
}
