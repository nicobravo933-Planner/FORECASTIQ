"use client"

/**
 * ColumnSelector — lets the user pick the date column, target column,
 * and data frequency, then triggers model detection.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import InputLabel from "@mui/material/InputLabel"
import FormControl from "@mui/material/FormControl"
import Button from "@mui/material/Button"
import CircularProgress from "@mui/material/CircularProgress"
import type { DatasetPreview, DataFreq } from "@/lib/types"

interface ColumnSelectorProps {
  preview: DatasetPreview
  detecting: boolean
  onDetect: (dateCol: string, targetCol: string, freq: DataFreq) => void
}

const FREQ_OPTIONS: { value: DataFreq; label: string }[] = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
  { value: "Q", label: "Trimestral" },
]

export function ColumnSelector({ preview, detecting, onDetect }: ColumnSelectorProps) {
  // Pre-select first datetime column as date, first numeric as target
  const dateGuess = preview.columns.find((c) => c.dtype === "datetime")?.name ?? ""
  const targetGuess = preview.columns.find((c) => c.dtype === "numeric")?.name ?? ""

  const [dateCol, setDateCol] = useState(dateGuess)
  const [targetCol, setTargetCol] = useState(targetGuess)
  const [freq, setFreq] = useState<DataFreq>("M")

  const canDetect = !!dateCol && !!targetCol && dateCol !== targetCol

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        borderRadius: "0.75rem",
        p: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <Typography variant="h6" color="text.primary">
        Seleccioná las columnas
      </Typography>

      <Typography variant="body2" color="text.secondary">
        Dataset: <strong>{preview.dataset_id}</strong> · {preview.total_rows} filas
      </Typography>

      <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {/* Date column */}
        <FormControl size="small" sx={{ minWidth: "12rem", flex: 1 }}>
          <InputLabel>Columna de fecha</InputLabel>
          <Select
            value={dateCol}
            label="Columna de fecha"
            onChange={(e) => setDateCol(e.target.value)}
          >
            {preview.columns.map((col) => (
              <MenuItem key={col.name} value={col.name}>
                {col.name}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: "0.5rem" }}>
                  ({col.dtype})
                </Typography>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Target column */}
        <FormControl size="small" sx={{ minWidth: "12rem", flex: 1 }}>
          <InputLabel>Columna objetivo</InputLabel>
          <Select
            value={targetCol}
            label="Columna objetivo"
            onChange={(e) => setTargetCol(e.target.value)}
          >
            {preview.columns
              .filter((c) => c.name !== dateCol)
              .map((col) => (
                <MenuItem key={col.name} value={col.name}>
                  {col.name}
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: "0.5rem" }}>
                    ({col.dtype})
                  </Typography>
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {/* Frequency */}
        <FormControl size="small" sx={{ minWidth: "9rem" }}>
          <InputLabel>Frecuencia</InputLabel>
          <Select
            value={freq}
            label="Frecuencia"
            onChange={(e) => setFreq(e.target.value as DataFreq)}
          >
            {FREQ_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Button
        variant="contained"
        disabled={!canDetect || detecting}
        onClick={() => onDetect(dateCol, targetCol, freq)}
        startIcon={detecting ? <CircularProgress size="1rem" color="inherit" /> : null}
        sx={{ alignSelf: "flex-start" }}
      >
        {detecting ? "Analizando…" : "Detectar modelo recomendado"}
      </Button>
    </Box>
  )
}
