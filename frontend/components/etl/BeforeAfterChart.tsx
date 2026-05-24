"use client"

/**
 * BeforeAfterChart — Recharts with two overlapping lines:
 *   - blue dashed  = original series
 *   - green solid  = cleaned series
 *
 * Winsorized points are highlighted as orange dots.
 * Imputed points are highlighted as purple dots.
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
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import type { EtlPoint } from "@/hooks/useEtl"

interface BeforeAfterChartProps {
  series: EtlPoint[]
  mode: "winsorize" | "fill-gaps"
  nChanged: number   // n_winsorized or n_imputed
  title?: string
}

interface ChartRow {
  date: string
  original: number | null
  cleaned: number | null
  // Highlight markers — only defined on the changed point
  winsorizedDot?: number
  imputedDot?: number
}

export function BeforeAfterChart({ series, mode, nChanged, title }: BeforeAfterChartProps) {
  const data: ChartRow[] = series.map((pt) => ({
    date: pt.date,
    original: pt.original ?? null,
    cleaned: pt.cleaned ?? null,
    winsorizedDot: pt.winsorized ? (pt.cleaned ?? undefined) : undefined,
    imputedDot: pt.imputed ? (pt.cleaned ?? undefined) : undefined,
  }))

  const modeLabel = mode === "winsorize" ? "winsorización" : "imputación de gaps"
  const chipColor = nChanged === 0 ? "#ecfdf5" : mode === "winsorize" ? "#fff7ed" : "#f5f3ff"
  const chipTextColor = nChanged === 0 ? "#10b981" : mode === "winsorize" ? "#ea580c" : "#7c3aed"
  const chipBorder = nChanged === 0 ? "#a7f3d0" : mode === "winsorize" ? "#fed7aa" : "#ddd6fe"

  const dotColor = mode === "winsorize" ? "#ea580c" : "#7c3aed"
  const dotKey = mode === "winsorize" ? "winsorizedDot" : "imputedDot"
  const dotLabel = mode === "winsorize" ? "Winsorizado" : "Imputado"

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}
    >
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: "1rem",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
            {title ?? `Resultado — ${modeLabel}`}
          </Typography>
          <Chip
            label={
              nChanged === 0
                ? `Sin cambios por ${modeLabel}`
                : `${nChanged} punto${nChanged !== 1 ? "s" : ""} modificado${nChanged !== 1 ? "s" : ""}`
            }
            size="small"
            sx={{
              fontSize: "0.75rem",
              fontWeight: 600,
              bgcolor: chipColor,
              color: chipTextColor,
              border: `1px solid ${chipBorder}`,
            }}
          />
        </Box>

        {/* Chart */}
        <Box sx={{ height: "17rem" }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.07)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string, i: number) =>
                  i === 0 || i === data.length - 1 ? v.slice(0, 7) : ""
                }
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => v.toLocaleString()}
                width={62}
              />
              <Tooltip
                contentStyle={{
                  fontSize: "0.8125rem",
                  borderRadius: "0.5rem",
                  border: "1px solid #e5e7eb",
                }}
                formatter={(value: number, name: string) => [
                  value?.toLocaleString() ?? "—",
                  name === "original"
                    ? "Original"
                    : name === "cleaned"
                    ? "Limpio"
                    : dotLabel,
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }}
                formatter={(v: string) =>
                  v === "original" ? "Serie original" : v === "cleaned" ? "Serie limpia" : dotLabel
                }
              />

              {/* Original — blue dashed */}
              <Line
                type="monotone"
                dataKey="original"
                stroke="#93c5fd"
                strokeWidth={1.5}
                strokeDasharray="5 3"
                dot={false}
                activeDot={{ r: 3 }}
                connectNulls
              />

              {/* Cleaned — green solid */}
              <Line
                type="monotone"
                dataKey="cleaned"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />

              {/* Highlight dots for changed points */}
              <Scatter dataKey={dotKey} fill={dotColor} r={5} name={dotKey} />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>

        {/* Legend explanation */}
        <Box sx={{ display: "flex", gap: "1.5rem", mt: "0.75rem", flexWrap: "wrap" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box
              sx={{
                width: "1.5rem",
                height: "0.125rem",
                bgcolor: "#93c5fd",
                borderTop: "2px dashed #93c5fd",
              }}
            />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              Serie original
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box sx={{ width: "1.5rem", height: "0.125rem", bgcolor: "#22c55e" }} />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              Serie limpia
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <Box
              sx={{
                width: "0.75rem",
                height: "0.75rem",
                borderRadius: "50%",
                bgcolor: dotColor,
              }}
            />
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
              {dotLabel}
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
