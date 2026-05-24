"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import { FormulaBlock } from "../FormulaBlock"

export function Chapter11() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>💡 FVA — Valor Añadido del Pronóstico</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        ¿Tu modelo sofisticado realmente supera al naive? La prueba de fuego.
      </Typography>

      <Alert severity="warning" sx={{ mb: "1.5rem" }}>
        <strong>Dato incómodo:</strong> En muchos proyectos reales, el LightGBM no supera al Seasonal Naive.
        Si el FVA es negativo, el modelo sofisticado está agregando complejidad sin valor. Mejor usar el naive.
      </Alert>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>11.1 ¿Qué mide el FVA?</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        El <strong>Forecast Value Added</strong> mide cuánto mejora (o empeora) un modelo respecto al baseline
        Seasonal Naive. Es la respuesta a: &quot;¿valió la pena construir este modelo más complejo?&quot;
      </Typography>

      <FormulaBlock
        label="FVA (Forecast Value Added)"
        formula="\text{FVA} = \frac{\text{WAPE}_{naive} - \text{WAPE}_{model}}{\text{WAPE}_{naive}} \times 100"
        description="FVA > 0: el modelo es mejor que el naive. FVA = 0: igual de bueno. FVA < 0: el naive gana — usalo directamente."
      />

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>11.2 Ejemplo práctico</Typography>
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Modelo", "WAPE", "FVA vs Naive", "¿Vale la pena?"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Seasonal Naive",  "22.5%", "baseline", "–"],
              ["Moving Average",  "24.1%", "-7%",      "❌ Peor que el naive"],
              ["Holt-Winters",    "17.3%", "+23%",     "✅ Vale la pena"],
              ["SARIMA",          "15.8%", "+30%",     "✅ Recomendado"],
              ["LightGBM",        "13.2%", "+41%",     "✅✅ Mejor opción"],
            ].map(([m, w, fva, val], i) => (
              <tr key={m as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: i === 0 ? 600 : 400 }}>{m as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace" }}>{w as string}</td>
                <td style={{ padding: "0.4rem 1rem", fontFamily: "monospace", color: (fva as string).startsWith("+") ? "#22c55e" : (fva as string).startsWith("-") ? "#ef4444" : "#6b7280" }}>{fva as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{val as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>11.3 FVA del proceso humano</Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        El FVA también se aplica al proceso de revisión humana: cuando un planificador ajusta manualmente
        el forecast del modelo, ¿lo mejora o lo empeora? Si el WAPE del forecast ajustado es mayor que el
        del modelo base, el planificador está <em>destruyendo valor</em>.
      </Typography>
      <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>
        <strong>Aplicación en S&OP:</strong> Calculá el FVA de cada planificador que revisa el forecast.
        Quienes tienen FVA negativo (empeoran el forecast) necesitan capacitación o deben revisar menos
        productos. Los que tienen FVA alto están agregando valor real con su expertise.
      </Alert>
    </Box>
  )
}
