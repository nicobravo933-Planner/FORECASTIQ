"use client"

/**
 * YearlyTrendChart — VIZ-1e
 *
 * One line per year plotted on a shared monthly x-axis (Jan–Dec).
 * Allows visual comparison of year-over-year patterns.
 *
 * Renders only when historical data covers >= 2 full years.
 * Caller is responsible for the conditional render guard.
 *
 * Props:
 *   historical — full historical series (HistoricalPoint[])
 *   freq       — data frequency (affects x-axis buckets)
 */

import { useMemo } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import { useTheme } from "@mui/material/styles"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import type { HistoricalPoint, DataFreq } from "@/lib/types"

// ── Constants ─────────────────────────────────────────────────────────────────

// Up to 6 years — color palette visually distinct
const YEAR_COLORS = [
  "#6366f1", // indigo   (current)
  "#22c55e", // green
  "#f97316", // orange
  "#a855f7", // purple
  "#ef4444", // red
  "#06b6d4", // cyan
]

const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"]

// ── Helpers ───────────────────────────────────────────────────────────────────

function getBucket(dateStr: string, isQuarterly: boolean): number {
  const d = new Date(dateStr + "T00:00:00")
  return isQuarterly ? Math.floor(d.getMonth() / 3) : d.getMonth()
}

function getYear(dateStr: string): number {
  return new Date(dateStr + "T00:00:00").getFullYear()
}

function formatValue(val: unknown): string {
  const n = typeof val === "number" ? val : NaN
  if (!isFinite(n)) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(0)
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface YearlyTrendChartProps {
  historical: HistoricalPoint[]
  freq?:      DataFreq
}

// ── Main component ────────────────────────────────────────────────────────────

export function YearlyTrendChart({ historical, freq = "M" }: YearlyTrendChartProps) {
  const theme = useTheme()
  const isQuarterly = freq === "Q"
  const colLabels   = isQuarterly ? QUARTER_LABELS : MONTH_LABELS
  const nCols       = colLabels.length

  // Build pivot: years → { bucket → value }
  const { chartData, years } = useMemo(() => {
    const map: Record<number, Record<number, number>> = {}
    for (const p of historical) {
      const y = getYear(p.date)
      const b = getBucket(p.date, isQuarterly)
      if (!map[y]) map[y] = {}
      map[y][b] = (map[y][b] ?? 0) + p.value
    }
    const yrs = Object.keys(map).map(Number).sort()
    // Keep last 6 years max
    const activeYears = yrs.slice(-6)

    // Build array of { bucket_label, year_YYYY: value, ... }
    const data = Array.from({ length: nCols }, (_, b) => {
      const row: Record<string, unknown> = { bucket: colLabels[b] }
      for (const y of activeYears) {
        const val = map[y]?.[b]
        if (val !== undefined) row[String(y)] = val
      }
      return row
    })

    return { chartData: data, years: activeYears }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historical, freq])

  // Need at least 2 years
  if (years.length < 2) return null

  const latestYear = years[years.length - 1]

  return (
    <Paper
      variant="outlined"
      sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <ShowChartIcon sx={{ fontSize: "1.25rem", color: "primary.main" }} />
        <Typography variant="subtitle1" fontWeight={700} color="text.primary">
          Tendencia interanual
        </Typography>
        <Typography variant="caption" color="text.disabled">
          — {years[0]}–{latestYear} · una línea por año
        </Typography>
      </Box>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />

          <XAxis
            dataKey="bucket"
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={{ stroke: theme.palette.divider }}
          />

          <YAxis
            tickFormatter={(v: number) => formatValue(v)}
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
              boxShadow: theme.shadows[4],
            }}
            formatter={(value: unknown, name: string) => [formatValue(value), name]}
          />

          <Legend
            wrapperStyle={{ fontSize: "0.8125rem", paddingTop: "0.5rem" }}
          />

          {years.map((year, i) => {
            const color = YEAR_COLORS[i % YEAR_COLORS.length]
            const isLatest = year === latestYear
            return (
              <Line
                key={year}
                type="monotone"
                dataKey={String(year)}
                stroke={color}
                strokeWidth={isLatest ? 2.5 : 1.5}
                strokeDasharray={isLatest ? undefined : "5 3"}
                dot={{ r: isLatest ? 3 : 2, fill: "white", stroke: color, strokeWidth: 1.5 }}
                activeDot={{ r: 5, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={true}
                animationDuration={700}
                animationEasing="ease-out"
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>

      {/* Footer */}
      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
        El año más reciente ({latestYear}) aparece en línea sólida. Los años anteriores en línea punteada. Valores acumulados por {isQuarterly ? "trimestre" : "mes"}.
      </Typography>
    </Paper>
  )
}
