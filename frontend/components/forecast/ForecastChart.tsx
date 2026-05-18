"use client"

/**
 * ForecastChart — Recharts composite chart showing:
 *   - Historical line (solid, primary color)
 *   - Forecast line (dashed, secondary color)
 *   - Confidence interval band (area, semi-transparent)
 *
 * Receives historical + predictions from the forecast result.
 */

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import { useTheme } from "@mui/material/styles"
import type { HistoricalPoint, PredictionPoint } from "@/lib/types"

interface ChartPoint {
  date: string
  historical?: number
  predicted?: number
  ci?: [number, number] // [lower, upper] for area band
}

interface ForecastChartProps {
  historical: HistoricalPoint[]
  predictions: PredictionPoint[]
  modelName: string
}

// Format date label for X axis — show only month/year
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
}

// Format large numbers for Y axis
function formatValue(val: unknown): string {
  const n = typeof val === "number" ? val : Array.isArray(val) ? val[0] : NaN
  if (!isFinite(n)) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toFixed(0)
}

export function ForecastChart({ historical, predictions, modelName }: ForecastChartProps) {
  const theme = useTheme()

  // Merge historical + predictions into a single array for Recharts
  const historicalPoints: ChartPoint[] = historical.map((p) => ({
    date: p.date,
    historical: p.value,
  }))

  const predictionPoints: ChartPoint[] = predictions.map((p) => ({
    date: p.date,
    predicted: p.predicted,
    ci: [p.lower, p.upper],
  }))

  // Overlap last historical point into first prediction for visual continuity
  const lastHist = historicalPoints[historicalPoints.length - 1]
  if (lastHist && predictionPoints.length > 0) {
    predictionPoints[0] = {
      ...predictionPoints[0],
      historical: lastHist.historical,
    }
  }

  const data: ChartPoint[] = [...historicalPoints, ...predictionPoints]
  const splitDate = predictions[0]?.date ?? null

  // Tick density: show every N-th label to avoid crowding
  const tickInterval = Math.max(1, Math.floor(data.length / 12))

  return (
    <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
          Serie histórica + proyección
        </Typography>
        <Typography variant="caption" color="text.disabled">
          {modelName}
        </Typography>
      </Box>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />

          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            interval={tickInterval}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={{ stroke: theme.palette.divider }}
          />

          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={false}
            width={48}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value: unknown, name: string) => {
              const labels: Record<string, string> = {
                historical: "Histórico",
                predicted:  "Proyección",
                ci:         "Intervalo de confianza",
              }
              // ci es un array [lower, upper] — no mostrar en tooltip
              if (name === "ci") return [null, null]
              return [formatValue(value), labels[name] ?? name]
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: "0.8125rem", paddingTop: "0.75rem" }}
            formatter={(value) => {
              const labels: Record<string, string> = {
                historical: "Histórico",
                predicted:  "Proyección",
                ci:         "Intervalo 95%",
              }
              return labels[value] ?? value
            }}
          />

          {/* Split line: where history ends and forecast begins */}
          {splitDate && (
            <ReferenceLine
              x={splitDate}
              stroke={theme.palette.divider}
              strokeDasharray="6 3"
              label={{
                value: "Hoy",
                position: "insideTopRight",
                fontSize: 10,
                fill: theme.palette.text.disabled,
              }}
            />
          )}

          {/* Confidence interval band */}
          <Area
            type="monotone"
            dataKey="ci"
            fill={theme.palette.secondary.main}
            stroke="none"
            fillOpacity={0.15}
            name="ci"
            legendType="rect"
            connectNulls
          />

          {/* Historical line */}
          <Line
            type="monotone"
            dataKey="historical"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
            name="historical"
            connectNulls
          />

          {/* Forecast line */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={theme.palette.secondary.main}
            strokeWidth={2}
            strokeDasharray="6 3"
            dot={false}
            activeDot={{ r: 4 }}
            name="predicted"
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </Paper>
  )
}
