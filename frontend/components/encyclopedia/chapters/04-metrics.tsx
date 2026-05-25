"use client"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import Chip from "@mui/material/Chip"
import { FormulaBlock } from "../FormulaBlock"
import { PythonCodeBlock } from "../PythonCodeBlock"

function SectionAnchor({ id }: { id: string }) {
  return <Box component="span" data-section-id={id} sx={{ display: "block", mt: "-1rem", pt: "1rem" }} />
}

const KPI_CODE = `import numpy as np
import pandas as pd

def kpi(df):
    mask    = df['Error'].notnull()
    dem_ave = df.loc[mask, 'Demand'].mean()

    bias_abs = df.loc[mask, 'Error'].mean()
    bias_rel = bias_abs / dem_ave
    print(f'Bias: {bias_abs:.2f}  ({bias_rel:.1%})')

    mape = (df.loc[mask, 'Error'].abs() / df.loc[mask, 'Demand']).mean()
    print(f'MAPE: {mape:.1%}  ⚠️ usar con precaución')

    mae_abs = df.loc[mask, 'Error'].abs().mean()
    mae_rel = mae_abs / dem_ave
    print(f'MAE:  {mae_abs:.2f}  ({mae_rel:.1%})')

    rmse_abs = np.sqrt((df.loc[mask, 'Error'] ** 2).mean())
    rmse_rel = rmse_abs / dem_ave
    print(f'RMSE: {rmse_abs:.2f}  ({rmse_rel:.1%})')

    wape = df.loc[mask, 'Error'].abs().sum() / df.loc[mask, 'Demand'].abs().sum()
    print(f'WAPE: {wape:.1%}  ✅ métrica recomendada')

    return {'bias': bias_rel, 'mape': mape, 'mae': mae_rel, 'rmse': rmse_rel, 'wape': wape}`

export function Chapter04() {
  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: "0.5rem" }}>📐 Métricas de error</Typography>
      <Typography sx={{ color: "text.secondary", fontSize: "1rem", mb: "2rem", fontStyle: "italic" }}>
        WAPE, MAE, BIAS, RMSE, MAPE y FVA — cuándo y cómo usar cada una
      </Typography>

      <Alert severity="info" sx={{ mb: "1.5rem" }}>
        <strong>Orden de prioridad en ForecastIQ:</strong> WAPE → MAE → BIAS → RMSE. El MAPE está incluido
        solo por compatibilidad — evitarlo para decisiones de negocio.
      </Alert>

      <SectionAnchor id="4-1" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.1 BIAS (Sesgo)</Typography>
      <Typography sx={{ mb: "1rem", lineHeight: 1.8 }}>
        El BIAS mide la <strong>dirección del error promedio</strong>. No dice cuánto te equivocás — dice
        hacia dónde te equivocás sistemáticamente. Es el KPI más crítico para inventario.
      </Typography>
      <FormulaBlock
        label="BIAS"
        formula="\text{BIAS} = \frac{\bar{F} - \bar{D}}{\bar{D}} \times 100"
        description="F = Forecast, D = Demand. Positivo = sobreestimación (sobra producto). Negativo = subestimación (quiebre de stock)."
      />
      <Box sx={{ display: "flex", gap: "1rem", mb: "1.5rem" }}>
        <Chip label="BIAS > 0 → sobreestimás → inventario excesivo" sx={{ bgcolor: "rgba(239,68,68,0.1)", color: "error.main", fontSize: "0.75rem" }} />
        <Chip label="BIAS < 0 → subestimás → quiebre de stock" sx={{ bgcolor: "rgba(245,158,11,0.1)", color: "warning.main", fontSize: "0.75rem" }} />
      </Box>

      <Divider sx={{ my: "1.5rem" }} />

      <SectionAnchor id="4-2" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.2 MAPE — El indicador engañoso</Typography>
      <FormulaBlock
        label="MAPE"
        formula="\text{MAPE} = \frac{1}{n} \sum_{t=1}^n \frac{|D_t - F_t|}{D_t}"
        description="Divide por la demanda real de cada período. Eso lo hace asimétrico: el error hacia arriba no tiene límite, el de abajo sí."
      />
      <Alert severity="error" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Por qué evitar el MAPE?</strong> Un error de 1 unidad cuando la demanda es 2 da 50% de error.
        El mismo error cuando la demanda es 100 da 1%. El modelo aprende a subestimar en días de baja demanda
        para mantener un MAPE &quot;bonito&quot; — y el resultado son estantes vacíos.
      </Alert>

      <Divider sx={{ my: "1.5rem" }} />

      <SectionAnchor id="4-3" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.3 MAE — Error Absoluto Medio</Typography>
      <FormulaBlock
        label="MAE"
        formula="\text{MAE} = \frac{1}{n} \sum_{t=1}^n |D_t - F_t|"
        description="Interpreta directamente en unidades de negocio. MAE = 150 unidades/semana es comprensible para cualquier gerente."
      />
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Matemáticamente, optimizar MAE equivale a buscar la <strong>mediana</strong> de la distribución de
        demanda. Esto lo hace robusto a outliers (al contrario del RMSE).
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <SectionAnchor id="4-4" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.4 RMSE — Penaliza errores grandes</Typography>
      <FormulaBlock
        label="RMSE"
        formula="\text{RMSE} = \sqrt{\frac{1}{n} \sum_{t=1}^n (D_t - F_t)^2}"
        description="Al elevar al cuadrado, un solo error grande domina el resultado. Útil para selección de modelos cuando los grandes errores son costosos."
      />
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        Optimizar RMSE equivale a buscar la <strong>media</strong> de la distribución. Es más sensible a
        outliers que MAE. Usar para comparar modelos — no para reportar a negocio.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <SectionAnchor id="4-5" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.5 WAPE — La métrica principal ✅</Typography>
      <FormulaBlock
        label="WAPE (Weighted Absolute Percentage Error)"
        formula="\text{WAPE} = \frac{\sum_{t=1}^n |D_t - F_t|}{\sum_{t=1}^n D_t}"
        description="Divide la suma total de errores por la suma total de demanda. Robusto a ceros y outliers. El estándar de la industria para portfolios."
      />
      <Alert severity="success" sx={{ mb: "1.5rem", fontSize: "0.8125rem" }}>
        <strong>¿Por qué WAPE y no MAE?</strong> El MAE en unidades depende de la escala del producto.
        El WAPE es siempre un porcentaje comparable entre productos distintos — ideal para portfolios de miles de SKUs.
      </Alert>

      <Divider sx={{ my: "1.5rem" }} />

      <SectionAnchor id="4-6" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.6 FVA — Forecast Value Added</Typography>
      <FormulaBlock
        label="FVA vs Seasonal Naive"
        formula="\text{FVA} = \frac{\text{WAPE}_{naive} - \text{WAPE}_{model}}{\text{WAPE}_{naive}} \times 100"
        description="FVA > 0 → el modelo es mejor que el naive. FVA < 0 → usá el naive directamente (es más barato y más preciso)."
      />
      <Typography sx={{ mb: "1.5rem", lineHeight: 1.8 }}>
        El FVA es la prueba de fuego de todo modelo. Si tu LightGBM con Optuna no supera al Seasonal Naive,
        estás desperdiciando recursos computacionales. ForecastIQ siempre calcula el FVA automáticamente.
      </Typography>

      <Divider sx={{ my: "1.5rem" }} />

      <SectionAnchor id="4-7" />
      <Typography variant="h6" sx={{ fontWeight: 700, mb: "0.75rem" }}>4.7 Código Python completo</Typography>
      <PythonCodeBlock code={KPI_CODE} title="kpi() — todas las métricas" />

      <Box sx={{ overflowX: "auto", mt: "1rem" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8125rem" }}>
          <thead>
            <tr style={{ background: "rgba(59,130,246,0.08)" }}>
              {["Métrica", "Objetivo matemático", "Sensible a outliers", "Interpretable", "ForecastIQ"].map(h => (
                <th key={h} style={{ padding: "0.5rem 0.875rem", textAlign: "left", fontWeight: 600, borderBottom: "2px solid rgba(0,0,0,0.1)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["BIAS",  "Dirección del error",    "Sí", "✅ %",  "✅ siempre"],
              ["MAPE",  "Mediana ponderada",       "No", "✅ %",  "⚠️ solo referencia"],
              ["MAE",   "Mediana",                 "No", "✅ unidades", "✅ secundaria"],
              ["RMSE",  "Media",                   "Sí", "❌ no %", "✅ selección modelo"],
              ["WAPE",  "Media ponderada",         "No", "✅ %",  "✅ principal"],
              ["FVA",   "Mejora vs naive",         "No", "✅ %",  "✅ obligatorio"],
            ].map(([m, obj, out, interp, fiq], i) => (
              <tr key={m as string} style={{ background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)" }}>
                <td style={{ padding: "0.4rem 0.875rem", fontWeight: 700 }}>{m as string}</td>
                <td style={{ padding: "0.4rem 0.875rem", color: "#374151" }}>{obj as string}</td>
                <td style={{ padding: "0.4rem 0.875rem", textAlign: "center" }}>{out as string}</td>
                <td style={{ padding: "0.4rem 0.875rem" }}>{interp as string}</td>
                <td style={{ padding: "0.4rem 0.875rem" }}>{fiq as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Box>
    </Box>
  )
}
