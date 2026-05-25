"use client"

/**
 * DataCompletenessBar — barra horizontal de completitud de la serie.
 *
 * Muestra visualmente qué proporción de la serie tiene datos vs nulls vs gaps,
 * para que el usuario entienda de un vistazo si su dataset es confiable.
 *
 * Tres segmentos:
 *   Verde  → observaciones completas (no nulas)
 *   Naranja → valores nulos dentro del rango
 *   Rojo   → períodos faltantes (gaps en el índice temporal)
 */

import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import type { SeriesSummary } from "@/hooks/useEda"

interface DataCompletenessBarProps {
  data: SeriesSummary
}

export function DataCompletenessBar({ data }: DataCompletenessBarProps) {
  const total = data.n_observations + data.n_gaps  // períodos totales esperados
  if (total === 0) return null

  // Proporciones para la barra (suman 100%)
  const pctComplete = ((data.n_observations - data.null_count) / total) * 100
  const pctNulls    = (data.null_count / total) * 100
  const pctGaps     = (data.n_gaps / total) * 100

  const segments = [
    {
      pct:   pctComplete,
      color: "#10b981",
      label: "Completo",
      value: data.n_observations - data.null_count,
      tooltip: `${(data.n_observations - data.null_count).toLocaleString()} observaciones con valor válido. El modelo usará estos puntos directamente.`,
    },
    {
      pct:   pctNulls,
      color: "#f59e0b",
      label: "Nulos",
      value: data.null_count,
      tooltip: `${data.null_count.toLocaleString()} valores nulos (${data.null_pct.toFixed(1)}%). En ETL podés imputarlos por forward-fill o interpolación. Los nulos degradan el quality score.`,
    },
    {
      pct:   pctGaps,
      color: "#ef4444",
      label: "Gaps",
      value: data.n_gaps,
      tooltip: `${data.n_gaps.toLocaleString()} períodos que deberían existir pero no están en el índice temporal (${(data.gap_ratio * 100).toFixed(1)}%). Los gaps rompen la continuidad de la serie y pueden confundir a Holt-Winters y SARIMA.`,
    },
  ].filter((s) => s.value > 0) // solo mostrar segmentos con valor

  // Calidad global de completitud como porcentaje
  const completenessGlobal = Math.round(pctComplete)
  const completenessColor =
    completenessGlobal >= 95 ? "#10b981" :
    completenessGlobal >= 80 ? "#f59e0b" :
                               "#ef4444"

  return (
    <Card variant="outlined" sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "1rem" }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
            Completitud de datos
          </Typography>
          <Typography sx={{ fontSize: "1.125rem", fontWeight: 800, color: completenessColor }}>
            {completenessGlobal}%
          </Typography>
        </Box>

        {/* Barra segmentada */}
        <Box
          sx={{
            display: "flex",
            height: "1.25rem",
            borderRadius: "0.625rem",
            overflow: "hidden",
            mb: "0.875rem",
            bgcolor: "rgba(0,0,0,0.06)",
          }}
        >
          {segments.map((seg) => (
            <Tooltip key={seg.label} title={seg.tooltip} placement="top" arrow>
              <Box
                sx={{
                  width: `${seg.pct}%`,
                  bgcolor: seg.color,
                  transition: "width 0.4s ease",
                  cursor: "default",
                  minWidth: seg.pct > 0 ? "0.25rem" : 0,
                }}
              />
            </Tooltip>
          ))}
        </Box>

        {/* Leyenda */}
        <Box sx={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
          {segments.map((seg) => (
            <Box key={seg.label} sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <Box sx={{ width: "0.75rem", height: "0.75rem", borderRadius: "0.1875rem", bgcolor: seg.color, flexShrink: 0 }} />
              <Typography sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                <strong>{seg.label}</strong>{" "}
                <span style={{ color: "#6b7280" }}>
                  {seg.value.toLocaleString()} ({seg.pct.toFixed(1)}%)
                </span>
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Mensaje contextual */}
        {data.n_gaps > 0 && (
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: "0.75rem", p: "0.625rem", bgcolor: "rgba(239,68,68,0.05)", borderRadius: "0.375rem", borderLeft: "0.1875rem solid #ef4444" }}>
            ⚠️ Se detectaron {data.n_gaps} períodos faltantes. La fase ETL puede imputarlos
            con forward-fill o interpolación lineal antes de modelar.
          </Typography>
        )}
        {data.null_count > 0 && data.n_gaps === 0 && (
          <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: "0.75rem", p: "0.625rem", bgcolor: "rgba(245,158,11,0.05)", borderRadius: "0.375rem", borderLeft: "0.1875rem solid #f59e0b" }}>
            🟡 Hay {data.null_count} valores nulos. Se interpolaron automáticamente para el análisis,
            pero limpiarlos en ETL mejorará el quality score.
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}
