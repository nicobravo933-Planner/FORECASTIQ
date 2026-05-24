"use client"

/**
 * QualityScoreCard — semáforo visual del Quality Score (0-100).
 * Muestra el puntaje total, el label, el breakdown por criterio y la recomendación.
 */

import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import LinearProgress from "@mui/material/LinearProgress"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import type { QualityScoreResponse } from "@/hooks/useEda"

interface QualityScoreCardProps {
  data: QualityScoreResponse
}

// Color del semáforo según label
const LABEL_CONFIG = {
  poor:      { color: "#ef4444", bg: "#fef2f2", border: "#fecaca", emoji: "🔴", text: "Insuficiente" },
  fair:      { color: "#f59e0b", bg: "#fffbeb", border: "#fde68a", emoji: "🟡", text: "Aceptable"    },
  good:      { color: "#3b82f6", bg: "#eff6ff", border: "#bfdbfe", emoji: "🔵", text: "Bueno"        },
  excellent: { color: "#10b981", bg: "#ecfdf5", border: "#a7f3d0", emoji: "🟢", text: "Excelente"    },
}

// Cada criterio del breakdown con su máximo de puntos
const CRITERIA = [
  { key: "completeness_score" as const, label: "Completitud",  max: 30, msg_key: "completeness_msg" as const },
  { key: "history_score"      as const, label: "Historia",     max: 25, msg_key: "history_msg"      as const },
  { key: "regularity_score"   as const, label: "Regularidad",  max: 25, msg_key: "regularity_msg"   as const },
  { key: "outlier_score"      as const, label: "Outliers",     max: 20, msg_key: "outlier_msg"       as const },
]

export function QualityScoreCard({ data }: QualityScoreCardProps) {
  const cfg = LABEL_CONFIG[data.label]

  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: cfg.border,
        bgcolor: cfg.bg,
        borderRadius: "0.75rem",
        boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)",
      }}
    >
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>
        {/* Header: score grande + label */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "1.25rem", mb: "1.25rem" }}>
          <Box
            sx={{
              width: "5rem",
              height: "5rem",
              borderRadius: "50%",
              border: `0.25rem solid ${cfg.color}`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              bgcolor: "background.paper",
              boxShadow: `0 0 0 0.375rem ${cfg.border}`,
            }}
          >
            <Typography sx={{ fontSize: "1.625rem", fontWeight: 800, color: cfg.color, lineHeight: 1 }}>
              {data.score}
            </Typography>
            <Typography sx={{ fontSize: "0.625rem", fontWeight: 600, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              / 100
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.secondary", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.125rem" }}>
              Quality Score
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <Typography sx={{ fontSize: "1rem" }}>{cfg.emoji}</Typography>
              <Typography sx={{ fontSize: "1.125rem", fontWeight: 700, color: cfg.color }}>
                {cfg.text}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.25rem", lineHeight: 1.4 }}>
              {data.recommendation}
            </Typography>
          </Box>
        </Box>

        {/* Breakdown por criterio */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {CRITERIA.map((c) => {
            const pts   = data.breakdown[c.key]
            const pct   = (pts / c.max) * 100
            const msg   = data[c.msg_key]
            // Color de la barra según % del criterio
            const barColor = pct >= 80 ? "#10b981" : pct >= 50 ? "#f59e0b" : "#ef4444"

            return (
              <Tooltip key={c.key} title={msg} placement="right" arrow>
                <Box sx={{ cursor: "default" }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: "0.25rem" }}>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 500, color: "text.primary" }}>
                      {c.label}
                    </Typography>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: barColor }}>
                      {pts.toFixed(1)} / {c.max}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={pct}
                    sx={{
                      height: "0.5rem",
                      borderRadius: "0.25rem",
                      bgcolor: "rgba(0,0,0,0.07)",
                      "& .MuiLinearProgress-bar": {
                        borderRadius: "0.25rem",
                        bgcolor: barColor,
                      },
                    }}
                  />
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", mt: "0.25rem" }}>
                    {msg}
                  </Typography>
                </Box>
              </Tooltip>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
}
