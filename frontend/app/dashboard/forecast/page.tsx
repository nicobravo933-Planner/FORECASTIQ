"use client"

/**
 * Forecast page — Phase 2.
 * Flow: configure → run → polling progress → chart + metrics
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import LinearProgress from "@mui/material/LinearProgress"
import Paper from "@mui/material/Paper"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Skeleton from "@mui/material/Skeleton"
import Switch from "@mui/material/Switch"
import FormControlLabel from "@mui/material/FormControlLabel"
import Chip from "@mui/material/Chip"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import EventIcon from "@mui/icons-material/Event"
import { useForecast } from "@/hooks/useForecast"
import { HorizonSelector } from "@/components/forecast/HorizonSelector"
import { ForecastChart } from "@/components/forecast/ForecastChart"
import { MetricsCard } from "@/components/forecast/MetricsCard"
import type { DataFreq, ModelName, PredictionPoint } from "@/lib/types"
import { api } from "@/lib/api"

const MODEL_OPTIONS: { value: ModelName | "auto"; label: string }[] = [
  { value: "auto",          label: "Auto-detectar (recomendado)" },
  { value: "moving_average", label: "Promedio Móvil" },
  { value: "holt_winters",   label: "Holt-Winters" },
  { value: "sarima",         label: "SARIMA" },
  { value: "lightgbm",       label: "LightGBM" },
]

const FREQ_OPTIONS: { value: DataFreq; label: string }[] = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
  { value: "Q", label: "Trimestral" },
]

const MODEL_LABELS: Record<ModelName, string> = {
  moving_average: "Promedio Móvil",
  holt_winters:   "Holt-Winters",
  sarima:         "SARIMA",
  lightgbm:       "LightGBM",
}

export default function ForecastPage() {
  const forecast = useForecast()

  // Form state
  const [datasetId,    setDatasetId]    = useState("")
  const [dateCol,      setDateCol]      = useState("")
  const [targetCol,    setTargetCol]    = useState("")
  const [freq,         setFreq]         = useState<DataFreq>("M")
  const [horizon,      setHorizon]      = useState(12)
  const [modelOverride, setModelOverride] = useState<ModelName | "auto">("auto")

  // Events toggle state
  const [eventsOn, setEventsOn]       = useState(false)
  const [compareData, setCompareData] = useState<PredictionPoint[] | null>(null)
  const [eventsCount, setEventsCount] = useState(0)
  const [loadingCompare, setLoadingCompare] = useState(false)

  const handleEventsToggle = async (checked: boolean) => {
    setEventsOn(checked)
    if (!checked || !forecast.result) return
    if (compareData) return // already fetched
    setLoadingCompare(true)
    try {
      const res = await api.get<{
        predictions: { date: string; baseline: number; with_events: number; lower: number; upper: number }[]
        events_applied: number
      }>(`/api/forecast/${forecast.result.job_id}/compare`)
      setEventsCount(res.events_applied)
      // Map compare points to PredictionPoint shape (using with_events as predicted)
      setCompareData(
        res.predictions.map((p) => ({
          date:      p.date,
          predicted: p.with_events,
          lower:     p.lower,
          upper:     p.upper,
        }))
      )
    } catch {
      setEventsOn(false)
    } finally {
      setLoadingCompare(false)
    }
  }

  const isRunning = forecast.stage === "submitting" || forecast.stage === "polling"
  const canRun    = datasetId.trim() && dateCol.trim() && targetCol.trim() && !isRunning

  const handleRun = () => {
    forecast.runForecast({
      dataset_id:     datasetId.trim(),
      date_column:    dateCol.trim(),
      target_column:  targetCol.trim(),
      freq,
      horizon,
      model_override: modelOverride === "auto" ? null : modelOverride,
    })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" color="text.primary" fontWeight={700}>
            Forecast
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
            Configurá los parámetros y generá una proyección con intervalos de confianza.
          </Typography>
        </Box>
        {forecast.stage !== "idle" && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={forecast.reset}
            color="inherit"
            disabled={isRunning}
          >
            Resetear
          </Button>
        )}
      </Box>

      {/* Config panel */}
      {(forecast.stage === "idle" || forecast.stage === "failed") && (
        <Paper variant="outlined" sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
            Parámetros del forecast
          </Typography>

          {/* Dataset ID + columns */}
          <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <TextField
              label="Dataset ID"
              size="small"
              value={datasetId}
              onChange={(e) => setDatasetId(e.target.value)}
              placeholder="UUID del dataset subido"
              sx={{ flex: "1 1 14rem" }}
              helperText="Copialo desde la página Dataset"
            />
            <TextField
              label="Columna fecha"
              size="small"
              value={dateCol}
              onChange={(e) => setDateCol(e.target.value)}
              placeholder="ej. fecha"
              sx={{ flex: "1 1 8rem" }}
            />
            <TextField
              label="Columna objetivo"
              size="small"
              value={targetCol}
              onChange={(e) => setTargetCol(e.target.value)}
              placeholder="ej. ventas_unidades"
              sx={{ flex: "1 1 10rem" }}
            />
          </Box>

          {/* Freq + model */}
          <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <TextField
              select
              label="Frecuencia"
              size="small"
              value={freq}
              onChange={(e) => setFreq(e.target.value as DataFreq)}
              sx={{ width: "10rem" }}
            >
              {FREQ_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Modelo"
              size="small"
              value={modelOverride}
              onChange={(e) => setModelOverride(e.target.value as ModelName | "auto")}
              sx={{ width: "16rem" }}
            >
              {MODEL_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Horizon */}
          <HorizonSelector value={horizon} onChange={setHorizon} />

          {/* Run button */}
          <Box>
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={handleRun}
              disabled={!canRun}
              sx={{ px: "1.5rem" }}
            >
              Generar forecast
            </Button>
          </Box>
        </Paper>
      )}

      {/* Error */}
      {forecast.stage === "failed" && forecast.error && (
        <Alert severity="error">{forecast.error}</Alert>
      )}

      {/* Progress bar while running */}
      {isRunning && (
        <Paper variant="outlined" sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between" }}>
            <Typography variant="body2" color="text.secondary">
              {forecast.step || "Procesando..."}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {forecast.progressPct}%
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={forecast.progressPct}
            sx={{ borderRadius: "0.25rem", height: "0.5rem" }}
          />
        </Paper>
      )}

      {/* Skeleton while polling result */}
      {forecast.stage === "polling" && forecast.progressPct >= 95 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Skeleton variant="rounded" height={320} />
          <Skeleton variant="rounded" height={80} />
        </Box>
      )}

      {/* Results */}
      {forecast.stage === "done" && forecast.result && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Events toggle */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
            <FormControlLabel
              control={
                <Switch
                  checked={eventsOn}
                  onChange={(e) => handleEventsToggle(e.target.checked)}
                  disabled={loadingCompare}
                />
              }
              label={
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <EventIcon fontSize="small" sx={{ color: "text.secondary" }} />
                  <Typography variant="body2">Ver con eventos</Typography>
                  {eventsOn && eventsCount > 0 && (
                    <Chip label={`${eventsCount} evento${eventsCount > 1 ? "s" : ""} activo${eventsCount > 1 ? "s" : ""}`} size="small" color="primary" />
                  )}
                  {eventsOn && eventsCount === 0 && (
                    <Chip label="Sin eventos con impacto" size="small" variant="outlined" />
                  )}
                </Box>
              }
            />
          </Box>

          <ForecastChart
            historical={forecast.result.historical}
            predictions={eventsOn && compareData ? compareData : forecast.result.predictions}
            modelName={MODEL_LABELS[forecast.result.model_used]}
          />
          <MetricsCard
            metrics={forecast.result.metrics}
            modelUsed={forecast.result.model_used}
          />
        </Box>
      )}
    </Box>
  )
}
