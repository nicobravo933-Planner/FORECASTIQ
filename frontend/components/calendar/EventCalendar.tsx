"use client"

/**
 * EventCalendar — monthly grid showing events per day.
 * Pure MUI, no external calendar library.
 */

import { useMemo } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Paper from "@mui/material/Paper"
import IconButton from "@mui/material/IconButton"
import Tooltip from "@mui/material/Tooltip"
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import { EventChip, ImpactBadge } from "./EventChip"
import type { CalendarEvent } from "@/lib/types"

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MONTHS = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

interface EventCalendarProps {
  events:      CalendarEvent[]
  year:        number
  month:       number           // 0-indexed
  onMonthChange: (year: number, month: number) => void
  onDelete:    (id: string) => void
}

interface DayCell {
  date:       Date
  isCurrentMonth: boolean
  events:     CalendarEvent[]
}

function buildCalendarGrid(year: number, month: number, events: CalendarEvent[]): DayCell[][] {
  const firstDay = new Date(year, month, 1)
  const lastDay  = new Date(year, month + 1, 0)

  // Fill leading days from previous month
  const startDow = firstDay.getDay()
  const grid: DayCell[] = []

  for (let i = startDow - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    grid.push({ date: d, isCurrentMonth: false, events: [] })
  }
  // Days of month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    const isoDate = date.toISOString().slice(0, 10)
    const dayEvents = events.filter((e) => e.start_date <= isoDate && isoDate <= e.end_date)
    grid.push({ date, isCurrentMonth: true, events: dayEvents })
  }
  // Fill trailing days to complete last week
  const trailing = (7 - (grid.length % 7)) % 7
  for (let i = 1; i <= trailing; i++) {
    const d = new Date(year, month + 1, i)
    grid.push({ date: d, isCurrentMonth: false, events: [] })
  }

  // Split into weeks
  const weeks: DayCell[][] = []
  for (let i = 0; i < grid.length; i += 7) weeks.push(grid.slice(i, i + 7))
  return weeks
}

export function EventCalendar({ events, year, month, onMonthChange, onDelete }: EventCalendarProps) {
  const weeks = useMemo(() => buildCalendarGrid(year, month, events), [year, month, events])

  const prevMonth = () => {
    if (month === 0) onMonthChange(year - 1, 11)
    else onMonthChange(year, month - 1)
  }
  const nextMonth = () => {
    if (month === 11) onMonthChange(year + 1, 0)
    else onMonthChange(year, month + 1)
  }

  const today = new Date().toISOString().slice(0, 10)

  return (
    <Box>
      {/* Month navigation */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", mb: "1rem" }}>
        <IconButton size="small" onClick={prevMonth}><ChevronLeftIcon /></IconButton>
        <Typography variant="h6" fontWeight={700} sx={{ minWidth: "12rem", textAlign: "center" }}>
          {MONTHS[month]} {year}
        </Typography>
        <IconButton size="small" onClick={nextMonth}><ChevronRightIcon /></IconButton>
      </Box>

      {/* Weekday headers */}
      <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        mb: "0.375rem",
        bgcolor: "rgba(239,246,255,0.80)",
        backdropFilter: "blur(0.5rem)",
        border: "1px solid rgba(147,197,253,0.45)",
        borderRadius: "0.5rem",
        overflow: "hidden",
      }}>
        {WEEKDAYS.map((d) => (
          <Typography
            key={d}
            variant="caption"
            sx={{
              display: "block", textAlign: "center",
              py: "0.375rem",
              fontWeight: 700,
              fontSize: "0.6875rem",
              color: "primary.main",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {/* Weeks */}
      <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(7, 1fr)",
        gap: "0.1875rem",
        border: "1px solid rgba(147,197,253,0.45)",
        borderRadius: "0.5rem",
        overflow: "hidden",
        bgcolor: "rgba(147,197,253,0.20)",
      }}>
        {weeks.flat().map((cell, idx) => {
          const iso = cell.date.toISOString().slice(0, 10)
          const isToday = iso === today
          return (
            <Box key={idx}>
              <Paper
                elevation={0}
                sx={{
                  minHeight: "5.5rem",
                  p: "0.35rem",
                  borderRadius: 0,
                  opacity: cell.isCurrentMonth ? 1 : 0.45,
                  bgcolor: isToday
                    ? "rgba(219,234,254,0.95)"
                    : "rgba(255,255,255,0.90)",
                  border: isToday ? "1.5px solid" : "none",
                  borderColor: "primary.main",
                  overflow: "hidden",
                }}>
                  <Typography
                    variant="caption"
                    fontWeight={isToday ? 700 : 400}
                    color={isToday ? "primary.main" : "text.secondary"}
                    sx={{ display: "block", textAlign: "right", mb: "0.25rem" }}
                  >
                    {cell.date.getDate()}
                  </Typography>

                  {/* Events for this day */}
                  <Box sx={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                    {cell.events.map((ev) => (
                      <Tooltip
                        key={ev.id}
                        title={
                          <Box>
                            <Typography variant="caption" fontWeight={700}>{ev.name}</Typography>
                            {ev.impact_pct != null && (
                              <Typography variant="caption" display="block">
                                Impacto: {ev.impact_pct > 0 ? "+" : ""}{ev.impact_pct}%
                              </Typography>
                            )}
                            {!ev.is_global && (
                              <Typography variant="caption" display="block" sx={{ color: "error.light" }}>
                                Click ✕ para eliminar
                              </Typography>
                            )}
                          </Box>
                        }
                        arrow
                      >
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            bgcolor: "action.hover",
                            borderRadius: "0.25rem",
                            px: "0.25rem",
                            py: "0.1rem",
                            cursor: "default",
                          }}
                        >
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ fontSize: "0.65rem", flex: 1, color: "text.primary" }}
                          >
                            {ev.name}
                          </Typography>
                          {!ev.is_global && (
                            <IconButton
                              size="small"
                              sx={{ p: "0.1rem", ml: "0.15rem" }}
                              onClick={() => onDelete(ev.id)}
                            >
                              <DeleteOutlineIcon sx={{ fontSize: "0.75rem", color: "error.light" }} />
                            </IconButton>
                          )}
                        </Box>
                      </Tooltip>
                    ))}
                  </Box>
                </Paper>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
