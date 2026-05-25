"use client"

/**
 * Calendar page — E9.
 * Shows events on a monthly grid. User can add/edit/delete events.
 * AR public holidays + commercial events (Black Friday, Hot Sale, etc.) auto-loaded.
 * Auto-generated events show an "Auto" badge and can be dismissed (hidden) for this session.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import Paper from "@mui/material/Paper"
import Chip from "@mui/material/Chip"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import ModelTrainingIcon from "@mui/icons-material/ModelTraining"
import EditIcon from "@mui/icons-material/Edit"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff"
import { useEvents } from "@/hooks/useEvents"
import { EventCalendar } from "@/components/calendar/EventCalendar"
import { EventForm } from "@/components/calendar/EventForm"
import { EventChip, ImpactBadge, AutoBadge } from "@/components/calendar/EventChip"
import type { CalendarEvent } from "@/lib/types"

export default function CalendarPage() {
  const { events, loading, error, year, setYear, createEvent, updateEvent, deleteEvent } = useEvents()

  const [month, setMonth] = useState(() => new Date().getMonth())

  // Edit state
  const [editEvent, setEditEvent]     = useState<CalendarEvent | null>(null)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)

  // Dismissed auto-events (hidden for this session, not deleted from DB)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setMonth(newMonth)
    if (newYear !== year) setYear(newYear)
  }

  const handleEdit = (ev: CalendarEvent) => {
    setEditEvent(ev)
    setEditDrawerOpen(true)
  }

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set([...prev, id]))
  }

  // Filter out dismissed events for display
  const visibleEvents = events.filter((e) => !dismissed.has(e.id))

  // Summary: events for visible month
  const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`
  const monthEvents = visibleEvents.filter(
    (e) => e.start_date.startsWith(monthIso) || e.end_date.startsWith(monthIso),
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <Box>
          <Typography variant="h4" color="text.primary" fontWeight={700}>
            Calendario de eventos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
            Agregá promociones, cierres y eventos que impactan tus ventas.
            Los feriados AR, Black Friday, Hot Sale y CyberWeek se cargan automáticamente.
          </Typography>
        </Box>
        <EventForm onSave={createEvent} />
      </Box>

      {/* Edit drawer (controlled) */}
      {editEvent && (
        <EventForm
          onSave={createEvent}
          eventId={editEvent.id}
          initialData={editEvent}
          onUpdate={updateEvent}
          open={editDrawerOpen}
          onClose={() => { setEditDrawerOpen(false); setEditEvent(null) }}
        />
      )}

      {/* Loading / Error */}
      {loading && (
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <CircularProgress size="1.25rem" />
          <Typography variant="body2" color="text.secondary">Cargando eventos...</Typography>
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Main layout: calendar + sidebar */}
      {!loading && (
        <Box sx={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", flexWrap: "wrap" }}>
          {/* Calendar grid */}
          <Box sx={{ flex: "1 1 36rem", minWidth: 0 }}>
            <EventCalendar
              events={visibleEvents}
              year={year}
              month={month}
              onMonthChange={handleMonthChange}
              onDelete={deleteEvent}
            />
            {/* Dismiss tooltip — behavior note */}
          </Box>

          {/* Sidebar: month events list */}
          <Paper
            elevation={0}
            sx={{
              width: "20rem",
              flexShrink: 0,
              p: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "1rem",
              boxShadow: "0 0.125rem 0.75rem rgba(0,0,0,0.06)",
            }}
          >
            <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
              Eventos del mes ({monthEvents.length})
            </Typography>
            <Divider />

            {monthEvents.length === 0 && (
              <Typography variant="body2" color="text.disabled" sx={{ py: "1rem", textAlign: "center" }}>
                Sin eventos este mes
              </Typography>
            )}

            {monthEvents.map((ev) => (
              <Box
                key={ev.id}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.3rem",
                  pb: "0.75rem",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                }}
              >
                {/* Name + action buttons */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.25rem" }}>
                  <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                    {ev.name}
                  </Typography>
                  <Box sx={{ display: "flex", gap: "0.1rem", flexShrink: 0 }}>
                    {/* Edit — only for manual events */}
                    {ev.source !== "auto" && !ev.is_global && (
                      <Tooltip title="Editar">
                        <IconButton size="small" onClick={() => handleEdit(ev)} sx={{ p: "0.2rem" }}>
                          <EditIcon sx={{ fontSize: "0.95rem" }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {/* Dismiss — for auto-generated events (hides for this session) */}
                    {ev.source === "auto" && (
                      <Tooltip title="Ocultar este evento (solo esta sesión — se vuelve a mostrar al recargar)">
                        <IconButton size="small" onClick={() => handleDismiss(ev.id)} sx={{ p: "0.2rem" }}>
                          <VisibilityOffIcon sx={{ fontSize: "0.95rem" }} />
                        </IconButton>
                      </Tooltip>
                    )}
                    {/* Delete — only for user's own manual events */}
                    {!ev.is_global && ev.source !== "auto" && (
                      <Tooltip title="Eliminar">
                        <IconButton
                          size="small"
                          onClick={() => deleteEvent(ev.id)}
                          sx={{ p: "0.2rem", color: "error.main" }}
                        >
                          <DeleteOutlineIcon sx={{ fontSize: "0.95rem" }} />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Chips row */}
                <Box sx={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                  <EventChip type={ev.type} />
                  <ImpactBadge impact_pct={ev.impact_pct} />
                  {ev.source === "auto" && <AutoBadge />}
                  {ev.source === "auto" && (
                    <Tooltip title="Este evento se usa como feature binaria en LightGBM durante el entrenamiento">
                      <Chip
                        icon={<ModelTrainingIcon sx={{ fontSize: "0.75rem !important" }} />}
                        label="Activo en LightGBM"
                        size="small"
                        variant="outlined"
                        sx={{
                          fontSize: "0.6rem",
                          fontWeight: 600,
                          borderColor: "secondary.main",
                          color: "secondary.main",
                          height: "1.2rem",
                          "& .MuiChip-icon": { color: "secondary.main" },
                        }}
                      />
                    </Tooltip>
                  )}
                  {ev.is_global && ev.source !== "auto" && (
                    <Chip label="Global" size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
                  )}
                </Box>

                {/* Date */}
                <Typography variant="caption" color="text.disabled">
                  {ev.start_date === ev.end_date
                    ? ev.start_date
                    : `${ev.start_date} → ${ev.end_date}`}
                </Typography>
              </Box>
            ))}
          </Paper>
        </Box>
      )}
    </Box>
  )
}
