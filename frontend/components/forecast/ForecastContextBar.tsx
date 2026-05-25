"use client"

/**
 * ForecastContextBar — F2.1
 *
 * Compact bar rendered above ForecastConfigPanel that makes the
 * EDA → ETL → Forecast connection visible at a glance.
 *
 * Shows:
 *   - Dataset name + ETL badge (orange "ETL ✓" if cleanedDatasetId exists)
 *   - Observation count + detected frequency
 *   - Quality score chip (color-coded red/yellow/green)
 *   - Quick-action buttons to EDA / ETL when quality < 60
 */

import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Tooltip from "@mui/material/Tooltip"
import Paper from "@mui/material/Paper"
import StorageIcon from "@mui/icons-material/Storage"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import AssessmentIcon from "@mui/icons-material/Assessment"
import CleaningServicesIcon from "@mui/icons-material/CleaningServices"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForecastContextBarProps {
  datasetName:   string          // display name (filename or UUID slice)
  nObs:          number          // total rows in dataset
  freq:          string          // detected frequency label e.g. "Mensual"
  qualityScore:  number | null   // 0-100, null if not yet computed
  qualityLabel:  string | null   // "poor" | "fair" | "good" | "excellent"
  isEtlCleaned:  boolean         // true if cleanedDatasetId exists in appStore
  onGoToEda:     () => void
  onGoToEtl:     () => void
}

// ── Quality color helper ───────────────────────────────────────────────────

function qualityColor(score: number | null): "error" | "warning" | "success" | "default" {
  if (score === null) return "default"
  if (score < 30)    return "error"
  if (score < 60)    return "warning"
  return "success"
}

const FREQ_LABELS: Record<string, string> = {
  D: "Diaria", W: "Semanal", M: "Mensual", MS: "Mensual", Q: "Trim.", QS: "Trim.",
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ForecastContextBar({
  datasetName,
  nObs,
  freq,
  qualityScore,
  qualityLabel,
  isEtlCleaned,
  onGoToEda,
  onGoToEtl,
}: ForecastContextBarProps) {
  const showImproveActions = qualityScore !== null && qualityScore < 60

  return (
    <Paper
      variant="outlined"
      sx={{
        px: "1rem",
        py: "0.625rem",
        borderRadius: "0.625rem",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.625rem",
        bgcolor: "background.default",
      }}
    >
      {/* Dataset icon + name */}
      <StorageIcon sx={{ fontSize: "1rem", color: "text.disabled", flexShrink: 0 }} />
      <Typography
        variant="body2"
        fontWeight={600}
        color="text.primary"
        sx={{ maxWidth: "12rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
        title={datasetName}
      >
        {datasetName}
      </Typography>

      {/* ETL badge */}
      {isEtlCleaned ? (
        <Tooltip title="Estás usando el dataset procesado por ETL (winsorización / imputación de gaps aplicada)">
          <Chip
            icon={<CheckCircleIcon sx={{ fontSize: "0.875rem !important" }} />}
            label="ETL ✓"
            size="small"
            sx={{
              bgcolor: "warning.light",
              color: "warning.contrastText",
              fontWeight: 700,
              fontSize: "0.6875rem",
              height: "1.375rem",
            }}
          />
        </Tooltip>
      ) : (
        <Chip
          label="Original"
          size="small"
          variant="outlined"
          sx={{ fontSize: "0.6875rem", height: "1.375rem", color: "text.disabled" }}
        />
      )}

      {/* Observation count */}
      <Chip
        label={`${nObs.toLocaleString("es-AR")} obs`}
        size="small"
        variant="outlined"
        sx={{ fontSize: "0.6875rem", height: "1.375rem" }}
      />

      {/* Frequency */}
      <Chip
        label={FREQ_LABELS[freq] ?? freq}
        size="small"
        variant="outlined"
        sx={{ fontSize: "0.6875rem", height: "1.375rem" }}
      />

      {/* Quality score chip */}
      {qualityScore !== null && (
        <Tooltip
          title={`Quality score: ${qualityScore}/100 — ${qualityLabel ?? ""}. Basado en completitud, historia, regularidad y outliers.`}
        >
          <Chip
            label={`Calidad: ${qualityScore}`}
            size="small"
            color={qualityColor(qualityScore)}
            variant="filled"
            sx={{ fontWeight: 700, fontSize: "0.6875rem", height: "1.375rem" }}
          />
        </Tooltip>
      )}

      {/* Quick-action buttons — only when quality < 60 */}
      {showImproveActions && (
        <Box sx={{ display: "flex", gap: "0.375rem", ml: "auto" }}>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<AssessmentIcon sx={{ fontSize: "0.875rem !important" }} />}
            onClick={onGoToEda}
            sx={{ fontSize: "0.6875rem", py: "0.25rem", px: "0.625rem", height: "1.75rem" }}
          >
            Mejorar en EDA
          </Button>
          <Button
            size="small"
            variant="outlined"
            color="warning"
            startIcon={<CleaningServicesIcon sx={{ fontSize: "0.875rem !important" }} />}
            onClick={onGoToEtl}
            sx={{ fontSize: "0.6875rem", py: "0.25rem", px: "0.625rem", height: "1.75rem" }}
          >
            Limpiar en ETL
          </Button>
        </Box>
      )}
    </Paper>
  )
}
