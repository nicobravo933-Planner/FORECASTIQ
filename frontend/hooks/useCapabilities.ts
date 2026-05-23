"use client"

/**
 * useCapabilities — fetches server tier and available ML features.
 *
 * Priority:
 *   1. sessionStorage cache (avoids round-trip on every navigation)
 *   2. GET /api/capabilities (backend real — once deployed)
 *   3. NEXT_PUBLIC_SERVER_TIER env var (frontend .env.local fallback for dev)
 *   4. CLOUD_FALLBACK (safe defaults when backend unreachable)
 *
 * This means in localhost, even without the backend endpoint deployed,
 * setting NEXT_PUBLIC_SERVER_TIER=local in frontend/.env.local shows
 * the correct "Backend local" chip immediately.
 */

import { useEffect, useState } from "react"
import { api } from "@/lib/api"

export interface ServerCapabilities {
  tier: "local" | "ec2" | "cloud"
  tier_label: string
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

// Tier labels matching the backend
const TIER_LABELS: Record<string, string> = {
  local: "Backend local",
  ec2:   "AWS EC2",
  cloud: "Cloud",
}

// Build capabilities from a tier string (used for env-var fallback)
function capsFromTier(tier: string): ServerCapabilities {
  const isLocal = tier === "local" || tier === "ec2"
  return {
    tier: (tier as ServerCapabilities["tier"]) ?? "cloud",
    tier_label: TIER_LABELS[tier] ?? "Cloud",
    models_available: isLocal
      ? ["moving_average", "holt_winters", "sarima", "lightgbm"]
      : ["moving_average", "holt_winters", "sarima"],
    features: {
      lightgbm:    isLocal,
      optuna_hpo:  isLocal,
      nixtla_batch: isLocal,
      demo_dataset: true,
      db_connect:   true,
    },
    message: TIER_LABELS[tier] ?? "Cloud",
  }
}

// Safe cloud-tier defaults — last resort fallback
const CLOUD_FALLBACK = capsFromTier("cloud")

const SESSION_KEY = "fiq_capabilities"

export function useCapabilities() {
  const [caps, setCaps]       = useState<ServerCapabilities | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. sessionStorage cache — only use if it has tier_label (schema v2)
    try {
      const cached = sessionStorage.getItem(SESSION_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as ServerCapabilities
        if (parsed.tier_label) {          // schema v1 cache (no tier_label) → skip
          setCaps(parsed)
          setLoading(false)
          return
        }
        // stale cache — remove and re-fetch
        sessionStorage.removeItem(SESSION_KEY)
      }
    } catch { /* unavailable */ }

    // 2. Backend endpoint
    api.get<ServerCapabilities>("/api/capabilities")
      .then((data) => {
        // Garantiza tier_label aunque el backend sea una versión vieja sin ese campo
        const normalized: ServerCapabilities = {
          ...data,
          tier_label: data.tier_label ?? TIER_LABELS[data.tier] ?? `Backend (${data.tier})`,
        }
        setCaps(normalized)
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(normalized)) } catch { /* ok */ }
      })
      .catch(() => {
        // 3. Env-var fallback — works in dev without backend endpoint deployed
        const envTier = process.env.NEXT_PUBLIC_SERVER_TIER ?? "cloud"
        setCaps(capsFromTier(envTier))
      })
      .finally(() => setLoading(false))
  }, [])

  return { caps: caps ?? CLOUD_FALLBACK, loading }
}

export function clearCapabilitiesCache() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ok */ }
}
