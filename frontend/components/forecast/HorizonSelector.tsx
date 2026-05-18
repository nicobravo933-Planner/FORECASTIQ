"use client"

/**
 * HorizonSelector — lets the user pick how many months ahead to forecast.
 * Quick options: 3 / 6 / 12 months. Custom: free numeric input.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"

const QUICK_OPTIONS = [3, 6, 12]

interface HorizonSelectorProps {
  value: number
  onChange: (horizon: number) => void
  disabled?: boolean
}

export function HorizonSelector({ value, onChange, disabled = false }: HorizonSelectorProps) {
  const isCustom = !QUICK_OPTIONS.includes(value)
  const [customVal, setCustomVal] = useState(isCustom ? String(value) : "")

  const handleQuick = (_: React.MouseEvent<HTMLElement>, newVal: string | null) => {
    if (newVal === "custom") return
    if (newVal) onChange(Number(newVal))
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setCustomVal(raw)
    const parsed = parseInt(raw, 10)
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 60) onChange(parsed)
  }

  const toggleValue = isCustom ? "custom" : String(value)

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <Typography variant="body2" color="text.secondary" fontWeight={500}>
        Horizonte de proyección
      </Typography>
      <Box sx={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
        <ToggleButtonGroup
          value={toggleValue}
          exclusive
          onChange={handleQuick}
          disabled={disabled}
          size="small"
          sx={{ "& .MuiToggleButton-root": { px: "1rem", fontSize: "0.8125rem" } }}
        >
          {QUICK_OPTIONS.map((m) => (
            <ToggleButton key={m} value={String(m)}>
              +{m}m
            </ToggleButton>
          ))}
          <ToggleButton value="custom">Personalizado</ToggleButton>
        </ToggleButtonGroup>

        {(isCustom || toggleValue === "custom") && (
          <TextField
            size="small"
            type="number"
            label="Meses"
            value={customVal}
            onChange={handleCustomChange}
            disabled={disabled}
            inputProps={{ min: 1, max: 60 }}
            sx={{ width: "6rem" }}
          />
        )}
      </Box>
    </Box>
  )
}
