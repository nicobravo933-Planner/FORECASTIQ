"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"

export function Chapter01() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>
        🧭 ¿Por qué forecasteamos?
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Demanda, decisiones y cadena de suministro
      </Typography>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.1 El propósito del forecast</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Las cadenas de suministro toman miles de decisiones diarias: cuánto comprar, producir, dónde almacenar.
        Todas dependen de una pregunta central: <strong>¿cuánta demanda podemos esperar en el futuro?</strong>
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Un planificador de demanda es como un marinero con catalejo: su trabajo no es decidir, sino
        <em> proveer información accionable</em> para que otros decidan mejor. Cuanto mejor sea el forecast,
        menos inventario inútil, menos quiebres de stock, más ventas, menos costos.
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem", fontSize: "0.875rem" }}>
        <strong>Punto clave de Vandeputt:</strong> La precisión del forecast no es el objetivo — la
        <em> utilidad</em> lo es. Un forecast preciso pero realizado en la granularidad incorrecta es inútil.
      </Alert>

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.2 Los 5 pasos hacia la excelencia</Typography>
      {[
        ["🎯 Objetivo", "¿Qué necesitás pronosticar? ¿Qué decisiones respalda el forecast?"],
        ["📦 Datos", "Demanda no restringida vs ventas restringidas. Factores externos (precios, promociones)."],
        ["📐 Métricas", "¿Cómo medís la calidad del pronóstico? WAPE, MAE, BIAS, FVA."],
        ["🤖 Modelo base", "Motor automatizado que genera el pronóstico de base sin intervención humana."],
        ["👥 Revisión", "Enriquecimiento humano: solo donde el experto agrega valor real."],
      ].map(([title, desc]) => (
        <Box key={title as string} sx={{ display: "flex", gap: "0.75rem", mb: "1rem" }}>
          <Typography sx={{ minWidth: "9rem", fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>{title as string}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.7 }}>{desc as string}</Typography>
        </Box>
      ))}

      <Divider sx={{ my: "1.5rem" }} />

      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.3 Demanda vs ventas</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Uno de los errores más frecuentes: usar las <strong>ventas</strong> históricas para entrenar el modelo.
        Las ventas son <em>demanda restringida</em>: si no había stock, no hubo venta — aunque había demanda.
      </Typography>
      <Typography sx={{ lineHeight: 1.8 }}>
        El modelo aprende del pasado. Si el pasado tiene &quot;ceros por quiebre de stock&quot; en lugar de demanda
        real, el modelo aprenderá que la demanda era baja cuando en realidad era alta. El resultado: un forecast
        sistemáticamente subestimado que perpetúa el quiebre de stock.
      </Typography>
    </Box>
  )
}
