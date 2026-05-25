"use client"

/**
 * useForecast — manages the full forecast job lifecycle:
 *   idle → submitting → polling → done | failed
 *
 * Polling strategy: every 2s, max 120s (60 attempts), then timeout.
 */

import { useState, useRef, useCallback, useEffect } from "react"
import { api } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import type {
  ForecastRunRequest,
  ForecastStatusResponse,
  ForecastResult,
  ForecastStatus,
} from "@/lib/types"

type ForecastStage = "idle" | "submitting" | "polling" | "done" | "failed"

interface UseForecastState {
  stage: ForecastStage
  jobId: string | null
  status: ForecastStatus | null
  progressPct: number
  step: string
  result: ForecastResult | null
  error: string | null
}

interface UseForecastReturn extends UseForecastState {
  runForecast: (req: ForecastRunRequest) => Promise<void>
  reset: () => void
}

const POLL_INTERVAL_MS = 2000
const MAX_POLLS = 60 // 2 min timeout

export function useForecast(): UseForecastReturn {
  const [state, setState] = useState<UseForecastState>(() => ({
    stage: "idle",
    jobId: null,
    status: null,
    progressPct: 0,
    step: "",
    // Restaurar resultado persistido al montar (volver de otra vista)
    result: appStore.getLastResult<ForecastResult>(),
    error: null,
  }))

  const pollCountRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const stopPolling = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const pollStatus = useCallback(
    async (jobId: string) => {
      pollCountRef.current += 1

      if (pollCountRef.current > MAX_POLLS) {
        stopPolling()
        setState((s) => ({ ...s, stage: "failed", error: "Timeout: el forecast tardó demasiado." }))
        return
      }

      try {
        const status = await api.get<ForecastStatusResponse>(`/api/forecast/${jobId}/status`)

        setState((s) => ({
          ...s,
          status: status.status,
          progressPct: status.progress_pct,
          step: status.step,
        }))

        if (status.status === "done") {
          stopPolling()
          const result = await api.get<ForecastResult>(`/api/forecast/${jobId}/result`)
          appStore.setActiveJobId(jobId)
          appStore.setLastResult(result)  // persistir para sobrevivir navegación
          setState((s) => ({ ...s, stage: "done", result }))
          return
        }

        if (status.status === "failed") {
          stopPolling()
          setState((s) => ({ ...s, stage: "failed", error: status.step || "El forecast falló." }))
          return
        }

        // Still running — schedule next poll
        timerRef.current = setTimeout(() => pollStatus(jobId), POLL_INTERVAL_MS)
      } catch (err) {
        stopPolling()
        const msg = err instanceof Error ? err.message : "Error consultando el estado del job."
        setState((s) => ({ ...s, stage: "failed", error: msg }))
      }
    },
    [stopPolling],
  )

  const runForecast = useCallback(
    async (req: ForecastRunRequest) => {
      stopPolling()
      pollCountRef.current = 0
      setState({
        stage: "submitting",
        jobId: null,
        status: null,
        progressPct: 0,
        step: "Enviando solicitud...",
        result: null,
        error: null,
      })

      try {
        const { job_id, status } = await api.post<{ job_id: string; status: string }>(
          "/api/forecast/run",
          req,
        )
        setState((s) => ({ ...s, stage: "polling", jobId: job_id }))

        // Si el backend ya terminó síncronamente (eager mode dev), va directo al resultado
        if (status === "done") {
          const result = await api.get<ForecastResult>(`/api/forecast/${job_id}/result`)
          appStore.setActiveJobId(job_id)
          appStore.setLastResult(result)  // persistir para sobrevivir navegación
          setState((s) => ({ ...s, stage: "done", result, progressPct: 100, step: "Completado" }))
          return
        }

        // Producción: inicia polling
        timerRef.current = setTimeout(() => pollStatus(job_id), 500)
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al lanzar el forecast."
        setState((s) => ({ ...s, stage: "failed", error: msg }))
      }
    },
    [stopPolling, pollStatus],
  )

  const reset = useCallback(() => {
    stopPolling()
    pollCountRef.current = 0
    setState({
      stage: "idle",
      jobId: null,
      status: null,
      progressPct: 0,
      step: "",
      result: null,
      error: null,
    })
  }, [stopPolling])

  return { ...state, runForecast, reset }
}
