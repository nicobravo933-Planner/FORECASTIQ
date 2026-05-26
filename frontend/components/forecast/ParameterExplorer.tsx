"use client"

/**
 * ParameterExplorer — E4.
 *
 * Shows the parameters used by the fitted model and allows the user to
 * override them for a new run (educational: "what happens if I change α?").
 *
 * Design decisions:
 *  - HW: sliders for alpha/beta/gamma (continuous 0.01–0.99)
 *  - SARIMA: number inputs for p,d,q / P,D,Q,s (discrete, readonly info + override)
 *  - LightGBM: read-only summary of Optuna best params (no manual tuning — Optuna does it better)
 *  - MA: read-only window size (auto-derived from series length)
 *  - Overfitting warning shown via `overfitWarning` prop
 *
 * Re-run uses the parent's `onRerun` callback with the new manual params.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import Slider from "@mui/material/Slider"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import Divider from "@mui/material/Divider"
import Collapse from "@mui/material/Collapse"
import IconButton from "@mui/material/IconButton"
import Alert from "@mui/material/Alert"
import TuneIcon from "@mui/icons-material/Tune"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"
import type {
  ModelName,
  ModelParams,
  HoltWintersParams,
  SarimaParams,
  MovingAverageParams,
  LightGBMParams,
  LinearSplinesParams,
  SESParams,
  HoltSimpleParams,
} from "@/lib/types"

// ── Types ────────────────────────────────────────────────────────────────────

interface ParameterExplorerProps {
  modelUsed:       ModelName
  modelParams:     ModelParams
  overfitWarning?: string | null
  onRerun:         (params: ManualParams) => void
  disabled?:       boolean
}

/** Params the user can override for a manual re-run. */
export interface ManualParams {
  hw_alpha?: number
  hw_beta?:  number
  hw_gamma?: number
  sarima_order?:          [number, number, number]
  sarima_seasonal_order?: [number, number, number, number]
}

// ── Shared sub-components ────────────────────────────────────────────────────

function SliderRow({
  label,
  tooltip,
  value,
  onChange,
  disabled,
}: {
  label:    string
  tooltip:  string
  value:    number
  onChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary">
          {label}
        </Typography>
        <Tooltip title={tooltip} arrow placement="right">
          <InfoOutlinedIcon sx={{ fontSize: "0.875rem", color: "text.disabled", cursor: "help" }} />
        </Tooltip>
        <Chip
          label={value.toFixed(2)}
          size="small"
          variant="outlined"
          sx={{ ml: "auto", height: "1.25rem", fontSize: "0.7rem", minWidth: "3rem" }}
        />
      </Box>
      <Slider
        value={value}
        min={0.01}
        max={0.99}
        step={0.01}
        disabled={disabled}
        onChange={(_, v) => onChange(v as number)}
        sx={{ py: "0.5rem" }}
        size="small"
      />
    </Box>
  )
}

function OrderInput({
  label,
  value,
  onChange,
  disabled,
  min = 0,
  max = 5,
}: {
  label:    string
  value:    number
  onChange: (v: number) => void
  disabled?: boolean
  min?:     number
  max?:     number
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.25rem", flex: 1 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={600} textAlign="center">
        {label}
      </Typography>
      <TextField
        type="number"
        size="small"
        value={value}
        disabled={disabled}
        inputProps={{ min, max, style: { textAlign: "center", fontSize: "0.875rem" } }}
        onChange={(e) => {
          const v = Math.max(min, Math.min(max, parseInt(e.target.value, 10) || 0))
          onChange(v)
        }}
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: "0.375rem" } }}
      />
    </Box>
  )
}

// ── Holt-Winters panel ────────────────────────────────────────────────────────

function HoltWintersPanel({
  params,
  manual,
  setManual,
  disabled,
}: {
  params:    HoltWintersParams
  manual:    { alpha: number; beta: number; gamma: number }
  setManual: (p: { alpha: number; beta: number; gamma: number }) => void
  disabled?: boolean
}) {
  const set = (key: "alpha" | "beta" | "gamma") => (v: number) =>
    setManual({ ...manual, [key]: v })

  const isModified =
    Math.abs(manual.alpha - params.alpha) > 0.005 ||
    Math.abs(manual.beta  - params.beta)  > 0.005 ||
    Math.abs(manual.gamma - params.gamma) > 0.005

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Auto values info row */}
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {[
          { key: "α", val: params.alpha, desc: "nivel" },
          { key: "β", val: params.beta,  desc: "tendencia" },
          ...(params.use_seasonal ? [{ key: "γ", val: params.gamma, desc: "estacional" }] : []),
        ].map(({ key, val, desc }) => (
          <Tooltip key={key} title={`Valor optimizado automáticamente para ${desc}`} arrow>
            <Box
              sx={{
                display:        "flex",
                flexDirection:  "column",
                alignItems:     "center",
                bgcolor:        "action.selected",
                borderRadius:   "0.5rem",
                px:             "0.875rem",
                py:             "0.375rem",
                minWidth:       "4.5rem",
              }}
            >
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.625rem" }}>
                auto {key}
              </Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">
                {val.toFixed(3)}
              </Typography>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>
                {desc}
              </Typography>
            </Box>
          </Tooltip>
        ))}
        {isModified && (
          <Chip
            label="Modificado"
            size="small"
            color="warning"
            variant="outlined"
            sx={{ alignSelf: "center", fontSize: "0.7rem", height: "1.5rem" }}
          />
        )}
      </Box>

      <Divider>
        <Typography variant="caption" color="text.disabled">Ajuste manual</Typography>
      </Divider>

      <SliderRow
        label="α — Suavizamiento del nivel"
        tooltip="Controla cuánto peso tienen las observaciones recientes vs las antiguas. α alto (≈1) = muy reactivo al ruido. α bajo (≈0) = muy estable, ignora cambios recientes."
        value={manual.alpha}
        onChange={set("alpha")}
        disabled={disabled}
      />
      <SliderRow
        label="β — Suavizamiento de la tendencia"
        tooltip="Controla qué tan rápido la tendencia se adapta. β alto = tendencia muy sensible a cambios recientes. β≈0 = tendencia casi constante."
        value={manual.beta}
        onChange={set("beta")}
        disabled={disabled}
      />
      {params.use_seasonal && (
        <SliderRow
          label="γ — Suavizamiento estacional"
          tooltip="Controla qué tan rápido el patrón estacional se actualiza. γ alto = cada año el patrón estacional puede cambiar mucho. γ bajo = el patrón estacional es estable."
          value={manual.gamma}
          onChange={set("gamma")}
          disabled={disabled}
        />
      )}

      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        Períodos estacionales: <strong>{params.seasonal_periods}</strong>
        {!params.use_seasonal && " — estacionalidad no activada (serie muy corta)"}
      </Typography>
    </Box>
  )
}

// ── SARIMA panel ──────────────────────────────────────────────────────────────

function SarimaPanel({
  params,
  manual,
  setManual,
  disabled,
}: {
  params:    SarimaParams
  manual:    { order: [number, number, number]; seasonal_order: [number, number, number, number] }
  setManual: (p: typeof manual) => void
  disabled?: boolean
}) {
  const setO = (i: number) => (v: number) => {
    const next = [...manual.order] as [number, number, number]
    next[i] = v
    setManual({ ...manual, order: next })
  }
  const setSO = (i: number) => (v: number) => {
    const next = [...manual.seasonal_order] as [number, number, number, number]
    next[i] = v
    setManual({ ...manual, seasonal_order: next })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <Chip
          label={`Auto: SARIMA(${params.order.join(",")})×(${params.seasonal_order.slice(0,3).join(",")})${params.seasonal_order[3]}`}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
        />
        <Tooltip title="pmdarima auto_arima seleccionó este orden minimizando AIC con búsqueda stepwise." arrow>
          <InfoOutlinedIcon sx={{ fontSize: "0.875rem", color: "text.disabled", cursor: "help" }} />
        </Tooltip>
      </Box>

      <Divider>
        <Typography variant="caption" color="text.disabled">Orden no estacional</Typography>
      </Divider>
      <Box sx={{ display: "flex", gap: "0.75rem" }}>
        <OrderInput label="p — AR" value={manual.order[0]} onChange={setO(0)} disabled={disabled} max={5} />
        <OrderInput label="d — I"  value={manual.order[1]} onChange={setO(1)} disabled={disabled} max={2} />
        <OrderInput label="q — MA" value={manual.order[2]} onChange={setO(2)} disabled={disabled} max={5} />
      </Box>

      <Divider>
        <Typography variant="caption" color="text.disabled">Orden estacional</Typography>
      </Divider>
      <Box sx={{ display: "flex", gap: "0.75rem" }}>
        <OrderInput label="P — AR" value={manual.seasonal_order[0]} onChange={setSO(0)} disabled={disabled} max={3} />
        <OrderInput label="D — I"  value={manual.seasonal_order[1]} onChange={setSO(1)} disabled={disabled} max={2} />
        <OrderInput label="Q — MA" value={manual.seasonal_order[2]} onChange={setSO(2)} disabled={disabled} max={3} />
        <OrderInput label="s — per." value={manual.seasonal_order[3]} onChange={setSO(3)} disabled min={1} max={52} />
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        s = período estacional (fijo, inferido de la frecuencia de la serie).
      </Typography>
    </Box>
  )
}

// ── Moving Average panel ──────────────────────────────────────────────────────

function MovingAveragePanel({ params }: { params: MovingAverageParams }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Box
        sx={{
          display:      "flex",
          alignItems:   "center",
          gap:          "0.75rem",
          p:            "0.875rem",
          bgcolor:      "action.hover",
          borderRadius: "0.5rem",
        }}
      >
        <CheckCircleOutlineIcon sx={{ color: "success.main", fontSize: "1.25rem" }} />
        <Box>
          <Typography variant="body2" fontWeight={600}>
            Ventana efectiva: {params.window} períodos
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Calculada automáticamente como min(window_default, n÷3). No hay parámetros para tunear.
          </Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ fontStyle: "italic" }}>
        El Promedio Móvil proyecta el promedio ponderado de los últimos {params.window} períodos.
        Para mejorar el forecast, considerá limpiar los datos (ETL) para desbloquear Holt-Winters.
      </Typography>
    </Box>
  )
}

// ── Linear Splines panel (read-only) ───────────────────────────────────────

function LinearSplinesPanel({ params }: { params: LinearSplinesParams }) {
  const chips = [
    { label: "n_knots",   value: String(params.n_knots),   desc: "Número de nudos" },
    { label: "degree",    value: String(params.degree),    desc: "Grado polinomial" },
    { label: "alpha",     value: params.alpha.toFixed(4),  desc: "Regularización Ridge" },
    { label: "season_len",value: String(params.season_len),desc: "Período estacional" },
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {chips.map(({ label, value, desc }) => (
          <Tooltip key={label} title={desc} arrow>
            <Box
              sx={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                bgcolor:       "action.selected",
                borderRadius:  "0.5rem",
                px:            "0.875rem",
                py:            "0.375rem",
                minWidth:      "5rem",
              }}
            >
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.625rem" }}>
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700} color="warning.main">
                {value}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        Regresión Lineal + Splines cúbicos naturales. Modelo interpretable: cada parámetro
        tiene significado directo. No tiene tuneo manual — los nudos y el grado están
        optimizados automáticamente.
      </Typography>
    </Box>
  )
}

// ── SES panel (read-only: solo alpha) ───────────────────────────────────────

function SESPanel({ params }: { params: SESParams }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Tooltip title="Peso del valor más reciente. α=1 → sólo el último valor importa. α≈0 → todos los períodos pesan igual." arrow>
          <Box
            sx={{
              display:       "flex",
              flexDirection: "column",
              alignItems:    "center",
              bgcolor:       "action.selected",
              borderRadius:  "0.5rem",
              px:            "0.875rem",
              py:            "0.375rem",
              minWidth:      "5rem",
            }}
          >
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.625rem" }}>
              α (nivel)
            </Typography>
            <Typography variant="body2" fontWeight={700} color="primary.main">
              {params.alpha.toFixed(4)}
            </Typography>
          </Box>
        </Tooltip>
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        SES solo captura el nivel — sin tendencia ni estacionalidad. Ideal para series
        cortas o muy ruidosas. El parámetro α es optimizado automáticamente por statsmodels.
      </Typography>
    </Box>
  )
}

// ── Holt Simple panel (read-only: alpha + beta) ───────────────────────────────

function HoltSimplePanel({ params }: { params: HoltSimpleParams }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {[
          { key: "α", val: params.alpha, desc: "nivel",     tooltip: "Peso del nivel más reciente. α alto = muy reactivo a cambios de nivel." },
          { key: "β", val: params.beta,  desc: "tendencia", tooltip: "Peso de la tendencia más reciente. β alto = tendencia muy adaptable." },
        ].map(({ key, val, desc, tooltip }) => (
          <Tooltip key={key} title={tooltip} arrow>
            <Box
              sx={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                bgcolor:       "action.selected",
                borderRadius:  "0.5rem",
                px:            "0.875rem",
                py:            "0.375rem",
                minWidth:      "5rem",
              }}
            >
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.625rem" }}>
                {key} ({desc})
              </Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">
                {val.toFixed(4)}
              </Typography>
            </Box>
          </Tooltip>
        ))}
      </Box>
      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        Holt Simple captura nivel + tendencia, sin estacionalidad. Usa cuando hay tendencia
        clara pero sin ciclo estacional (Mann-Kendall significativo, FFT no detecta pico).
        Ambos parámetros son optimizados automáticamente.
      </Typography>
    </Box>
  )
}

// ── LightGBM panel ────────────────────────────────────────────────────────────

function LightGBMPanel({ params }: { params: LightGBMParams }) {
  const [expanded, setExpanded] = useState(false)

  const topParams = [
    { key: "n_estimators",  label: "Árboles" },
    { key: "num_leaves",    label: "Hojas" },
    { key: "learning_rate", label: "LR" },
    { key: "max_lag",       label: "Lags",  val: params.max_lag },
  ]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <Chip
          label={params.used_cache ? "Parámetros desde cache HPO" : `Optuna: ${params.n_trials} trials`}
          size="small"
          color={params.used_cache ? "success" : "primary"}
          variant="outlined"
          sx={{ fontSize: "0.75rem" }}
        />
        <Chip
          label={`max_lag = ${params.max_lag}`}
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.75rem" }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {topParams.map(({ key, label, val: overrideVal }) => {
          const val = overrideVal !== undefined ? overrideVal : params.best_params[key]
          if (val === undefined) return null
          return (
            <Box
              key={key}
              sx={{
                display:       "flex",
                flexDirection: "column",
                alignItems:    "center",
                bgcolor:       "action.selected",
                borderRadius:  "0.5rem",
                px:            "0.75rem",
                py:            "0.375rem",
                minWidth:      "4rem",
              }}
            >
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6rem" }}>
                {label}
              </Typography>
              <Typography variant="body2" fontWeight={700} color="primary.main">
                {typeof val === "number" && val < 1 ? val.toFixed(4) : Math.round(val as number)}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {Object.keys(params.best_params).length > 0 && (
        <>
          <Box
            onClick={() => setExpanded((v) => !v)}
            sx={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", color: "text.secondary" }}
          >
            <Typography variant="caption" fontWeight={600}>
              {expanded ? "Ocultar" : "Ver"} todos los hiperparámetros Optuna
            </Typography>
            <IconButton size="small" sx={{ p: 0 }}>
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Box>
          <Collapse in={expanded}>
            <Box
              component="table"
              sx={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.75rem",
                "& td, & th": { p: "0.25rem 0.5rem", borderBottom: "1px solid", borderColor: "divider" },
                "& th": { color: "text.disabled", fontWeight: 600, textAlign: "left" },
              }}
            >
              <thead>
                <tr><th>Parámetro</th><th>Valor</th></tr>
              </thead>
              <tbody>
                {Object.entries(params.best_params).map(([k, v]) => (
                  <tr key={k}>
                    <td><code>{k}</code></td>
                    <td>{typeof v === "number" && v < 1 ? v.toFixed(4) : String(v)}</td>
                  </tr>
                ))}
              </tbody>
            </Box>
          </Collapse>
        </>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        LightGBM no tiene tuneo manual — Optuna ya encontró el óptimo en {params.n_trials} trials.
        Para re-optimizar, usá el botón &ldquo;Re-optimizar&rdquo; en el panel de configuración.
      </Typography>
    </Box>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ParameterExplorer({
  modelUsed,
  modelParams,
  overfitWarning,
  onRerun,
  disabled,
}: ParameterExplorerProps) {
  const [open, setOpen] = useState(false)

  // Cast to specific types for each panel
  const hw  = modelParams as HoltWintersParams
  const sa  = modelParams as SarimaParams
  const lgb = modelParams as LightGBMParams
  const ma  = modelParams as MovingAverageParams
  const ls  = modelParams as LinearSplinesParams
  const ses = modelParams as SESParams
  const hs  = modelParams as HoltSimpleParams

  // Local manual state — initialized from auto params on first render
  const [hwManual, setHwManual] = useState({
    alpha: hw.alpha ?? 0.3,
    beta:  hw.beta  ?? 0.1,
    gamma: hw.gamma ?? 0.1,
  })
  const [saManual, setSaManual] = useState({
    order:          (sa.order          ?? [1, 1, 1]) as [number, number, number],
    seasonal_order: (sa.seasonal_order ?? [1, 1, 1, 12]) as [number, number, number, number],
  })

  const hasManualControls = modelUsed === "holt_winters" || modelUsed === "sarima"

  const handleRerun = () => {
    const params: ManualParams = {}
    if (modelUsed === "holt_winters") {
      params.hw_alpha = hwManual.alpha
      params.hw_beta  = hwManual.beta
      params.hw_gamma = hwManual.gamma
    } else if (modelUsed === "sarima") {
      params.sarima_order          = saManual.order
      params.sarima_seasonal_order = saManual.seasonal_order
    }
    onRerun(params)
  }

  const modelLabel: Record<ModelName, string> = {
    moving_average: "Promedio Móvil",
    holt_winters:   "Holt-Winters",
    sarima:         "SARIMA",
    lightgbm:       "LightGBM",
    linear_splines: "Regresión Lineal + Splines",
    ses:            "SES (Suavizamiento Simple)",
    holt_simple:    "Holt Simple",
  }

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {/* Collapsible header */}
      <Box
        onClick={() => setOpen((v) => !v)}
        sx={{
          display:    "flex",
          alignItems: "center",
          gap:        "0.625rem",
          p:          "0.875rem 1.25rem",
          cursor:     "pointer",
          userSelect: "none",
          bgcolor:    open ? "action.hover" : "transparent",
          "&:hover":  { bgcolor: "action.hover" },
          transition: "background-color 0.15s",
        }}
      >
        <TuneIcon sx={{ color: "primary.main", fontSize: "1.125rem" }} />
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
          Explorador de parámetros
        </Typography>
        <Chip
          label={modelLabel[modelUsed]}
          size="small"
          color="primary"
          variant="outlined"
          sx={{ fontSize: "0.7rem", height: "1.375rem" }}
        />
        <IconButton size="small" sx={{ p: 0, color: "text.secondary" }}>
          {open ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      <Collapse in={open}>
        <Divider />
        <Box sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {overfitWarning && (
            <Alert severity="warning" sx={{ fontSize: "0.8125rem" }}>
              {overfitWarning}
            </Alert>
          )}

          {modelUsed === "holt_winters"   && (
            <HoltWintersPanel params={hw} manual={hwManual} setManual={setHwManual} disabled={disabled} />
          )}
          {modelUsed === "sarima"         && (
            <SarimaPanel params={sa} manual={saManual} setManual={setSaManual} disabled={disabled} />
          )}
          {modelUsed === "moving_average" && <MovingAveragePanel params={ma} />}
          {modelUsed === "lightgbm"       && <LightGBMPanel params={lgb} />}
          {modelUsed === "linear_splines" && <LinearSplinesPanel params={ls} />}
          {modelUsed === "ses"            && <SESPanel params={ses} />}
          {modelUsed === "holt_simple"    && <HoltSimplePanel params={hs} />}

          {hasManualControls && (
            <>
              <Divider />
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PlayArrowIcon />}
                  onClick={handleRerun}
                  disabled={disabled}
                  sx={{ flexShrink: 0 }}
                >
                  Re-correr con estos parámetros
                </Button>
                <Typography variant="caption" color="text.disabled">
                  El gráfico se actualizará con los nuevos valores.
                </Typography>
              </Box>
            </>
          )}

        </Box>
      </Collapse>
    </Paper>
  )
}
