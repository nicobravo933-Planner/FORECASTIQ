"use client"

/**
 * Calendar page — Phase 3.
 * Shows events on a monthly grid. User can add/delete events.
 * AR public holidays auto-loaded.
 */

import { useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import Paper from "@mui/material/Paper"
import Chip from "@mui/material/Chip"
import { useEvents } from "@/hooks/useEvents"
import { EventCalendar } from "@/components/calendar/EventCalendar"
import { EventForm } from "@/components/calendar/EventForm"
import { EventChip, ImpactBadge } from "@/components/calendar/EventChip"

export default function CalendarPage() {
  const { events, loading, error, year, setYear, createEvent, deleteEvent } = useEvents()

  const [month, setMonth] = useState(() => new Date().getMonth())

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setMonth(newMonth)
    if (newYear !== year) setYear(newYear)
  }

  // Summary: events for visible month
  const monthIso = `${year}-${String(month + 1).padStart(2, "0")}`
  const monthEvents = events.filter(
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
            Agregá promociones, feriados y eventos que impactan tus ventas.
            Los feriados nacionales AR se cargan automáticamente.
          </Typography>
        </Box>
        <EventForm onSave={createEvent} />
      </Box>

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
              events={events}
              year={year}
              month={month}
              onMonthChange={handleMonthChange}
              onDelete={deleteEvent}
            />
          </Box>

          {/* Sidebar: month events list */}
          <Paper
            variant="outlined"
            sx={{ width: "18rem", flexShrink: 0, p: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}
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
                sx={{ display: "flex", flexDirection: "column", gap: "0.3rem", pb: "0.75rem", borderBottom: "1px solid", borderColor: "divider" }}
              >
                <Typography variant="body2" fontWeight={600} noWrap>{ev.name}</Typography>
                <Box sx={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                  <EventChip type={ev.type} />
                  <ImpactBadge impact_pct={ev.impact_pct} />
                  {ev.is_global && (
                    <Chip label="Global" size="small" variant="outlined" sx={{ fontSize: "0.65rem" }} />
                  )}
                </Box>
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
