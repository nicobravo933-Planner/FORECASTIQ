"use client"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Divider from "@mui/material/Divider"
import Typography from "@mui/material/Typography"

// Helper: section anchor for scroll-spy
function SectionAnchor({ id }: { id: string }) {
  return <Box component="span" data-section-id={id} sx={{ display: "block", mt: "-1rem", pt: "1rem" }} />
}

export function Chapter01() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>
        🧭 ¿Por qué forecasteamos?
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        Demanda, decisiones y cadena de suministro
      </Typography>

      {/* 1-1 */}
      <SectionAnchor id="1-1" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.1 El propósito del forecast</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Las cadenas de suministro toman miles de decisiones diarias: cuánto comprar, producir, dónde almacenar, qué
        reponer. Todas dependen de una pregunta central: <strong>¿cuánta demanda podemos esperar en el futuro?</strong>
      </Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Un planificador de demanda es como un marinero con catalejo: su trabajo no es decidir, sino
        <em> proveer información accionable</em> para que otros decidan mejor. Cuanto mejor sea el forecast,
        menos inventario inútil, menos quiebres de stock, más ventas, menos costos.
      </Typography>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        El forecast no elimina la incertidumbre — la <strong>cuantifica</strong>. Un buen pronóstico siempre
        incluye un intervalo de confianza, no solo un número puntual. La diferencia entre &quot;venderemos 1.000
        unidades&quot; y &quot;venderemos entre 800 y 1.200 con 90% de confianza&quot; es toda la diferencia para
        dimensionar el stock de seguridad.
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem", fontSize: "0.875rem" }}>
        <strong>Punto clave de Vandeputt:</strong> La precisión del forecast no es el objetivo — la
        <em> utilidad</em> lo es. Un forecast preciso pero realizado en la granularidad incorrecta es inútil.
      </Alert>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 1-2 */}
      <SectionAnchor id="1-2" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.2 Los 5 pasos hacia la excelencia</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Vandeputt describe un framework de cinco pasos que separa a las organizaciones que hacen forecasting bien
        de las que simplemente generan números. Estos cinco pasos son el hilo conductor de toda la Enciclopedia:
      </Typography>
      {[
        ["🎯 1. Objetivo", "¿Qué necesitás pronosticar? ¿Qué decisiones respalda el forecast? Sin un objetivo claro, cualquier número sirve — y ninguno sirve bien."],
        ["📦 2. Datos", "Demanda no restringida vs ventas restringidas. Factores externos (precios, promociones). Sin datos buenos, los modelos sofisticados empeoran el resultado."],
        ["📐 3. Métricas", "¿Cómo medís la calidad del pronóstico? WAPE, MAE, BIAS, FVA. Una organización que no mide no puede mejorar."],
        ["🤖 4. Modelo base", "Motor automatizado que genera el pronóstico de base sin intervención humana. El modelo debe ganarle al naive o no vale la pena."],
        ["👥 5. Revisión", "Enriquecimiento humano: solo donde el experto agrega valor real. El 80% de los overrides empeoran el pronóstico — medir el FVA del humano es tan importante como el del modelo."],
      ].map(([title, desc]) => (
        <Box key={title as string} sx={{ display: "flex", gap: "0.75rem", mb: "1.25rem", p: "0.875rem", bgcolor: "rgba(59,130,246,0.04)", borderRadius: "0.5rem", borderLeft: "0.25rem solid", borderColor: "primary.light" }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.9375rem", color: "primary.main", mb: "0.25rem" }}>{title as string}</Typography>
            <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.7 }}>{desc as string}</Typography>
          </Box>
        </Box>
      ))}

      <Divider sx={{ my: "1.75rem" }} />

      {/* 1-3 */}
      <SectionAnchor id="1-3" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.3 Demanda vs ventas</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Uno de los errores más frecuentes: usar las <strong>ventas</strong> históricas para entrenar el modelo.
        Las ventas son <em>demanda restringida</em>: si no había stock, no hubo venta — aunque había demanda.
      </Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El modelo aprende del pasado. Si el pasado tiene &quot;ceros por quiebre de stock&quot; en lugar de demanda
        real, el modelo aprenderá que la demanda era baja cuando en realidad era alta. El resultado: un forecast
        sistemáticamente subestimado que perpetúa el quiebre de stock.
      </Typography>
      <Box sx={{ overflowX: "auto", mb: "1.5rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.875rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Dato", "Qué mide", "Problema", "¿Usar para forecast?"].map(h => (
                <th key={h} style={{ padding: "0.5rem 1rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Ventas", "Demanda realizada con stock disponible", "Ceros por quiebre de stock", "⚠️ Solo si no hay alternativa"],
              ["Demanda real", "Pedidos recibidos (con y sin stock)", "Puede haber backorders", "✅ Siempre preferible"],
              ["Demanda implícita", "Ventas + stock outs estimados", "Requiere estimación de BO", "✅ Mejor que ventas puras"],
            ].map(([d, q, p, u], i) => (
              <tr key={d as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 1rem", fontWeight: 600 }}>{d as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{q as string}</td>
                <td style={{ padding: "0.4rem 1rem", color: "#b45309" }}>{p as string}</td>
                <td style={{ padding: "0.4rem 1rem" }}>{u as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 1-4 */}
      <SectionAnchor id="1-4" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.4 Granularidad y horizonte</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        Dos dimensiones definen el contexto del forecast: <strong>¿a qué nivel de detalle?</strong> (granularidad)
        y <strong>¿para cuánto tiempo hacia adelante?</strong> (horizonte).
      </Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        La granularidad determina qué modelo es apropiado. Pronosticar a nivel SKU-bodega-semana requiere manejar
        series muy cortas, muchos ceros y alta variabilidad. Pronosticar a nivel categoría-mes tiene series más
        largas y estables donde un SARIMA puede brillar.
      </Typography>
      <Alert severity="warning" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>Trampa frecuente:</strong> agregar el pronóstico de SKUs individuales para obtener la categoría
        acumula los errores. Es mejor pronosticar en ambos niveles y reconciliar (hierarchical forecasting).
        En ForecastIQ priorizamos el nivel SKU-semana o SKU-mes como unidad base.
      </Alert>
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        El horizonte ideal debería coincidir con el <strong>lead time de compra</strong> más el ciclo de revisión.
        Si reponés cada 4 semanas con un lead time de 6 semanas, necesitás pronosticar al menos 10 semanas hacia adelante.
        Vandeputt recomienda que los períodos de test en la evaluación sean iguales al horizonte de proyección.
      </Typography>

      <Divider sx={{ my: "1.75rem" }} />

      {/* 1-5 */}
      <SectionAnchor id="1-5" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>1.5 El costo de equivocarse</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El error de forecast no es simétrico. Sobreestimar y subestimar tienen costos distintos según el
        contexto del negocio. Entender este asimétría es fundamental para elegir la métrica correcta y
        calibrar el modelo hacia el lado correcto.
      </Typography>
      {[
        ["📦 Sobreestimación (BIAS > 0)", "Inventario excesivo → capital inmovilizado, costo de almacenaje, riesgo de obsolescencia. Típico en productos de moda o perecederos."],
        ["🚫 Subestimación (BIAS < 0)", "Quiebre de stock → ventas perdidas, clientes insatisfechos, urgencias de reposición a mayor costo. Más común pero más difícil de medir."],
        ["🎯 Objetivo: BIAS ~ 0%", "Un forecast imparcial. No siempre es posible ni deseable si el costo de uno y otro error es muy diferente (ej: medicamentos críticos)."],
      ].map(([title, desc]) => (
        <Box key={title as string} sx={{ display: "flex", gap: "0.75rem", mb: "1rem" }}>
          <Typography sx={{ minWidth: "14rem", fontWeight: 600, fontSize: "0.875rem", color: "primary.main" }}>{title as string}</Typography>
          <Typography sx={{ color: "text.secondary", fontSize: "0.875rem", lineHeight: 1.7 }}>{desc as string}</Typography>
        </Box>
      ))}
      <Alert severity="success" sx={{ mt: "1rem", fontSize: "0.8125rem" }}>
        <strong>ForecastIQ siempre muestra el BIAS</strong> junto a WAPE y MAE. Si el BIAS supera ±5%,
        la app muestra una alerta con la interpretación de negocio correspondiente.
        Ver <strong>Capítulo 4 — Métricas</strong> para el cálculo completo.
      </Alert>
    </Box>
  )
}
