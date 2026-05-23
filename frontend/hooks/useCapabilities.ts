"use client"

/**
 * useCapabilities — fetches server tier and available ML features.
 *
 * The backend exposes GET /api/capabilities which returns:
 *   tier: "cloud" | "local"
 *   models_available: string[]
 *   features: { lightgbm, optuna_hpo, nixtla_batch, demo_dataset, db_connect }
 *   message: string
 *
 * Result is cached in sessionStorage so we call the backend only once per tab.
 * Falls back to "cloud" tier gracefully if the backend is unreachable.
 */

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export interface ServerCapabilities {
  tier: "cloud" | "local"
  models_available: string[]
  features: {
    lightgbm: boolean
    optuna_hpo: boolean
    nixtla_batch: boolean
    demo_dataset: boolean
    db_connect: boolean
  }
  message: string
}

// Safe cloud-tier defaults — used as fallback when the backend is unreachable
const CLOUD_FALLBACK: ServerCapabilities = {
  tier: "cloud",
  models_available: ["moving_average", "holt_winters", "sarima"],
  features: {
    lightgbm: false,
    optuna_hpo: false,
    nixtla_batch: false,
    demo_dataset: true,
    db_connect: true,
  },
  message: "No se pudo conectar al backend — mostrando modo cloud.",
}

const SESSION_KEY = "fiq_capabilities"

export function useCapabilities() {
  const [caps, setCaps]       = useState<ServerCapabilities | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Try sessionStorage first — avoids a round-trip on every page navigation
    try {
      const cached = sessionStorage.getItem(SESSION_KEY)
      if (cached) {
        setCaps(JSON.parse(cached) as ServerCapabilities)
        setLoading(false)
        return
      }
    } catch {
      // sessionStorage unavailable (SSR, private mode) — continue to fetch
    }

    api.get<ServerCapabilities>("/api/capabilities")
      .then((data) => {
        setCaps(data)
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(data)) } catch { /* ok */ }
      })
      .catch(() => setCaps(CLOUD_FALLBACK))
      .finally(() => setLoading(false))
  }, [])

  return { caps: caps ?? CLOUD_FALLBACK, loading }
}

/** Invalidate the session cache (call after SERVER_TIER env changes in dev) */
export function clearCapabilitiesCache() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ok */ }
}
