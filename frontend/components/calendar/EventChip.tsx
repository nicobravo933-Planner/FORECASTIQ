/**
 * EventChip — color-coded chip by event type.
 */

import Chip from "@mui/material/Chip"
import type { CalendarEvent, EventType } from "@/lib/types"

const TYPE_CONFIG: Record<EventType, { label: string; color: "default" | "primary" | "secondary" | "error" | "warning" | "info" | "success" }> = {
  holiday:   { label: "Feriado",    color: "info" },
  promotion: { label: "Promoción",  color: "success" },
  seasonal:  { label: "Estacional", color: "warning" },
  other:     { label: "Otro",       color: "default" },
}

interface EventChipProps {
  type: EventType
  size?: "small" | "medium"
}

export function EventChip({ type, size = "small" }: EventChipProps) {
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.other
  return (
    <Chip
      label={cfg.label}
      color={cfg.color}
      size={size}
      sx={{ fontSize: "0.7rem", fontWeight: 600 }}
    />
  )
}

// Helper: impact badge color (green = positive, red = negative)
interface ImpactBadgeProps {
  impact_pct: number | null
}

export function ImpactBadge({ impact_pct }: ImpactBadgeProps) {
  if (impact_pct === null || impact_pct === undefined) return null
  const positive = impact_pct >= 0
  return (
    <Chip
      label={`${positive ? "+" : ""}${impact_pct}%`}
      size="small"
      sx={{
        fontSize: "0.7rem",
        fontWeight: 700,
        bgcolor: positive ? "success.dark" : "error.dark",
        color: "common.white",
      }}
    />
  )
}

// Re-export event type config for use in other components
export { TYPE_CONFIG }
export type { EventType }
