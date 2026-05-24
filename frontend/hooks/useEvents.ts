"use client"

/**
 * useEvents — CRUD state for calendar events.
 * Handles fetching, creating, and deleting events.
 */

import { useState, useCallback, useEffect } from "react"
import { api } from "@/lib/api"
import type { CalendarEvent, EventType } from "@/lib/types"

interface EventListResponse {
  events: CalendarEvent[]
  total: number
}

interface CreateEventPayload {
  name: string
  type: EventType
  start_date: string
  end_date: string
  impact_pct: number | null
  dataset_id?: string | null
}

interface UpdateEventPayload {
  name?: string
  type?: EventType
  start_date?: string
  end_date?: string
  impact_pct?: number | null
}

interface UseEventsReturn {
  events: CalendarEvent[]
  loading: boolean
  error: string | null
  year: number
  setYear: (y: number) => void
  createEvent: (payload: CreateEventPayload) => Promise<void>
  updateEvent: (id: string, payload: UpdateEventPayload) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  refresh: () => void
}

export function useEvents(): UseEventsReturn {
  const [events, setEvents]   = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [year, setYear]       = useState(() => new Date().getFullYear())

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get<EventListResponse>(
        `/api/events?year=${year}&include_holidays=true`,
      )
      setEvents(res.events)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error cargando eventos.")
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const createEvent = useCallback(
    async (payload: CreateEventPayload) => {
      const newEvent = await api.post<CalendarEvent>("/api/events", payload)
      setEvents((prev) => [...prev, newEvent])
    },
    [],
  )

  const updateEvent = useCallback(async (id: string, payload: UpdateEventPayload) => {
    const updated = await api.patch<CalendarEvent>(`/api/events/${id}`, payload)
    setEvents((prev) => prev.map((e) => (e.id === id ? updated : e)))
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/events/${id}`, {
      method: "DELETE",
    })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  return {
    events,
    loading,
    error,
    year,
    setYear,
    createEvent,
    updateEvent,
    deleteEvent,
    refresh: fetchEvents,
  }
}
