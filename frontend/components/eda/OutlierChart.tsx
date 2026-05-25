"use client"

/**
 * OutlierChart — gráfico de la serie con outliers marcados en rojo.
 * Usa Recharts (mantenemos Recharts para charts con puntos customizados).
 * Muestra también las líneas horizontales de winsorización p5/p95.
 */

import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Chip from "@mui/material/Chip"
import Typography from "@mui/material/Typography"
import {
  ComposedChart,
  Line,
  Scatter,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts"
import type { OutlierInfo, SeriesSummary } from "@/hooks/useEda"

interface OutlierChartProps {
  summary: SeriesSummary
  outliers: OutlierInfo
  /** Serie completa: array de { date: string; value: number } */
  series: Array<{ date: string; value: number }>
}

interface ChartPoint {
  date: string
  value: number
  outlier?: number    // solo definido si el punto es outlier
}

interface HistoBin {
  bin: string
  count: number
  isOutlier: boolean  // true si el bin cae fuera del rango winsor
}

export function OutlierChart({ summary, outliers, series }: OutlierChartProps) {
  // Construir datos del gráfico marcando outliers
  // Nota: gaps del índice temporal se reportan vía summary.n_gaps (chip debajo del header)
  const outlierDateSet = new Set(outliers.outlier_dates)

  const data: ChartPoint[] = series.map((pt) => ({
    date: pt.date,
    value: pt.value,
    outlier: outlierDateSet.has(pt.date) ? pt.value : undefined,
  }))

  const hasOutliers = outliers.n_outliers > 0
  const hasGaps     = summary.n_gaps > 0

  // ── Histograma de distribución ──────────────────────────────────────────
  // Divide el rango [min, max] en 12 bins y cuenta observaciones por bin
  const buildHistogram = (): HistoBin[] => {
    if (series.length === 0) return []
    const min = summary.min_val
    const max = summary.max_val
    if (min === max) return [{ bin: min.toLocaleString(), count: series.length, isOutlier: false }]
    const N_BINS = 12
    const binWidth = (max - min) / N_BINS
    const bins: HistoBin[] = Array.from({ length: N_BINS }, (_, i) => ({
      bin: (min + i * binWidth).toLocaleString("es-AR", { maximumFractionDigits: 0 }),
      count: 0,
      isOutlier: (min + i * binWidth) < outliers.winsor_lower ||
                 (min + (i + 1) * binWidth) > outliers.winsor_upper,
    }))
    for (const pt of series) {
      const idx = Math.min(Math.floor((pt.value - min) / binWidth), N_BINS - 1)
      if (idx >= 0) bins[idx].count++
    }
    return bins
  }
  const histData = buildHistogram()

  return (
    <Card variant="outlined" sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
            Serie temporal — detección de outliers
          </Typography>
          <Box sx={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {hasOutliers ? (
              <Chip
                label={`${outliers.n_outliers} outliers (${outliers.outlier_pct.toFixed(1)}%)`}
                size="small"
                sx={{ fontSize: "0.75rem", fontWeight: 600, bgcolor: "#fef2f2", color: "#ef4444", border: "1px solid #fecaca" }}
              />
            ) : (
              <Chip
                label="Sin outliers"
                size="small"
                sx={{ fontSize: "0.75rem", fontWeight: 600, bgcolor: "#ecfdf5", color: "#10b981", border: "1px solid #a7f3d0" }}
              />
            )}
            <Chip
              label={`Winsor: [${outliers.winsor_lower.toLocaleString()}, ${outliers.winsor_upper.toLocaleString()}]`}
              size="small"
              variant="outlined"
              sx={{ fontSize: "0.6875rem" }}
            />
          </Box>
        </Box>

        {/* Chips de gaps si los hay */}
        {hasGaps && (
          <Box sx={{ mb: "0.75rem" }}>
            <Chip
              label={`${summary.n_gaps} períodos faltantes (gaps)`}
              size="small"
              sx={{ fontSize: "0.75rem", fontWeight: 600, bgcolor: "#fff7ed", color: "#ea580c", border: "1px solid #fed7aa" }}
            />
          </Box>
        )}

        {/* Gráfico */}
        <Box sx={{ height: "16rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                // Mostrar solo el primer y último label para no saturar el eje
                tickFormatter={(v: string, i: number) =>
                  i === 0 || i === data.length - 1 ? v.slice(0, 7) : ""
                }
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={60}
              />
              <Tooltip
                contentStyle={{ fontSize: "0.8125rem", borderRadius: "0.5rem", border: "1px solid #e5e7eb" }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString(),
                  name === "value" ? summary.freq + " valor" : "⚠️ Outlier",
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }}
                formatter={(value: string) => (value === "value" ? "Serie" : "Outlier")}
              />

              {/* Línea principal de la serie */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 4 }}
              />

              {/* Scatter de outliers — puntos rojos */}
              <Scatter
                dataKey="outlier"
                fill="#ef4444"
                r={5}
                name="outlier"
              />

              {/* Líneas de winsorización */}
              <ReferenceLine
                y={outliers.winsor_lower}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "p5", position: "insideTopRight", fontSize: 10, fill: "#f59e0b" }}
              />
              <ReferenceLine
                y={outliers.winsor_upper}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{ value: "p95", position: "insideBottomRight", fontSize: 10, fill: "#f59e0b" }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>

        {/* Mini-histograma de distribución */}
        <Box sx={{ mt: "1.25rem" }}>
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", mb: "0.5rem" }}>
            Distribución de valores · {series.length} observaciones
            {(outliers.winsor_lower > summary.min_val || outliers.winsor_upper < summary.max_val) && (
              <Typography component="span" sx={{ fontSize: "0.6875rem", color: "#f59e0b", ml: "0.5rem" }}>
                — barras naranja fuera del rango winsorización
              </Typography>
            )}
          </Typography>
          <Box sx={{ height: "5.5rem" }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histData} margin={{ top: 2, right: 8, bottom: 0, left: 0 }} barCategoryGap="8%">
                <XAxis
                  dataKey="bin"
                  tick={{ fontSize: 9 }}
                  tickLine={false}
                  axisLine={false}
                  interval={2}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ fontSize: "0.75rem", borderRadius: "0.375rem", border: "1px solid #e5e7eb", padding: "0.25rem 0.5rem" }}
                  formatter={(v: number) => [`${v} obs`, "Frecuencia"]}
                  labelFormatter={(label: string) => `Desde ${label}`}
                />
                <Bar
                  dataKey="count"
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                >
                  {histData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.isOutlier ? "#f59e0b" : "#3b82f6"}
                      fillOpacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>

        {/* Leyenda explicativa */}
        <Box sx={{ display: "flex", gap: "1.5rem", mt: "0.75rem", flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box sx={{ width: "1.5rem", height: "0.125rem", bgcolor: "#3b82f6" }} />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Serie original</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box sx={{ width: "0.75rem", height: "0.75rem", borderRadius: "50%", bgcolor: "#ef4444" }} />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Outlier (MAD ≥ {outliers.mad_threshold})</Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box sx={{ width: "1.5rem", height: "0.125rem", bgcolor: "#f59e0b", borderTop: "2px dashed #f59e0b" }} />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>Límites winsorización p5/p95</Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
