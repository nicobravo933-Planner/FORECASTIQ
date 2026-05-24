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
import LockIcon from "@mui/icons-material/Lock"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"
import { useEffect, useState } from "react"
import { useColumnPreview } from "@/hooks/useColumnPreview"
import { useCapabilities } from "@/hooks/useCapabilities"
import { DatasetPicker } from "@/components/forecast/DatasetPicker"
import { HorizonSelector } from "@/components/forecast/HorizonSelector"
import { inferFreqFromSamples, type FreqDetectionResult } from "@/lib/freqDetection"
import type { DataFreq, ModelName, DatasetColumn } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ForecastConfig {
  datasetId:     string
  dateCol:       string
  targetCol:     string
  freq:          DataFreq
  horizon:       number
  modelOverride: ModelName | "auto"
  testPeriods:   number   // 0 = hold-out auto; N = hold-out manual
  cvFolds:       number   // 0 = sin CV; 2–5 = TimeSeriesSplit k folds
}

interface ForecastConfigPanelProps {
  config:    ForecastConfig
  onChange:  (patch: Partial<ForecastConfig>) => void
  disabled?: boolean
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

export function ForecastConfigPanel({ config, onChange, disabled = false }: ForecastConfigPanelProps) {
  const preview  = useColumnPreview(config.datasetId || null)
  const { caps } = useCapabilities()
  const isLocal  = caps.tier === "local"
  const [detectedFreq, setDetectedFreq] = useState<FreqDetectionResult | null>(null)

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
              const locked = o.requiresLocal && !isLocal
              return (
                <MenuItem key={o.value} value={o.value} disabled={locked} sx={{ opacity: locked ? 0.5 : 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                    <span style={{ flex: 1 }}>{o.label}</span>
                    {locked && (
                      <Tooltip title="Requiere backend local. No disponible en modo cloud." placement="right">
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

      {/* Horizon */}
      <HorizonSelector
        value={config.horizon}
        freq={config.freq}
        onChange={(h) => onChange({ horizon: h })}
        disabled={disabled}
      />

      {/* Hold-out manual */}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Períodos de evaluación (test)
          </Typography>
          <Tooltip
            title="Reserva los últimos N períodos como test. El modelo se entrena sin ellos y sus predicciones se comparan contra los valores reales. Ves las 3 zonas en el gráfico."
            placement="top"
          >
            <Chip
              label="?"
              size="small"
              variant="outlined"
              sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "help" }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          {[0, 3, 6, 12].map((v) => (
            <ToggleButton
              key={v}
              value={v}
              selected={config.testPeriods === v}
              onChange={() => !disabled && onChange({ testPeriods: v })}
              size="small"
              sx={{
                px: "0.75rem",
                py: "0.25rem",
                fontSize: "0.75rem",
                textTransform: "none",
                borderRadius: "0.375rem",
                border: "1px solid",
                borderColor: config.testPeriods === v ? "primary.main" : "divider",
                bgcolor: config.testPeriods === v ? "primary.main" : "transparent",
                color: config.testPeriods === v ? "primary.contrastText" : "text.secondary",
                "&:hover": { bgcolor: config.testPeriods === v ? "primary.dark" : "action.hover" },
              }}
            >
              {v === 0 ? "Auto (20%)" : `Últimos ${v}`}
            </ToggleButton>
          ))}
        </Box>
        {config.testPeriods > 0 && (
          <Typography variant="caption" color="text.disabled">
            El gráfico mostrará las zonas: Entrenamiento · Test · Proyección
          </Typography>
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
              sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "help" }}
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
