"use client"

/**
 * ModelGatingPanel — E5: semáforo de calidad → modelos disponibles.
 *
 * Muestra el quality score del dataset activo y los modelos desbloqueados/bloqueados.
 * El usuario puede ver de un vistazo qué modelos puede usar y por qué.
 *
 * Comportamiento:
 *  - Si el quality score es null (EDA no corrió aún) → banner "Corré el EDA primero".
 *  - Si hay score → barra de progreso coloreada + chips de modelos.
 *  - Modelos bloqueados muestran el requisito de score mínimo.
 *  - Botón "Ir a EDA" para mejorar el score.
 *  - Botón "Ir a ETL" si hay outliers o gaps (score < 80).
 */

import Box from "@mui/material/Box"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import LinearProgress from "@mui/material/LinearProgress"
import Tooltip from "@mui/material/Tooltip"
import Chip from "@mui/material/Chip"
import Button from "@mui/material/Button"
import Collapse from "@mui/material/Collapse"
import IconButton from "@mui/material/IconButton"
import LockIcon from "@mui/icons-material/Lock"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import AssessmentIcon from "@mui/icons-material/Assessment"
import CleaningServicesIcon from "@mui/icons-material/CleaningServices"
import ExpandMoreIcon from "@mui/icons-material/ExpandMore"
import ExpandLessIcon from "@mui/icons-material/ExpandLess"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import Link from "next/link"
import { useState } from "react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ModelGatingPanelProps {
  /** Quality score 0-100, null si EDA no corrió aún */
  qualityScore: number | null
  /** "poor" | "fair" | "good" | "excellent" */
  qualityLabel: string | null
  /** IDs de modelos disponibles según el score (["moving_average", "holt_winters", ...]) */
  availableModelIds: string[]
  /** Model seleccionado actualmente en el config */
  selectedModel: string
  /** Callback para cambiar el modelo desde el panel */
  onSelectModel: (modelId: string) => void
}

// ── Catálogo de modelos con requisitos mínimos ─────────────────────────────────

const MODEL_CATALOG = [
  {
    id:          "moving_average",
    label:       "Moving Average",
    minScore:    0,
    minLabel:    "Siempre disponible",
    description: "Baseline robusto. Ideal para series cortas o muy ruidosas.",
    color:       "#6366f1",
  },
  {
    id:          "holt_winters",
    label:       "Holt-Winters",
    minScore:    30,
    minLabel:    "Score ≥ 30",
    description: "Suavizado exponencial triple. Captura nivel, tendencia y estacionalidad.",
    color:       "#0ea5e9",
  },
  {
    id:          "sarima",
    label:       "SARIMA",
    minScore:    60,
    minLabel:    "Score ≥ 60",
    description: "ARIMA estacional con auto-selección de parámetros. Intervalos de confianza.",
    color:       "#f59e0b",
  },
  {
    id:          "lightgbm",
    label:       "LightGBM",
    minScore:    80,
    minLabel:    "Score ≥ 80",
    description: "Gradient boosting con features de lag y calendario. Optuna HPO.",
    color:       "#10b981",
  },
]

// ── Semáforo de colores por label ──────────────────────────────────────────────

const SCORE_COLOR: Record<string, string> = {
  poor:      "#ef4444",
  fair:      "#f59e0b",
  good:      "#0ea5e9",
  excellent: "#10b981",
}

const SCORE_LABEL_ES: Record<string, string> = {
  poor:      "Insuficiente",
  fair:      "Aceptable",
  good:      "Bueno",
  excellent: "Excelente",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ModelGatingPanel({
  qualityScore,
  qualityLabel,
  availableModelIds,
  selectedModel,
  onSelectModel,
}: ModelGatingPanelProps) {
  const [expanded, setExpanded] = useState(false)

  // Sin EDA corrido: banner informativo
  if (qualityScore === null) {
    return (
      <Paper
        variant="outlined"
        sx={{
          p: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          borderRadius: "0.625rem",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <InfoOutlinedIcon sx={{ color: "text.disabled", fontSize: "1.25rem", flexShrink: 0 }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Sin análisis de calidad. Todos los modelos disponibles (sin restricción).
          </Typography>
          <Typography variant="caption" color="text.disabled">
            Corré el EDA para ver qué modelos son apropiados para tus datos.
          </Typography>
        </Box>
        <Button
          component={Link}
          href="/dashboard/eda"
          size="small"
          startIcon={<AssessmentIcon />}
          variant="outlined"
          sx={{ flexShrink: 0, fontSize: "0.75rem" }}
        >
          Ir a EDA
        </Button>
      </Paper>
    )
  }

  const scoreColor = SCORE_COLOR[qualityLabel ?? "poor"] ?? "#6366f1"
  const scoreLabelEs = SCORE_LABEL_ES[qualityLabel ?? "poor"] ?? "—"
  const available = MODEL_CATALOG.filter((m) => availableModelIds.includes(m.id))
  const locked    = MODEL_CATALOG.filter((m) => !availableModelIds.includes(m.id))
  const canImprove = qualityScore < 80

  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: "0.625rem", overflow: "hidden" }}
    >
      {/* ── Header row: score + toggle ──────────────────────────────────────── */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          px: "1rem",
          py: "0.75rem",
          cursor: "pointer",
          "&:hover": { bgcolor: "action.hover" },
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Score badge */}
        <Box
          sx={{
            width: "2.5rem",
            height: "2.5rem",
            borderRadius: "50%",
            bgcolor: `${scoreColor}18`,
            border: `2px solid ${scoreColor}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Typography sx={{ fontSize: "0.75rem", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
            {qualityScore}
          </Typography>
        </Box>

        {/* Label + barra */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "0.25rem" }}>
            <Typography variant="body2" fontWeight={600} color="text.primary" noWrap>
              Calidad de datos: <span style={{ color: scoreColor }}>{scoreLabelEs}</span>
            </Typography>
            <Chip
              label={`${available.length} modelo${available.length !== 1 ? "s" : ""} disponible${available.length !== 1 ? "s" : ""}`}
              size="small"
              sx={{
                height: "1.25rem",
                fontSize: "0.625rem",
                fontWeight: 700,
                bgcolor: `${scoreColor}18`,
                color: scoreColor,
                border: `1px solid ${scoreColor}40`,
              }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={qualityScore}
            sx={{
              height: "0.375rem",
              borderRadius: "0.25rem",
              bgcolor: "action.selected",
              "& .MuiLinearProgress-bar": { bgcolor: scoreColor, borderRadius: "0.25rem" },
            }}
          />
        </Box>

        <IconButton size="small" sx={{ color: "text.disabled" }}>
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* ── Collapsed: chips de modelos disponibles (quick select) ──────────── */}
      {!expanded && (
        <Box sx={{ px: "1rem", pb: "0.75rem", display: "flex", gap: "0.375rem", flexWrap: "wrap" }}>
          {MODEL_CATALOG.map((m) => {
            const isAvail    = availableModelIds.includes(m.id)
            const isSelected = selectedModel === m.id || (selectedModel === "auto" && m.id === available[available.length - 1]?.id)
            return (
              <Tooltip
                key={m.id}
                title={isAvail ? m.description : `Bloqueado — ${m.minLabel}`}
                placement="top"
                arrow
              >
                <span>
                  <Chip
                    label={m.label}
                    size="small"
                    icon={isAvail
                      ? (isSelected ? <CheckCircleIcon sx={{ fontSize: "0.875rem !important" }} /> : <LockOpenIcon sx={{ fontSize: "0.875rem !important" }} />)
                      : <LockIcon sx={{ fontSize: "0.875rem !important" }} />
                    }
                    onClick={isAvail ? () => onSelectModel(m.id) : undefined}
                    sx={{
                      height: "1.625rem",
                      fontSize: "0.6875rem",
                      fontWeight: isSelected ? 700 : 500,
                      cursor: isAvail ? "pointer" : "default",
                      opacity: isAvail ? 1 : 0.45,
                      bgcolor: isSelected
                        ? `${m.color}22`
                        : isAvail ? "transparent" : "action.disabledBackground",
                      color: isAvail ? m.color : "text.disabled",
                      border: `1px solid ${isAvail ? m.color + "50" : "transparent"}`,
                      "&:hover": isAvail
                        ? { bgcolor: `${m.color}18` }
                        : {},
                    }}
                  />
                </span>
              </Tooltip>
            )
          })}
        </Box>
      )}

      {/* ── Expanded: detalle de cada modelo ────────────────────────────────── */}
      <Collapse in={expanded}>
        <Box sx={{ px: "1rem", pb: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>

          {/* Disponibles */}
          {available.length > 0 && (
            <Box>
              <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.5rem" }}>
                ✅ Disponibles
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {available.map((m) => {
                  const isSelected = selectedModel === m.id
                  return (
                    <Box
                      key={m.id}
                      onClick={() => onSelectModel(m.id)}
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        p: "0.625rem 0.875rem",
                        borderRadius: "0.5rem",
                        border: "1px solid",
                        borderColor: isSelected ? m.color : `${m.color}30`,
                        bgcolor: isSelected ? `${m.color}10` : `${m.color}06`,
                        cursor: "pointer",
                        transition: "all 0.15s",
                        "&:hover": { bgcolor: `${m.color}15`, borderColor: m.color },
                      }}
                    >
                      <LockOpenIcon sx={{ fontSize: "1rem", color: m.color, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "text.primary" }}>
                          {m.label}
                        </Typography>
                        <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", mt: "0.125rem" }}>
                          {m.description}
                        </Typography>
                      </Box>
                      {isSelected && (
                        <CheckCircleIcon sx={{ fontSize: "1rem", color: m.color, flexShrink: 0 }} />
                      )}
                    </Box>
                  )
                })}
              </Box>
            </Box>
          )}

          {/* Bloqueados */}
          {locked.length > 0 && (
            <Box sx={{ mt: "0.25rem" }}>
              <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.5rem" }}>
                🔒 Bloqueados
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {locked.map((m) => (
                  <Box
                    key={m.id}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      p: "0.625rem 0.875rem",
                      borderRadius: "0.5rem",
                      border: "1px solid",
                      borderColor: "divider",
                      bgcolor: "action.disabledBackground",
                      opacity: 0.6,
                    }}
                  >
                    <LockIcon sx={{ fontSize: "1rem", color: "text.disabled", flexShrink: 0 }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.secondary" }}>
                        {m.label}
                      </Typography>
                      <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled", mt: "0.125rem" }}>
                        Requiere score ≥ {m.minScore} · Actual: {qualityScore}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* CTAs: mejorar calidad */}
          {canImprove && (
            <Box sx={{ display: "flex", gap: "0.5rem", mt: "0.5rem", flexWrap: "wrap" }}>
              <Button
                component={Link}
                href="/dashboard/eda"
                size="small"
                startIcon={<AssessmentIcon />}
                variant="outlined"
                sx={{ fontSize: "0.75rem", py: "0.25rem" }}
              >
                Ver EDA
              </Button>
              <Button
                component={Link}
                href="/dashboard/etl"
                size="small"
                startIcon={<CleaningServicesIcon />}
                variant="outlined"
                color="secondary"
                sx={{ fontSize: "0.75rem", py: "0.25rem" }}
              >
                Limpiar datos (ETL)
              </Button>
              <Typography variant="caption" color="text.disabled" sx={{ alignSelf: "center", fontSize: "0.6875rem" }}>
                Limpiar los datos puede desbloquear más modelos.
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>
    </Paper>
  )
}
