"use client"

/**
 * ModelStatusBar — pill con nombre del modelo, luz de estado y barra de tokens.
 *
 * - Luz verde parpadeante = online, roja = offline, gris = checking
 * - Pill con label del modelo activo
 * - Barra de progreso verde que se llena con los tokens consumidos
 * - tokensUsed se incrementa desde afuera (chat page / useChat)
 */

import Box from "@mui/material/Box"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import { FREE_MODELS, type LlmModelId } from "@/lib/types"
import { MODEL_CONTEXT, type ModelStatus } from "@/hooks/useModelStatus"

interface ModelStatusBarProps {
  model: LlmModelId
  status: ModelStatus
  tokensUsed: number
}

// ── Status dot ────────────────────────────────────────────────────────────────
function StatusDot({ status }: { status: ModelStatus }) {
  const color =
    status === "online"   ? "#10b981" :
    status === "offline"  ? "#ef4444" :
    "#9ca3af"

  const pulse = status !== "checking"

  return (
    <Box
      sx={{
        width: "0.5rem",
        height: "0.5rem",
        borderRadius: "50%",
        bgcolor: color,
        flexShrink: 0,
        ...(pulse && {
          animation: "statusPulse 2s ease-in-out infinite",
          "@keyframes statusPulse": {
            "0%, 100%": { boxShadow: `0 0 0 0 ${color}80` },
            "50%":      { boxShadow: `0 0 0 0.25rem ${color}00` },
          },
        }),
      }}
    />
  )
}

export function ModelStatusBar({ model, status, tokensUsed }: ModelStatusBarProps) {
  const label  = FREE_MODELS.find((m) => m.id === model)?.label ?? model
  const ctxMax = MODEL_CONTEXT[model] ?? 32_000
  const pct    = Math.min((tokensUsed / ctxMax) * 100, 100)

  const barColor =
    pct > 80 ? "#ef4444" :
    pct > 50 ? "#f59e0b" :
    "#10b981"

  const statusLabel =
    status === "online"  ? "Modelo disponible" :
    status === "offline" ? "Modelo no disponible" :
    "Verificando disponibilidad…"

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem", width: "100%" }}>
      {/* Row: dot + pill + tokens */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Tooltip title={statusLabel} placement="top">
          <Box sx={{ display: "flex", alignItems: "center", cursor: "default" }}>
            <StatusDot status={status} />
          </Box>
        </Tooltip>

        {/* Model name pill */}
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            bgcolor: "rgba(59,130,246,0.08)",
            border: "1px solid rgba(59,130,246,0.2)",
            borderRadius: "999px",
            px: "0.625rem",
            py: "0.125rem",
          }}
        >
          <Typography sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "primary.main", whiteSpace: "nowrap" }}>
            {label}
          </Typography>
        </Box>

        {/* Token count */}
        <Tooltip title={`${tokensUsed.toLocaleString()} / ${ctxMax.toLocaleString()} tokens`} placement="top">
          <Typography sx={{ fontSize: "0.625rem", color: "text.secondary", ml: "auto", whiteSpace: "nowrap" }}>
            {tokensUsed > 0 ? `~${(tokensUsed / 1000).toFixed(1)}k` : "0"} / {ctxMax >= 1_000_000 ? "1M" : `${ctxMax / 1000}k`}
          </Typography>
        </Tooltip>
      </Box>

      {/* Token bar */}
      <Tooltip title={`${pct.toFixed(1)}% del contexto utilizado`} placement="bottom">
        <Box
          sx={{
            width: "100%",
            height: "0.25rem",
            bgcolor: "rgba(0,0,0,0.06)",
            borderRadius: "999px",
            overflow: "hidden",
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: `${pct}%`,
              bgcolor: barColor,
              borderRadius: "999px",
              transition: "width 0.4s ease, background-color 0.3s ease",
              minWidth: pct > 0 ? "0.25rem" : 0,
            }}
          />
        </Box>
      </Tooltip>
    </Box>
  )
}
