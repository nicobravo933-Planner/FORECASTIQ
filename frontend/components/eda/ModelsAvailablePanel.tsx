"use client"

/**
 * ModelsAvailablePanel — chips de modelos desbloqueados/bloqueados según quality score.
 * Cada modelo tiene un tooltip con la razón de disponibilidad o bloqueo.
 */

import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import LockIcon from "@mui/icons-material/Lock"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import type { ModelsAvailableResponse } from "@/hooks/useEda"

interface ModelsAvailablePanelProps {
  data: ModelsAvailableResponse
}

// Descripción corta de cada modelo para mostrar en el panel
const MODEL_META: Record<string, { description: string; minObs: string }> = {
  moving_average: {
    description: "Promedio de las últimas N observaciones. Baseline siempre disponible.",
    minObs: "≥ 1 obs",
  },
  holt_winters: {
    description: "Suavizado exponencial triple. Captura nivel, tendencia y estacionalidad.",
    minObs: "≥ 2× estación",
  },
  sarima: {
    description: "ARIMA estacional con auto-selección de parámetros (p,d,q)(P,D,Q,s).",
    minObs: "≥ 104 obs",
  },
  lightgbm: {
    description: "Gradient boosting con features de lag y calendario. Optuna HPO.",
    minObs: "≥ 104 obs + CV > 1",
  },
}

export function ModelsAvailablePanel({ data }: ModelsAvailablePanelProps) {
  const available = data.models.filter((m) => m.available)
  const locked    = data.models.filter((m) => !m.available)

  return (
    <Card variant="outlined" sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: "1.5rem", "&:last-child": { pb: "1.5rem" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "1rem" }}>
          <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700 }}>
            Modelos disponibles
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
            Score: <strong>{data.quality_score}</strong> / 100
          </Typography>
        </Box>

        {/* Modelos disponibles */}
        {available.length > 0 && (
          <Box sx={{ mb: "1rem" }}>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.625rem" }}>
              ✅ Disponibles ({available.length})
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {available.map((m) => {
                const meta = MODEL_META[m.id]
                return (
                  <Tooltip key={m.id} title={m.reason} placement="right" arrow>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "0.75rem",
                        p: "0.75rem",
                        borderRadius: "0.5rem",
                        bgcolor: "rgba(16,185,129,0.06)",
                        border: "1px solid rgba(16,185,129,0.2)",
                        cursor: "default",
                      }}
                    >
                      <LockOpenIcon sx={{ fontSize: "1.125rem", color: "#10b981", mt: "0.125rem", flexShrink: 0 }} />
                      <Box>
                        <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: "#065f46" }}>
                          {m.label}
                        </Typography>
                        {meta && (
                          <>
                            <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", mt: "0.125rem" }}>
                              {meta.description}
                            </Typography>
                            <Typography sx={{ fontSize: "0.6875rem", color: "#10b981", mt: "0.25rem", fontWeight: 600 }}>
                              {meta.minObs}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        )}

        {/* Modelos bloqueados */}
        {locked.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: "0.6875rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.625rem" }}>
              🔒 Bloqueados ({locked.length})
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {locked.map((m) => (
                <Tooltip key={m.id} title={m.reason} placement="right" arrow>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "0.75rem",
                      p: "0.75rem",
                      borderRadius: "0.5rem",
                      bgcolor: "rgba(0,0,0,0.03)",
                      border: "1px solid rgba(0,0,0,0.08)",
                      cursor: "default",
                      opacity: 0.65,
                    }}
                  >
                    <LockIcon sx={{ fontSize: "1.125rem", color: "text.disabled", mt: "0.125rem", flexShrink: 0 }} />
                    <Box>
                      <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.secondary" }}>
                        {m.label}
                      </Typography>
                      <Typography sx={{ fontSize: "0.75rem", color: "text.disabled", mt: "0.125rem" }}>
                        {m.reason}
                      </Typography>
                    </Box>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
