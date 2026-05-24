"use client"

/**
 * FillGapsPanel — controls for the ETL gap-filling step.
 *
 * Lets the user choose between:
 *   ffill   → forward fill (last known value propagated forward)
 *   linear  → linear interpolation between surrounding known values
 *
 * Always uses the explicit button mode (no debounce) since gap detection
 * depends on the full series from the backend.
 */

import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import TimelineIcon from "@mui/icons-material/Timeline"
import { useState } from "react"

interface FillGapsPanelProps {
  loading: boolean
  nGaps: number              // from EDA summary — shown as context before applying
  onApply: (method: "ffill" | "linear") => void
  currentResult?: {
    method: string
    n_imputed: number
    new_quality_score: number
    new_quality_label: string
  } | null
}

const QUALITY_COLORS: Record<string, string> = {
  excellent: "#22c55e",
  good:      "#84cc16",
  fair:      "#f59e0b",
  poor:      "#ef4444",
}

const METHOD_DESCRIPTIONS: Record<string, string> = {
  ffill:  "Propaga el último valor conocido hacia adelante. Mantiene el nivel — no suaviza. Ideal para series con saltos bruscos.",
  linear: "Interpola linealmente entre el punto anterior y el siguiente. Produce transiciones suaves. Ideal para series continuas.",
}

export function FillGapsPanel({
  loading,
  nGaps,
  onApply,
  currentResult,
}: FillGapsPanelProps) {
  const [method, setMethod] = useState<"ffill" | "linear">("linear")

  const qualityColor = currentResult
    ? (QUALITY_COLORS[currentResult.new_quality_label] ?? "#94a3b8")
    : null

  return (
    <Card
      variant="outlined"
      sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}
    >
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>

        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "1.25rem" }}>
          <TimelineIcon sx={{ fontSize: "1.25rem", color: "secondary.main" }} />
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
            Imputación de gaps
          </Typography>
          <Tooltip
            title="Un gap es un período de tiempo que falta en la serie (ej. mes de marzo sin datos). La imputación genera un valor estimado para ese período."
            placement="right"
          >
            <InfoOutlinedIcon sx={{ fontSize: "1rem", color: "text.disabled", cursor: "help" }} />
          </Tooltip>
        </Box>

        {/* Context: gaps found in EDA */}
        {nGaps === 0 ? (
          <Box
            sx={{
              bgcolor: "rgba(34,197,94,0.08)",
              borderRadius: "0.5rem",
              p: "0.75rem",
              mb: "1.25rem",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <Typography sx={{ fontSize: "0.8125rem", color: "#16a34a", fontWeight: 600 }}>
              ✅ Sin gaps detectados — la serie está completa.
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              bgcolor: "rgba(245,158,11,0.08)",
              borderRadius: "0.5rem",
              p: "0.75rem",
              mb: "1.25rem",
              border: "1px solid rgba(245,158,11,0.2)",
            }}
          >
            <Typography sx={{ fontSize: "0.8125rem", color: "#b45309", fontWeight: 600 }}>
              ⚠️ {nGaps} período{nGaps !== 1 ? "s" : ""} faltante{nGaps !== 1 ? "s" : ""} detectado{nGaps !== 1 ? "s" : ""}
            </Typography>
            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: "0.25rem" }}>
              Elegí el método de imputación y aplicalo para completar la serie.
            </Typography>
          </Box>
        )}

        {/* Method selector */}
        <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, mb: "0.625rem" }}>
          Método de imputación
        </Typography>
        <ToggleButtonGroup
          value={method}
          exclusive
          onChange={(_e, v) => { if (v) setMethod(v as "ffill" | "linear") }}
          size="small"
          sx={{ mb: "0.75rem" }}
        >
          <ToggleButton value="linear" sx={{ textTransform: "none", fontSize: "0.8125rem", px: "1rem" }}>
            Interpolación lineal
          </ToggleButton>
          <ToggleButton value="ffill" sx={{ textTransform: "none", fontSize: "0.8125rem", px: "1rem" }}>
            Forward fill
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mb: "1.25rem", lineHeight: 1.6 }}>
          {METHOD_DESCRIPTIONS[method]}
        </Typography>

        <Button
          variant="contained"
          size="small"
          color="secondary"
          onClick={() => onApply(method)}
          disabled={loading || nGaps === 0}
          startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : undefined}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {loading ? "Imputando…" : "Aplicar imputación"}
        </Button>

        {/* Result summary */}
        {currentResult && !loading && (
          <>
            <Divider sx={{ my: "1.25rem" }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700 }}>
                Resultado
              </Typography>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Método usado
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {currentResult.method === "linear" ? "Interpolación lineal" : "Forward fill"}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Períodos imputados
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                  {currentResult.n_imputed}
                </Typography>
              </Box>

              <Divider sx={{ my: "0.5rem" }} />

              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Nuevo quality score
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                  <Box
                    sx={{
                      width: "0.625rem",
                      height: "0.625rem",
                      borderRadius: "50%",
                      bgcolor: qualityColor ?? "grey.400",
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: "0.9375rem",
                      fontWeight: 800,
                      color: qualityColor ?? "text.primary",
                    }}
                  >
                    {currentResult.new_quality_score}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </>
        )}
      </CardContent>
    </Card>
  )
}
