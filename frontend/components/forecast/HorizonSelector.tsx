"use client"

/**
 * HorizonSelector — selector de horizonte de proyección contextual a la frecuencia.
 *
 * Las opciones rápidas y el máximo cambian según la frecuencia seleccionada:
 *   D (diaria)    → +7d  +14d  +30d   — máx 90
 *   W (semanal)   → +4w  +8w   +13w   — máx 52
 *   M (mensual)   → +3m  +6m   +12m   — máx 24
 *   Q (trimestral)→ +2q  +4q   +8q    — máx 12
 */

import { useEffect, useState } from "react"
import Box from "@mui/material/Box"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import type { DataFreq } from "@/lib/types"

// ── Config by frequency ───────────────────────────────────────────────────────

interface FreqConfig {
  quickOptions: number[]
  max: number
  unit: string       // label shown next to custom input
  quickLabel: (n: number) => string
}

const FREQ_CONFIG: Record<DataFreq, FreqConfig> = {
  D: { quickOptions: [7, 14, 30],  max: 90, unit: "días",      quickLabel: (n) => `+${n}d` },
  W: { quickOptions: [4, 8, 13],   max: 52, unit: "semanas",   quickLabel: (n) => `+${n}w` },
  M: { quickOptions: [3, 6, 12],   max: 24, unit: "meses",     quickLabel: (n) => `+${n}m` },
  Q: { quickOptions: [2, 4, 8],    max: 12, unit: "trimestres",quickLabel: (n) => `+${n}q` },
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface HorizonSelectorProps {
  value:    number
  freq?:    DataFreq       // if omitted, behaves as monthly (legacy)
  onChange: (horizon: number) => void
  disabled?: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HorizonSelector({
  value,
  freq = "M",
  onChange,
  disabled = false,
}: HorizonSelectorProps) {
  const cfg = FREQ_CONFIG[freq] ?? FREQ_CONFIG["M"]
  const isCustom = !cfg.quickOptions.includes(value)

  const [customVal, setCustomVal] = useState(isCustom ? String(value) : "")

  // Reset custom input when freq changes and value is out of range
  useEffect(() => {
    if (value > cfg.max) {
      onChange(cfg.quickOptions[0])
      setCustomVal("")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [freq])

  const handleQuick = (_: React.MouseEvent<HTMLElement>, newVal: string | null) => {
    if (newVal === "custom") return
    if (newVal) { onChange(Number(newVal)); setCustomVal("") }
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setCustomVal(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= cfg.max) onChange(parsed)
  }

  const toggleValue = isCustom ? "custom" : String(value)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        Horizonte de proyección
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <ToggleButtonGroup
          value={toggleValue}
          exclusive
          onChange={handleQuick}
          disabled={disabled}
          size="small"
          sx={{ "& .MuiToggleButton-root": { px: "0.875rem", fontSize: "0.8125rem", minWidth: "3.5rem" } }}
        >
          {cfg.quickOptions.map((n) => (
            <ToggleButton key={n} value={String(n)}>
              {cfg.quickLabel(n)}
            </ToggleButton>
          ))}
          <ToggleButton value="custom">Otro</ToggleButton>
        </ToggleButtonGroup>

        {(isCustom || toggleValue === "custom") && (
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <TextField
              size="small"
              type="number"
              label={cfg.unit}
              value={customVal}
              onChange={handleCustomChange}
              disabled={disabled}
              inputProps={{ min: 1, max: cfg.max }}
              sx={{ width: "6rem" }}
            />
            <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
              máx {cfg.max}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
