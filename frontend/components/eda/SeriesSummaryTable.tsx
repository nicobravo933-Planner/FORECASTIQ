"use client"

/**
 * SeriesSummaryTable — tabla de estadísticas descriptivas de la serie.
 * Dos columnas: info temporal (izquierda) + estadísticas numéricas (derecha).
 */

import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import Typography from "@mui/material/Typography"
import type { SeriesSummary } from "@/hooks/useEda"

interface SeriesSummaryTableProps {
  data: SeriesSummary
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        py: "0.375rem",
        px: "0.5rem",
        borderRadius: "0.375rem",
        "&:hover": { bgcolor: "rgba(0,0,0,0.03)" },
      }}
    >
      <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>{label}</Typography>
      <Typography
        sx={{
          fontSize: "0.8125rem",
          fontWeight: highlight ? 700 : 500,
          color: highlight ? "primary.main" : "text.primary",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </Typography>
    </Box>
  )
}

const FREQ_LABELS: Record<string, string> = {
  D: "Diaria",
  W: "Semanal",
  M: "Mensual",
  Q: "Trimestral",
}

export function SeriesSummaryTable({ data }: SeriesSummaryTableProps) {
  const freqLabel = FREQ_LABELS[data.freq] ?? data.freq

  // CV semáforo: < 0.3 baja variabilidad, 0.3-1 media, > 1 alta
  const cvColor =
    data.cv > 1 ? "#ef4444" : data.cv > 0.3 ? "#f59e0b" : "#10b981"

  // Comparación contextual del CV según frecuencia
  // Umbrales empíricos de Vandeputt: CV > 1 = demanda altamente volátil (usa LightGBM)
  const cvContextLabel =
    data.cv > 1.5 ? "Muy alta volatilidad — típico de SKUs intermitentes" :
    data.cv > 1.0 ? "Alta volatilidad — LightGBM puede aprovechar features" :
    data.cv > 0.5 ? "Volatilidad media — Holt-Winters o SARIMA adecuados" :
    data.cv > 0.3 ? "Baja variabilidad — serie bastante estable" :
                    "Muy estable — Moving Average puede ser suficiente"

  return (
    <Card variant="outlined" sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "1rem" }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: "text.primary" }}>
            Resumen de la serie
          </Typography>
          <Chip
            label={freqLabel}
            size="small"
            sx={{ fontSize: "0.75rem", fontWeight: 600, bgcolor: "primary.50", color: "primary.main" }}
          />
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: "0.75rem" }}>
          {/* Columna izquierda: info temporal */}
          <Box>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.5rem", px: "0.5rem" }}>
              Datos temporales
            </Typography>
            <StatRow label="Observaciones"     value={data.n_observations.toLocaleString()} highlight />
            <StatRow label="Inicio"             value={data.date_start} />
            <StatRow label="Fin"                value={data.date_end} />
            <StatRow label="Historia"           value={`${data.history_years} años`} />
            <StatRow label="Valores nulos"      value={`${data.null_count} (${data.null_pct}%)`} />
            <StatRow label="Períodos faltantes" value={`${data.n_gaps} (${(data.gap_ratio * 100).toFixed(1)}%)`} />
          </Box>

          <Divider orientation="vertical" flexItem sx={{ display: { xs: "none", sm: "block" } }} />

          {/* Columna derecha: estadísticas del target */}
          <Box>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.5rem", px: "0.5rem" }}>
              Estadísticas del objetivo
            </Typography>
            <StatRow label="Media"    value={data.mean.toLocaleString()}   highlight />
            <StatRow label="Mediana"  value={data.median.toLocaleString()} />
            <StatRow label="Desvío"   value={data.std.toLocaleString()} />
            <StatRow label="Mínimo"   value={data.min_val.toLocaleString()} />
            <StatRow label="Máximo"   value={data.max_val.toLocaleString()} />
            <StatRow label="Skewness" value={data.skewness.toFixed(3)} />
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                py: "0.375rem",
                px: "0.5rem",
                borderRadius: "0.375rem",
                "&:hover": { bgcolor: "rgba(0,0,0,0.03)" },
              }}
            >
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>CV (dispersión)</Typography>
              <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: cvColor, fontVariantNumeric: "tabular-nums" }}>
                {data.cv.toFixed(3)}
              </Typography>
            </Box>
            {/* Comparación contextual del CV */}
            <Box sx={{ px: "0.5rem", pt: "0.125rem", pb: "0.25rem" }}>
              <Typography sx={{ fontSize: "0.6875rem", color: cvColor, fontStyle: "italic", lineHeight: 1.4 }}>
                {cvContextLabel}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  )
}
