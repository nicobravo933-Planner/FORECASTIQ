"use client"

/**
 * ForecastChart — interactive composite chart (Paso 1 + Paso 6).
 *
 * Features:
 *  - Three colored zones: Train (blue tint) | Test (amber tint) | Future (violet tint)
 *  - Confidence interval band (area)
 *  - Brush scrubber for pan/zoom along time axis
 *  - Quick-zoom buttons: All | Last 24 | Last 12 | Forecast only
 *  - Full-width layout (used when forecast result is present)
 *  - Tall chart (540px) for readability on dense series
 *  - VIZ-1a: multi-model overlay from benchmark (dashed lines, checkbox toggle)
 *  - VIZ-1a: entry animations on main lines
 *
 * Props:
 *  historical           — all historical points (train + optional test_actual)
 *  predictions          — future forecast points
 *  modelName            — display label shown in header
 *  testActual?          — actual values in the hold-out test window (optional)
 *  testPredicted?       — model predictions over the hold-out window (optional)
 *  trainEndDate?        — last date of training data (draws zone boundaries)
 *  testStartDate?       — first date of test window (optional)
 *  allModelPredictions? — VIZ-1a: benchmark predictions per model for overlay
 */

import { useState, useMemo } from "react"
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
  ReferenceArea,
  Brush,
  ResponsiveContainer,
} from "recharts"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Chip from "@mui/material/Chip"
import MuiTooltip from "@mui/material/Tooltip"
import FormControlLabel from "@mui/material/FormControlLabel"
import Checkbox from "@mui/material/Checkbox"
import Divider from "@mui/material/Divider"
import { useTheme, alpha } from "@mui/material/styles"
import ZoomInIcon from "@mui/icons-material/ZoomIn"
import LayersIcon from "@mui/icons-material/Layers"
import type { HistoricalPoint, PredictionPoint } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChartPoint {
  date: string
  historical?: number
  testActual?: number
  testPredicted?: number
  predicted?: number
  ci?: [number, number]
  // VIZ-1a: overlay model predictions (dynamic keys: overlay_<modelId>)
  [key: string]: unknown
}

export interface ForecastChartProps {
  historical:           HistoricalPoint[]
  predictions:          PredictionPoint[]
  modelName:            string
  // Optional: filled in by Paso 2 (hold-out)
  testActual?:          HistoricalPoint[]
  testPredicted?:       PredictionPoint[]
  trainEndDate?:        string | null
  testStartDate?:       string | null
  // VIZ-1a: benchmark predictions per model for overlay
  allModelPredictions?: Record<string, PredictionPoint[]>
}

type ZoomPreset = "all" | "last24" | "last12" | "forecast"

// VIZ-1a: color palette per model
const MODEL_OVERLAY_COLORS: Record<string, string> = {
  moving_average: "#f97316", // naranja
  holt_winters:   "#22c55e", // verde
  sarima:         "#a855f7", // púrpura
  lightgbm:       "#ef4444", // rojo
  seasonal_naive: "#94a3b8", // gris
}

// ── Formatters ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-AR", { month: "short", year: "2-digit" })
}

function formatDateFull(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" })
}

function formatValue(val: unknown): string {
  const n = typeof val === "number" ? val : Array.isArray(val) ? val[0] : NaN
  if (!isFinite(n)) return ""
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return n.toFixed(1)
}

// ── Zone legend chips ─────────────────────────────────────────────────────────

function ZoneLegend({ hasTest }: { hasTest: boolean }) {
  return (
    <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
      <Chip
        size="small"
        label="Entrenamiento"
        sx={{ height: "1.375rem", fontSize: "0.6875rem", bgcolor: "rgba(99,102,241,0.10)", color: "primary.main", border: "1px solid", borderColor: "rgba(99,102,241,0.25)" }}
      />
      {hasTest && (
        <Chip
          size="small"
          label="Test (hold-out)"
          sx={{ height: "1.375rem", fontSize: "0.6875rem", bgcolor: "rgba(245,158,11,0.10)", color: "warning.main", border: "1px solid", borderColor: "rgba(245,158,11,0.3)" }}
        />
      )}
      <Chip
        size="small"
        label="Proyección"
        sx={{ height: "1.375rem", fontSize: "0.6875rem", bgcolor: "rgba(6,182,212,0.10)", color: "secondary.main", border: "1px solid", borderColor: "rgba(6,182,212,0.25)" }}
      />
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ForecastChart({
  historical,
  predictions,
  modelName,
  testActual          = [],
  testPredicted       = [],
  trainEndDate        = null,
  testStartDate       = null,
  allModelPredictions = {},
}: ForecastChartProps) {
  const theme = useTheme()
  const [zoomPreset, setZoomPreset] = useState<ZoomPreset>("all")

  // VIZ-1a: which overlay models are active (controlled by checkboxes)
  const overlayModelIds = Object.keys(allModelPredictions)
  const [activeModels, setActiveModels] = useState<Set<string>>(
    () => new Set(overlayModelIds)
  )

  const toggleModel = (id: string) =>
    setActiveModels((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const hasTest = testActual.length > 0

  // ── Build unified data array ───────────────────────────────────────────────

  const allData = useMemo<ChartPoint[]>(() => {
    const trainPoints: ChartPoint[] = historical.map((p) => ({
      date: p.date,
      historical: p.value,
    }))

    // Map test actual + predicted (hold-out window)
    const testActualMap = new Map(testActual.map((p) => [p.date, p.value]))
    const testPredMap   = new Map(testPredicted.map((p) => [p.date, p.predicted]))

    const existingDates = new Set(trainPoints.map((p) => p.date))
    const testDates = new Set([...testActualMap.keys(), ...testPredMap.keys()])
    testDates.forEach((date) => {
      if (existingDates.has(date)) {
        const pt = trainPoints.find((p) => p.date === date)
        if (pt) {
          pt.testActual    = testActualMap.get(date)
          pt.testPredicted = testPredMap.get(date)
        }
      } else {
        trainPoints.push({
          date,
          testActual:    testActualMap.get(date),
          testPredicted: testPredMap.get(date),
        })
      }
    })

    trainPoints.sort((a, b) => a.date.localeCompare(b.date))

    const futurePoints: ChartPoint[] = predictions.map((p) => ({
      date:      p.date,
      predicted: p.predicted,
      ci:        [p.lower, p.upper],
    }))

    // VIZ-1a: inject overlay model predictions into future points
    for (const [modelId, preds] of Object.entries(allModelPredictions)) {
      const key = `overlay_${modelId}`
      const predMap = new Map(preds.map((p) => [p.date, p.predicted]))
      futurePoints.forEach((pt) => {
        const v = predMap.get(pt.date)
        if (v !== undefined) pt[key] = v
      })
    }

    // Overlap first future point onto last existing for visual continuity
    const lastExisting = trainPoints[trainPoints.length - 1]
    if (lastExisting && futurePoints.length > 0) {
      futurePoints[0] = {
        ...futurePoints[0],
        historical: lastExisting.historical ?? lastExisting.testActual,
      }
    }

    return [...trainPoints, ...futurePoints]
  }, [historical, predictions, testActual, testPredicted, allModelPredictions])

  // ── Zoom: compute brush start/end indices ─────────────────────────────────

  const { brushStart, brushEnd } = useMemo(() => {
    const n = allData.length
    if (n === 0) return { brushStart: 0, brushEnd: 0 }

    const forecastStartIdx = allData.findIndex(
      (p) => p.predicted !== undefined && p.historical === undefined && p.testActual === undefined
    )

    switch (zoomPreset) {
      case "forecast":
        return { brushStart: Math.max(0, (forecastStartIdx > 0 ? forecastStartIdx : n) - 6), brushEnd: n - 1 }
      case "last12":
        return { brushStart: Math.max(0, n - 12 - predictions.length), brushEnd: n - 1 }
      case "last24":
        return { brushStart: Math.max(0, n - 24 - predictions.length), brushEnd: n - 1 }
      default:
        return { brushStart: 0, brushEnd: n - 1 }
    }
  }, [zoomPreset, allData, predictions.length])

  // ── Zone boundary dates ────────────────────────────────────────────────────

  const zoneTrainEnd    = trainEndDate  ?? (testStartDate ? null : predictions[0]?.date ?? null)
  const zoneTestStart   = testStartDate ?? null
  const zoneTestEnd     = hasTest ? (predictions[0]?.date ?? allData[allData.length - 1]?.date ?? null) : null
  const zoneFutureStart = predictions[0]?.date ?? null

  const visibleCount = brushEnd - brushStart + 1
  const tickInterval = Math.max(1, Math.floor(visibleCount / 10))

  const firstDate = allData[0]?.date
  const lastDate  = allData[allData.length - 1]?.date
  const rangeLabel = firstDate && lastDate
    ? `${formatDateFull(firstDate)} → ${formatDateFull(lastDate)}`
    : ""

  return (
    <Paper
      variant="outlined"
      sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
            <Typography variant="subtitle1" color="text.primary" fontWeight={700}>
              Serie histórica + proyección
            </Typography>
            <Chip
              label={modelName}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ height: "1.375rem", fontSize: "0.6875rem", fontWeight: 600 }}
            />
          </Box>
          {rangeLabel && (
            <Typography variant="caption" color="text.disabled">
              {rangeLabel} · {allData.length} períodos totales
            </Typography>
          )}
        </Box>

        {/* Quick-zoom buttons */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
          <ZoomInIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
          <ToggleButtonGroup
            value={zoomPreset}
            exclusive
            onChange={(_, v) => { if (v) setZoomPreset(v as ZoomPreset) }}
            size="small"
            sx={{
              "& .MuiToggleButton-root": {
                px: "0.625rem",
                py: "0.125rem",
                fontSize: "0.6875rem",
                textTransform: "none",
                minWidth: "auto",
              },
            }}
          >
            <ToggleButton value="all">Todo</ToggleButton>
            <ToggleButton value="last24">Últ. 24</ToggleButton>
            <ToggleButton value="last12">Últ. 12</ToggleButton>
            <ToggleButton value="forecast">Solo forecast</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* Zone legend */}
      <ZoneLegend hasTest={hasTest} />

      {/* VIZ-1a: model overlay checkboxes — only visible after benchmark ran */}
      {overlayModelIds.length > 0 && (
        <Box sx={{
          display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap",
          p: "0.375rem 0.75rem", bgcolor: "action.hover",
          borderRadius: "0.375rem", border: "1px solid", borderColor: "divider",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <LayersIcon sx={{ fontSize: "0.875rem", color: "text.secondary" }} />
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              Overlay modelos
            </Typography>
          </Box>
          <Divider orientation="vertical" flexItem />
          {overlayModelIds.map((modelId) => {
            const color = MODEL_OVERLAY_COLORS[modelId] ?? "#64748b"
            const lbl = modelId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            return (
              <MuiTooltip key={modelId} title={`${lbl} — predicción del benchmark`} placement="top">
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={activeModels.has(modelId)}
                      onChange={() => toggleModel(modelId)}
                      size="small"
                      sx={{ color, "&.Mui-checked": { color }, p: "0.125rem" }}
                    />
                  }
                  label={
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Box sx={{
                        width: "1.25rem",
                        height: 0,
                        borderTop: `2px dashed ${color}`,
                        opacity: activeModels.has(modelId) ? 1 : 0.3,
                      }} />
                      <Typography
                        variant="caption"
                        sx={{ fontSize: "0.6875rem", color: activeModels.has(modelId) ? "text.primary" : "text.disabled" }}
                      >
                        {lbl}
                      </Typography>
                    </Box>
                  }
                  sx={{ ml: 0, mr: 0 }}
                />
              </MuiTooltip>
            )
          })}
        </Box>
      )}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={540}>
        <ComposedChart data={allData} margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>

          {/* Background zone — Train */}
          {zoneTrainEnd && allData[0] && (
            <ReferenceArea
              x1={allData[0].date}
              x2={zoneTrainEnd}
              fill={alpha(theme.palette.primary.main, 0.04)}
              ifOverflow="extendDomain"
            />
          )}

          {/* Background zone — Test (hold-out) */}
          {hasTest && zoneTestStart && zoneTestEnd && (
            <ReferenceArea
              x1={zoneTestStart}
              x2={zoneTestEnd}
              fill={alpha(theme.palette.warning.main, 0.07)}
              ifOverflow="extendDomain"
            />
          )}

          {/* Background zone — Future forecast */}
          {zoneFutureStart && allData[allData.length - 1] && (
            <ReferenceArea
              x1={zoneFutureStart}
              x2={allData[allData.length - 1].date}
              fill={alpha(theme.palette.secondary.main, 0.06)}
              ifOverflow="extendDomain"
            />
          )}

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
            tickFormatter={(value: number) => {
              if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
              if (value >= 1_000)     return `${(value / 1_000).toFixed(0)}K`
              return String(value)
            }}
            tick={{ fontSize: 11, fill: theme.palette.text.secondary }}
            tickLine={false}
            axisLine={false}
            width={52}
          />

          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: "0.5rem",
              fontSize: "0.8125rem",
              boxShadow: theme.shadows[4],
            }}
            labelFormatter={(label) => `📅 ${formatDateFull(String(label))}`}
            formatter={(value: unknown, name: string) => {
              if (name === "ci") return [null, null]
              // Strip overlay_ prefix for tooltip labels
              if (name.startsWith("overlay_")) {
                const mid = name.replace("overlay_", "")
                const lbl = mid.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                return [formatValue(value), lbl]
              }
              const labels: Record<string, string> = {
                historical:    "Histórico",
                testActual:    "Real (test)",
                testPredicted: "Pred. test",
                predicted:     "Proyección",
              }
              return [formatValue(value), labels[name] ?? name]
            }}
          />

          <Legend
            wrapperStyle={{ fontSize: "0.8125rem", paddingTop: "0.5rem" }}
            formatter={(value) => {
              if (value.startsWith("overlay_")) return null  // overlay managed by checkboxes
              const labels: Record<string, string> = {
                historical:    "Histórico",
                testActual:    "Real (test)",
                testPredicted: "Predicho (test)",
                predicted:     "Proyección",
                ci:            "IC 95%",
              }
              return labels[value] ?? value
            }}
          />

          {/* Vertical line: train → test boundary */}
          {zoneTestStart && (
            <ReferenceLine
              x={zoneTestStart}
              stroke={alpha(theme.palette.warning.main, 0.6)}
              strokeDasharray="5 3"
              strokeWidth={1.5}
              label={{ value: "Test", position: "insideTopLeft", fontSize: 10, fill: theme.palette.warning.main }}
            />
          )}

          {/* Vertical line: test → future boundary */}
          {zoneFutureStart && (
            <ReferenceLine
              x={zoneFutureStart}
              stroke={alpha(theme.palette.secondary.main, 0.7)}
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: "Forecast →", position: "insideTopRight", fontSize: 10, fill: theme.palette.secondary.main }}
            />
          )}

          {/* Confidence interval band */}
          <Area
            type="monotone"
            dataKey="ci"
            fill={theme.palette.secondary.main}
            stroke="none"
            fillOpacity={0.18}
            name="ci"
            legendType="rect"
            connectNulls
          />

          {/* Historical (train) line */}
          <Line
            type="monotone"
            dataKey="historical"
            stroke={theme.palette.primary.main}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
            name="historical"
            connectNulls
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />

          {/* Test actual — solid amber */}
          {hasTest && (
            <Line
              type="monotone"
              dataKey="testActual"
              stroke={theme.palette.warning.main}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
              name="testActual"
              connectNulls
            />
          )}

          {/* Test predicted — dashed amber */}
          {hasTest && (
            <Line
              type="monotone"
              dataKey="testPredicted"
              stroke={theme.palette.warning.main}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              name="testPredicted"
              connectNulls
            />
          )}

          {/* Future forecast line */}
          <Line
            type="monotone"
            dataKey="predicted"
            stroke={theme.palette.secondary.main}
            strokeWidth={2.5}
            strokeDasharray="7 3"
            dot={false}
            activeDot={{ r: 5, strokeWidth: 0 }}
            name="predicted"
            connectNulls
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />

          {/* VIZ-1a: overlay lines from benchmark — one per active model */}
          {overlayModelIds.map((modelId) => {
            if (!activeModels.has(modelId)) return null
            const color = MODEL_OVERLAY_COLORS[modelId] ?? "#64748b"
            const lbl = modelId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
            return (
              <Line
                key={modelId}
                type="monotone"
                dataKey={`overlay_${modelId}`}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
                name={`overlay_${modelId}`}
                connectNulls
                isAnimationActive={true}
                animationDuration={800}
                animationEasing="ease-out"
                legendType="none"
              />
            )
          })}

          {/* Brush scrubber — pan + zoom via drag */}
          <Brush
            dataKey="date"
            startIndex={brushStart}
            endIndex={brushEnd}
            height={24}
            tickFormatter={formatDate}
            stroke={theme.palette.divider}
            fill={alpha(theme.palette.background.default, 0.9)}
            travellerWidth={8}
            gap={2}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Footer hint */}
      <Typography variant="caption" color="text.disabled" sx={{ textAlign: "right" }}>
        Arrastrá el scrubber inferior para hacer zoom · Usá los botones para vistas rápidas
      </Typography>
    </Paper>
  )
}
