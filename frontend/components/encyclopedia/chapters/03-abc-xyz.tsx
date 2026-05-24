"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import Chip from "@mui/material/Chip"

export function Chapter03() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>📊 Segmentación ABC-XYZ</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Clasificar productos por volumen (ABC) y variabilidad (XYZ)
      </Typography>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>3.1 ¿Por qué segmentar?</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        No todos los productos merecen el mismo nivel de atención. El Principio de Pareto dice que el 20% de los
        SKUs genera el 80% del valor. La segmentación ABC-XYZ te permite <strong>priorizar esfuerzo</strong>:
        dedica modelos sofisticados a los productos que realmente importan.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>3.2 Clasificación ABC (volumen)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Ordena los SKUs de mayor a menor por valor acumulado (unidades × precio). Luego acumula porcentaje:
      </Typography>
      {[
        { label: "A", color: "#22c55e", pct: "Top 80% del valor", desc: "Productos críticos. Modelos complejos, revisión frecuente." },
        { label: "B", color: "#f59e0b", pct: "80–95% del valor", desc: "Productos intermedios. Modelos automáticos con revisión ocasional." },
        { label: "C", color: "#ef4444", pct: "Último 5% del valor", desc: "Cola larga. Modelos simples o Seasonal Naive. Sin revisión manual." },
      ].map(row => (
        <Box key={row.label} sx={{ display: "flex", gap: "1rem", mb: "0.875rem", alignItems: "flex-start" }}>
          <Chip label={row.label} size="small" sx={{ bgcolor: row.color, color: "#fff", fontWeight: 800, minWidth: "2rem" }} />
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: "0.875rem" }}>{row.pct}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>{row.desc}</Typography>
          </Box>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>3.3 Clasificación XYZ (variabilidad)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Mide el <strong>Coeficiente de Variación (CV = std / media)</strong> de la demanda histórica:
      </Typography>
      {[
        { label: "X", color: "#3b82f6", cv: "CV < 0.5", desc: "Demanda estable y predecible. Holt-Winters funciona muy bien." },
        { label: "Y", color: "#8b5cf6", cv: "0.5 ≤ CV < 1.0", desc: "Demanda variable con cierto patrón. SARIMA o LightGBM." },
        { label: "Z", color: "#ec4899", cv: "CV ≥ 1.0", desc: "Demanda muy errática. LightGBM + feature engineering, o modelos intermitentes." },
      ].map(row => (
        <Box key={row.label} sx={{ display: "flex", gap: "1rem", mb: "0.875rem", alignItems: "flex-start" }}>
          <Chip label={row.label} size="small" sx={{ bgcolor: row.color, color: "#fff", fontWeight: 800, minWidth: "2rem" }} />
          <Box>
            <Typography sx={{ fontWeight: 600, fontSize: "0.875rem", fontFamily: "monospace" }}>{row.cv}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>{row.desc}</Typography>
          </Box>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>3.4 Matriz combinada ABC × XYZ</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Segmento", "Modelo recomendado", "Revisión manual"].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["AX", "Holt-Winters / SARIMA", "Semanal"],
              ["AY", "LightGBM + features", "Quincenal"],
              ["AZ", "LightGBM + Optuna", "Mensual"],
              ["BX", "Holt-Winters simple", "Mensual"],
              ["BY", "SARIMA automático", "Trimestral"],
              ["BZ", "LightGBM simple", "Trimestral"],
              ["CX", "Moving Average", "Nunca (automático)"],
              ["CY", "Moving Average / SES", "Nunca (automático)"],
              ["CZ", "Seasonal Naive / Croston", "Nunca (automático)"],
            ].map(([seg, model, rev], i) => (
              <tr key={seg as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 0.875rem", fontWeight: 700 }}>{seg as string}</td>
                <td style={{ padding: "0.4rem 0.875rem", color: "#374151" }}>{model as string}</td>
                <td style={{ padding: "0.4rem 0.875rem", color: "#6b7280" }}>{rev as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Alert severity="success" sx={{ mt: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Regla práctica:</strong> Si tenés 10.000 SKUs, es imposible revisar todos. La matriz ABC-XYZ te
        dice en cuáles poner esfuerzo humano y cuáles dejar en piloto automático.
      </Alert>
    </Box>
  )
}
