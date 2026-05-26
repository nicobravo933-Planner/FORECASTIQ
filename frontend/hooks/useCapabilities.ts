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
  hardware_label: string   // specs: "t3.micro · 1 GB RAM" | "16 GB · Ryzen 5" | ""
  backend_online: boolean  // true cuando el backend responde, false en fallback
  models_available: string[]
  features: {
    lightgbm: boolean
    optuna_hpo: boolean
    nixtla_batch: boolean
    demo_dataset: boolean
    db_connect: boolean
  }
  // Restricciones operacionales por tier — controla qué operaciones mostrar habilitadas.
  // El frontend usa esto para deshabilitar opciones con tooltip en lugar de error genérico.
  constraints: {
    benchmark_parallel: boolean   // false en EC2: benchmark corre secuencial
    sarima_cv_allowed: boolean    // false en EC2: CV con SARIMA riesgo OOM
    lightgbm_allowed: boolean     // false en EC2
    max_benchmark_workers: number // 1 en EC2, 4 en local
  }
  message: string
}

// Tier labels matching the backend
const TIER_LABELS: Record<string, string> = {
  local: "PC Local",
  ec2:   "AWS EC2",
  cloud: "Cloud",
}

// Build capabilities from a tier string (used for env-var fallback)
function capsFromTier(tier: string): ServerCapabilities {
  const isLocal = tier === "local"
  const isEc2   = tier === "ec2"
  return {
    tier: (tier as ServerCapabilities["tier"]) ?? "cloud",
    tier_label: TIER_LABELS[tier] ?? "Cloud",
    hardware_label: "",
    backend_online: false,  // fallback = backend no respondió
    models_available: (isLocal || isEc2)
      ? ["moving_average", "holt_winters", "sarima", ...(isLocal ? ["lightgbm"] : [])]
      : ["moving_average", "holt_winters", "sarima"],
    features: {
      lightgbm:    isLocal,
      optuna_hpo:  isLocal,
      nixtla_batch: isLocal || isEc2,
      demo_dataset: true,
      db_connect:   true,
    },
    constraints: {
      benchmark_parallel: !isEc2,
      sarima_cv_allowed:  !isEc2,
      lightgbm_allowed:   isLocal,
      max_benchmark_workers: isEc2 ? 1 : 4,
    },
    message: TIER_LABELS[tier] ?? "Cloud",
  }
}

// Safe cloud-tier defaults — last resort fallback
const CLOUD_FALLBACK = capsFromTier("cloud")

const SESSION_KEY = "fiq_capabilities"
// Versión del schema — incrementar cuando cambia la estructura de ServerCapabilities
// Esto invalida el cache viejo en sessionStorage automáticamente
const SCHEMA_VERSION = "v5" // v5: hardware_label always visible (invalida cache v4)

export function useCapabilities() {
  const [caps, setCaps]       = useState<ServerCapabilities | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. sessionStorage cache — only use if it has tier_label (schema v2)
    try {
      const cached = sessionStorage.getItem(SESSION_KEY)
      if (cached) {
        const parsed = JSON.parse(cached) as ServerCapabilities
        if (parsed.tier_label && parsed.hardware_label !== undefined && (parsed as unknown as Record<string,string>).__schema === SCHEMA_VERSION) {
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
          hardware_label: data.hardware_label || process.env.NEXT_PUBLIC_SERVER_HARDWARE_LABEL || "",
          backend_online: true,
          // Si el backend es viejo y no manda constraints, construir fallback desde tier
          constraints: data.constraints ?? capsFromTier(data.tier).constraints,
        }
        setCaps(normalized)
        try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...normalized, __schema: SCHEMA_VERSION })) } catch { /* ok */ }
      })
      .catch(() => {
        // 3. Env-var fallback — works in dev without backend endpoint deployed
        const envTier = process.env.NEXT_PUBLIC_SERVER_TIER ?? "cloud"
        const fallback = capsFromTier(envTier)
        // Leer hardware label desde env var si está disponible
        const envHw = process.env.NEXT_PUBLIC_SERVER_HARDWARE_LABEL ?? ""
        setCaps({ ...fallback, hardware_label: envHw })
      })
      .finally(() => setLoading(false))
  }, [])

  return { caps: caps ?? CLOUD_FALLBACK, loading }
}

export function clearCapabilitiesCache() {
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ok */ }
}
