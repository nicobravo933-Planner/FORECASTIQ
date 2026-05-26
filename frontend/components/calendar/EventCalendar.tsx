"use client"

/**
 * EventCalendar — custom monthly grid (no MUI X DateCalendar).
 * Replicates the HTML prototype aesthetics: tall cells, full-width event chips,
 * accent circle for today, uppercase weekday headers.
 */

import { useMemo, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Tooltip from "@mui/material/Tooltip"
import IconButton from "@mui/material/IconButton"
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft"
import ChevronRightIcon from "@mui/icons-material/ChevronRight"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { TYPE_CONFIG } from "./EventChip"
import type { CalendarEvent } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventCalendarProps {
  events:        CalendarEvent[]
  year:          number
  month:         number           // 0-indexed
  onMonthChange: (year: number, month: number) => void
  onDelete:      (id: string) => void
}

// ── Color map: MUI color name → CSS color ────────────────────────────────────

const COLOR_MAP: Record<string, string> = {
  info:    "#3b82f6",
  success: "#10b981",
  warning: "#f59e0b",
  error:   "#ef4444",
  default: "#6b7280",
  primary: "#6366f1",
}

// ── Weekday labels (Mon-first, matching ES locale) ────────────────────────────

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]

const MONTHS_ES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
]

// ── Build day → events map ────────────────────────────────────────────────────

function buildEventsMap(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>()
  for (const ev of events) {
    const start = parseISO(ev.start_date)
    const end   = parseISO(ev.end_date)
    const cursor = new Date(start)
    while (cursor <= end) {
      const key = format(cursor, "yyyy-MM-dd")
      map.set(key, [...(map.get(key) ?? []), ev])
      cursor.setDate(cursor.getDate() + 1)
    }
  }
  return map
}

// ── Build calendar cell grid ──────────────────────────────────────────────────

interface Cell { day: number; iso: string; current: boolean }

function buildCells(year: number, month: number): Cell[] {
  const firstDay  = new Date(year, month, 1).getDay()   // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevDays  = new Date(year, month, 0).getDate()

  const cells: Cell[] = []

  // Trailing days from previous month
  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + 1 + i
    const prevMonth = month === 0 ? 11 : month - 1
    const prevYear  = month === 0 ? year - 1 : year
    cells.push({
      day: d,
      iso: `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      current: false,
    })
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      day: d,
      iso: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      current: true,
    })
  }

  // Leading days of next month to complete 6 rows
  let nextDay = 1
  while (cells.length < 42) {
    const nextMonth = month === 11 ? 0 : month + 1
    const nextYear  = month === 11 ? year + 1 : year
    cells.push({
      day: nextDay,
      iso: `${nextYear}-${String(nextMonth + 1).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`,
      current: false,
    })
    nextDay++
  }

  return cells
}

// ── Main component ────────────────────────────────────────────────────────────

export function EventCalendar({ events, year, month, onMonthChange }: EventCalendarProps) {
  const eventsMap = useMemo(() => buildEventsMap(events), [events])
  const cells     = useMemo(() => buildCells(year, month), [year, month])
  const todayIso  = format(new Date(), "yyyy-MM-dd")

  const handlePrev = () => {
    if (month === 0) onMonthChange(year - 1, 11)
    else             onMonthChange(year, month - 1)
  }
  const handleNext = () => {
    if (month === 11) onMonthChange(year + 1, 0)
    else              onMonthChange(year, month + 1)
  }

  return (
    <Box
      sx={{
        bgcolor:      "background.paper",
        border:       "1px solid",
        borderColor:  "divider",
        borderRadius: "1rem",
        overflow:     "hidden",
        boxShadow:    "0 0.125rem 0.75rem rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Month nav header ── */}
      <Box
        sx={{
          display:        "flex",
          alignItems:     "center",
          justifyContent: "space-between",
          px:             "1.25rem",
          py:             "0.875rem",
          borderBottom:   "1px solid",
          borderColor:    "divider",
        }}
      >
        <IconButton size="small" onClick={handlePrev} sx={{ borderRadius: "0.5rem" }}>
          <ChevronLeftIcon fontSize="small" />
        </IconButton>

        <Typography fontWeight={700} fontSize="1.0625rem" color="text.primary">
          {MONTHS_ES[month]} {year}
        </Typography>

        <IconButton size="small" onClick={handleNext} sx={{ borderRadius: "0.5rem" }}>
          <ChevronRightIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Weekday headers ── */}
      <Box
        sx={{
          display:         "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          borderBottom:    "1px solid",
          borderColor:     "divider",
          bgcolor:         "action.hover",
        }}
      >
        {WEEKDAYS.map((d) => (
          <Typography
            key={d}
            sx={{
              py:            "0.5rem",
              textAlign:     "center",
              fontSize:      "0.6875rem",
              fontWeight:    700,
              color:         "primary.main",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {d}
          </Typography>
        ))}
      </Box>

      {/* ── Day grid — 6 rows × 7 cols ── */}
      <Box
        sx={{
          display:             "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
        }}
      >
        {cells.map((cell, i) => {
          const dayEvts  = eventsMap.get(cell.iso) ?? []
          const isToday  = cell.iso === todayIso
          const col      = i % 7
          const row      = Math.floor(i / 7)
          const isLastRow = row === 5

          return (
            <Box
              key={cell.iso}
              sx={{
                minHeight:     "5.5rem",
                borderRight:   col < 6 ? "1px solid" : "none",
                borderBottom:  !isLastRow ? "1px solid" : "none",
                borderColor:   "divider",
                p:             "0.375rem 0.375rem 0.25rem",
                bgcolor:       isToday ? "primary.50" : "transparent",
                transition:    "background 0.12s",
                "&:hover":     { bgcolor: isToday ? "primary.50" : "action.hover" },
              }}
            >
              {/* Day number */}
              <Box
                sx={{
                  width:          "1.625rem",
                  height:         "1.625rem",
                  borderRadius:   "50%",
                  display:        "flex",
                  alignItems:     "center",
                  justifyContent: "center",
                  mb:             "0.2rem",
                  bgcolor:        isToday ? "primary.main" : "transparent",
                  flexShrink:     0,
                  alignSelf:      "flex-start",
                }}
              >
                <Typography
                  sx={{
                    fontSize:   "0.8125rem",
                    fontWeight: isToday ? 700 : 400,
                    color:      isToday
                      ? "primary.contrastText"
                      : cell.current ? "text.primary" : "text.disabled",
                    lineHeight: 1,
                  }}
                >
                  {cell.day}
                </Typography>
              </Box>

              {/* Event chips */}
              {cell.current && dayEvts.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                  {dayEvts.slice(0, 3).map((ev) => {
                    const cfg   = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.other
                    const color = COLOR_MAP[cfg.color] ?? COLOR_MAP.default
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
                            bgcolor:      color,
                            borderRadius: "0.25rem",
                            px:           "0.3rem",
                            py:           "0.1rem",
                            overflow:     "hidden",
                            cursor:       "default",
                            opacity:      0.92,
                          }}
                        >
                          <Typography
                            noWrap
                            sx={{
                              display:    "block",
                              fontSize:   "0.6rem",
                              fontWeight: 600,
                              color:      "#fff",
                              lineHeight: 1.4,
                            }}
                          >
                            {ev.name}
                          </Typography>
                        </Box>
                      </Tooltip>
                    )
                  })}

                  {dayEvts.length > 3 && (
                    <Typography
                      sx={{
                        fontSize:  "0.575rem",
                        color:     "text.disabled",
                        textAlign: "center",
                        lineHeight: 1.2,
                      }}
                    >
                      +{dayEvts.length - 3} más
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
