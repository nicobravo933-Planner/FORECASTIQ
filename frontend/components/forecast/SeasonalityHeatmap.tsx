"use client"

/**
 * SeasonalityHeatmap — VIZ-1d
 *
 * Pivot table: rows = years of history, columns = months (Jan–Dec).
 * Cell color encodes intensity (white → deep blue).
 * Implemented as a plain HTML table with inline CSS — no Recharts needed.
 *
 * Renders only when historical data covers >= 2 years.
 * Caller is responsible for the conditional render guard.
 *
 * Props:
 *   historical — full historical series (HistoricalPoint[])
 *   freq       — data frequency; only "M" and "Q" produce meaningful heatmaps
 */

import { useMemo } from "react"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import { useTheme, alpha } from "@mui/material/styles"
import GridViewIcon from "@mui/icons-material/GridView"
import type { HistoricalPoint, DataFreq } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface SeasonalityHeatmapProps {
  historical: HistoricalPoint[]
  freq?:      DataFreq
}

// Column headers per frequency
const MONTH_LABELS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const QUARTER_LABELS = ["Q1", "Q2", "Q3", "Q4"]

// ── Color interpolation ───────────────────────────────────────────────────────

/**
 * Interpolate between white and a deep blue.
 * intensity = 0 → very light, intensity = 1 → deep blue.
 */
function intensityToColor(intensity: number, baseHue: number): string {
  const lightness = 95 - intensity * 65   // 95% (white-ish) → 30% (deep)
  const saturation = intensity * 80       // 0% (gray) → 80% (vivid)
  return `hsl(${baseHue}, ${saturation.toFixed(0)}%, ${lightness.toFixed(0)}%)`
}

function textColorForIntensity(intensity: number): string {
  return intensity > 0.55 ? "#ffffff" : "inherit"
}

// ── Main component ────────────────────────────────────────────────────────────

export function SeasonalityHeatmap({ historical, freq = "M" }: SeasonalityHeatmapProps) {
  const theme = useTheme()

  // Only meaningful for monthly and quarterly data
  const isQuarterly = freq === "Q"
  const colLabels   = isQuarterly ? QUARTER_LABELS : MONTH_LABELS
  const nCols       = colLabels.length

  // Determine bucket (0-indexed) for each point
  const getBucket = (dateStr: string): number => {
    const d = new Date(dateStr + "T00:00:00")
    if (isQuarterly) return Math.floor(d.getMonth() / 3)
    return d.getMonth()
  }

  const getYear = (dateStr: string): number =>
    new Date(dateStr + "T00:00:00").getFullYear()

  // Build pivot: { year → { bucket → value } }
  const { pivot, years, globalMin, globalMax } = useMemo(() => {
    const map: Record<number, Record<number, number>> = {}
    for (const p of historical) {
      const y = getYear(p.date)
      const b = getBucket(p.date)
      if (!map[y]) map[y] = {}
      // Sum if multiple points land in same cell (e.g. weekly → monthly bucket)
      map[y][b] = (map[y][b] ?? 0) + p.value
    }
    const yrs = Object.keys(map).map(Number).sort()
    const allVals = Object.values(map).flatMap((row) => Object.values(row))
    const mn = Math.min(...allVals)
    const mx = Math.max(...allVals)
    return { pivot: map, years: yrs, globalMin: mn, globalMax: mx }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historical, freq])

  // Need at least 2 years
  if (years.length < 2) return null

  const range = globalMax - globalMin || 1

  const hue = theme.palette.mode === "dark" ? 210 : 220

  // Year-over-year % change for the last complete year vs previous
  const lastYear = years[years.length - 1]
  const prevYear = years[years.length - 2]
  const lastTotal = Object.values(pivot[lastYear] ?? {}).reduce((s, v) => s + v, 0)
  const prevTotal = Object.values(pivot[prevYear] ?? {}).reduce((s, v) => s + v, 0)
  const yoyPct = prevTotal > 0 ? ((lastTotal - prevTotal) / prevTotal) * 100 : null

  return (
    <Paper
      variant="outlined"
      sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <GridViewIcon sx={{ fontSize: "1.25rem", color: "primary.main" }} />
          <Typography variant="subtitle1" fontWeight={700} color="text.primary">
            Mapa de estacionalidad ({isQuarterly ? "trimestral" : "mensual"})
          </Typography>
        </Box>

        {yoyPct !== null && (
          <Chip
            size="small"
            label={`${lastYear} vs ${prevYear}: ${yoyPct > 0 ? "+" : ""}${yoyPct.toFixed(1)}%`}
            color={yoyPct > 5 ? "success" : yoyPct < -5 ? "error" : "default"}
            variant="outlined"
            sx={{ height: "1.5rem", fontSize: "0.6875rem", fontWeight: 600 }}
          />
        )}
      </Box>

      {/* Color scale legend */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6875rem", minWidth: "3rem" }}>
          Bajo
        </Typography>
        <Box sx={{
          flex: 1,
          height: "0.625rem",
          borderRadius: "0.25rem",
          background: `linear-gradient(to right, ${intensityToColor(0, hue)}, ${intensityToColor(0.5, hue)}, ${intensityToColor(1, hue)})`,
          border: "1px solid",
          borderColor: "divider",
          maxWidth: "10rem",
        }} />
        <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6875rem", minWidth: "3rem" }}>
          Alto
        </Typography>
      </Box>

      {/* Table */}
      <Box sx={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: "0.75rem" }}>
          <thead>
            <tr>
              {/* Year column header */}
              <th style={{
                padding: "0.375rem 0.625rem",
                textAlign: "left",
                color: theme.palette.text.disabled,
                fontWeight: 600,
                fontSize: "0.6875rem",
                borderBottom: `1px solid ${theme.palette.divider}`,
                minWidth: "3rem",
              }}>
                Año
              </th>
              {colLabels.map((lbl) => (
                <th
                  key={lbl}
                  style={{
                    padding: "0.375rem 0.25rem",
                    textAlign: "center",
                    color: theme.palette.text.secondary,
                    fontWeight: 600,
                    fontSize: "0.6875rem",
                    borderBottom: `1px solid ${theme.palette.divider}`,
                    minWidth: "3rem",
                  }}
                >
                  {lbl}
                </th>
              ))}
              {/* Row total */}
              <th style={{
                padding: "0.375rem 0.625rem",
                textAlign: "right",
                color: theme.palette.text.disabled,
                fontWeight: 600,
                fontSize: "0.6875rem",
                borderBottom: `1px solid ${theme.palette.divider}`,
                minWidth: "4rem",
              }}>
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              const rowData = pivot[year] ?? {}
              const rowTotal = Object.values(rowData).reduce((s, v) => s + v, 0)
              const isCurrentYear = year === Math.max(...years)

              return (
                <tr key={year}>
                  {/* Year label */}
                  <td style={{
                    padding: "0.25rem 0.625rem",
                    fontWeight: isCurrentYear ? 700 : 400,
                    color: isCurrentYear ? theme.palette.primary.main : theme.palette.text.secondary,
                    fontSize: "0.75rem",
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    whiteSpace: "nowrap",
                  }}>
                    {year}{isCurrentYear ? " *" : ""}
                  </td>

                  {/* Data cells */}
                  {Array.from({ length: nCols }, (_, b) => {
                    const val = rowData[b]
                    const hasData = val !== undefined
                    const intensity = hasData ? (val - globalMin) / range : 0
                    const bg = hasData
                      ? intensityToColor(intensity, hue)
                      : alpha(theme.palette.action.hover, 0.3)
                    const fg = hasData ? textColorForIntensity(intensity) : theme.palette.text.disabled

                    return (
                      <td
                        key={b}
                        title={hasData ? `${colLabels[b]} ${year}: ${val.toLocaleString("es-AR", { maximumFractionDigits: 0 })}` : "Sin datos"}
                        style={{
                          padding: "0.25rem 0.25rem",
                          textAlign: "center",
                          backgroundColor: bg,
                          color: fg,
                          fontSize: "0.6875rem",
                          fontWeight: hasData && intensity > 0.6 ? 600 : 400,
                          borderRadius: "0.125rem",
                          cursor: "default",
                          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
                          transition: "opacity 0.15s",
                        }}
                      >
                        {hasData ? formatCell(val) : "—"}
                      </td>
                    )
                  })}

                  {/* Row total */}
                  <td style={{
                    padding: "0.25rem 0.625rem",
                    textAlign: "right",
                    color: theme.palette.text.secondary,
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
                    whiteSpace: "nowrap",
                  }}>
                    {formatCell(rowTotal)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Box>

      {/* Footer */}
      <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
        * Año en curso (datos parciales). Color = intensidad relativa al rango histórico. Pasá el cursor sobre una celda para ver el valor exacto.
      </Typography>
    </Paper>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCell(val: number): string {
  if (!isFinite(val)) return "—"
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`
  if (Math.abs(val) >= 10_000)    return `${(val / 1_000).toFixed(0)}K`
  if (Math.abs(val) >= 1_000)     return `${(val / 1_000).toFixed(1)}K`
  return val.toFixed(0)
}
