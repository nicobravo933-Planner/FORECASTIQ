"use client"

/**
 * CumulativeBiasChart — VIZ-1c
 *
 * Line chart of cumulative BIAS % over the hold-out test window.
 * Helps identify systematic over/under-estimation across the evaluation period.
 *
 * Formula:
 *   bias_cum[t] = cumsum(pred_i - real_i) / sum(real) * 100
 *
 * Visual zones:
 *   Green band  : -10% to +10% (acceptable range per Vandeputt)
 *   Orange zone : 10%-25% / -10% to -25%
 *   Red zone    : beyond ±25%
 *
 * Props:
 *   testActual    — real values in hold-out window (HistoricalPoint[])
 *   testPredicted — model predictions over hold-out window (PredictionPoint[])
 *   freq          — data frequency (for x-axis label formatting)
 */

import { useMemo } from "react"
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ResponsiveContainer,
} from "recharts"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Alert from "@mui/material/Alert"
import { useTheme, alpha } from "@mui/material/styles"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import TrendingDownIcon from "@mui/icons-material/TrendingDown"
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat"
import type { HistoricalPoint, PredictionPoint, DataFreq } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface BiasPoint {
  date:      string
  biasCum:   number   // cumulative bias % at this period
  errorAbs:  number   // |pred - real| for reference
}

interface CumulativeBiasChartProps {
  testActual:    HistoricalPoint[]
  testPredicted: PredictionPoint[]
  freq?:         DataFreq
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string, freq: DataFreq): string {
  const d = new Date(dateStr + "T00:00:00")
  if (freq === "D") return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
  if (freq === "W") return d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" })
  if (freq === "Q") {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `Q${q} ${d.getFullYear().toString().slice(2)}`
  }
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: BiasPoint
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null
  const { date, biasCum } = payload[0].payload
  const isOver  = biasCum > 0
  const isFlat  = Math.abs(biasCum) <= 10
  const label   = isFlat
    ? "Dentro del rango aceptable (±10%)"
    : isOver
    ? `Sobreestimación acumulada → riesgo sobrestock`
    : `Subestimación acumulada → riesgo quiebre de stock`
  const color   = isFlat ? "success.main" : Math.abs(biasCum) <= 25 ? "warning.main" : "error.main"

  return (
    <Box sx={{
      bgcolor: "background.paper",
      border: "1px solid",
      borderColor: "divider",
      borderRadius: "0.5rem",
      p: "0.75rem",
      fontSize: "0.8125rem",
      boxShadow: 4,
      minWidth: "14rem",
    }}>
      <Typography variant="caption" fontWeight={700} display="block" mb="0.375rem">
        📅 {formatDateFull(date)}
      </Typography>
      <Typography variant="caption" color={color} fontWeight={700} display="block" mb="0.25rem">
        BIAS acum: {biasCum > 0 ? "+" : ""}{biasCum.toFixed(1)}%
      </Typography>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.4 }}>
        {label}
      </Typography>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function CumulativeBiasChart({
  testActual,
  testPredicted,
  freq = "M",
}: CumulativeBiasChartProps) {
  const theme = useTheme()

  // Build cumulative bias series
  const biasData = useMemo<BiasPoint[]>(() => {
    const predMap = new Map(testPredicted.map((p) => [p.date, p.predicted]))
    // sum of all real values (denominator for relative bias)
    const sumReal = testActual.reduce((s, p) => s + (p.value > 0 ? p.value : 0), 0)
    if (sumReal === 0) return []

    let cumError = 0
    return testActual.map((p) => {
      const real = p.value
      const pred = predMap.get(p.date) ?? real  // fallback: no error if missing
      cumError += (pred - real)
      return {
        date:     p.date,
        biasCum:  (cumError / sumReal) * 100,
        errorAbs: Math.abs(pred - real),
      }
    })
  }, [testActual, testPredicted])

  // Final bias value for the summary chip
  const finalBias = biasData.length > 0 ? biasData[biasData.length - 1].biasCum : null

  // Y-axis domain — symmetric, at least ±30
  const maxAbs = useMemo(() => {
    if (biasData.length === 0) return 30
    const peak = Math.max(...biasData.map((p) => Math.abs(p.biasCum)))
    return Math.max(Math.ceil(peak * 1.15), 30)
  }, [biasData])

  if (biasData.length === 0) return null

  const isGood    = finalBias !== null && Math.abs(finalBias) <= 10
  const isWarning = finalBias !== null && Math.abs(finalBias) > 10 && Math.abs(finalBias) <= 25
  const isBad     = finalBias !== null && Math.abs(finalBias) > 25

  const summaryColor = isGood ? "success" : isWarning ? "warning" : "error"
  const summaryIcon  = finalBias === null ? null
    : finalBias > 2  ? <TrendingUpIcon sx={{ fontSize: "0.875rem" }} />
    : finalBias < -2 ? <TrendingDownIcon sx={{ fontSize: "0.875rem" }} />
    : <TrendingFlatIcon sx={{ fontSize: "0.875rem" }} />

  return (
    <Paper
      variant="outlined"
      sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <TrendingFlatIcon sx={{ fontSize: "1.25rem", color: "primary.main" }} />
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            BIAS acumulado (hold-out)
          </Typography>
        </Box>

        {/* Final bias chip */}
        {finalBias !== null && (
          <Chip
            icon={summaryIcon ?? undefined}
            label={`BIAS final: ${finalBias > 0 ? "+" : ""}${finalBias.toFixed(1)}%`}
            size="small"
            color={summaryColor}
            variant="outlined"
            sx={{ height: "1.5rem", fontSize: "0.6875rem", fontWeight: 600 }}
          />
        )}
      </Box>

      {/* Contextual alert */}
      {isBad && finalBias !== null && (
        <Alert
          severity="error"
          sx={{ fontSize: "0.8125rem", py: "0.375rem" }}
          icon={finalBias > 0 ? <TrendingUpIcon /> : <TrendingDownIcon />}
        >
          {finalBias > 0
            ? `BIAS acumulado +${finalBias.toFixed(1)}% — El modelo sobreestima sistemáticamente. Riesgo de sobrestock.`
            : `BIAS acumulado ${finalBias.toFixed(1)}% — El modelo subestima sistemáticamente. Riesgo de quiebre de stock.`
          }
        </Alert>
      )}
      {isWarning && finalBias !== null && (
        <Alert severity="warning" sx={{ fontSize: "0.8125rem", py: "0.375rem" }}>
          {finalBias > 0
            ? `BIAS acumulado +${finalBias.toFixed(1)}% — Tendencia a sobreestimar. Monitoreá el stock.`
            : `BIAS acumulado ${finalBias.toFixed(1)}% — Tendencia a subestimar. Revisá la demanda real.`
          }
        </Alert>
      )}

      {/* Zone legend */}
      <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {[
          { color: alpha(theme.palette.success.main, 0.25), label: "±10% — aceptable" },
          { color: alpha(theme.palette.warning.main, 0.25), label: "±10–25% — atención" },
          { color: alpha(theme.palette.error.main,   0.20), label: "> ±25% — crítico" },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box sx={{ width: "0.75rem", height: "0.75rem", borderRadius: "0.125rem", bgcolor: color, border: "1px solid", borderColor: "divider" }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={biasData} margin={{ top: 8, right: 48, bottom: 8, left: 8 }}>

          {/* Zone: critical positive */}
          <ReferenceArea y1={25}  y2={maxAbs} fill={alpha(theme.palette.error.main,   0.12)} />
          {/* Zone: warning positive */}
          <ReferenceArea y1={10}  y2={25}     fill={alpha(theme.palette.warning.main, 0.12)} />
          {/* Zone: acceptable (green band) */}
          <ReferenceArea y1={-10} y2={10}     fill={alpha(theme.palette.success.main, 0.10)} />
          {/* Zone: warning negative */}
          <ReferenceArea y1={-25} y2={-10}    fill={alpha(theme.palette.warning.main, 0.12)} />
          {/* Zone: critical negative */}
          <ReferenceArea y1={-maxAbs} y2={-25} fill={alpha(theme.palette.error.main,  0.12)} />

          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />

          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d, freq)}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={{ stroke: theme.palette.divider }}
          />

          <YAxis
            domain={[-maxAbs, maxAbs]}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={false}
            width={52}
          />

          {/* Threshold reference lines */}
          <ReferenceLine y={0}   stroke={theme.palette.text.primary}  strokeWidth={1.5} label={{ value: "0%", position: "right", fontSize: 10, fill: theme.palette.text.secondary }} />
          <ReferenceLine y={10}  stroke={theme.palette.success.main}  strokeDasharray="4 3" strokeWidth={1} label={{ value: "+10%", position: "right", fontSize: 10, fill: theme.palette.success.main }} />
          <ReferenceLine y={-10} stroke={theme.palette.success.main}  strokeDasharray="4 3" strokeWidth={1} label={{ value: "-10%", position: "right", fontSize: 10, fill: theme.palette.success.main }} />
          <ReferenceLine y={25}  stroke={theme.palette.error.light}   strokeDasharray="4 3" strokeWidth={1} label={{ value: "+25%", position: "right", fontSize: 10, fill: theme.palette.error.light }} />
          <ReferenceLine y={-25} stroke={theme.palette.error.light}   strokeDasharray="4 3" strokeWidth={1} label={{ value: "-25%", position: "right", fontSize: 10, fill: theme.palette.error.light }} />

          <Tooltip content={<CustomTooltip />} />

          {/* Cumulative BIAS line — color changes by zone */}
          <Line
            type="monotone"
            dataKey="biasCum"
            stroke={
              finalBias === null ? theme.palette.primary.main
                : isGood    ? theme.palette.success.main
                : isWarning ? theme.palette.warning.main
                : theme.palette.error.main
            }
            strokeWidth={2.5}
            dot={{ r: 3, fill: "white", strokeWidth: 2 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
            name="BIAS acum %"
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />

        </ComposedChart>
      </ResponsiveContainer>

      {/* Educational footer */}
      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
        BIAS acum[t] = Σ(pred − real) / Σreal × 100. Tendencia positiva = sobreestimación acumulada (sobrestock). Tendencia negativa = subestimación acumulada (quiebre de stock). Zona verde = ±10% (Vandeputt).
      </Typography>
    </Paper>
  )
}
