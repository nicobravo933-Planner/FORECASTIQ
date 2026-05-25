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
import { useRouter } from "next/navigation"
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
import CircularProgress from "@mui/material/CircularProgress"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import EventIcon from "@mui/icons-material/Event"
import TuneIcon from "@mui/icons-material/Tune"
import PsychologyIcon from "@mui/icons-material/Psychology"
import CompareArrowsIcon from "@mui/icons-material/CompareArrows"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import Accordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import AccordionDetails from "@mui/material/AccordionDetails"
import { useForecast } from "@/hooks/useForecast"
import { useColumnPreview } from "@/hooks/useColumnPreview"
import { appStore } from "@/lib/appStore"
import { ForecastConfigPanel, type ForecastConfig } from "@/components/forecast/ForecastConfigPanel"
import { ForecastChart } from "@/components/forecast/ForecastChart"
import { MetricsCard } from "@/components/forecast/MetricsCard"
import { CvResultsCard } from "@/components/forecast/CvResultsCard"
import { ParameterExplorer, type ManualParams } from "@/components/forecast/ParameterExplorer"
import { ModelGatingPanel } from "@/components/forecast/ModelGatingPanel"
import { DetectionReportModal } from "@/components/forecast/DetectionReportModal"
import { ForecastContextBar } from "@/components/forecast/ForecastContextBar"
import { BenchmarkTable } from "@/components/forecast/BenchmarkTable"
import { ExportButton } from "@/components/dataset/ExportButton"
import { EmptyStateGuard } from "@/components/common/EmptyStateGuard"
import type { DataFreq, ModelName, PredictionPoint, DetectionResult, BenchmarkResult } from "@/lib/types"
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
  const router = useRouter()

  // Consolidated config state — driven by ForecastConfigPanel
  const [config, setConfig] = useState<ForecastConfig>({
    datasetId:      appStore.getActiveDatasetId()    ?? "",
    dateCol:        appStore.getActiveDateCol()       ?? "",
    targetCol:      appStore.getActiveTargetCol()     ?? "",
    freq:           (appStore.getActiveFreq() as DataFreq) ?? "M",
    horizon:        12,
    modelOverride:  "auto",
    testPeriods:    0,
    cvFolds:        0,
    // F2.3: default = full history
    trainWindow:    "auto",
    trainStartDate: null,
  })

  // F1.3: preview data to validate test/total ratio before run
  const preview = useColumnPreview(config.datasetId || null)

  const [forceReoptimize, setForceReoptimize] = useState(false)
  const [hpoCache, setHpoCache] = useState<{ wape: number | null; optimized_at: string | null } | null>(null)

  // E5: quality score del dataset activo (leído desde appStore)
  const [qualityData, setQualityData] = useState<{
    score: number
    label: string
    modelIds: string[]
  } | null>(() => {
    // Solo inicializar en cliente
    if (typeof window === "undefined") return null
    return appStore.getQualityScore()
  })

  // E6: detection report modal
  const [detectionModalOpen, setDetectionModalOpen] = useState(false)
  const [detectionReport, setDetectionReport] = useState<DetectionResult | null>(() => {
    if (typeof window === "undefined") return null
    const raw = appStore.getDetectionReport()
    return raw ? (raw as unknown as DetectionResult) : null
  })

  // UX-1a: active results tab (0=Forecast, 1=Benchmark, 2=Diagnóstico, 3=Parámetros)
  const [activeTab, setActiveTab] = useState(0)

  // E7: benchmark state
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(null)
  const [benchmarkRunning, setBenchmarkRunning] = useState(false)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  const handleRunBenchmark = async () => {
    if (!config.datasetId || !config.dateCol || !config.targetCol) return
    setBenchmarkRunning(true)
    setBenchmarkError(null)
    setBenchmarkResult(null)
    try {
      const res = await api.post<BenchmarkResult>("/api/forecast/benchmark", {
        dataset_id:    config.datasetId,
        date_column:   config.dateCol,
        target_column: config.targetCol,
        freq:          config.freq,
        horizon:       config.horizon,
        test_periods:  config.testPeriods,
      })
      setBenchmarkResult(res)
    } catch (err) {
      setBenchmarkError(err instanceof Error ? err.message : "Error al correr el benchmark")
    } finally {
      setBenchmarkRunning(false)
    }
  }

  const handleOpenDetectionReport = () => {
    // Re-read from store in case it was just updated by ForecastConfigPanel
    const raw = appStore.getDetectionReport()
    if (raw) setDetectionReport(raw as unknown as DetectionResult)
    setDetectionModalOpen(true)
  }

  // Pre-select cached model if we already ran forecast for this dataset
  useEffect(() => {
    if (!config.datasetId) return
    const cached = appStore.getDetectedModel(config.datasetId)
    if (cached && config.modelOverride === "auto") {
      patchConfig({ modelOverride: cached as typeof config.modelOverride })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.datasetId])

  // UX-1e: pre-select model coming from Encyclopedia "Try in Forecast" button
  useEffect(() => {
    const pending = appStore.popPendingModel()
    if (pending) {
      patchConfig({ modelOverride: pending as typeof config.modelOverride })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // E5: re-leer quality score cuando cambia el dataset
  useEffect(() => {
    if (!config.datasetId) return
    const q = appStore.getQualityScore()
    setQualityData(q)
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

  // E4: overfitting detection — warn when train WAPE << test WAPE
  const overfitWarning: string | null = (() => {
    if (!forecast.result?.metrics) return null
    const { wape } = forecast.result.metrics
    if (wape === null || wape === undefined) return null
    // Si test WAPE > 1.5× auto 20% umbral, es sospechoso
    // La heurística real compara con train WAPE, pero el backend no lo expone aún.
    // Por ahora: WAPE > 40% siempre es una señal de alerta para el usuario.
    if (wape > 0.40) {
      return `WAPE = ${(wape * 100).toFixed(1)}% — El error es alto. Si usás Holt-Winters o SARIMA, probá bajar α o usar menos lags. Si usás LightGBM, revisá si hay overfitting: corré Rolling CV para comparar train vs test.`
    }
    return null
  })()

  // E4: re-run con parámetros manuales
  const handleRerunWithParams = (manualParams: ManualParams) => {
    appStore.setActiveDataset(config.datasetId, config.dateCol, config.targetCol, config.freq)
    setActiveTab(0) // UX-1a: reset to Forecast tab on re-run
    forecast.runForecast({
      dataset_id:     config.datasetId.trim(),
      date_column:    config.dateCol.trim(),
      target_column:  config.targetCol.trim(),
      freq:           config.freq,
      horizon:        config.horizon,
      model_override: forecast.result?.model_used ?? (config.modelOverride === "auto" ? null : config.modelOverride),
      test_periods:   config.testPeriods,
      cv_folds:       config.cvFolds,
      manual_params:  manualParams as Record<string, unknown>,
    })
    setEventsOn(false)
    setCompareData(null)
  }

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

  // F2.3: compute the effective train_start_date from trainWindow config
  const getTrainStartDate = (): string | null => {
    if (config.trainWindow === "auto" || !config.trainWindow) return null
    if (config.trainWindow === "custom") return config.trainStartDate ?? null
    const years = parseInt(config.trainWindow, 10)
    if (isNaN(years)) return null
    const d = new Date()
    d.setFullYear(d.getFullYear() - years)
    return d.toISOString().split("T")[0]
  }

  const handleRun = () => {
    appStore.setActiveDataset(config.datasetId, config.dateCol, config.targetCol, config.freq)
    setActiveTab(0) // UX-1a: reset to Forecast tab on new run
    forecast.runForecast({
      dataset_id:       config.datasetId.trim(),
      date_column:      config.dateCol.trim(),
      target_column:    config.targetCol.trim(),
      freq:             config.freq,
      horizon:          config.horizon,
      model_override:   config.modelOverride === "auto" ? null : config.modelOverride,
      force_reoptimize: forceReoptimize,
      test_periods:     config.testPeriods,
      cv_folds:         config.cvFolds,
      train_start_date: getTrainStartDate(),
    })
    setForceReoptimize(false) // reset tras correr
  }

  const isDone    = forecast.stage === "done"
  const isFailed  = forecast.stage === "failed"
  const isIdle    = forecast.stage === "idle"

  // Results visible when done and result is ready
  const showResults = isDone && forecast.result != null

  // F3.2: Accordion config — expanded when idle/failed, collapsed when running/done
  const [configExpanded, setConfigExpanded] = useState(true)
  // Auto-collapse on run start, auto-expand on idle/failed
  useEffect(() => {
    if (isRunning || isDone) setConfigExpanded(false)
    if (isIdle || isFailed) setConfigExpanded(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecast.stage])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* ── Guard: sin dataset activo ────────────────────────────────────── */}
      {!config.datasetId && (
        <EmptyStateGuard
          condition
          title="No hay dataset activo"
          description="Subí un CSV o conectá una base de datos para empezar a forecastear."
          ctaLabel="Subir datos"
          ctaHref="/dashboard/data"
          secondaryLabel="Ver EDA"
          secondaryHref="/dashboard/eda"
        />
      )}

      {/* Resto del contenido — solo cuando hay dataset */}
      {config.datasetId && (<>

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

      {/* ── Layout: vertical full-width (F3.1) ─────────────────────────────── */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

        {/* ── Row 1: config panel (full-width) ─────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* E5: Model Gating Panel — siempre visible cuando hay dataset activo */}
          {config.datasetId && (
            <ModelGatingPanel
              qualityScore={qualityData?.score ?? null}
              qualityLabel={qualityData?.label ?? null}
              availableModelIds={qualityData?.modelIds ?? []}
              selectedModel={config.modelOverride}
              onSelectModel={(id) => patchConfig({ modelOverride: id as ModelName | "auto" })}
            />
          )}
          {/* F2.1: ForecastContextBar — visible when there's an active dataset */}
          {config.datasetId && preview.status === "ready" && (
            <ForecastContextBar
              datasetName={config.datasetId.slice(0, 12) + "…"}
              nObs={preview.totalRows}
              freq={config.freq}
              qualityScore={qualityData?.score ?? null}
              qualityLabel={qualityData?.label ?? null}
              isEtlCleaned={!!appStore.getCleanedDatasetId()}
              onGoToEda={() => router.push("/dashboard/eda")}
              onGoToEtl={() => router.push("/dashboard/etl")}
            />
          )}

          {/* Guarda suave 1: no pasó por EDA — datos sin analizar */}
          {!qualityData && (
            <Alert
              severity="info"
              sx={{ fontSize: "0.8125rem", py: "0.375rem" }}
              action={
                <Button size="small" color="inherit" onClick={() => router.push("/dashboard/eda")}>
                  Ir a EDA →
                </Button>
              }
            >
              No analizaste la calidad de tus datos. Los resultados podrían ser poco confiables.
            </Alert>
          )}

          {/* Guarda suave 2: calidad baja sin ETL aplicado */}
          {qualityData && qualityData.score < 60 && !appStore.getCleanedDatasetId() && (
            <Alert
              severity="warning"
              sx={{ fontSize: "0.8125rem", py: "0.375rem" }}
              action={
                <Button size="small" color="inherit" onClick={() => router.push("/dashboard/etl")}>
                  Limpiar →
                </Button>
              }
            >
              Calidad de datos <strong>{qualityData.label}</strong> ({qualityData.score}/100). Limpiá los outliers antes de forecastear para mejores resultados.
            </Alert>
          )}
          {/* F3.2: Config Accordion — collapses after run, expands when idle/failed */}
          <Accordion
            expanded={configExpanded}
            onChange={(_, expanded) => setConfigExpanded(expanded)}
            disableGutters
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "0.5rem !important",
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{ px: "1.25rem", py: "0.5rem", minHeight: "3rem" }}
            >
              {/* Summary chips — visible when collapsed */}
              {!configExpanded ? (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", alignItems: "center" }}>
                  {[
                    { label: config.datasetId ? config.datasetId.slice(0, 10) + "…" : "Sin dataset" },
                    { label: config.modelOverride === "auto" ? "Auto" : config.modelOverride },
                    { label: `+${config.horizon}p` },
                    { label: config.testPeriods > 0 ? `Test ${config.testPeriods}p` : "Test auto" },
                  ].map(({ label }) => (
                    <Chip
                      key={label}
                      label={label}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: "0.6875rem", height: "1.375rem" }}
                    />
                  ))}
                  <Chip
                    label="Editar configuración"
                    size="small"
                    color="primary"
                    onClick={(e) => { e.stopPropagation(); setConfigExpanded(true) }}
                    sx={{ fontSize: "0.6875rem", height: "1.375rem", cursor: "pointer" }}
                  />
                </Box>
              ) : (
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                  Configuración del forecast
                </Typography>
              )}
            </AccordionSummary>

            <AccordionDetails sx={{ px: "1.25rem", pt: 0, pb: "1.25rem" }}>
              {/* Running: progress bar */}
              {isRunning && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem", mb: "1rem" }}>
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
                </Box>
              )}

              {/* Done: events toggle + config summary */}
              {isDone && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem", mb: "1rem" }}>
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
                </Box>
              )}

              {/* Idle / failed: full config form */}
              {(isIdle || isFailed) && (
                <>
                  <ForecastConfigPanel
                    config={config}
                    onChange={patchConfig}
                    disabled={isRunning}
                    availableModelIds={qualityData?.modelIds ?? null}
                    onOpenDetectionReport={handleOpenDetectionReport}
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

                  {/* F1.3 — Pre-run warning: test set > 50% of total data */}
                  {(() => {
                    const total = preview.status === "ready" ? preview.totalRows : 0
                    if (total > 0 && config.testPeriods > 0 && config.testPeriods > total * 0.5) {
                      return (
                        <Alert severity="warning" sx={{ fontSize: "0.8125rem", py: "0.375rem" }}>
                          Reserás <strong>{config.testPeriods}</strong> períodos como test sobre{" "}
                          <strong>{total}</strong> obs totales ({((config.testPeriods / total) * 100).toFixed(0)}%).
                          El modelo puede no tener suficiente historia para entrenarse bien.
                        </Alert>
                      )
                    }
                    return null
                  })()}

                  <Button
                    variant="contained"
                    startIcon={<PlayArrowIcon />}
                    onClick={handleRun}
                    disabled={!canRun}
                    fullWidth
                    sx={{ py: "0.625rem", mt: "0.25rem" }}
                  >
                    {forceReoptimize ? "Optimizar + Forecast" : "Generar forecast"}
                  </Button>
                </>
              )}
            </AccordionDetails>
          </Accordion>
        </Box>

        {/* ── Row 2: results panel (full-width) ──────────────────────────── */}
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

          {/* Results — UX-1a: Tabs layout */}
          {showResults && (
            <>
              {/* Tab bar */}
              <Tabs
                value={activeTab}
                onChange={(_, v: number) => setActiveTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{ mb: "1rem", borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Tab label="Forecast"     sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
                <Tab label="Benchmark"    sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
                <Tab label="Diagnóstico"  sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
                <Tab label="Parámetros"   sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
              </Tabs>

              {/* ── Tab 0: Forecast ────────────────────────────────────────── */}
              {activeTab === 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <ForecastChart
                    historical={forecast.result!.historical}
                    predictions={eventsOn && compareData ? compareData : forecast.result!.predictions}
                    modelName={MODEL_LABELS[forecast.result!.model_used]}
                    testActual={forecast.result!.test_actual}
                    testPredicted={forecast.result!.test_predicted}
                    trainEndDate={forecast.result!.train_end_date}
                    testStartDate={forecast.result!.test_start_date}
                  />
                  <MetricsCard
                    metrics={forecast.result!.metrics}
                    modelUsed={forecast.result!.model_used}
                    testPeriods={forecast.result!.test_periods}
                    orientation="horizontal"
                  />
                  {config.datasetId && (
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <ExportButton
                        datasetId={config.datasetId}
                        showBoth
                        variant="outlined"
                        size="small"
                      />
                    </Box>
                  )}
                </Box>
              )}

              {/* ── Tab 1: Benchmark ───────────────────────────────────────── */}
              {activeTab === 1 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <Tooltip title="Corre MA + HW + SARIMA + Seasonal Naive en paralelo y compara sus métricas">
                      <span>
                        <Chip
                          icon={
                            benchmarkRunning
                              ? <CircularProgress size="0.875rem" sx={{ color: "secondary.main" }} />
                              : <CompareArrowsIcon sx={{ fontSize: "0.9rem !important" }} />
                          }
                          label={benchmarkRunning ? "Comparando..." : "Comparar modelos"}
                          onClick={!benchmarkRunning ? handleRunBenchmark : undefined}
                          color="secondary"
                          variant={benchmarkResult ? "filled" : "outlined"}
                          size="small"
                          sx={{ cursor: benchmarkRunning ? "default" : "pointer", fontSize: "0.75rem" }}
                        />
                      </span>
                    </Tooltip>
                  </Box>
                  {benchmarkError && (
                    <Alert severity="error" sx={{ fontSize: "0.8125rem" }}>{benchmarkError}</Alert>
                  )}
                  {!benchmarkResult && !benchmarkRunning && (
                    <Paper variant="outlined" sx={{ p: "2rem", textAlign: "center", borderStyle: "dashed", borderRadius: "0.75rem" }}>
                      <CompareArrowsIcon sx={{ fontSize: "2.5rem", color: "text.disabled", mb: "0.5rem" }} />
                      <Typography variant="body2" color="text.secondary">
                        Presá <strong>Comparar modelos</strong> para ver cómo rinden MA, Holt-Winters, SARIMA y Seasonal Naive en tu serie.
                      </Typography>
                    </Paper>
                  )}
                  {benchmarkResult && <BenchmarkTable result={benchmarkResult} />}
                </Box>
              )}

              {/* ── Tab 2: Diagnóstico ─────────────────────────────────────── */}
              {activeTab === 2 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {detectionReport ? (
                    <>
                      {/* Resultado final */}
                      <Paper
                        variant="outlined"
                        sx={{ p: "1.25rem", borderRadius: "0.625rem", bgcolor: "rgba(99,102,241,0.04)" }}
                      >
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", mb: "0.5rem" }}>
                          <PsychologyIcon sx={{ color: "primary.main", fontSize: "1.125rem" }} />
                          <Typography variant="subtitle2" fontWeight={700}>Modelo seleccionado</Typography>
                          <Chip
                            label={MODEL_LABELS[detectionReport.model] ?? detectionReport.model}
                            color="primary"
                            size="small"
                            sx={{ fontWeight: 700 }}
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6, mb: "0.75rem" }}>
                          {detectionReport.reason}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Typography variant="caption" color="text.disabled" sx={{ minWidth: "6.5rem" }}>
                            Confianza: {Math.round(detectionReport.confidence * 100)}%
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={Math.round(detectionReport.confidence * 100)}
                            sx={{ flex: 1, height: "0.375rem", borderRadius: "0.25rem" }}
                            color={detectionReport.confidence >= 0.8 ? "success" : detectionReport.confidence >= 0.65 ? "warning" : "error"}
                          />
                        </Box>
                      </Paper>
                      {/* Stats rápidas */}
                      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                        {[
                          { label: "Observaciones", value: String(detectionReport.n_observations) },
                          { label: "Outliers",      value: `${detectionReport.outlier_count} (${detectionReport.outlier_pct.toFixed(1)}%)` },
                          { label: "CV",            value: detectionReport.cv.toFixed(3) },
                        ].map(({ label, value }) => (
                          <Box key={label} sx={{ p: "0.625rem", borderRadius: "0.375rem", bgcolor: "action.hover", textAlign: "center" }}>
                            <Typography variant="caption" color="text.disabled" sx={{ display: "block", fontSize: "0.625rem" }}>{label}</Typography>
                            <Typography variant="body2" fontWeight={700}>{value}</Typography>
                          </Box>
                        ))}
                      </Box>
                      {/* Steps del pipeline — reutiliza el modal completo */}
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mt: "0.25rem" }}>
                        Pipeline de detección
                      </Typography>
                      <Chip
                        icon={<PsychologyIcon sx={{ fontSize: "0.9rem !important" }} />}
                        label="Ver reporte completo"
                        onClick={handleOpenDetectionReport}
                        color="primary"
                        variant="outlined"
                        size="small"
                        sx={{ alignSelf: "flex-start", cursor: "pointer", fontSize: "0.75rem" }}
                      />
                    </>
                  ) : (
                    <Paper variant="outlined" sx={{ p: "2rem", textAlign: "center", borderStyle: "dashed", borderRadius: "0.75rem" }}>
                      <PsychologyIcon sx={{ fontSize: "2.5rem", color: "text.disabled", mb: "0.5rem" }} />
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        No hay reporte de detección todavía.
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        Usá el botón <strong>Analizar serie</strong> en la configuración para generar el reporte.
                      </Typography>
                    </Paper>
                  )}
                  {overfitWarning && (
                    <Alert severity="warning" sx={{ fontSize: "0.8125rem" }}>{overfitWarning}</Alert>
                  )}
                </Box>
              )}

              {/* ── Tab 3: Parámetros ──────────────────────────────────────── */}
              {activeTab === 3 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  {forecast.result!.model_params && Object.keys(forecast.result!.model_params).length > 0 ? (
                    <ParameterExplorer
                      modelUsed={forecast.result!.model_used}
                      modelParams={forecast.result!.model_params}
                      overfitWarning={overfitWarning}
                      onRerun={handleRerunWithParams}
                      disabled={isRunning}
                    />
                  ) : (
                    <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>Los parámetros del modelo no están disponibles para este resultado.</Alert>
                  )}
                  {forecast.result!.cv_summary && (
                    <CvResultsCard
                      cvSummary={forecast.result!.cv_summary}
                      cvWarning={forecast.result!.cv_warning}
                      modelName={MODEL_LABELS[forecast.result!.model_used]}
                    />
                  )}
                  {!forecast.result!.cv_summary && forecast.result!.cv_warning && (
                    <Alert severity="warning" sx={{ fontSize: "0.8125rem" }}>
                      {forecast.result!.cv_warning}
                    </Alert>
                  )}
                </Box>
              )}
            </>
          )}
        </Box>

      </Box>

      {/* E6: Detection Report Modal */}
      <DetectionReportModal
        open={detectionModalOpen}
        onClose={() => setDetectionModalOpen(false)}
        report={detectionReport}
      />

      </>)}
    </Box>
  )
}
