"use client"

/**
 * Forecast page — UX-3.
 *
 * Layout:
 *   Desktop (md+): 2 columns — config panel (left) | chart + metrics (right)
 *   Mobile (xs–sm): stacked
 *
 * Column selectors are driven by real preview data from the backend.
 * Config state is managed locally and persisted to appStore on run.
 */

import { useEffect, useRef, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import LinearProgress from "@mui/material/LinearProgress"
import Paper from "@mui/material/Paper"
import Switch from "@mui/material/Switch"
import FormControlLabel from "@mui/material/FormControlLabel"
import Chip from "@mui/material/Chip"
import Skeleton from "@mui/material/Skeleton"
import Divider from "@mui/material/Divider"
import Tooltip from "@mui/material/Tooltip"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import EventIcon from "@mui/icons-material/Event"
import TuneIcon from "@mui/icons-material/Tune"
import PsychologyIcon from "@mui/icons-material/Psychology"
import { useForecast } from "@/hooks/useForecast"
import { appStore } from "@/lib/appStore"
import { ForecastConfigPanel, type ForecastConfig } from "@/components/forecast/ForecastConfigPanel"
import { ForecastChart } from "@/components/forecast/ForecastChart"
import { MetricsCard } from "@/components/forecast/MetricsCard"
import type { DataFreq, ModelName, PredictionPoint } from "@/lib/types"
import { api } from "@/lib/api"

const MODEL_LABELS: Record<ModelName, string> = {
  moving_average: "Promedio Móvil",
  holt_winters:   "Holt-Winters",
  sarima:         "SARIMA",
  lightgbm:       "LightGBM",
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const forecast = useForecast()

  // Consolidated config state — driven by ForecastConfigPanel
  const [config, setConfig] = useState<ForecastConfig>({
    datasetId:     appStore.getActiveDatasetId()    ?? "",
    dateCol:       appStore.getActiveDateCol()       ?? "",
    targetCol:     appStore.getActiveTargetCol()     ?? "",
    freq:          (appStore.getActiveFreq() as DataFreq) ?? "M",
    horizon:       12,
    modelOverride: "auto",
  })

  const [forceReoptimize, setForceReoptimize] = useState(false)
  const [hpoCache, setHpoCache] = useState<{ wape: number | null; optimized_at: string | null } | null>(null)

  // Pre-select cached model if we already ran forecast for this dataset
  useEffect(() => {
    if (!config.datasetId) return
    const cached = appStore.getDetectedModel(config.datasetId)
    if (cached && config.modelOverride === "auto") {
      patchConfig({ modelOverride: cached as typeof config.modelOverride })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.datasetId])

  const patchConfig = (patch: Partial<ForecastConfig>) =>
    setConfig((prev) => ({ ...prev, ...patch }))

  // Persist job_id to appStore for Chat context
  // Also cache the detected model to avoid re-running detection on next visit
  const jobPersisted = useRef(false)
  useEffect(() => {
    if (forecast.stage === "done" && forecast.jobId && !jobPersisted.current) {
      appStore.setActiveJobId(forecast.jobId)
      if (forecast.result?.model_used && config.datasetId) {
        appStore.setDetectedModel(config.datasetId, forecast.result.model_used)
      }
      jobPersisted.current = true
    }
    if (forecast.stage === "idle") jobPersisted.current = false
  }, [forecast.stage, forecast.jobId, forecast.result, config.datasetId])

  // Consultar cache HPO cuando el modelo es lightgbm y hay dataset
  useEffect(() => {
    const isLgbm = config.modelOverride === "lightgbm" || config.modelOverride === "auto"
    if (!config.datasetId || !isLgbm) { setHpoCache(null); return }
    api.get<{ has_cache: boolean; wape: number | null; optimized_at: string | null }>(
      `/api/forecast/hpo-cache/${config.datasetId}?freq=${config.freq}`
    ).then((res) => {
      setHpoCache(res.has_cache ? { wape: res.wape, optimized_at: res.optimized_at } : null)
    }).catch(() => setHpoCache(null))
  }, [config.datasetId, config.freq, config.modelOverride])

  // Events overlay
  const [eventsOn, setEventsOn]           = useState(false)
  const [compareData, setCompareData]     = useState<PredictionPoint[] | null>(null)
  const [eventsCount, setEventsCount]     = useState(0)
  const [loadingCompare, setLoadingCompare] = useState(false)

  const handleEventsToggle = async (checked: boolean) => {
    setEventsOn(checked)
    if (!checked || !forecast.result) return
    if (compareData) return
    setLoadingCompare(true)
    try {
      const res = await api.get<{
        predictions: { date: string; baseline: number; with_events: number; lower: number; upper: number }[]
        events_applied: number
      }>(`/api/forecast/${forecast.result.job_id}/compare`)
      setEventsCount(res.events_applied)
      setCompareData(
        res.predictions.map((p) => ({
          date: p.date, predicted: p.with_events, lower: p.lower, upper: p.upper,
        }))
      )
    } catch {
      setEventsOn(false)
    } finally {
      setLoadingCompare(false)
    }
  }

  const isRunning = forecast.stage === "submitting" || forecast.stage === "polling"

  const canRun =
    config.datasetId.trim() !== "" &&
    config.dateCol.trim()   !== "" &&
    config.targetCol.trim() !== "" &&
    config.dateCol          !== config.targetCol &&
    !isRunning

  const handleRun = () => {
    appStore.setActiveDataset(config.datasetId, config.dateCol, config.targetCol, config.freq)
    forecast.runForecast({
      dataset_id:       config.datasetId.trim(),
      date_column:      config.dateCol.trim(),
      target_column:    config.targetCol.trim(),
      freq:             config.freq,
      horizon:          config.horizon,
      model_override:   config.modelOverride === "auto" ? null : config.modelOverride,
      force_reoptimize: forceReoptimize,
    })
    setForceReoptimize(false) // reset tras correr
  }

  const isDone    = forecast.stage === "done"
  const isFailed  = forecast.stage === "failed"
  const isIdle    = forecast.stage === "idle"

  // Whether to show results panel alongside config
  const showResults = isDone && forecast.result != null

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem", mb: "0.25rem" }}>
            <TuneIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
            <Typography variant="h4" color="text.primary" fontWeight={700}>
              Forecast
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Configurá los parámetros y generá una proyección con intervalos de confianza.
          </Typography>
        </Box>
        {forecast.stage !== "idle" && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={() => { forecast.reset(); setEventsOn(false); setCompareData(null) }}
            color="inherit"
            disabled={isRunning}
          >
            Resetear
          </Button>
        )}
      </Box>

      {/* ── 2-column layout ──────────────────────────────────────────────── */}
      <Box
        sx={{
          display: "grid",
          // Left column fixed ~26rem, right takes remaining space
          // On mobile: single column
          gridTemplateColumns: { xs: "1fr", md: "26rem 1fr" },
          gap: "1.5rem",
          alignItems: "start",
        }}
      >

        {/* ── LEFT: config panel ──────────────────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {(isIdle || isFailed) && (
            <Paper variant="outlined" sx={{ p: "1.5rem" }}>
              <ForecastConfigPanel
                config={config}
                onChange={patchConfig}
                disabled={isRunning}
              />

              <Divider sx={{ my: "1.25rem" }} />

              {/* HPO cache info + Re-optimizar (solo para LightGBM) */}
              {(config.modelOverride === "lightgbm" || config.modelOverride === "auto") && config.datasetId && (
                <Box sx={{ mb: "1rem", p: "0.875rem", bgcolor: "background.default", borderRadius: "0.5rem", border: "1px solid", borderColor: "divider" }}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <PsychologyIcon sx={{ fontSize: "1rem", color: hpoCache ? "success.main" : "text.disabled" }} />
                      <Typography variant="caption" color="text.secondary">
                        {hpoCache
                          ? <>HPO cache: WAPE <strong>{hpoCache.wape?.toFixed(3) ?? "—"}</strong> · {hpoCache.optimized_at ?? ""}</>
                          : "Sin cache HPO — Optuna correrá (~60s)"}
                      </Typography>
                    </Box>
                    {hpoCache && (
                      <Tooltip title="Ignora el cache y corre Optuna desde cero para encontrar mejores hiperparámetros">
                        <Chip
                          label={forceReoptimize ? "Re-optimizar: ON" : "Re-optimizar"}
                          size="small"
                          onClick={() => setForceReoptimize((v) => !v)}
                          color={forceReoptimize ? "warning" : "default"}
                          variant={forceReoptimize ? "filled" : "outlined"}
                          icon={<PsychologyIcon />}
                          sx={{ cursor: "pointer", fontSize: "0.75rem" }}
                        />
                      </Tooltip>
                    )}
                  </Box>
                </Box>
              )}

              <Button
                variant="contained"
                startIcon={<PlayArrowIcon />}
                onClick={handleRun}
                disabled={!canRun}
                fullWidth
                sx={{ py: "0.625rem" }}
              >
                {forceReoptimize ? "Optimizar + Forecast" : "Generar forecast"}
              </Button>
            </Paper>
          )}

          {/* Progress — shown in left column while running */}
          {isRunning && (
            <Paper variant="outlined" sx={{ p: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                Procesando…
              </Typography>
              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography variant="body2" color="text.secondary">
                  {forecast.step || "Iniciando…"}
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
              {/* Summary of selected config */}
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", pt: "0.25rem" }}>
                {[
                  config.datasetId.slice(0, 8) + "…",
                  config.dateCol,
                  config.targetCol,
                  config.freq,
                  `+${config.horizon}p`,
                ].map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: "0.6875rem", height: "1.375rem", color: "text.disabled" }}
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Config summary after done — compact re-run card */}
          {isDone && (
            <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
                Configuración activa
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                {[
                  { label: "Dataset", value: config.datasetId.slice(0, 8) + "…" },
                  { label: "Fecha",   value: config.dateCol },
                  { label: "Obj.",    value: config.targetCol },
                  { label: "Freq",    value: config.freq },
                  { label: "Horizon", value: `+${config.horizon}p` },
                ].map(({ label, value }) => (
                  <Box
                    key={label}
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      bgcolor: "action.hover",
                      borderRadius: "0.375rem",
                      px: "0.625rem",
                      py: "0.375rem",
                      minWidth: "4rem",
                    }}
                  >
                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.625rem" }}>
                      {label}
                    </Typography>
                    <Typography variant="caption" fontWeight={600} color="text.primary" sx={{ fontSize: "0.75rem" }}>
                      {value}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Events toggle */}
              <Divider />
              <FormControlLabel
                control={
                  <Switch
                    checked={eventsOn}
                    onChange={(e) => handleEventsToggle(e.target.checked)}
                    disabled={loadingCompare}
                    size="small"
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <EventIcon fontSize="small" sx={{ color: "text.secondary" }} />
                    <Typography variant="body2">Ver con eventos</Typography>
                    {eventsOn && eventsCount > 0 && (
                      <Chip label={`${eventsCount} evento${eventsCount > 1 ? "s" : ""}`} size="small" color="primary" />
                    )}
                    {eventsOn && eventsCount === 0 && (
                      <Chip label="Sin eventos" size="small" variant="outlined" />
                    )}
                  </Box>
                }
              />
            </Paper>
          )}
        </Box>

        {/* ── RIGHT: results panel ─────────────────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem", minWidth: 0 }}>

          {/* Error */}
          {isFailed && forecast.error && (
            <Alert severity="error">{forecast.error}</Alert>
          )}

          {/* Skeleton while last polling */}
          {isRunning && forecast.progressPct >= 80 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <Skeleton variant="rounded" height={320} />
              <Skeleton variant="rounded" height={80} />
            </Box>
          )}

          {/* Idle placeholder */}
          {isIdle && (
            <Paper
              variant="outlined"
              sx={{
                p: "3rem",
                display: { xs: "none", md: "flex" },
                flexDirection: "column",
                alignItems: "center",
                gap: "0.75rem",
                borderStyle: "dashed",
                borderRadius: "0.75rem",
              }}
            >
              <TuneIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
              <Typography variant="h6" color="text.secondary">
                Los resultados aparecen aquí
              </Typography>
              <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="22rem">
                Configurá los parámetros a la izquierda y presioná&nbsp;
                <strong>Generar forecast</strong>.
              </Typography>
            </Paper>
          )}

          {/* Results */}
          {showResults && (
            <>
              <ForecastChart
                historical={forecast.result!.historical}
                predictions={eventsOn && compareData ? compareData : forecast.result!.predictions}
                modelName={MODEL_LABELS[forecast.result!.model_used]}
              />
              <MetricsCard
                metrics={forecast.result!.metrics}
                modelUsed={forecast.result!.model_used}
              />
            </>
          )}
        </Box>

      </Box>
    </Box>
  )
}
