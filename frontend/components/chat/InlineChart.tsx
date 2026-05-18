"use client"

/**
 * InlineChart — renders a Recharts chart from a JSON spec embedded in LLM response.
 *
 * Supported chart types: "bar" | "line" | "area"
 *
 * Expected spec shape (emitted by LLM inside ```json chart-spec blocks):
 * {
 *   "type": "bar" | "line" | "area",
 *   "title": "Optional title",
 *   "xKey": "name",          // defaults to "name"
 *   "yKey": "value",         // defaults to "value"
 *   "data": [{ "name": "Jan", "value": 120 }, ...]
 * }
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export interface ChartSpec {
  type: "bar" | "line" | "area"
  title?: string
  xKey?: string
  yKey?: string
  data: Record<string, unknown>[]
}

interface InlineChartProps {
  spec: ChartSpec
}

const CHART_COLOR = "#6366f1" // primary.main — consistent with theme

export function InlineChart({ spec }: InlineChartProps) {
  const { type, title, data, xKey = "name", yKey = "value" } = spec

  if (!data || data.length === 0) {
    return (
      <Typography variant="caption" color="text.disabled">
        (empty chart data)
      </Typography>
    )
  }

  const commonProps = {
    data,
    margin: { top: 4, right: 8, left: 0, bottom: 4 },
  }

  const axisStyle = { fontSize: "0.6875rem" }

  const chartContent =
    type === "bar" ? (
      <BarChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} width={40} />
        <Tooltip contentStyle={{ fontSize: "0.75rem" }} />
        <Bar dataKey={yKey} fill={CHART_COLOR} radius={[3, 3, 0, 0]} />
      </BarChart>
    ) : type === "area" ? (
      <AreaChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} width={40} />
        <Tooltip contentStyle={{ fontSize: "0.75rem" }} />
        <Area type="monotone" dataKey={yKey} stroke={CHART_COLOR} fill={`${CHART_COLOR}33`} />
      </AreaChart>
    ) : (
      // default: line
      <LineChart {...commonProps}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
        <XAxis dataKey={xKey} tick={axisStyle} />
        <YAxis tick={axisStyle} width={40} />
        <Tooltip contentStyle={{ fontSize: "0.75rem" }} />
        <Line type="monotone" dataKey={yKey} stroke={CHART_COLOR} dot={false} strokeWidth={2} />
      </LineChart>
    )

  return (
    <Box
      sx={{
        bgcolor: "background.default",
        borderRadius: "0.5rem",
        border: "1px solid",
        borderColor: "divider",
        p: "0.75rem",
        my: "0.5rem",
      }}
    >
      {title && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: "block", mb: "0.5rem", fontSize: "0.75rem", fontWeight: 600 }}
        >
          {title}
        </Typography>
      )}
      <ResponsiveContainer width="100%" height={180}>
        {chartContent}
      </ResponsiveContainer>
    </Box>
  )
}

/**
 * parseChartSpec — extrae un ChartSpec de un bloque ```json chart-spec ... ```.
 * Retorna null si el bloque no es un chart spec válido.
 */
export function parseChartSpec(block: string): ChartSpec | null {
  try {
    const parsed = JSON.parse(block.trim())
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray(parsed.data) &&
      ["bar", "line", "area"].includes(parsed.type)
    ) {
      return parsed as ChartSpec
    }
    return null
  } catch {
    return null
  }
}
