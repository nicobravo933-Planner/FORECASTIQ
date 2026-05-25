"use client"

/**
 * EventCalendar — MUI X DateCalendar with custom day slots showing events.
 * Each day cell renders event chips below the date number.
 * Uses date-fns adapter (LocalizationProvider wraps the whole component).
 */

import { useMemo, forwardRef, type ComponentType } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Tooltip from "@mui/material/Tooltip"
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar"
import { PickersDay } from "@mui/x-date-pickers/PickersDay"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import type { PickersDayProps } from "@mui/x-date-pickers/PickersDay"
import { es } from "date-fns/locale"
import { format, parseISO } from "date-fns"
import { TYPE_CONFIG } from "./EventChip"
import type { CalendarEvent } from "@/lib/types"

// ── Types ──────────────────────────────────────────────────────────────────

interface EventCalendarProps {
  events:        CalendarEvent[]
  year:          number
  month:         number           // 0-indexed
  onMonthChange: (year: number, month: number) => void
  onDelete:      (id: string) => void
}

// Props injected by DateCalendar into our custom day slot
interface EventDayProps extends PickersDayProps<Date> {
  eventsMap: Map<string, CalendarEvent[]>
}

// ── Helper: build iso → events map for the visible month ──────────────────

function buildEventsMap(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const start = parseISO(ev.start_date)
    const end   = parseISO(ev.end_date)
    // Walk each day of the event range
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = format(cursor, "yyyy-MM-dd")
      const existing = map.get(key) ?? []
      map.set(key, [...existing, ev])
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return map
}

// ── Custom Day Slot ────────────────────────────────────────────────────────

// forwardRef is required by MUI X slot API
const EventDay = forwardRef<HTMLButtonElement, EventDayProps>(
  function EventDay({ eventsMap, day, outsideCurrentMonth, ...other }, ref) {
    const iso     = format(day, "yyyy-MM-dd")
    const dayEvts = eventsMap.get(iso) ?? []
    // Show max 2 chips + overflow badge
    const visible  = dayEvts.slice(0, 2)
    const overflow = dayEvts.length - visible.length

    return (
      <Box
        sx={{
          display:        "flex",
          flexDirection:  "column",
          alignItems:     "center",
          width:          "100%",
          // Cells with events get slightly more height
          pb:             dayEvts.length > 0 ? "0.25rem" : 0,
        }}
      >
        {/* Native PickersDay handles today highlight, selected state, disabled */}
        <PickersDay
          ref={ref}
          day={day}
          outsideCurrentMonth={outsideCurrentMonth}
          {...other}
          sx={{
            // Keep the default circle button size
            width:  "2.25rem",
            height: "2.25rem",
            fontSize: "0.8125rem",
          }}
        />

        {/* Event chips below the number */}
        {!outsideCurrentMonth && dayEvts.length > 0 && (
          <Box
            sx={{
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "stretch",
              width:          "calc(100% - 0.25rem)",
              gap:            "0.15rem",
              mt:             "0.15rem",
            }}
          >
            {visible.map((ev) => {
              const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.other
              // Map MUI color names to palette tokens
              const colorMap: Record<string, string> = {
                info:    "info.main",
                success: "success.main",
                warning: "warning.main",
                default: "text.secondary",
                error:   "error.main",
              }
              const bg = colorMap[cfg.color] ?? "text.secondary"
              return (
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
                      {ev.source === "auto" && (
                        <Typography variant="caption" display="block" color="primary.light">
                          Auto-generado
                        </Typography>
                      )}
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      bgcolor:      bg,
                      borderRadius: "0.2rem",
                      px:           "0.2rem",
                      py:           "0.05rem",
                      overflow:     "hidden",
                      opacity:      0.9,
                    }}
                  >
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        display:  "block",
                        fontSize: "0.575rem",
                        color:    "common.white",
                        fontWeight: 600,
                        lineHeight: 1.3,
                      }}
                    >
                      {ev.name}
                    </Typography>
                  </Box>
                </Tooltip>
              )
            })}

            {/* Overflow badge: "+2 más" */}
            {overflow > 0 && (
              <Typography
                variant="caption"
                sx={{
                  fontSize:  "0.55rem",
                  color:     "text.secondary",
                  textAlign: "center",
                  lineHeight: 1.2,
                }}
              >
                +{overflow} más
              </Typography>
            )}
          </Box>
        )}
      </Box>
    )
  },
)

// ── Main Component ─────────────────────────────────────────────────────────

export function EventCalendar({
  events,
  year,
  month,
  onMonthChange,
}: EventCalendarProps) {
  // Build a fast lookup map: "yyyy-MM-dd" → CalendarEvent[]
  const eventsMap = useMemo(() => buildEventsMap(events), [events])

  // Controlled value for DateCalendar — first day of visible month
  const value = useMemo(() => new Date(year, month, 1), [year, month])

  const handleMonthChange = (date: Date | null) => {
    if (!date) return
    onMonthChange(date.getFullYear(), date.getMonth())
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={es}>
      <Box
        sx={{
          // Glass card matching the rest of the app
          bgcolor:        "background.paper",
          border:         "1px solid",
          borderColor:    "divider",
          borderRadius:   "1rem",
          p:              "0.5rem",
          boxShadow:      "0 0.125rem 0.75rem rgba(0,0,0,0.06)",
          // Let DateCalendar fill the container width
          "& .MuiDateCalendar-root": {
            width:    "100%",
            maxWidth: "100%",
            height:   "auto",
          },
          // Expand day cells vertically to fit event chips
          "& .MuiDayCalendar-weekContainer": {
            alignItems: "flex-start",
            mb:         "0.25rem",
          },
          // Each day column stretches to fill the 7-column grid
          "& .MuiPickersDay-root": {
            flexShrink: 0,
          },
          // Header (month label + nav arrows)
          "& .MuiPickersCalendarHeader-root": {
            pl:  "0.75rem",
            pr:  "0.5rem",
            mt:  "0.25rem",
            mb:  "0.5rem",
          },
          "& .MuiPickersCalendarHeader-label": {
            fontWeight: 700,
            fontSize:   "1rem",
            textTransform: "capitalize",
          },
          // Weekday labels row
          "& .MuiDayCalendar-header": {
            mb: "0.25rem",
          },
          "& .MuiDayCalendar-weekDayLabel": {
            fontWeight:    700,
            fontSize:      "0.6875rem",
            color:         "primary.main",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          },
        }}
      >
        <DateCalendar
          value={value}
          onMonthChange={handleMonthChange}
          onYearChange={handleMonthChange}
          // Prevent selecting a specific date — we only use it as a navigator
          onChange={() => {}}
          showDaysOutsideCurrentMonth
          fixedWeekNumber={6}
          slots={{
            // Cast needed: MUI X slot generics don't accept extra props directly
            day: EventDay as ComponentType<PickersDayProps<Date>>,
          }}
          slotProps={{
            day: {
              // Pass the events map down to each day cell
              eventsMap,
            } as object,
          }}
        />
      </Box>
    </LocalizationProvider>
  )
}
