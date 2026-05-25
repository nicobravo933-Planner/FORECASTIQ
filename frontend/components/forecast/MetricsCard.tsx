"use client"

/**
 * MetricsCard — displays WAPE, MAE, BIAS, RMSE, MAPE chips.
 * WAPE is the primary metric (highlighted). MAPE shown only if not null.
 */

import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Tooltip from "@mui/material/Tooltip"
import Chip from "@mui/material/Chip"
import Alert from "@mui/material/Alert"
import type { ForecastMetrics, ModelName } from "@/lib/types"

const MODEL_LABELS: Record<ModelName, string> = {
  moving_average: "Promedio Móvil",
  holt_winters:   "Holt-Winters",
  sarima:         "SARIMA",
  lightgbm:       "LightGBM",
}

const METRIC_INFO: { key: keyof ForecastMetrics; label: string; tooltip: string; primary?: boolean }[] = [
  {
    key: "wape",
    label: "WAPE",
    tooltip: "Weighted Absolute Percentage Error — métrica principal. < 20% es excelente.",
    primary: true,
  },
  {
    key: "fva",
    label: "FVA",
    tooltip: "Forecast Value Added: diferencia entre WAPE Naive y WAPE del modelo. Positivo = el modelo supera al Naive. Negativo = usar Naive directamente.",
  },
  {
    key: "mae",
    label: "MAE",
    tooltip: "Error absoluto medio en unidades de la serie.",
  },
  {
    key: "bias",
    label: "BIAS",
    tooltip: "Positivo = sobreestima (stock excesivo), negativo = subestima (quiebres). Idealmente cercano a 0.",
  },
  {
    key: "rmse",
    label: "RMSE",
    tooltip: "Penaliza errores grandes. Útil para comparar modelos.",
  },
  {
    key: "mape",
    label: "MAPE",
    tooltip: "Mean Absolute Percentage Error. No disponible si la serie tiene ceros.",
  },
]

interface MetricsCardProps {
  metrics: ForecastMetrics
  modelUsed: ModelName
  testPeriods?: number   // 0 = hold-out auto; N = hold-out manual
  orientation?: "vertical" | "horizontal"  // F3.4: horizontal = chips in a row
}

export function MetricsCard({ metrics, modelUsed, testPeriods = 0, orientation = "vertical" }: MetricsCardProps) {
  const isManualTest = testPeriods > 0
  const isHorizontal = orientation === "horizontal"
  return (
    <Paper
      variant="outlined"
      sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
            Métricas de evaluación
          </Typography>
          <Tooltip
            title={isManualTest
              ? `Calculadas sobre los últimos ${testPeriods} períodos reales (hold-out manual). Alta confiabilidad.`
              : "Calculadas sobre el último 20% de la serie (hold-out automático)."}
          >
            <Chip
              label={isManualTest ? `Test ${testPeriods}p` : "Auto 20%"}
              size="small"
              color={isManualTest ? "success" : "default"}
              variant="outlined"
              sx={{ height: "1.25rem", fontSize: "0.625rem", cursor: "help" }}
            />
          </Tooltip>
        </Box>
        <Chip
          label={MODEL_LABELS[modelUsed]}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontSize: "0.75rem" }}
        />
      </Box>

      <Box sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: isHorizontal ? "0.5rem" : "0.75rem",
      }}>
        {METRIC_INFO.map(({ key, label, tooltip, primary }) => {
          const val = metrics[key]
          if (val === null || val === undefined) return null

          // Format: WAPE/MAPE/BIAS as %, MAE/RMSE as number
          const formatted =
            key === "wape" || key === "mape"
              ? `${(val * 100).toFixed(1)}%`
              : key === "bias"
              ? `${val >= 0 ? "+" : ""}${(val * 100).toFixed(1)}%`
              : val.toLocaleString("es-AR", { maximumFractionDigits: 1 })

          const isFva = key === "fva"
          // FVA: verde si positivo (agrega valor), rojo si negativo (resta valor)
          const fvaBgColor = isFva
            ? val >= 0 ? "success.main" : "error.main"
            : undefined

          return (
            <Tooltip key={key} title={tooltip} arrow placement="top">
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  bgcolor: primary ? "primary.main" : isFva ? fvaBgColor : "action.hover",
                  color: primary || isFva ? "primary.contrastText" : "text.primary",
                  borderRadius: "0.5rem",
                  px: isHorizontal ? "0.625rem" : "1rem",
                  py: isHorizontal ? "0.25rem" : "0.5rem",
                  minWidth: isHorizontal ? "3.5rem" : "5rem",
                  cursor: "default",
                }}
              >
                <Typography variant="caption" sx={{ opacity: 0.8, fontWeight: 500 }}>
                  {label}
                </Typography>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {formatted}
                </Typography>
              </Box>
            </Tooltip>
          )
        })}
      </Box>

      {/* F4.2 — BIAS alert: warn when systematic over/under-estimation exceeds 5% */}
      {metrics.bias !== null && metrics.bias !== undefined && Math.abs(metrics.bias) > 0.05 && (
        <Alert severity="warning" sx={{ fontSize: "0.8125rem", py: "0.375rem" }}>
          {metrics.bias > 0
            ? `Sobreestimás un +${(metrics.bias * 100).toFixed(1)}%. Riesgo de sobrestock. Revisá si hay tendencia bajista o eventos que el modelo no captura.`
            : `Subestimás un ${(metrics.bias * 100).toFixed(1)}%. Riesgo de quiebre de stock. Puede ser demanda estacional no capturada.`
          }
          {" "}Estudiá en{" "}
          <span
            style={{ textDecoration: "underline", cursor: "pointer" }}
            onClick={() => { if (typeof window !== "undefined") window.location.href = "/dashboard/encyclopedia?chapter=4" }}
          >
            Enciclopedia Cap. 4 — Métricas
          </span>.
        </Alert>
      )}

      {/* F4.3 — FVA alert: error when model underperforms the Naive baseline */}
      {metrics.fva !== null && metrics.fva !== undefined && metrics.fva < 0 && (
        <Alert severity="error" sx={{ fontSize: "0.8125rem", py: "0.375rem" }}>
          Tu modelo rinde peor que copiar el año pasado (FVA = {(metrics.fva * 100).toFixed(1)}%).
          Considerá más datos de historia, cambiar el modelo o revisar el ETL.{" "}
          Estudiá en{" "}
          <span
            style={{ textDecoration: "underline", cursor: "pointer" }}
            onClick={() => { if (typeof window !== "undefined") window.location.href = "/dashboard/encyclopedia?chapter=11" }}
          >
            Enciclopedia Cap. 11 — FVA
          </span>.
        </Alert>
      )}
    </Paper>
  )
}
