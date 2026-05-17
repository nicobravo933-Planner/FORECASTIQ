"use client"

/**
 * ModelRecommendation — badge + explanation card shown after detection.
 * Displays model name, reason, confidence, and key detected characteristics.
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import Button from "@mui/material/Button"
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import type { DetectionResult } from "@/lib/types"

interface ModelRecommendationProps {
  result: DetectionResult
  onRunForecast?: () => void
}

const MODEL_LABELS: Record<DetectionResult["model"], string> = {
  moving_average: "Promedio Móvil",
  holt_winters: "Holt-Winters",
  sarima: "SARIMA",
  lightgbm: "LightGBM",
}

const MODEL_COLOR: Record<DetectionResult["model"], "default" | "primary" | "secondary" | "warning"> = {
  moving_average: "default",
  holt_winters: "primary",
  sarima: "secondary",
  lightgbm: "warning",
}

function ConfidenceDots({ value }: { value: number }) {
  const filled = Math.round(value * 5)
  return (
    <Box sx={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Box
          key={i}
          sx={{
            width: "0.5rem",
            height: "0.5rem",
            borderRadius: "50%",
            bgcolor: i < filled ? "primary.main" : "divider",
          }}
        />
      ))}
      <Typography variant="caption" color="text.secondary" sx={{ ml: "0.25rem" }}>
        {Math.round(value * 100)}%
      </Typography>
    </Box>
  )
}

export function ModelRecommendation({ result, onRunForecast }: ModelRecommendationProps) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "primary.dark",
        borderRadius: "0.75rem",
        p: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <AutoAwesomeIcon sx={{ color: "primary.main" }} />
        <Typography variant="h6" color="text.primary">
          Modelo recomendado
        </Typography>
      </Box>

      {/* Badge + confidence */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <Chip
          label={MODEL_LABELS[result.model]}
          color={MODEL_COLOR[result.model]}
          sx={{ fontSize: "1rem", fontWeight: 700, px: "0.5rem", py: "1.25rem" }}
        />
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: "0.25rem" }}>
            Confianza de la detección
          </Typography>
          <ConfidenceDots value={result.confidence} />
        </Box>
      </Box>

      {/* Reason */}
      <Box
        sx={{
          bgcolor: "background.default",
          borderRadius: "0.5rem",
          p: "1rem",
          borderLeft: "3px solid",
          borderColor: "primary.main",
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
          {result.reason}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: "divider" }} />

      {/* Stats grid */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(10rem, 1fr))", gap: "0.75rem" }}>
        <StatItem
          icon={<ShowChartIcon fontSize="small" />}
          label="Observaciones"
          value={String(result.n_observations)}
        />
        <StatItem
          icon={<TrendingUpIcon fontSize="small" />}
          label="Tendencia"
          value={result.has_trend ? result.trend_direction : "Sin tendencia"}
          highlight={result.has_trend}
        />
        <StatItem
          icon={<ShowChartIcon fontSize="small" />}
          label="Estacionalidad"
          value={
            result.has_seasonality
              ? `Período ${result.seasonality_period}`
              : "No detectada"
          }
          highlight={result.has_seasonality}
        />
        <StatItem
          icon={<WarningAmberIcon fontSize="small" />}
          label="Outliers"
          value={`${result.outlier_count} (${(result.outlier_pct * 100).toFixed(1)}%)`}
          warn={result.outlier_pct > 0.05}
        />
        <StatItem
          label="CV (dispersión)"
          value={result.cv.toFixed(3)}
          warn={result.cv > 1.0}
        />
        <StatItem
          label="p-valor MK"
          value={result.trend_p_value.toFixed(4)}
        />
      </Box>

      {/* CTA */}
      {onRunForecast && (
        <Button
          variant="contained"
          endIcon={<ArrowForwardIcon />}
          onClick={onRunForecast}
          sx={{ alignSelf: "flex-start", mt: "0.25rem" }}
        >
          Ir a Forecast
        </Button>
      )}
    </Box>
  )
}

// Small stat cell
function StatItem({
  icon,
  label,
  value,
  highlight = false,
  warn = false,
}: {
  icon?: React.ReactNode
  label: string
  value: string
  highlight?: boolean
  warn?: boolean
}) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
        {icon && (
          <Box sx={{ color: "text.disabled", display: "flex", alignItems: "center" }}>
            {icon}
          </Box>
        )}
        <Typography variant="caption" color="text.disabled">
          {label}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        fontWeight={600}
        color={warn ? "warning.main" : highlight ? "primary.light" : "text.primary"}
      >
        {value}
      </Typography>
    </Box>
  )
}
