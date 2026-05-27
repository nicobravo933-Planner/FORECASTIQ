"use client"

/**
 * ForecastConfigPanel — UX-3 (refactored layout 2-col).
 *
 * Config panel for the Forecast page. When a dataset_id is present:
 *   - DatasetPicker shows all available datasets by name (no UUID visible)
 *   - Loads real column names from /api/datasets/{id}/preview
 *   - Shows Select dropdowns for date column and target column
 *   - Validates column types and shows inline warnings
 *
 * Layout: 2-col grids for columns, freq+model, horizon+test, train+cv.
 * Tooltips are short and direct (no \n artifacts).
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import TextField from "@mui/material/TextField"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import FormHelperText from "@mui/material/FormHelperText"
import Skeleton from "@mui/material/Skeleton"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import Alert from "@mui/material/Alert"
import ToggleButton from "@mui/material/ToggleButton"
import Switch from "@mui/material/Switch"
import FormControlLabel from "@mui/material/FormControlLabel"
import CircularProgress from "@mui/material/CircularProgress"
import LockIcon from "@mui/icons-material/Lock"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"
import SearchIcon from "@mui/icons-material/Search"
import { DatePicker } from "@mui/x-date-pickers/DatePicker"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFnsV3"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useColumnPreview } from "@/hooks/useColumnPreview"
import { useCapabilities } from "@/hooks/useCapabilities"
import { DatasetPicker } from "@/components/forecast/DatasetPicker"
import { HorizonSelector } from "@/components/forecast/HorizonSelector"
import { inferFreqFromSamples, type FreqDetectionResult } from "@/lib/freqDetection"
import { api } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import type { DataFreq, ModelName, DatasetColumn } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ForecastConfig {
  datasetId:      string
  dateCol:        string
  targetCol:      string
  freq:           DataFreq
  horizon:        number
  modelOverride:  ModelName | "auto"
  testPeriods:    number
  cvFolds:        number
  trainWindow:    "auto" | "1y" | "2y" | "3y" | "custom"
  trainStartDate: string | null
}

interface ForecastConfigPanelProps {
  config:    ForecastConfig
  onChange:  (patch: Partial<ForecastConfig>) => void
  disabled?: boolean
  availableModelIds?: string[] | null
  onOpenDetectionReport?: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_MODEL_OPTIONS: { value: ModelName | "auto"; label: string; requiresLocal: boolean }[] = [
  { value: "auto",            label: "Auto-detectar (recomendado)", requiresLocal: false },
  { value: "moving_average",  label: "Promedio Móvil",               requiresLocal: false },
  { value: "ses",             label: "SES (Suavizamiento Simple)",    requiresLocal: false },
  { value: "holt_simple",     label: "Holt Simple (Sin estacional)",  requiresLocal: false },
  { value: "holt_winters",    label: "Holt-Winters",                  requiresLocal: false },
  { value: "sarima",          label: "SARIMA",                        requiresLocal: false },
  { value: "linear_splines",  label: "Regresión Lineal + Splines",    requiresLocal: false },
  { value: "lightgbm",        label: "LightGBM",                      requiresLocal: true  },
]

const FREQ_OPTIONS: { value: DataFreq; label: string }[] = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
  { value: "Q", label: "Trimestral" },
]

const TEST_PERIODS_OPTIONS: Record<DataFreq, number[]> = {
  D: [7, 30, 90],
  W: [4, 8, 13],
  M: [3, 6, 12],
  Q: [2, 4, 8],
}

// ── Column type validation helpers ────────────────────────────────────────────

type ColStatus = "ok" | "warn" | "unknown"
interface ColValidation { status: ColStatus; message: string }

function validateDateCol(col: DatasetColumn | undefined): ColValidation {
  if (!col) return { status: "unknown", message: "" }
  if (col.dtype === "datetime") return { status: "ok",   message: "Columna de fecha válida" }
  if (col.dtype === "numeric")  return { status: "warn", message: "Columna numérica — verificá que sea una fecha." }
  return                               { status: "warn", message: "Tipo texto — puede haber errores al parsear." }
}

function validateTargetCol(col: DatasetColumn | undefined): ColValidation {
  if (!col) return { status: "unknown", message: "" }
  if (col.dtype === "numeric")  return { status: "ok",   message: "Columna numérica válida" }
  if (col.dtype === "datetime") return { status: "warn", message: "Parece una fecha, no un valor objetivo." }
  return                               { status: "warn", message: "El objetivo debe ser un número." }
}

function ColIcon({ validation }: { validation: ColValidation }) {
  if (validation.status === "ok")
    return <Tooltip title={validation.message} placement="top"><CheckCircleOutlineIcon sx={{ fontSize: "1rem", color: "success.main", flexShrink: 0 }} /></Tooltip>
  if (validation.status === "warn")
    return <Tooltip title={validation.message} placement="top"><WarningAmberIcon sx={{ fontSize: "1rem", color: "warning.main", flexShrink: 0 }} /></Tooltip>
  return null
}

const DTYPE_COLORS: Record<string, "default" | "success" | "warning" | "error"> = {
  datetime: "success", numeric: "success", text: "warning", unknown: "default",
}

function DtypeChip({ dtype }: { dtype: string }) {
  return (
    <Chip label={dtype} size="small" color={DTYPE_COLORS[dtype] ?? "default"} variant="outlined"
      sx={{ fontSize: "0.625rem", height: "1.125rem", pointerEvents: "none" }} />
  )
}

// Shared toggle button style
function toggleBtnSx(selected: boolean, color: "primary" | "secondary" = "primary") {
  return {
    px: "0.625rem", py: "0.25rem", fontSize: "0.75rem", textTransform: "none" as const,
    borderRadius: "0.375rem", border: "1px solid",
    borderColor: selected ? `${color}.main` : "divider",
    bgcolor: selected ? `${color}.main` : "transparent",
    color: selected ? `${color}.contrastText` : "text.secondary",
    "&:hover": { bgcolor: selected ? `${color}.dark` : "action.hover" },
    "&.Mui-disabled": { opacity: 0.4 },
  }
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ForecastConfigPanel({
  config, onChange, disabled = false, availableModelIds = null, onOpenDetectionReport
}: ForecastConfigPanelProps) {
  const preview  = useColumnPreview(config.datasetId || null)
  const { caps } = useCapabilities()
  const isLocal  = caps.tier === "local"
  const isEc2    = caps.tier === "ec2"
  const router   = useRouter()
  const [detectedFreq, setDetectedFreq] = useState<FreqDetectionResult | null>(null)
  const [detecting, setDetecting]       = useState(false)
  const [detectError, setDetectError]   = useState<string | null>(null)
  const [testManualMode, setTestManualMode] = useState(false)
  const [testManualVal, setTestManualVal]   = useState("")
  const [linkHorizonTest, setLinkHorizonTest] = useState(false)

  useEffect(() => {
    if (testManualMode) return
    const opts = TEST_PERIODS_OPTIONS[config.freq]
    if (config.testPeriods !== 0 && !opts.includes(config.testPeriods)) onChange({ testPeriods: 0 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.freq])

  const handleDetect = async () => {
    if (!config.datasetId || !config.dateCol || !config.targetCol) return
    setDetecting(true); setDetectError(null)
    try {
      const result = await api.post<Record<string, unknown>>(
        `/api/datasets/${config.datasetId}/detect`,
        { date_column: config.dateCol, target_column: config.targetCol, freq: config.freq }
      )
      appStore.setDetectionReport(result)
      if (result.model && config.modelOverride === "auto") onChange({ modelOverride: result.model as ModelName })
      onOpenDetectionReport?.()
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : "Error al analizar la serie")
    } finally { setDetecting(false) }
  }

  useEffect(() => {
    if (preview.status !== "ready") return
    const cols = preview.columns
    const needsDate = !config.dateCol; const needsTarget = !config.targetCol
    if (!needsDate && !needsTarget) return
    const firstDate   = cols.find((c) => c.dtype === "datetime")
    const autoDate    = needsDate ? (firstDate?.name ?? "") : config.dateCol
    const firstTarget = cols.find((c) => c.dtype === "numeric" && c.name !== autoDate)
    const autoTarget  = needsTarget ? (firstTarget?.name ?? "") : config.targetCol
    const patch: Partial<typeof config> = {}
    if (needsDate && autoDate)     patch.dateCol   = autoDate
    if (needsTarget && autoTarget) patch.targetCol = autoTarget
    if (Object.keys(patch).length) onChange(patch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.status])

  useEffect(() => {
    if (preview.status !== "ready" || !config.dateCol) { setDetectedFreq(null); return }
    const dateColMeta = preview.columns.find((c) => c.name === config.dateCol)
    if (!dateColMeta || dateColMeta.dtype !== "datetime") { setDetectedFreq(null); return }
    const result = inferFreqFromSamples(dateColMeta.sample_values)
    setDetectedFreq(result)
    if (result && config.freq === "M") onChange({ freq: result.freq })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.status, config.dateCol])

  const columns    = preview.status === "ready" ? preview.columns : []
  const hasColumns = columns.length > 0
  const dateColMeta   = columns.find((c) => c.name === config.dateCol)
  const targetColMeta = columns.find((c) => c.name === config.targetCol)
  const dateValidation   = validateDateCol(dateColMeta)
  const targetValidation = validateTargetCol(targetColMeta)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
        Parámetros del forecast
      </Typography>

      {/* Dataset picker */}
      <DatasetPicker
        value={config.datasetId}
        onChange={(ds) => onChange({
          datasetId: ds.dataset_id,
          dateCol:   ds.dateCol   ?? "",
          targetCol: ds.targetCol ?? "",
          freq:      (ds.freq as DataFreq | undefined) ?? config.freq,
        })}
      />

      {config.datasetId && preview.status === "ready" && (
        <Typography variant="caption" color="success.main" sx={{ mt: "-0.5rem" }}>
          {preview.totalRows.toLocaleString("es-AR")} filas · {columns.length} columnas detectadas
        </Typography>
      )}
      {config.datasetId && preview.status === "error" && (
        <Typography variant="caption" color="error.main" sx={{ mt: "-0.5rem" }}>{preview.message}</Typography>
      )}

      {/* ── Columnas en 2 col ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {preview.status === "loading" ? <Skeleton variant="rounded" height="2.5rem" /> : hasColumns ? (
          <FormControl size="small" fullWidth disabled={disabled}>
            <InputLabel>Columna fecha</InputLabel>
            <Select value={config.dateCol} label="Columna fecha" onChange={(e) => onChange({ dateCol: e.target.value })}>
              {columns.map((col) => (
                <MenuItem key={col.name} value={col.name}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span>{col.name}</span><DtypeChip dtype={col.dtype} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {config.dateCol && (
              <FormHelperText sx={{ color: dateValidation.status === "ok" ? "success.main" : "warning.main", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <ColIcon validation={dateValidation} />{dateValidation.message}
              </FormHelperText>
            )}
          </FormControl>
        ) : (
          <TextField label="Columna fecha" size="small" value={config.dateCol}
            onChange={(e) => onChange({ dateCol: e.target.value })} placeholder="ej. fecha" disabled={disabled} />
        )}

        {preview.status === "loading" ? <Skeleton variant="rounded" height="2.5rem" /> : hasColumns ? (
          <FormControl size="small" fullWidth disabled={disabled}>
            <InputLabel>Columna objetivo</InputLabel>
            <Select value={config.targetCol} label="Columna objetivo" onChange={(e) => onChange({ targetCol: e.target.value })}>
              {columns.map((col) => (
                <MenuItem key={col.name} value={col.name}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span>{col.name}</span><DtypeChip dtype={col.dtype} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {config.targetCol && (
              <FormHelperText sx={{ color: targetValidation.status === "ok" ? "success.main" : "warning.main", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <ColIcon validation={targetValidation} />{targetValidation.message}
              </FormHelperText>
            )}
          </FormControl>
        ) : (
          <TextField label="Columna objetivo" size="small" value={config.targetCol}
            onChange={(e) => onChange({ targetCol: e.target.value })} placeholder="ej. ventas" disabled={disabled} />
        )}
      </Box>

      {config.dateCol && config.targetCol && config.dateCol === config.targetCol && (
        <Alert severity="warning" sx={{ fontSize: "0.8125rem", py: "0.25rem" }}>
          La columna de fecha y la columna objetivo no pueden ser la misma.
        </Alert>
      )}

      {/* Analizar serie */}
      {config.datasetId && config.dateCol && config.targetCol && config.dateCol !== config.targetCol && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <Tooltip title="Detecta estacionalidad, tendencia y recomienda modelo" placement="top">
            <span>
              <Chip
                icon={detecting ? <CircularProgress size="0.875rem" /> : <SearchIcon sx={{ fontSize: "0.9rem !important" }} />}
                label={detecting ? "Analizando..." : "Analizar serie"}
                onClick={!disabled && !detecting ? handleDetect : undefined}
                color="primary" variant="outlined" size="small"
                sx={{ cursor: disabled || detecting ? "default" : "pointer", fontSize: "0.75rem", opacity: disabled ? 0.5 : 1 }}
              />
            </span>
          </Tooltip>
          {!detecting && onOpenDetectionReport && (
            <Typography variant="caption" color="primary.main"
              sx={{ cursor: "pointer", textDecoration: "underline", fontSize: "0.75rem" }}
              onClick={onOpenDetectionReport}>
              Ver último reporte
            </Typography>
          )}
          {detectError && <Typography variant="caption" color="error.main" sx={{ fontSize: "0.75rem" }}>{detectError}</Typography>}
        </Box>
      )}

      {/* ── Frecuencia + Modelo en 2 col ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "10rem 1fr", gap: "0.75rem", alignItems: "flex-start" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          <TextField select label="Frecuencia" size="small" value={config.freq}
            onChange={(e) => onChange({ freq: e.target.value as DataFreq })} disabled={disabled}>
            {FREQ_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </TextField>
          {detectedFreq && (
            <Tooltip title={`Intervalo mediano: ${detectedFreq.medianDays}d detectado`} placement="bottom">
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "help" }}>
                <AutoAwesomeIcon sx={{ fontSize: "0.75rem", color: detectedFreq.freq === config.freq ? "success.main" : "text.disabled" }} />
                <Typography variant="caption" color={detectedFreq.freq === config.freq ? "success.main" : "text.disabled"} sx={{ fontSize: "0.6875rem" }}>
                  {detectedFreq.freq === config.freq ? `${detectedFreq.label} detectada` : `Sugerida: ${detectedFreq.label}`}
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>

        <FormControl size="small" fullWidth disabled={disabled}>
          <InputLabel>Modelo</InputLabel>
          <Select value={config.modelOverride} label="Modelo"
            onChange={(e) => onChange({ modelOverride: e.target.value as ModelName | "auto" })}>
            {ALL_MODEL_OPTIONS.map((o) => {
              const lockedByTier    = o.requiresLocal && !isLocal
              const lockedByQuality = availableModelIds !== null && o.value !== "auto" && !availableModelIds.includes(o.value)
              const locked = lockedByTier || lockedByQuality
              const lockReason = lockedByTier ? "Requiere backend local" : "Requiere mejor calidad (EDA → ETL)"
              return (
                <MenuItem key={o.value} value={o.value} disabled={locked} sx={{ opacity: locked ? 0.5 : 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span style={{ flex: 1 }}>{o.label}</span>
                    {locked && <Tooltip title={lockReason} placement="right"><LockIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} /></Tooltip>}
                  </Box>
                </MenuItem>
              )
            })}
          </Select>
          {!isLocal && <FormHelperText sx={{ fontSize: "0.6875rem" }}>LightGBM requiere backend local</FormHelperText>}
        </FormControl>
      </Box>

      {/* ── Horizonte + Test en 2 col ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {/* Horizonte */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Horizonte</Typography>
            <Tooltip title="Períodos futuros. Máx: 1 ciclo estacional (12 mensual, 52 semanal)" placement="top">
              <Chip label="?" size="small" variant="outlined"
                onClick={() => router.push("/dashboard/encyclopedia?chapter=1")}
                sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }} />
            </Tooltip>
          </Box>
          <HorizonSelector
            value={config.horizon} freq={config.freq}
            onChange={(h) => onChange(linkHorizonTest ? { horizon: h, testPeriods: h } : { horizon: h })}
            disabled={disabled}
          />
          <FormControlLabel
            control={
              <Switch size="small" checked={linkHorizonTest}
                onChange={(e) => {
                  setLinkHorizonTest(e.target.checked)
                  if (e.target.checked) { setTestManualMode(false); onChange({ testPeriods: config.horizon }) }
                }}
                disabled={disabled}
              />
            }
            label={<Typography variant="caption" color="text.secondary">= test (Vandeput)</Typography>}
            sx={{ mt: "-0.25rem", ml: 0 }}
          />
        </Box>

        {/* Períodos test */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Períodos test</Typography>
            <Tooltip title="Últimos N períodos para evaluar el modelo. Mínimo: 1 ciclo estacional" placement="top">
              <Chip label="?" size="small" variant="outlined"
                onClick={() => router.push("/dashboard/encyclopedia?chapter=4")}
                sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }} />
            </Tooltip>
          </Box>
          <Box sx={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            <ToggleButton value={0} selected={config.testPeriods === 0 && !testManualMode}
              onChange={() => { if (!disabled) { setTestManualMode(false); onChange({ testPeriods: 0 }) } }}
              size="small" sx={toggleBtnSx(config.testPeriods === 0 && !testManualMode)}>Auto</ToggleButton>
            {TEST_PERIODS_OPTIONS[config.freq].map((v) => (
              <ToggleButton key={v} value={v} selected={config.testPeriods === v && !testManualMode}
                onChange={() => { if (!disabled) { setTestManualMode(false); onChange({ testPeriods: v }) } }}
                size="small" sx={toggleBtnSx(config.testPeriods === v && !testManualMode)}>Últ.{v}</ToggleButton>
            ))}
            <ToggleButton value="manual" selected={testManualMode}
              onChange={() => { if (!disabled) setTestManualMode((m) => !m) }}
              size="small" sx={toggleBtnSx(testManualMode)}>N</ToggleButton>
          </Box>
          {testManualMode && (
            <TextField size="small" type="number" label="períodos" value={testManualVal}
              onChange={(e) => {
                const raw = e.target.value; setTestManualVal(raw)
                const n = parseInt(raw, 10); if (!isNaN(n) && n >= 1) onChange({ testPeriods: n })
              }}
              disabled={disabled} inputProps={{ min: 1 }} sx={{ width: "6rem" }} />
          )}
          {config.testPeriods > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>
              Entrenamiento · Test · Proyección
            </Typography>
          )}
        </Box>
      </Box>

      {/* ── Ventana train + CV en 2 col ── */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        {/* Ventana de entrenamiento */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Ventana train</Typography>
            <Tooltip title="Limita la historia usada. Útil si hubo cambio estructural (pandemia, fusión, etc.)" placement="top">
              <Chip label="?" size="small" variant="outlined"
                onClick={() => router.push("/dashboard/encyclopedia?chapter=2")}
                sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }} />
            </Tooltip>
          </Box>
          <TextField select size="small" label="Ventana"
            value={config.trainWindow ?? "auto"}
            onChange={(e) => {
              const val = e.target.value as ForecastConfig["trainWindow"]
              onChange({ trainWindow: val, trainStartDate: val !== "custom" ? null : config.trainStartDate })
            }}
            disabled={disabled}>
            <MenuItem value="auto">Auto (toda)</MenuItem>
            <MenuItem value="1y">Último año</MenuItem>
            <MenuItem value="2y">2 años</MenuItem>
            <MenuItem value="3y">3 años</MenuItem>
            <MenuItem value="custom">Desde fecha…</MenuItem>
          </TextField>
          {config.trainWindow === "custom" && (
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Inicio del train"
                value={config.trainStartDate ? new Date(config.trainStartDate) : null}
                onChange={(date) => {
                  if (!date) { onChange({ trainStartDate: null }); return }
                  onChange({ trainStartDate: (date as Date).toISOString().split("T")[0] })
                }}
                disabled={disabled}
                slotProps={{ textField: { size: "small" } }}
              />
            </LocalizationProvider>
          )}
        </Box>

        {/* Cross-validation */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Typography variant="body2" color="text.secondary" fontWeight={500}>Cross-validation</Typography>
            <Tooltip title="Rolling CV con K folds. Más robusto que un solo hold-out. Requiere más observaciones." placement="top">
              <Chip label="?" size="small" variant="outlined"
                onClick={() => router.push("/dashboard/encyclopedia?chapter=10")}
                sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }} />
            </Tooltip>
          </Box>
          {isEc2 && config.modelOverride === "sarima" && config.cvFolds > 0 && (
            <Typography variant="caption" color="warning.main" sx={{ fontSize: "0.6875rem" }}>
              ⚠️ CV con SARIMA bloqueado en EC2 (memoria insuficiente).
            </Typography>
          )}
          <Box sx={{ display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
            {[0, 2, 3, 5].map((v) => {
              const blocked = v > 0 && isEc2 && config.modelOverride === "sarima"
              return (
                <Tooltip key={v} title={blocked ? "CV con SARIMA requiere modo local" : ""} placement="top" disableHoverListener={!blocked}>
                  <span>
                    <ToggleButton value={v} selected={config.cvFolds === v}
                      onChange={() => !disabled && !blocked && onChange({ cvFolds: v })}
                      size="small" disabled={blocked} sx={toggleBtnSx(config.cvFolds === v, "secondary")}>
                      {v === 0 ? "Sin CV" : `K=${v}`}
                      {blocked && <LockIcon sx={{ fontSize: "0.625rem", ml: "0.25rem" }} />}
                    </ToggleButton>
                  </span>
                </Tooltip>
              )
            })}
          </Box>
          {config.cvFolds > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>
              {config.cvFolds} folds · mín {config.cvFolds * config.horizon + 4} obs.
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
