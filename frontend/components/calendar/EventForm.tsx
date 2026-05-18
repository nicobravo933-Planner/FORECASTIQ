"use client"

/**
 * EventForm — drawer to create a new calendar event.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Drawer from "@mui/material/Drawer"
import IconButton from "@mui/material/IconButton"
import MenuItem from "@mui/material/MenuItem"
import TextField from "@mui/material/TextField"
import Typography from "@mui/material/Typography"
import Divider from "@mui/material/Divider"
import Alert from "@mui/material/Alert"
import CloseIcon from "@mui/icons-material/Close"
import AddIcon from "@mui/icons-material/Add"
import type { EventType } from "@/lib/types"

const EVENT_TYPES: { value: EventType; label: string }[] = [
  { value: "promotion", label: "Promoción" },
  { value: "seasonal",  label: "Estacional" },
  { value: "holiday",   label: "Feriado" },
  { value: "other",     label: "Otro" },
]

interface EventFormPayload {
  name:       string
  type:       EventType
  start_date: string
  end_date:   string
  impact_pct: number | null
}

interface EventFormProps {
  onSave: (payload: EventFormPayload) => Promise<void>
}

const EMPTY: EventFormPayload = {
  name:       "",
  type:       "promotion",
  start_date: "",
  end_date:   "",
  impact_pct: null,
}

export function EventForm({ onSave }: EventFormProps) {
  const [open, setOpen]       = useState(false)
  const [form, setForm]       = useState<EventFormPayload>(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const set = (key: keyof EventFormPayload, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const valid =
    form.name.trim().length > 0 &&
    form.start_date !== "" &&
    form.end_date !== "" &&
    form.end_date >= form.start_date

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      await onSave({ ...form })
      setForm(EMPTY)
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el evento.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Button
        variant="contained"
        startIcon={<AddIcon />}
        onClick={() => setOpen(true)}
        size="small"
      >
        Nuevo evento
      </Button>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        PaperProps={{ sx: { width: "22rem", p: "1.5rem" } }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "1rem" }}>
          <Typography variant="h6" fontWeight={700}>Nuevo evento</Typography>
          <IconButton size="small" onClick={() => setOpen(false)}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <Divider sx={{ mb: "1.25rem" }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* Name */}
          <TextField
            label="Nombre"
            size="small"
            fullWidth
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="ej. Black Friday"
            inputProps={{ maxLength: 120 }}
          />

          {/* Type */}
          <TextField
            select
            label="Tipo"
            size="small"
            fullWidth
            value={form.type}
            onChange={(e) => set("type", e.target.value as EventType)}
          >
            {EVENT_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
            ))}
          </TextField>

          {/* Dates */}
          <TextField
            label="Fecha inicio"
            type="date"
            size="small"
            fullWidth
            value={form.start_date}
            onChange={(e) => set("start_date", e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Fecha fin"
            type="date"
            size="small"
            fullWidth
            value={form.end_date}
            onChange={(e) => set("end_date", e.target.value)}
            InputLabelProps={{ shrink: true }}
            error={form.end_date !== "" && form.end_date < form.start_date}
            helperText={form.end_date !== "" && form.end_date < form.start_date ? "Debe ser ≥ fecha inicio" : ""}
          />

          {/* Impact */}
          <TextField
            label="Impacto estimado (%)"
            type="number"
            size="small"
            fullWidth
            value={form.impact_pct ?? ""}
            onChange={(e) => set("impact_pct", e.target.value === "" ? null : parseFloat(e.target.value))}
            placeholder="ej. 20 para +20% · -10 para -10%"
            helperText="Opcional. Afecta el forecast en esas fechas."
            inputProps={{ step: 0.5, min: -100, max: 500 }}
          />

          {error && <Alert severity="error" sx={{ fontSize: "0.8rem" }}>{error}</Alert>}

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!valid || saving}
            sx={{ mt: "0.5rem" }}
          >
            {saving ? "Guardando..." : "Guardar evento"}
          </Button>
        </Box>
      </Drawer>
    </>
  )
}
