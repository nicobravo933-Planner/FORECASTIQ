"use client"

/**
 * ForecastConfigPanel — UX-3.
 *
 * Config panel for the Forecast page. When a dataset_id is present:
 *   - DatasetPicker shows all available datasets by name (no UUID visible)
 *   - Loads real column names from /api/datasets/{id}/preview
 *   - Shows Select dropdowns for date column and target column
 *   - Validates column types and shows inline warnings
 *
 * Model selector shows lock icon for models unavailable in cloud tier.
 * When no dataset_id is present, falls back to free-text TextFields.
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
  testPeriods:    number   // 0 = hold-out auto; N = hold-out manual
  cvFolds:        number   // 0 = sin CV; 2–5 = TimeSeriesSplit k folds
  // F2.3: training window — "auto" = full history; "custom" = user-picked date
  trainWindow:    "auto" | "1y" | "2y" | "3y" | "custom"
  trainStartDate: string | null  // ISO date, only used when trainWindow = "custom"
}

interface ForecastConfigPanelProps {
  config:    ForecastConfig
  onChange:  (patch: Partial<ForecastConfig>) => void
  disabled?: boolean
  /** E5: model IDs desbloqueados por quality score. Si es null, no se filtra nada. */
  availableModelIds?: string[] | null
  /** E6: callback cuando el usuario quiere ver el reporte de detección */
  onOpenDetectionReport?: () => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ALL_MODEL_OPTIONS: { value: ModelName | "auto"; label: string; requiresLocal: boolean }[] = [
  { value: "auto",           label: "Auto-detectar (recomendado)", requiresLocal: false },
  { value: "moving_average", label: "Promedio Móvil",               requiresLocal: false },
  { value: "holt_winters",   label: "Holt-Winters",                 requiresLocal: false },
  { value: "sarima",         label: "SARIMA",                       requiresLocal: false },
  { value: "lightgbm",       label: "LightGBM",                     requiresLocal: true  },
]

const FREQ_OPTIONS: { value: DataFreq; label: string }[] = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
  { value: "Q", label: "Trimestral" },
]

// F1.2 — test period options change based on frequency.
// Values represent "reserve last N periods for test".
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
  if (col.dtype === "numeric")  return { status: "warn", message: "Columna numérica. Verificá que sea una fecha reconocible." }
  return                               { status: "warn", message: "Columna de tipo texto. Puede haber problemas al parsear fechas." }
}

function validateTargetCol(col: DatasetColumn | undefined): ColValidation {
  if (!col) return { status: "unknown", message: "" }
  if (col.dtype === "numeric")  return { status: "ok",   message: "Columna numérica válida" }
  if (col.dtype === "datetime") return { status: "warn", message: "Parece una fecha, no un valor objetivo." }
  return                               { status: "warn", message: "El objetivo debe ser un número (ventas, unidades, etc.)." }
}

// ── Status icon ───────────────────────────────────────────────────────────────

function ColIcon({ validation }: { validation: ColValidation }) {
  if (validation.status === "ok")
    return <Tooltip title={validation.message} placement="top"><CheckCircleOutlineIcon sx={{ fontSize: "1rem", color: "success.main", flexShrink: 0 }} /></Tooltip>
  if (validation.status === "warn")
    return <Tooltip title={validation.message} placement="top"><WarningAmberIcon sx={{ fontSize: "1rem", color: "warning.main", flexShrink: 0 }} /></Tooltip>
  return null
}

// ── dtype chip ────────────────────────────────────────────────────────────────

const DTYPE_COLORS: Record<string, "default" | "success" | "warning" | "error"> = {
  datetime: "success", numeric: "success", text: "warning", unknown: "default",
}

function DtypeChip({ dtype }: { dtype: string }) {
  return (
    <Chip label={dtype} size="small" color={DTYPE_COLORS[dtype] ?? "default"} variant="outlined"
      sx={{ fontSize: "0.625rem", height: "1.125rem", pointerEvents: "none" }} />
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ForecastConfigPanel({ config, onChange, disabled = false, availableModelIds = null, onOpenDetectionReport }: ForecastConfigPanelProps) {
  const preview  = useColumnPreview(config.datasetId || null)
  const { caps } = useCapabilities()
  const isLocal  = caps.tier === "local"
  const router   = useRouter()
  const [detectedFreq, setDetectedFreq] = useState<FreqDetectionResult | null>(null)

  // E6: run detect and cache the result in appStore
  const [detecting, setDetecting] = useState(false)
  const [detectError, setDetectError] = useState<string | null>(null)

  // F1.2: local state for manual test period input
  const [testManualMode, setTestManualMode] = useState(false)
  const [testManualVal, setTestManualVal]   = useState("")

  // F1.4: link horizon <-> test periods when active
  const [linkHorizonTest, setLinkHorizonTest] = useState(false)

  // F1.2: reset testPeriods when freq changes and current value is not in new options
  useEffect(() => {
    if (testManualMode) return  // user is in manual mode, leave it alone
    const opts = TEST_PERIODS_OPTIONS[config.freq]
    if (config.testPeriods !== 0 && !opts.includes(config.testPeriods)) {
      onChange({ testPeriods: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.freq])

  const handleDetect = async () => {
    if (!config.datasetId || !config.dateCol || !config.targetCol) return
    setDetecting(true)
    setDetectError(null)
    try {
      const result = await api.post<Record<string, unknown>>(
        `/api/datasets/${config.datasetId}/detect`,
        { date_column: config.dateCol, target_column: config.targetCol, freq: config.freq }
      )
      appStore.setDetectionReport(result)
      // Auto-apply model recommendation if user hasn't manually chosen one
      if (result.model && config.modelOverride === "auto") {
        onChange({ modelOverride: result.model as ModelName })
      }
      onOpenDetectionReport?.()
    } catch (err) {
      setDetectError(err instanceof Error ? err.message : "Error al analizar la serie")
    } finally {
      setDetecting(false)
    }
  }

  // Auto-select best columns when preview loads and fields are still empty
  useEffect(() => {
    if (preview.status !== "ready") return
    const cols        = preview.columns
    const needsDate   = !config.dateCol
    const needsTarget = !config.targetCol
    if (!needsDate && !needsTarget) return

    const firstDate   = cols.find((c) => c.dtype === "datetime")
    const autoDate    = needsDate ? (firstDate?.name ?? "") : config.dateCol
    const firstTarget = cols.find((c) => c.dtype === "numeric" && c.name !== autoDate)
    const autoTarget  = needsTarget ? (firstTarget?.name ?? "") : config.targetCol

    const patch: Partial<typeof config> = {}
    if (needsDate   && autoDate)   patch.dateCol   = autoDate
    if (needsTarget && autoTarget) patch.targetCol = autoTarget
    if (Object.keys(patch).length) onChange(patch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.status])

  // Detect frequency from date column sample values
  useEffect(() => {
    if (preview.status !== "ready" || !config.dateCol) {
      setDetectedFreq(null)
      return
    }
    const dateColMeta = preview.columns.find((c) => c.name === config.dateCol)
    if (!dateColMeta || dateColMeta.dtype !== "datetime") {
      setDetectedFreq(null)
      return
    }
    const result = inferFreqFromSamples(dateColMeta.sample_values)
    setDetectedFreq(result)
    // Auto-apply if the current freq is still the default "M" (untouched)
    if (result && config.freq === "M") {
      onChange({ freq: result.freq })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.status, config.dateCol])

  const columns    = preview.status === "ready" ? preview.columns : []
  const hasColumns = columns.length > 0

  const dateColMeta   = columns.find((c) => c.name === config.dateCol)
  const targetColMeta = columns.find((c) => c.name === config.targetCol)
  const dateValidation   = validateDateCol(dateColMeta)
  const targetValidation = validateTargetCol(targetColMeta)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
        Parámetros del forecast
      </Typography>

      {/* Dataset picker — nombre legible, no UUID */}
      <DatasetPicker
        value={config.datasetId}
        onChange={(ds) => {
          onChange({
            datasetId: ds.dataset_id,
            dateCol:   ds.dateCol   ?? "",
            targetCol: ds.targetCol ?? "",
            freq:      (ds.freq as DataFreq | undefined) ?? config.freq,
          })
        }}
      />

      {/* Row count hint cuando hay preview */}
      {config.datasetId && preview.status === "ready" && (
        <Typography variant="caption" color="success.main" sx={{ mt: "-0.75rem" }}>
          {preview.totalRows.toLocaleString("es-AR")} filas · {columns.length} columnas detectadas
        </Typography>
      )}
      {config.datasetId && preview.status === "error" && (
        <Typography variant="caption" color="error.main" sx={{ mt: "-0.75rem" }}>
          {preview.message}
        </Typography>
      )}

      {/* Column selectors */}
      <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>

        {/* Date column */}
        {preview.status === "loading" ? (
          <Skeleton variant="rounded" width="12rem" height="2.5rem" />
        ) : hasColumns ? (
          <FormControl size="small" sx={{ flex: "1 1 11rem" }} disabled={disabled}>
            <InputLabel>Columna fecha</InputLabel>
            <Select value={config.dateCol} label="Columna fecha"
              onChange={(e) => onChange({ dateCol: e.target.value })}>
              {columns.map((col) => (
                <MenuItem key={col.name} value={col.name}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span>{col.name}</span>
                    <DtypeChip dtype={col.dtype} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {config.dateCol && (
              <FormHelperText sx={{ color: dateValidation.status === "ok" ? "success.main" : "warning.main", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <ColIcon validation={dateValidation} />
                {dateValidation.message}
              </FormHelperText>
            )}
          </FormControl>
        ) : (
          <TextField label="Columna fecha" size="small" value={config.dateCol}
            onChange={(e) => onChange({ dateCol: e.target.value })}
            placeholder="ej. fecha" disabled={disabled} sx={{ flex: "1 1 8rem" }} />
        )}

        {/* Target column */}
        {preview.status === "loading" ? (
          <Skeleton variant="rounded" width="14rem" height="2.5rem" />
        ) : hasColumns ? (
          <FormControl size="small" sx={{ flex: "1 1 13rem" }} disabled={disabled}>
            <InputLabel>Columna objetivo</InputLabel>
            <Select value={config.targetCol} label="Columna objetivo"
              onChange={(e) => onChange({ targetCol: e.target.value })}>
              {columns.map((col) => (
                <MenuItem key={col.name} value={col.name}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span>{col.name}</span>
                    <DtypeChip dtype={col.dtype} />
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {config.targetCol && (
              <FormHelperText sx={{ color: targetValidation.status === "ok" ? "success.main" : "warning.main", display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <ColIcon validation={targetValidation} />
                {targetValidation.message}
              </FormHelperText>
            )}
          </FormControl>
        ) : (
          <TextField label="Columna objetivo" size="small" value={config.targetCol}
            onChange={(e) => onChange({ targetCol: e.target.value })}
            placeholder="ej. ventas_unidades" disabled={disabled} sx={{ flex: "1 1 10rem" }} />
        )}
      </Box>

      {/* Same column warning */}
      {config.dateCol && config.targetCol && config.dateCol === config.targetCol && (
        <Alert severity="warning" sx={{ fontSize: "0.8125rem", py: "0.25rem" }}>
          La columna de fecha y la columna objetivo no pueden ser la misma.
        </Alert>
      )}

      {/* E6: Analizar serie — visible cuando fecha y objetivo están seleccionados y son distintos */}
      {config.datasetId && config.dateCol && config.targetCol && config.dateCol !== config.targetCol && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Tooltip
            title="Corre el pipeline MAD → FFT → Mann-Kendall → CV y explica por qué se elige cada modelo"
            placement="top"
          >
            <span>
              <Chip
                icon={detecting ? <CircularProgress size="0.875rem" /> : <SearchIcon sx={{ fontSize: "0.9rem !important" }} />}
                label={detecting ? "Analizando..." : "Analizar serie"}
                onClick={!disabled && !detecting ? handleDetect : undefined}
                color="primary"
                variant="outlined"
                size="small"
                sx={{
                  cursor: disabled || detecting ? "default" : "pointer",
                  fontSize: "0.75rem",
                  opacity: disabled ? 0.5 : 1,
                }}
              />
            </span>
          </Tooltip>
          {/* Si ya hay un reporte cacheado, mostrar link para reabrirlo */}
          {!detecting && onOpenDetectionReport && (
            <Typography
              variant="caption"
              color="primary.main"
              sx={{ cursor: "pointer", textDecoration: "underline", fontSize: "0.75rem" }}
              onClick={onOpenDetectionReport}
            >
              Ver último reporte
            </Typography>
          )}
          {detectError && (
            <Typography variant="caption" color="error.main" sx={{ fontSize: "0.75rem" }}>
              {detectError}
            </Typography>
          )}
        </Box>
      )}

      {/* Freq + model */}
      <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-start" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <TextField select label="Frecuencia" size="small" value={config.freq}
            onChange={(e) => onChange({ freq: e.target.value as DataFreq })}
            disabled={disabled} sx={{ width: "10rem" }}>
            {FREQ_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          {/* Freq detection badge */}
          {detectedFreq && (
            <Tooltip
              title={`Detectada a partir de los datos: intervalo mediano de ${detectedFreq.medianDays} día${detectedFreq.medianDays !== 1 ? "s" : ""}. Podés cambiarlo manualmente.`}
              placement="bottom"
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "help" }}>
                <AutoAwesomeIcon sx={{ fontSize: "0.75rem", color: detectedFreq.freq === config.freq ? "success.main" : "text.disabled" }} />
                <Typography variant="caption" color={detectedFreq.freq === config.freq ? "success.main" : "text.disabled"} sx={{ fontSize: "0.6875rem" }}>
                  {detectedFreq.freq === config.freq ? `${detectedFreq.label} detectada` : `Sugerida: ${detectedFreq.label}`}
                </Typography>
              </Box>
            </Tooltip>
          )}
        </Box>

        {/* Model selector with tier-based lock */}
        <FormControl size="small" sx={{ flex: "1 1 14rem", maxWidth: "18rem" }} disabled={disabled}>
          <InputLabel>Modelo</InputLabel>
          <Select value={config.modelOverride} label="Modelo"
            onChange={(e) => onChange({ modelOverride: e.target.value as ModelName | "auto" })}>
            {ALL_MODEL_OPTIONS.map((o) => {
              const lockedByTier    = o.requiresLocal && !isLocal
              // E5: bloquear si quality score no lo habilita (solo si tenemos la lista)
              const lockedByQuality = availableModelIds !== null
                && o.value !== "auto"
                && !availableModelIds.includes(o.value)
              const locked = lockedByTier || lockedByQuality
              const lockReason = lockedByTier
                ? "Requiere backend local. No disponible en modo cloud."
                : `Requiere mejor calidad de datos. Ve a EDA → ETL para desbloquearlo.`
              return (
                <MenuItem key={o.value} value={o.value} disabled={locked} sx={{ opacity: locked ? 0.5 : 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span style={{ flex: 1 }}>{o.label}</span>
                    {locked && (
                      <Tooltip title={lockReason} placement="right">
                        <LockIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
                      </Tooltip>
                    )}
                  </Box>
                </MenuItem>
              )
            })}
          </Select>
          {!isLocal && (
            <FormHelperText sx={{ fontSize: "0.6875rem" }}>
              LightGBM requiere backend local
            </FormHelperText>
          )}
        </FormControl>
      </Box>

      {/* Horizon — F4.1: chip ? links to Encyclopedia Ch.1 */}
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
        <Box sx={{ flex: 1 }}>
          <HorizonSelector
            value={config.horizon}
            freq={config.freq}
            onChange={(h) => {
              onChange(linkHorizonTest ? { horizon: h, testPeriods: h } : { horizon: h })
            }}
            disabled={disabled}
          />
        </Box>
        <Tooltip
          title="Cu\u00e1ntos per\u00edodos futuros proyectar. Vandeput recomienda no superar 1 ciclo estacional completo: 12 per\u00edodos para datos mensuales, 52 para datos semanales."
          placement="top"
        >
          <Chip
            label="?"
            size="small"
            variant="outlined"
            onClick={() => router.push("/dashboard/encyclopedia?chapter=1")}
            sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer", mt: "0.375rem" }}
          />
        </Tooltip>
      </Box>

      {/* F1.4 — Link horizon ↔ test periods */}
      <Box sx={{ display: "flex", alignItems: "center", mt: "-0.5rem" }}>
        <Tooltip
          title="Vandeput recomienda que el horizonte de proyección sea igual al período de evaluación"
          placement="top"
        >
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={linkHorizonTest}
                onChange={(e) => {
                  setLinkHorizonTest(e.target.checked)
                  if (e.target.checked) {
                    // Sync test to current horizon immediately
                    setTestManualMode(false)
                    onChange({ testPeriods: config.horizon })
                  }
                }}
                disabled={disabled}
              />
            }
            label={
              <Typography variant="caption" color="text.secondary">
                Horizonte = test (Vandeput)
              </Typography>
            }
          />
        </Tooltip>
      </Box>

      {/* Hold-out manual — F1.2: opciones adaptativas por frecuencia */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Períodos de evaluación (test)
          </Typography>
          {/* F4.1 + F4.4 — tooltip ampliado con recomendaci\u00f3n Vandeput */}
          <Tooltip
            title="Reserv\u00e1 los \u00faltimos N per\u00edodos como test. Vandeput recomienda al menos 1 ciclo estacional completo: 12 per\u00edodos (mensual), 52 semanas, 4 trimestres. Un test m\u00e1s corto subestima el error real en producci\u00f3n."
            placement="top"
          >
            <Chip
              label="?"
              size="small"
              variant="outlined"
              onClick={() => router.push("/dashboard/encyclopedia?chapter=4")}
              sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {/* Auto option always first */}
          <ToggleButton
            value={0}
            selected={config.testPeriods === 0 && !testManualMode}
            onChange={() => { if (!disabled) { setTestManualMode(false); onChange({ testPeriods: 0 }) } }}
            size="small"
            sx={{
              px: "0.75rem", py: "0.25rem", fontSize: "0.75rem", textTransform: "none",
              borderRadius: "0.375rem", border: "1px solid",
              borderColor: config.testPeriods === 0 && !testManualMode ? "primary.main" : "divider",
              bgcolor: config.testPeriods === 0 && !testManualMode ? "primary.main" : "transparent",
              color: config.testPeriods === 0 && !testManualMode ? "primary.contrastText" : "text.secondary",
              "&:hover": { bgcolor: config.testPeriods === 0 && !testManualMode ? "primary.dark" : "action.hover" },
            }}
          >
            Auto (20%)
          </ToggleButton>

          {/* Adaptive quick options per frequency */}
          {TEST_PERIODS_OPTIONS[config.freq].map((v) => (
            <ToggleButton
              key={v}
              value={v}
              selected={config.testPeriods === v && !testManualMode}
              onChange={() => { if (!disabled) { setTestManualMode(false); onChange({ testPeriods: v }) } }}
              size="small"
              sx={{
                px: "0.75rem", py: "0.25rem", fontSize: "0.75rem", textTransform: "none",
                borderRadius: "0.375rem", border: "1px solid",
                borderColor: config.testPeriods === v && !testManualMode ? "primary.main" : "divider",
                bgcolor: config.testPeriods === v && !testManualMode ? "primary.main" : "transparent",
                color: config.testPeriods === v && !testManualMode ? "primary.contrastText" : "text.secondary",
                "&:hover": { bgcolor: config.testPeriods === v && !testManualMode ? "primary.dark" : "action.hover" },
              }}
            >
              {`Últ. ${v}`}
            </ToggleButton>
          ))}

          {/* Manual input toggle */}
          <ToggleButton
            value="manual"
            selected={testManualMode}
            onChange={() => { if (!disabled) setTestManualMode((m) => !m) }}
            size="small"
            sx={{
              px: "0.75rem", py: "0.25rem", fontSize: "0.75rem", textTransform: "none",
              borderRadius: "0.375rem", border: "1px solid",
              borderColor: testManualMode ? "primary.main" : "divider",
              bgcolor: testManualMode ? "primary.main" : "transparent",
              color: testManualMode ? "primary.contrastText" : "text.secondary",
              "&:hover": { bgcolor: testManualMode ? "primary.dark" : "action.hover" },
            }}
          >
            Manual
          </ToggleButton>

          {/* Manual number input */}
          {testManualMode && (
            <TextField
              size="small"
              type="number"
              label="períodos"
              value={testManualVal}
              onChange={(e) => {
                const raw = e.target.value
                setTestManualVal(raw)
                const n = parseInt(raw, 10)
                if (!isNaN(n) && n >= 1) onChange({ testPeriods: n })
              }}
              disabled={disabled}
              inputProps={{ min: 1 }}
              sx={{ width: "6rem" }}
            />
          )}
        </Box>
        {config.testPeriods > 0 && (
          <Typography variant="caption" color="text.disabled">
            El gráfico mostrará las zonas: Entrenamiento · Test · Proyección
          </Typography>
        )}
      </Box>

      {/* F2.3 — Training window selector */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Ventana de entrenamiento
          </Typography>
          <Tooltip
            title="Limita la historia que usa el modelo. 'Auto' = toda la historia disponible. Útil cuando la demanda cambió estructuralmente (ej: pandemia) y la historia vieja 'contamina' el modelo."
            placement="top"
          >
            <Chip label="?" size="small" variant="outlined"
              onClick={() => router.push("/dashboard/encyclopedia?chapter=2")}
              sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }} />
          </Tooltip>
        </Box>
        <TextField
          select
          size="small"
          label="Ventana"
          value={config.trainWindow ?? "auto"}
          onChange={(e) => {
            const val = e.target.value as ForecastConfig["trainWindow"]
            onChange({ trainWindow: val, trainStartDate: val !== "custom" ? null : config.trainStartDate })
          }}
          disabled={disabled}
          sx={{ width: "12rem" }}
        >
          <MenuItem value="auto">Auto (toda la historia)</MenuItem>
          <MenuItem value="1y">Últimos 1 año</MenuItem>
          <MenuItem value="2y">Últimos 2 años</MenuItem>
          <MenuItem value="3y">Últimos 3 años</MenuItem>
          <MenuItem value="custom">Desde fecha…</MenuItem>
        </TextField>
        {/* DatePicker: only shown in "custom" mode */}
        {config.trainWindow === "custom" && (
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Fecha de inicio del train"
              value={config.trainStartDate ? new Date(config.trainStartDate) : null}
              onChange={(date) => {
                if (!date) { onChange({ trainStartDate: null }); return }
                const iso = (date as Date).toISOString().split("T")[0]
                onChange({ trainStartDate: iso })
              }}
              disabled={disabled}
              slotProps={{ textField: { size: "small", sx: { width: "12rem" } } }}
            />
          </LocalizationProvider>
        )}
      </Box>

      {/* Rolling CV */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Cross-validation (folds)
          </Typography>
          <Tooltip
            title="Rolling window CV con TimeSeriesSplit. Entrena K modelos en ventanas sucesivas y promedia el WAPE ± desvêo. Más robusto que un solo hold-out. Requiere serie más larga."
            placement="top"
          >
            <Chip
              label="?"
              size="small"
              variant="outlined"
              onClick={() => router.push("/dashboard/encyclopedia?chapter=10")}
              sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "pointer" }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {[0, 2, 3, 5].map((v) => (
            <ToggleButton
              key={v}
              value={v}
              selected={config.cvFolds === v}
              onChange={() => !disabled && onChange({ cvFolds: v })}
              size="small"
              sx={{
                px: "0.75rem",
                py: "0.25rem",
                fontSize: "0.75rem",
                textTransform: "none",
                borderRadius: "0.375rem",
                border: "1px solid",
                borderColor: config.cvFolds === v ? "secondary.main" : "divider",
                bgcolor: config.cvFolds === v ? "secondary.main" : "transparent",
                color: config.cvFolds === v ? "secondary.contrastText" : "text.secondary",
                "&:hover": { bgcolor: config.cvFolds === v ? "secondary.dark" : "action.hover" },
              }}
            >
              {v === 0 ? "Sin CV" : `K=${v}`}
            </ToggleButton>
          ))}
        </Box>
        {config.cvFolds > 0 && (
          <Typography variant="caption" color="text.disabled">
            {config.cvFolds} folds · cada test = {config.horizon} período{config.horizon !== 1 ? "s" : ""}
            {" "}· mín. {config.cvFolds * config.horizon + 4} obs. requeridas
          </Typography>
        )}
      </Box>
    </Box>
  )
}
