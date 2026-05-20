"use client";

/**
 * WapeTrendChart — MLOps Phase 9
 * Line chart showing WAPE evolution across MLflow experiment runs.
 * Data comes from the already-loaded MlflowRun[] array — no extra fetch needed.
 *
 * Color bands:
 *   < 10%  → green reference line  (excellent)
 *   < 25%  → yellow reference line (acceptable)
 *   ≥ 25%  → red zone              (needs attention)
 */

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type MlflowRun } from "@/lib/types";

interface WapeTrendChartProps {
  runs: MlflowRun[];
}

interface ChartPoint {
  label: string;
  wape: number | null;
  model: string;
}

function formatRunLabel(run: MlflowRun): string {
  if (!run.start_time) return run.run_id.slice(0, 6);
  try {
    return new Date(run.start_time).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
    });
  } catch {
    return run.run_id.slice(0, 6);
  }
}

// Custom tooltip shown on hover
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint; value: number }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const { payload: point, value } = payload[0];
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "0.5rem",
        p: "0.75rem",
        fontSize: "0.8125rem",
      }}
    >
      <Typography variant="caption" color="text.secondary" display="block">
        {point.label}
      </Typography>
      <Typography variant="body2" fontWeight={600}>
        WAPE: {value != null ? `${value.toFixed(1)}%` : "—"}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        Modelo: {point.model || "—"}
      </Typography>
    </Box>
  );
}

export function WapeTrendChart({ runs }: WapeTrendChartProps) {
  // Sort runs chronologically and filter those with WAPE data
  const chartData = useMemo<ChartPoint[]>(() => {
    return [...runs]
      .filter((r) => r.wape !== null && r.wape !== undefined)
      .sort((a, b) => {
        const ta = a.start_time ? new Date(a.start_time).getTime() : 0;
        const tb = b.start_time ? new Date(b.start_time).getTime() : 0;
        return ta - tb;
      })
      .map((r) => ({
        label: formatRunLabel(r),
        wape: r.wape !== null ? r.wape * 100 : null, // stored as 0–1, display as %
        model: r.model,
      }));
  }, [runs]);

  if (chartData.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          minHeight: "12rem",
          color: "text.disabled",
        }}
      >
        <Typography variant="body2">
          Sin datos de WAPE registrados aún. Ejecutá un forecast para ver la evolución.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ width: "100%", height: "100%", minHeight: "12rem" }}>
      <ResponsiveContainer width="100%" height="100%" minHeight={192}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--mui-palette-divider)" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--mui-palette-text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />

          <YAxis
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            tick={{ fontSize: 11, fill: "var(--mui-palette-text-secondary)" }}
            tickLine={false}
            axisLine={false}
            width={40}
          />

          {/* Reference lines for WAPE quality thresholds */}
          <ReferenceLine
            y={10}
            stroke="var(--mui-palette-success-main)"
            strokeDasharray="4 4"
            label={{ value: "10% (excelente)", position: "insideTopRight", fontSize: 10 }}
          />
          <ReferenceLine
            y={25}
            stroke="var(--mui-palette-warning-main)"
            strokeDasharray="4 4"
            label={{ value: "25% (límite)", position: "insideTopRight", fontSize: 10 }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="wape"
            name="WAPE %"
            stroke="var(--mui-palette-primary-main)"
            strokeWidth={2}
            dot={{ r: 4, fill: "var(--mui-palette-primary-main)" }}
            activeDot={{ r: 6 }}
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </Box>
  );
}
