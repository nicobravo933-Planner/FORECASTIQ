"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import Chip from "@mui/material/Chip"

export function Chapter12() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>🧠 Sesgos humanos en forecasting</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Por qué los humanos sistemáticamente distorsionan los pronósticos — y cómo evitarlo
      </Typography>

      <Alert severity="error" sx={{ mb: "1.5rem" }}>
        <strong>El hallazgo más contraintuitivo de Vandeputt:</strong> En el 60-70% de los casos estudiados,
        los ajustes manuales de planificadores <em>empeoraron</em> el forecast del modelo estadístico.
        El sesgo humano es sistemático, no aleatorio.
      </Alert>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>12.1 Los 5 sesgos más comunes</Typography>

      {[
        {
          name: "Sesgo de optimismo (Sales Bias)",
          color: "#ef4444",
          desc: "El equipo de ventas siempre sube el forecast. «Este trimestre vamos a crecer 30%». El modelo lo ve como sesgo positivo sistemático.",
          impact: "Sobrestock, capital inmovilizado",
        },
        {
          name: "Anclaje al pasado",
          color: "#f59e0b",
          desc: "Ajustar el pronóstico tomando el año anterior como anchor y haciendo pequeños ajustes. Ignora cambios de tendencia.",
          impact: "Reacciona lento a cambios de mercado",
        },
        {
          name: "Aversión a la pérdida",
          color: "#8b5cf6",
          desc: "Miedo asimétrico al quiebre de stock vs al exceso de inventario. Se sobreestima para «no quedarse sin stock».",
          impact: "Inventario crónico alto, costos de holding",
        },
        {
          name: "Sesgo de disponibilidad",
          color: "#3b82f6",
          desc: "Eventos recientes (una promoción exitosa, una crisis) dominan el juicio. Se ignoran los patrones de largo plazo.",
          impact: "Pronósticos erráticos, poco confiables",
        },
        {
          name: "Influencia política",
          color: "#ec4899",
          desc: "El forecast se ajusta para alinearse con los objetivos de presupuesto, no con la demanda real.",
          impact: "El modelo pierde credibilidad, decisiones subóptimas",
        },
      ].map((bias) => (
        <Box key={bias.name} sx={{ mb: "1.25rem", p: "1rem", borderRadius: "0.5rem", border: "1px solid", borderColor: "divider", borderLeft: "0.25rem solid", borderLeftColor: bias.color }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem", mb: "0.375rem" }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.875rem" }}>{bias.name}</Typography>
            <Chip label={bias.impact} size="small" sx={{ fontSize: "0.6875rem", bgcolor: "action.hover" }} />
          </Box>
          <Typography sx={{ color: "text.secondary", fontSize: "0.8125rem", lineHeight: 1.7 }}>{bias.desc}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>12.2 Cómo combatirlos</Typography>
      {[
        ["📐 FVA obligatorio", "Medir el FVA de cada ajuste manual. Si el ajuste empeora el forecast, el planificador debe justificarlo."],
        ["📊 Datos, no intuición", "El modelo tiene razón hasta que haya evidencia concreta de que está equivocado."],
        ["🔒 Congelar el baseline", "No mostrar el forecast del modelo ANTES de que el planificador haga su estimación inicial."],
        ["📋 Audit trail", "Registrar cada ajuste, quién lo hizo y por qué. La responsabilidad reduce los sesgos políticos."],
        ["🎯 Foco en AX", "El planificador solo revisa los productos de alta criticidad y alta predictibilidad donde puede agregar valor real."],
      ].map(([title, desc]) => (
        <Box key={title as string} sx={{ display: "flex", gap: "0.75rem", mb: "1rem" }}>
          <Typography sx={{ minWidth: "10rem", fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>{title as string}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.7 }}>{desc as string}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Alert severity="success" sx={{ fontSize: "0.875rem" }}>
        <strong>La conclusión de Vandeputt:</strong> El mejor proceso de planificación es aquel donde el
        equipo humano interviene lo menos posible — pero interviene en los momentos correctos y con
        información que el modelo no tiene. La tecnología no reemplaza el juicio humano,
        pero sí debería <em>demostrar</em> cuándo ese juicio agrega valor y cuándo lo destruye.
      </Alert>
    </Box>
  )
}
