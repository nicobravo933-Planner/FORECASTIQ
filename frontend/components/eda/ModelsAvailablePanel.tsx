"use client"

/**
 * ModelsAvailablePanel — grid 2×2 de modelos disponibles/bloqueados.
 * Layout horizontal compacto para no consumir espacio vertical en la barra lateral.
 */

import Box from "@mui/material/Box"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import LockIcon from "@mui/icons-material/Lock"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import { useRouter } from "next/navigation"
import type { ModelsAvailableResponse } from "@/hooks/useEda"

interface ModelsAvailablePanelProps {
  data: ModelsAvailableResponse
}

// Short display names and hints per model
const MODEL_META: Record<string, { short: string; hint: string }> = {
  moving_average: { short: "MA",      hint: "Promedio móvil · baseline, siempre disponible" },
  ses:            { short: "SES",     hint: "Suavizamiento simple · sin tendencia" },
  holt_simple:    { short: "Holt",    hint: "Suavizamiento doble · con tendencia" },
  holt_winters:   { short: "HW",      hint: "Triple suavizamiento · nivel + tendencia + estacionalidad" },
  sarima:         { short: "SARIMA",  hint: "ARIMA estacional · ≥ 104 obs" },
  linear_splines: { short: "Splines", hint: "Regresión lineal + splines cúbicos" },
  lightgbm:       { short: "LightGBM",hint: "Gradient boosting con lags · CV > 1.0" },
}

export function ModelsAvailablePanel({ data }: ModelsAvailablePanelProps) {
  const router = useRouter()
  const available = data.models.filter((m) => m.available)
  const locked    = data.models.filter((m) => !m.available)

  return (
    <Card variant="outlined" sx={{ borderRadius: "0.75rem", boxShadow: "0 0.125rem 0.5rem rgba(0,0,0,0.06)" }}>
      <CardContent sx={{ p: "1rem", "&:last-child": { pb: "1rem" } }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "0.75rem" }}>
          <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700 }}>Modelos disponibles</Typography>
          <Typography
            onClick={() => router.push("/dashboard/encyclopedia?chapter=5")}
            sx={{ fontSize: "0.6875rem", color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
          >
            Score {data.quality_score}/100
          </Typography>
        </Box>

        {/* Available — chip grid */}
        {available.length > 0 && (
          <Box sx={{ mb: locked.length > 0 ? "0.625rem" : 0 }}>
            <Typography sx={{ fontSize: "0.5625rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.375rem" }}>
              ✅ Disponibles
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {available.map((m) => {
                const meta = MODEL_META[m.id]
                return (
                  <Tooltip key={m.id} title={meta?.hint ?? m.reason} placement="top" arrow>
                    <Chip
                      icon={<LockOpenIcon sx={{ fontSize: "0.75rem !important" }} />}
                      label={meta?.short ?? m.label}
                      size="small"
                      sx={{
                        bgcolor: "rgba(16,185,129,0.08)",
                        border: "1px solid rgba(16,185,129,0.25)",
                        color: "#065f46",
                        fontWeight: 700,
                        fontSize: "0.6875rem",
                        height: "1.5rem",
                        cursor: "default",
                        "& .MuiChip-icon": { color: "#10b981" },
                      }}
                    />
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        )}

        {/* Locked — chip grid (muted) */}
        {locked.length > 0 && (
          <Box>
            <Typography sx={{ fontSize: "0.5625rem", fontWeight: 700, color: "text.disabled", textTransform: "uppercase", letterSpacing: "0.08em", mb: "0.375rem" }}>
              🔒 Bloqueados
            </Typography>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
              {locked.map((m) => {
                const meta = MODEL_META[m.id]
                return (
                  <Tooltip key={m.id} title={m.reason} placement="top" arrow>
                    <Chip
                      icon={<LockIcon sx={{ fontSize: "0.75rem !important" }} />}
                      label={meta?.short ?? m.label}
                      size="small"
                      sx={{
                        bgcolor: "rgba(0,0,0,0.04)",
                        border: "1px solid rgba(0,0,0,0.1)",
                        color: "text.disabled",
                        fontWeight: 600,
                        fontSize: "0.6875rem",
                        height: "1.5rem",
                        opacity: 0.7,
                        cursor: "default",
                      }}
                    />
                  </Tooltip>
                )
              })}
            </Box>
          </Box>
        )}

        {/* CTA to ETL */}
        <Box
          onClick={() => router.push("/dashboard/etl")}
          sx={{
            mt: "0.75rem", display: "flex", alignItems: "center", gap: "0.25rem",
            cursor: "pointer", color: "text.disabled", fontSize: "0.6875rem",
            "&:hover": { color: "primary.main" }, transition: "color 0.15s",
          }}
        >
          <Typography sx={{ fontSize: "0.6875rem" }}>Mejorar calidad en ETL</Typography>
          <ArrowForwardIcon sx={{ fontSize: "0.75rem" }} />
        </Box>
      </CardContent>
    </Card>
  )
}


