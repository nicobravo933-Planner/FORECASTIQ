"use client"

/**
 * EventForm — drawer to create or edit a calendar event.
 * Pass `initialData` + `eventId` to enter edit mode.
 */

import { useState, useEffect } from "react"
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
import EditIcon from "@mui/icons-material/Edit"
import type { CalendarEvent, EventType } from "@/lib/types"

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
  // Create mode: only onSave
  onSave: (payload: EventFormPayload) => Promise<void>
  // Edit mode: provide initial data + eventId + onUpdate
  eventId?: string
  initialData?: CalendarEvent
  onUpdate?: (id: string, payload: Partial<EventFormPayload>) => Promise<void>
  // Controlled open state (used in edit mode from parent)
  open?: boolean
  onClose?: () => void
}

const EMPTY: EventFormPayload = {
  name:       "",
  type:       "promotion",
  start_date: "",
  end_date:   "",
  impact_pct: null,
}

export function EventForm({ onSave, eventId, initialData, onUpdate, open: controlledOpen, onClose }: EventFormProps) {
  const isEditMode = Boolean(eventId && initialData && onUpdate)

  // Uncontrolled open state (create mode)
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen

  const [form, setForm]     = useState<EventFormPayload>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Populate form when entering edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      setForm({
        name:       initialData.name,
        type:       initialData.type,
        start_date: initialData.start_date,
        end_date:   initialData.end_date,
        impact_pct: initialData.impact_pct,
      })
    } else {
      setForm(EMPTY)
    }
  }, [isEditMode, initialData])

  const set = (key: keyof EventFormPayload, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const valid =
    form.name.trim().length > 0 &&
    form.start_date !== "" &&
    form.end_date !== "" &&
    form.end_date >= form.start_date

  const handleClose = () => {
    setError(null)
    if (controlledOpen !== undefined) onClose?.()
    else setInternalOpen(false)
  }

  const handleSave = async () => {
    if (!valid) return
    setSaving(true)
    setError(null)
    try {
      if (isEditMode && eventId && onUpdate) {
        await onUpdate(eventId, form)
      } else {
        await onSave({ ...form })
        setForm(EMPTY)
      }
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el evento.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* Trigger button — only shown in create mode (edit mode uses external trigger) */}
      {!isEditMode && controlledOpen === undefined && (
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setInternalOpen(true)}
          size="small"
        >
          Nuevo evento
        </Button>
      )}

      <Drawer
        anchor="right"
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: "22rem", p: "1.5rem" } }}
      >
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "1rem" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {isEditMode ? <EditIcon fontSize="small" color="action" /> : <AddIcon fontSize="small" color="action" />}
            <Typography variant="h6" fontWeight={700}>
              {isEditMode ? "Editar evento" : "Nuevo evento"}
            </Typography>
          </Box>
          <IconButton size="small" onClick={handleClose}>
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
            placeholder="ej. Cierre por vacaciones"
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
            helperText={
              form.end_date !== "" && form.end_date < form.start_date
                ? "Debe ser ≥ fecha inicio"
                : "Para eventos multi-día: ponés la fecha de fin acá"
            }
          />

          {/* Impact */}
          <TextField
            label="Impacto estimado (%)"
            type="number"
            size="small"
            fullWidth
            value={form.impact_pct ?? ""}
            onChange={(e) =>
              set("impact_pct", e.target.value === "" ? null : parseFloat(e.target.value))
            }
            placeholder="ej. 20 para +20% · -10 para -10%"
            helperText="Opcional. Para HW/SARIMA. LightGBM aprende el impacto solo."
            inputProps={{ step: 0.5, min: -100, max: 500 }}
          />

          {error && <Alert severity="error" sx={{ fontSize: "0.8rem" }}>{error}</Alert>}

          <Button
            variant="contained"
            onClick={handleSave}
            disabled={!valid || saving}
            sx={{ mt: "0.5rem" }}
          >
            {saving ? "Guardando..." : isEditMode ? "Guardar cambios" : "Guardar evento"}
          </Button>
        </Box>
      </Drawer>
    </>
  )
}
