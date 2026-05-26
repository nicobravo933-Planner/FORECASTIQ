"use client"

/**
 * ErrorMonthlyChart — VIZ-1b
 *
 * Bar chart showing percentage error per period in the hold-out test window.
 * Each bar is colored:
 *   - green  : |error| < 20%
 *   - red    : |error| >= 20%
 *   - gray   : real value <= 0 (error not meaningful)
 *
 * Reference lines at 0, +20%, -20% (dashed).
 *
 * Renders only when test_periods > 0 and both test_actual + test_predicted
 * are non-empty. Caller is responsible for the conditional render.
 *
 * Props:
 *   testActual    — real values in the hold-out window (HistoricalPoint[])
 *   testPredicted — model predictions over the hold-out window (PredictionPoint[])
 *   freq          — data frequency (used to format x-axis labels)
 */

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import { useTheme, alpha } from "@mui/material/styles"
import BarChartIcon from "@mui/icons-material/BarChart"
import type { HistoricalPoint, PredictionPoint, DataFreq } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ErrorPoint {
  date:     string
  real:     number | null
  pred:     number | null
  errorPct: number | null   // null = not calculable (real <= 0)
}

interface ErrorMonthlyChartProps {
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
  // Monthly (default)
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

function formatValue(n: number): string {
  if (!isFinite(n)) return "—"
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(1)
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipPayload {
  payload?: { date: string; real: number | null; pred: number | null; errorPct: number | null }
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length || !payload[0].payload) return null
  const { date, real, pred, errorPct } = payload[0].payload
  return (
    <Box sx={{
      bgcolor: "background.paper",
      border: "1px solid",
      borderColor: "divider",
      borderRadius: "0.5rem",
      p: "0.75rem",
      fontSize: "0.8125rem",
      boxShadow: 4,
      minWidth: "11rem",
    }}>
      <Typography variant="caption" fontWeight={700} display="block" mb="0.375rem">
        📅 {formatDateFull(date)}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
        <Typography variant="caption" color="text.secondary">
          Real: <strong>{real !== null ? formatValue(real) : "—"}</strong>
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Pred: <strong>{pred !== null ? formatValue(pred) : "—"}</strong>
        </Typography>
        <Typography
          variant="caption"
          fontWeight={700}
          sx={{ color: errorPct === null ? "text.disabled" : Math.abs(errorPct) < 20 ? "success.main" : "error.main" }}
        >
          Error: {errorPct !== null ? `${errorPct > 0 ? "+" : ""}${errorPct.toFixed(1)}%` : "N/A"}
        </Typography>
      </Box>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ErrorMonthlyChart({
  testActual,
  testPredicted,
  freq = "M",
}: ErrorMonthlyChartProps) {
  const theme = useTheme()

  // Build error series: join actual + predicted by date
  const errorData = useMemo<ErrorPoint[]>(() => {
    const predMap = new Map(testPredicted.map((p) => [p.date, p.predicted]))
    return testActual.map((p) => {
      const real = p.value
      const pred = predMap.get(p.date) ?? null
      let errorPct: number | null = null
      if (real !== null && pred !== null && real > 0) {
        errorPct = ((pred - real) / real) * 100
      }
      return { date: p.date, real, pred, errorPct }
    })
  }, [testActual, testPredicted])

  // Summary stats
  const { nGreen, nRed, avgAbsError } = useMemo(() => {
    const calculable = errorData.filter((p) => p.errorPct !== null)
    const green = calculable.filter((p) => Math.abs(p.errorPct!) < 20).length
    const red   = calculable.length - green
    const avg   = calculable.length > 0
      ? calculable.reduce((s, p) => s + Math.abs(p.errorPct!), 0) / calculable.length
      : null
    return { nGreen: green, nRed: red, avgAbsError: avg }
  }, [errorData])

  // Color per bar
  const getColor = (errorPct: number | null): string => {
    if (errorPct === null) return theme.palette.text.disabled
    if (Math.abs(errorPct) < 20) return theme.palette.success.main
    return theme.palette.error.main
  }

  // Domain for Y axis — add some padding
  const maxAbsError = useMemo(() => {
    const vals = errorData.map((p) => p.errorPct).filter((v): v is number => v !== null)
    if (vals.length === 0) return 50
    return Math.max(Math.ceil(Math.max(...vals.map(Math.abs)) * 1.2), 25)
  }, [errorData])

  if (errorData.length === 0) return null

  return (
    <Paper
      variant="outlined"
      sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <BarChartIcon sx={{ fontSize: "1.25rem", color: "primary.main" }} />
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            Error % por período (hold-out)
          </Typography>
        </Box>

        {/* Summary chips */}
        <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Chip
            size="small"
            label={`${nGreen} período${nGreen !== 1 ? "s" : ""} < 20%`}
            sx={{
              height: "1.375rem",
              fontSize: "0.6875rem",
              bgcolor: alpha(theme.palette.success.main, 0.1),
              color: "success.main",
              border: "1px solid",
              borderColor: alpha(theme.palette.success.main, 0.3),
            }}
          />
          {nRed > 0 && (
            <Chip
              size="small"
              label={`${nRed} período${nRed !== 1 ? "s" : ""} ≥ 20%`}
              sx={{
                height: "1.375rem",
                fontSize: "0.6875rem",
                bgcolor: alpha(theme.palette.error.main, 0.1),
                color: "error.main",
                border: "1px solid",
                borderColor: alpha(theme.palette.error.main, 0.3),
              }}
            />
          )}
          {avgAbsError !== null && (
            <Chip
              size="small"
              label={`Error medio: ${avgAbsError.toFixed(1)}%`}
              variant="outlined"
              sx={{ height: "1.375rem", fontSize: "0.6875rem" }}
            />
          )}
        </Box>
      </Box>

      {/* Legend */}
      <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {[
          { color: theme.palette.success.main, label: "|Error| < 20%" },
          { color: theme.palette.error.main,   label: "|Error| ≥ 20%" },
          { color: theme.palette.text.disabled, label: "Real ≤ 0 (N/A)" },
        ].map(({ color, label }) => (
          <Box key={label} sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box sx={{ width: "0.75rem", height: "0.75rem", borderRadius: "0.125rem", bgcolor: color }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.6875rem" }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={errorData}
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
          barCategoryGap="20%"
        >
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={(d) => formatDate(d, freq)}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={{ stroke: theme.palette.divider }}
          />

          <YAxis
            domain={[-maxAbsError, maxAbsError]}
            tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={false}
            width={48}
          />

          {/* Reference line at 0 */}
          <ReferenceLine y={0} stroke={theme.palette.text.secondary} strokeWidth={1.5} />

          {/* Threshold lines at ±20% (dashed) */}
          <ReferenceLine
            y={20}
            stroke={theme.palette.error.light}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: "+20%", position: "right", fontSize: 10, fill: theme.palette.error.light }}
          />
          <ReferenceLine
            y={-20}
            stroke={theme.palette.error.light}
            strokeDasharray="4 4"
            strokeWidth={1}
            label={{ value: "-20%", position: "right", fontSize: 10, fill: theme.palette.error.light }}
          />

          <Tooltip content={<CustomTooltip />} cursor={{ fill: alpha(theme.palette.action.hover, 0.5) }} />

          <Bar dataKey="errorPct" name="Error %" radius={[2, 2, 0, 0]}>
            {errorData.map((entry) => (
              <Cell
                key={entry.date}
                fill={getColor(entry.errorPct)}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Educational footer */}
      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
        Error % = (Predicho − Real) / Real × 100. Barras positivas = sobreestimación (riesgo sobrestock). Barras negativas = subestimación (riesgo quiebre). Umbral educativo: ±20%.
      </Typography>
    </Paper>
  )
}
