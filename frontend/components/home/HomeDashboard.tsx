"use client"

/**
 * HomeDashboard — HomeV2 data-forward.
 * Hero strip (logo flotante 11.75rem) intacto.
 * Debajo: KPI cards · MiniChart real · Pipeline stepper · Próximos eventos · Acciones rápidas.
 */

import { useEffect, useState, useCallback } from "react"
import { useTheme } from "@mui/material/styles"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import CloudDoneIcon from "@mui/icons-material/CloudDone"
import CloudOffIcon from "@mui/icons-material/CloudOff"
import ComputerIcon from "@mui/icons-material/Computer"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import SmartToyIcon from "@mui/icons-material/SmartToy"
import BarChartIcon from "@mui/icons-material/BarChart"
import EventIcon from "@mui/icons-material/Event"
import { api } from "@/lib/api"
import { PipelineBar } from "@/components/common/PipelineBar"
import { useCapabilities } from "@/hooks/useCapabilities"
import { appStore } from "@/lib/appStore"
import type { ForecastResult, CalendarEvent } from "@/lib/types"
import type { SxProps } from "@mui/material"

// ── Date helpers ──────────────────────────────────────────────────────────────
const DAYS_ES   = ["Domingo","Lunes","Martes","Miercoles","Jueves","Viernes","Sabado"]
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
function formatDateES(d: Date) {
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}
function formatTimeES(d: Date) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ── Sizes (hero — no tocar) ───────────────────────────────────────────────────
const LOGO_SIZE     = "11.75rem"
const LOGO_OVERFLOW = "2rem"

// ── Glass card sx helper — moved inside component to read theme ─────────────

// ── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color, w = 72, h = 30 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data), range = max - min || 1
  const pts = data.map((v, i) => [
    (i / (data.length - 1)) * w,
    h - 4 - ((v - min) / range) * (h - 8) + 4,
  ])
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ")
  const area = `${line} L${w},${h} L0,${h} Z`
  const last = pts[pts.length - 1]
  return (
    <svg width={w} height={h} style={{ overflow: "visible", display: "block", flexShrink: 0 }}>
      <path d={area} fill={color} opacity={0.13} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={3} fill={color} />
    </svg>
  )
}

// ── Quality Ring SVG ──────────────────────────────────────────────────────────
function QualityRing({ score, color, size = 52 }: { score: number; color: string; size?: number }) {
  const r = size * 0.36
  const circ = 2 * Math.PI * r
  const dash = Math.max(0, Math.min(1, score / 100)) * circ
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${color}22`} strokeWidth={4.5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4.5}
        strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x={size / 2} y={size / 2 + 4.5} textAnchor="middle"
        fontSize={size * 0.22} fontWeight="700" fill={color} fontFamily="Inter,sans-serif">
        {score}
      </text>
    </svg>
  )
}

// ── Mini Forecast Chart SVG ───────────────────────────────────────────────────
function MiniChart({ result }: { result: ForecastResult | null }) {
  if (!result) {
    return (
      <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "0.5rem", color: "text.disabled" }}>
        <ShowChartIcon sx={{ fontSize: "2.5rem", opacity: 0.3 }} />
        <Typography variant="caption" color="text.disabled">
          Ejecutá un forecast para ver el gráfico aquí
        </Typography>
      </Box>
    )
  }

  const W = 520, H = 120
  const PAD = { t: 12, b: 24, l: 34, r: 10 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b

  const allVals = [
    ...result.historical.map(p => p.value),
    ...result.predictions.map(p => p.upper),
  ].filter(Boolean)
  if (allVals.length === 0) return null

  const minV = Math.min(...allVals) * 0.92
  const maxV = Math.max(...allVals) * 1.05

  // Usar toda la historia disponible (máx 24 puntos para no saturar el mini-chart)
  const hist = result.historical.slice(-24)
  const preds = result.predictions

  const totalPts = hist.length + preds.length
  const xS = (i: number) => PAD.l + (i / (totalPts - 1)) * cW
  const yS = (v: number) => PAD.t + cH - ((v - minV) / (maxV - minV)) * cH

  const histPath = hist
    .map((p, i) => `${i === 0 ? "M" : "L"}${xS(i).toFixed(1)},${yS(p.value).toFixed(1)}`)
    .join(" ")

  const fxStart = hist.length - 1
  const fxPath = [
    `M${xS(fxStart).toFixed(1)},${yS(hist[hist.length - 1].value).toFixed(1)}`,
    ...preds.map((p, i) => `L${xS(fxStart + 1 + i).toFixed(1)},${yS(p.predicted).toFixed(1)}`),
  ].join(" ")

  const ciPath = [
    ...preds.map((p, i) => `${i === 0 ? "M" : "L"}${xS(fxStart + 1 + i).toFixed(1)},${yS(p.upper).toFixed(1)}`),
    ...preds.slice().reverse().map((p, i) =>
      `L${xS(fxStart + preds.length - i).toFixed(1)},${yS(p.lower).toFixed(1)}`),
    "Z",
  ].join(" ")

  const divX = xS(fxStart)
  const gridVals = [minV + (maxV - minV) * 0.75, minV + (maxV - minV) * 0.4]

  const labels = [
    ...hist.map((p, i) => ({ i, label: p.date.slice(0, 7) })).filter((_, i) => i === 0 || i === hist.length - 1),
    ...preds.map((p, i) => ({ i: fxStart + 1 + i, label: p.date.slice(0, 7) }))
      .filter((_, i) => i === preds.length - 1),
  ]

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", display: "block" }}>
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={yS(v)} x2={W - PAD.r} y2={yS(v)}
            stroke="rgba(219,234,254,0.9)" strokeWidth={1} strokeDasharray="2,3" />
          <text x={PAD.l - 4} y={yS(v) + 3.5} textAnchor="end" fontSize={8}
            fill="#94a3b8" fontFamily="Inter,sans-serif">
            {Math.round(v)}
          </text>
        </g>
      ))}
      <rect x={divX} y={PAD.t} width={W - PAD.r - divX} height={cH}
        fill="rgba(139,92,246,0.04)" rx={2} />
      <path d={ciPath} fill="rgba(139,92,246,0.12)" />
      <path d={histPath} fill="none" stroke="#3b82f6" strokeWidth={2.2}
        strokeLinecap="round" strokeLinejoin="round" />
      <path d={fxPath} fill="none" stroke="#8b5cf6" strokeWidth={2}
        strokeDasharray="5,3" strokeLinecap="round" />
      <line x1={divX} y1={PAD.t} x2={divX} y2={PAD.t + cH}
        stroke="#94a3b8" strokeWidth={1} strokeDasharray="3,3" opacity={0.6} />
      {hist.map((p, i) => (
        <circle key={i} cx={xS(i)} cy={yS(p.value)} r={2.5} fill="#3b82f6" />
      ))}
      {preds.map((p, i) => (
        <circle key={i} cx={xS(fxStart + 1 + i)} cy={yS(p.predicted)} r={2.5}
          fill="#8b5cf6" opacity={0.75} />
      ))}
      {labels.map(({ i, label }) => (
        <text key={i} x={xS(i)} y={H - 3} textAnchor="middle" fontSize={8}
          fill={i > fxStart ? "#8b5cf6" : "#64748b"}
          fontWeight={i > fxStart ? "600" : "400"}
          fontFamily="Inter,sans-serif">
          {label}
        </text>
      ))}
      <text x={divX + 6} y={PAD.t + 9} fontSize={7.5} fill="#8b5cf6"
        fontWeight="600" letterSpacing="0.06em" fontFamily="Inter,sans-serif">
        FORECAST →
      </text>
    </svg>
  )
}

// ── Countdown helper ──────────────────────────────────────────────────────────
function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

// ── Quick actions ─────────────────────────────────────────────────────────────
const QUICK_ACTIONS = [
  { icon: <UploadFileIcon />, label: "Subir dataset",    sub: "CSV · Parquet · DB",          color: "#3b82f6", href: "/dashboard/dataset"     },
  { icon: <ShowChartIcon />,  label: "Nuevo forecast",   sub: "4 modelos · auto-detección",  color: "#8b5cf6", href: "/dashboard/forecast"    },
  { icon: <SmartToyIcon />,   label: "Chat IA",          sub: "Preguntá en lenguaje natural",color: "#f59e0b", href: "/dashboard/chat"        },
  { icon: <BarChartIcon />,   label: "Batch 25k SKUs",   sub: "Nixtla StatsForecast",        color: "#ec4899", href: "/dashboard/batch"       },
]

// ── Model chip colors ─────────────────────────────────────────────────────────
const MODEL_COLORS: Record<string, string> = {
  moving_average: "#3b82f6",
  holt_winters:   "#0ea5e9",
  sarima:         "#8b5cf6",
  lightgbm:       "#10b981",
}
const MODEL_LABELS: Record<string, string> = {
  moving_average: "MA",
  holt_winters:   "HW",
  sarima:         "SARIMA",
  lightgbm:       "LGB",
}

// ── Main Component ────────────────────────────────────────────────────────────
export function HomeDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const { caps } = useCapabilities()
  const theme = useTheme()

  // Glass card sx — adapts to dark/light mode
  const glassCard: SxProps = {
    bgcolor: theme.palette.mode === "dark" ? theme.palette.background.paper : "rgba(255,255,255,0.85)",
    backdropFilter: "blur(0.625rem)",
    borderRadius: "0.875rem",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "divider" : "rgba(219,234,254,0.7)",
    boxShadow: "0 0.0625rem 0.25rem rgba(0,0,0,0.05)",
  }

  // ── Clock (SSR-safe) ────────────────────────────────────────────────────────
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // ── Backend health ──────────────────────────────────────────────────────────
  const [health, setHealth] = useState<{ status: string; version: string } | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  useEffect(() => {
    api.get<{ status: string; version: string; environment: string }>("/health")
      .then(res => setHealth(res))
      .catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [])
  const isOnline = health?.status === "ok"

  // ── appStore state ──────────────────────────────────────────────────────────
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null)
  const [activeJobId, setActiveJobId]         = useState<string | null>(null)
  const [qualityData, setQualityData]         = useState<{ score: number; label: string } | null>(null)

  useEffect(() => {
    const dsId   = appStore.getActiveDatasetId()
    const jobId  = appStore.getActiveJobId()
    const qs     = appStore.getQualityScore()
    setActiveDatasetId(dsId)
    setActiveJobId(jobId)
    setQualityData(qs ? { score: qs.score, label: qs.label } : null)

    const onStorage = () => {
      const newJobId = appStore.getActiveJobId()
      const newDsId  = appStore.getActiveDatasetId()
      const newQs    = appStore.getQualityScore()
      setActiveJobId(newJobId)
      setActiveDatasetId(newDsId)
      setQualityData(newQs ? { score: newQs.score, label: newQs.label } : null)
    }
    window.addEventListener("storage", onStorage)
    window.addEventListener("fiq:store-update", onStorage)
    return () => {
      window.removeEventListener("storage", onStorage)
      window.removeEventListener("fiq:store-update", onStorage)
    }
  }, [])

  // ── Forecast result (SSR-safe) ────────────────────────────────────────────
  // Nunca leer localStorage en la inicializacion del estado — causa hydration mismatch.
  // Se hidrata en useEffect (solo corre en el cliente).
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)

  useEffect(() => {
    // Hidratar desde localStorage al montar
    const persisted = appStore.getLastResult<ForecastResult>()
    if (persisted) setForecastResult(persisted)

    // Escuchar actualizaciones en tiempo real (cuando useForecast guarda el resultado)
    const onUpdate = () => {
      const updated = appStore.getLastResult<ForecastResult>()
      if (updated) setForecastResult(updated)
    }
    window.addEventListener("fiq:store-update", onUpdate)
    return () => window.removeEventListener("fiq:store-update", onUpdate)
  }, [])

  // ── Events (próximos) ──────────────────────────────────────────────────────
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const fetchEvents = useCallback(async () => {
    const year = new Date().getFullYear()
    try {
      const res = await api.get<{ events: CalendarEvent[] }>(
        `/api/events?year=${year}&include_holidays=true`
      )
      const today = new Date(); today.setHours(0, 0, 0, 0)
      const future = res.events
        .filter(e => new Date(e.start_date) >= today)
        .sort((a, b) => a.start_date.localeCompare(b.start_date))
        .slice(0, 4)
      setUpcomingEvents(future)
    } catch { /* silencioso */ }
  }, [])
  useEffect(() => { void fetchEvents() }, [fetchEvents])

  // ── Derived values ─────────────────────────────────────────────────────────
  const firstName = session?.user?.name ? session.user.name.split(" ")[0] : null
  const modelsAvailable = (caps.models_available as string[] | undefined) ?? []

  const wape        = forecastResult?.metrics.wape != null ? forecastResult.metrics.wape * 100 : null
  const fva         = forecastResult?.metrics.fva  != null ? forecastResult.metrics.fva  * 100 : null
  const modelUsed   = forecastResult?.model_used   ?? null
  const wapeHistory = wape !== null ? [wape * 1.15, wape * 1.1, wape * 1.06, wape * 1.02, wape] : []

  const qScore = qualityData?.score ?? null
  const qColor = qScore === null ? "#9ca3af"
    : qScore >= 80 ? "#10b981"
    : qScore >= 60 ? "#3b82f6"
    : qScore >= 30 ? "#f59e0b"
    : "#ef4444"
  const qLabel = qualityData?.label ?? null

  const nextEvent = upcomingEvents[0] ?? null
  const nextEventDays = nextEvent ? daysUntil(nextEvent.start_date) : null

  // ── Pipeline steps ─────────────────────────────────────────────────────────
  // (Removed: HomeDashboard now uses <PipelineBar> directly)

  // ── Event type color map ────────────────────────────────────────────────────
  const evColor = (type: string) =>
    type === "holiday" ? "#3b82f6"
    : type === "promotion" ? "#f59e0b"
    : type === "seasonal" ? "#10b981"
    : "#8b5cf6"

  const formatEvDate = (d: string) => {
    const dt = new Date(d + "T00:00:00")
    return `${dt.getDate()} ${MONTHS_ES[dt.getMonth()].slice(0, 3)}`
  }

  return (
    <Box sx={{
      height: "100%", display: "flex", flexDirection: "column",
      gap: "0.875rem", overflow: "hidden",
      px: "1.5rem", pt: "2.5rem", pb: "1.125rem",
    }}>
{/* ══════════════════════════════════════════════════════════════════════
          HERO STRIP — no modificar (logo 11.75rem flotante)
      ══════════════════════════════════════════════════════════════════════ */}
      <Box sx={{
        background: "var(--fiq-appbar-bg, linear-gradient(135deg, #0f2044 0%, #1a3868 100%))",
        borderRadius: "1rem",
        p: "1.75rem 1.5rem",
        height: "8rem",         // altura fija — el logo siempre centrado
        minHeight: "8rem",
        display: "flex", alignItems: "center", gap: "1.25rem",
        position: "relative", overflow: "visible", flexShrink: 0,
      }}>
        <Box sx={{ position: "absolute", inset: 0, borderRadius: "1rem", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          <Box sx={{ position: "absolute", right: "-1.875rem", top: "-1.875rem", width: "12.5rem", height: "12.5rem", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.04)" }} />
          <Box sx={{ position: "absolute", right: "5rem", bottom: "-3.125rem", width: "10rem", height: "10rem", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.03)" }} />
        </Box>
        <Box sx={{ position: "absolute", left: "1.5rem", top: "50%", transform: "translateY(-50%)", zIndex: 5, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ForecastIQ" style={{
            width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: "50%",
            objectFit: "cover", display: "block",
            filter: "drop-shadow(0 0.5rem 2.5rem rgba(0,0,0,0.45)) drop-shadow(0 0.125rem 0.5rem rgba(59,130,246,0.35))",
            animation: undefined,
          }} />
        </Box>
        <Box sx={{ width: LOGO_SIZE, flexShrink: 0 }} />
        <Box sx={{ flex: 1, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Typography sx={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", mb: "0.3rem" }}>
            {now ? `${formatDateES(now)} · ${formatTimeES(now)}` : "\u00a0"}
          </Typography>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03rem", mb: "0.3rem", lineHeight: 1.15 }}>
            {firstName
              ? <><span>Bienvenido, </span><Box component="span" sx={{ color: "#93c5fd" }}>{firstName}</Box></>
              : "Bienvenido"
            }
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
            {forecastResult
              ? `Último forecast: ${MODEL_LABELS[forecastResult.model_used] ?? forecastResult.model_used} · WAPE ${wape?.toFixed(1)}% · ${upcomingEvents.length > 0 ? `${upcomingEvents.length} eventos próximos` : "sin eventos próximos"}`
              : "Conecta tus ventas · Obtene forecasts con IA al instante · Charla con tus numeros"
            }
          </Typography>
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
          <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, px: "0.875rem", py: "0.3125rem", borderRadius: "1.25rem", bgcolor: "rgba(255,255,255,0.14)", color: "#fff", letterSpacing: "0.04em", display: "flex", alignItems: "center", gap: "0.35rem" }}>
            {caps.tier === "local"
              ? <ComputerIcon sx={{ fontSize: "0.875rem" }} />
              : caps.backend_online
                ? <CloudDoneIcon sx={{ fontSize: "0.875rem" }} />
                : <CloudOffIcon sx={{ fontSize: "0.875rem", color: "#fca5a5" }} />
            }
            {caps.tier_label}
          </Box>
          <Box component="span" sx={{
            fontSize: "0.75rem", fontWeight: 600, px: "0.875rem", py: "0.3125rem",
            borderRadius: "1.25rem",
            bgcolor: isOnline ? "rgba(34,197,94,0.18)" : healthLoading ? "rgba(156,163,175,0.18)" : "rgba(239,68,68,0.18)",
            color:   isOnline ? "#4ade80"              : healthLoading ? "#d1d5db"              : "#f87171",
            display: "flex", alignItems: "center", gap: "0.4375rem",
          }}>
            {healthLoading
              ? <CircularProgress size="0.625rem" color="inherit" />
              : <Box component="span" sx={{
                  width: "0.4375rem", height: "0.4375rem", borderRadius: "50%", flexShrink: 0,
                  bgcolor: isOnline ? "#22c55e" : "#ef4444",
                  animation: isOnline ? "pulseDot 2s ease-in-out infinite" : "none",
                  "@keyframes pulseDot": {
                    "0%, 100%": { boxShadow: "0 0 0 0.1875rem rgba(34,197,94,0.25)" },
                    "50%":      { boxShadow: "0 0 0 0.4375rem rgba(34,197,94,0.06)" },
                  },
                } as SxProps}
              />
            }
            {healthLoading ? "Conectando…" : isOnline ? "Backend online" : "Backend offline"}
          </Box>
          {caps.hardware_label && (
          <Box component="span" sx={{ fontSize: "0.6875rem", fontWeight: 500, px: "0.75rem", py: "0.25rem", borderRadius: "1.25rem", bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)" }}>
            {caps.hardware_label}
          </Box>
          )}
        </Box>
      </Box>

      {/* KPI CARDS */}
      <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem",
        flexShrink: 0,
        mt: "0.75rem",
      }}>
        {/* KPI 1 — WAPE */}
        <Box sx={{ ...glassCard, p: "0.8125rem 0.9375rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            WAPE último forecast
          </Typography>
          {forecastLoading ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", py: "0.5rem" }}>
              <CircularProgress size="1rem" />
              <Typography variant="caption" color="text.disabled">Cargando…</Typography>
            </Box>
          ) : wape !== null ? (
            <>
              <Box sx={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <Box>
                  <Box sx={{ display: "flex", alignItems: "baseline", gap: "0.125rem" }}>
                    <Typography sx={{ fontSize: "1.625rem", fontWeight: 800, color: "#10b981", lineHeight: 1 }}>
                      {wape.toFixed(1)}
                    </Typography>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "#10b981" }}>%</Typography>
                  </Box>
                  {fva !== null && (
                    <Typography sx={{ fontSize: "0.65625rem", color: fva >= 0 ? "#10b981" : "#f59e0b", mt: "0.1875rem" }}>
                      {fva >= 0 ? "↗" : "↘"} FVA {fva >= 0 ? "+" : ""}{fva.toFixed(1)}pp
                    </Typography>
                  )}
                </Box>
                <Sparkline data={wapeHistory} color="#10b981" w={72} h={30} />
              </Box>
              <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>
                {modelUsed ? (MODEL_LABELS[modelUsed] ?? modelUsed) : "—"} · {forecastResult?.dataset_id?.slice(0, 8) ?? "—"}
              </Typography>
            </>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ py: "0.25rem" }}>Sin forecasts aún</Typography>
          )}
        </Box>

        {/* KPI 2 — Calidad */}
        <Box sx={{ ...glassCard, p: "0.8125rem 0.9375rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Calidad del dataset
          </Typography>
          {qScore !== null ? (
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flex: 1 }}>
              <Box>
                <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, color: qColor, lineHeight: 1.1 }}>
                  {qScore}<Box component="span" sx={{ fontSize: "0.8125rem", fontWeight: 500 }}>/100</Box>
                </Typography>
                <Box sx={{ mt: "0.25rem" }}>
                  <Box component="span" sx={{ fontSize: "0.625rem", fontWeight: 600, px: "0.4375rem", py: "0.125rem", borderRadius: "0.75rem", bgcolor: `${qColor}18`, color: qColor }}>
                    {qLabel}
                  </Box>
                </Box>
                <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary", mt: "0.25rem" }}>
                  {caps.features.lightgbm && qScore >= 80 ? "LightGBM disponible" : `${modelsAvailable.length} modelos`}
                </Typography>
              </Box>
              <QualityRing score={qScore} color={qColor} size={52} />
            </Box>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ py: "0.25rem" }}>Ejecutá EDA para ver el score</Typography>
          )}
        </Box>

        {/* KPI 3 — Modelos */}
        <Box sx={{ ...glassCard, p: "0.8125rem 0.9375rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Modelos disponibles
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mt: "0.125rem" }}>
            <Typography sx={{ fontSize: "1.625rem", fontWeight: 800, color: "primary.main", lineHeight: 1 }}>
              {modelsAvailable.length || 3}
            </Typography>
            <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>activos</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: "0.3125rem", flexWrap: "wrap" }}>
            {(modelsAvailable.length > 0 ? modelsAvailable : ["moving_average", "holt_winters", "sarima"]).map(m => (
              <Box key={m} component="span" sx={{
                fontSize: "0.625rem", fontWeight: 600, px: "0.4375rem", py: "0.125rem",
                borderRadius: "0.75rem",
                bgcolor: `${MODEL_COLORS[m] ?? "#6366f1"}18`,
                color: MODEL_COLORS[m] ?? "#6366f1",
                border: `1px solid ${MODEL_COLORS[m] ?? "#6366f1"}30`,
              }}>
                {MODEL_LABELS[m] ?? m}
              </Box>
            ))}
          </Box>
          <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>
            {caps.tier_label} · {caps.features.lightgbm ? "LightGBM ✓" : "sin LightGBM"}
          </Typography>
        </Box>

        {/* KPI 4 — Próximo evento */}
        <Box sx={{ ...glassCard, p: "0.8125rem 0.9375rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Próximo evento
          </Typography>
          {nextEvent ? (
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: "0.625rem", mt: "0.125rem" }}>
              <Box sx={{ width: "2.375rem", height: "2.375rem", borderRadius: "0.625rem", flexShrink: 0, bgcolor: `${evColor(nextEvent.type)}18`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ fontSize: "0.5625rem", fontWeight: 700, color: evColor(nextEvent.type), lineHeight: 1 }}>
                  {formatEvDate(nextEvent.start_date).split(" ")[1]?.toUpperCase()}
                </Typography>
                <Typography sx={{ fontSize: "0.9375rem", fontWeight: 800, color: evColor(nextEvent.type), lineHeight: 1.1 }}>
                  {formatEvDate(nextEvent.start_date).split(" ")[0]}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "text.primary", lineHeight: 1.2 }}>
                  {nextEvent.name}
                </Typography>
                <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary", mt: "0.125rem" }}>
                  {nextEventDays === 0 ? "hoy" : nextEventDays === 1 ? "mañana" : `en ${nextEventDays} días`}
                </Typography>
                <Box component="span" sx={{ fontSize: "0.625rem", fontWeight: 600, px: "0.4375rem", py: "0.125rem", borderRadius: "0.75rem", bgcolor: `${evColor(nextEvent.type)}14`, color: evColor(nextEvent.type), mt: "0.25rem", display: "inline-block" }}>
                  {nextEvent.type}
                </Box>
              </Box>
            </Box>
          ) : (
            <Typography variant="caption" color="text.disabled" sx={{ py: "0.25rem" }}>Sin eventos próximos</Typography>
          )}
        </Box>
      </Box>

      {/* MAIN AREA */}
      <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 17rem", gap: "0.875rem", minHeight: 0 }}>

        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: 0 }}>

          {/* Forecast chart card */}
          <Box sx={{ ...glassCard, p: "0.875rem 1.125rem", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: "0.625rem", flexShrink: 0 }}>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 700, color: "text.primary" }}>Último forecast</Typography>
                  {modelUsed && (
                    <Box component="span" sx={{ fontSize: "0.625rem", fontWeight: 600, px: "0.5rem", py: "0.125rem", borderRadius: "0.75rem", bgcolor: "rgba(139,92,246,0.12)", color: "#8b5cf6" }}>
                      {MODEL_LABELS[modelUsed] ?? modelUsed}
                    </Box>
                  )}
                </Box>
                {forecastResult && (
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", mt: "0.125rem" }}>
                    {forecastResult.freq} · horizonte {forecastResult.horizon}
                    {wape !== null && <> · WAPE <Box component="span" sx={{ color: "#10b981", fontWeight: 600 }}>{wape.toFixed(1)}%</Box></>}
                    {fva !== null && <> · FVA <Box component="span" sx={{ color: "#10b981", fontWeight: 600 }}>+{fva.toFixed(1)}pp</Box></>}
                  </Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", gap: "0.875rem", alignItems: "center", flexShrink: 0 }}>
                {[
                  { color: "#3b82f6", label: "Real", dashed: false },
                  { color: "#8b5cf6", label: "Forecast", dashed: true },
                  { color: "rgba(139,92,246,0.15)", label: "IC 90%", dashed: false, isRect: true },
                ].map(l => (
                  <Box key={l.label} sx={{ display: "flex", alignItems: "center", gap: "0.3125rem" }}>
                    {l.isRect
                      ? <Box sx={{ width: "0.75rem", height: "0.5rem", bgcolor: l.color, borderRadius: "0.125rem" }} />
                      : <Box sx={{ width: "1.125rem", height: "0.125rem", bgcolor: l.color, borderRadius: "0.125rem", borderTop: l.dashed ? `2px dashed ${l.color}` : "none", mt: l.dashed ? "-0.125rem" : 0 }} />
                    }
                    <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>{l.label}</Typography>
                  </Box>
                ))}
                <Box onClick={() => router.push("/dashboard/forecast")}
                  sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", px: "0.6875rem", py: "0.3125rem", borderRadius: "0.5rem", border: "1px solid", borderColor: "divider", "&:hover": { bgcolor: "primary.50" } }}>
                  Ver forecast <ArrowForwardIcon sx={{ fontSize: "0.75rem" }} />
                </Box>
              </Box>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center" }}>
              {forecastLoading
                ? <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}><CircularProgress size="1.5rem" /></Box>
                : <MiniChart result={forecastResult} />
              }
            </Box>
          </Box>

          {/* Pipeline stepper — usa el mismo PipelineBar que las demás vistas */}
          <Box sx={{ ...glassCard, p: "0.875rem 1rem 0.25rem", flexShrink: 0 }}>
            <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", mb: "0.375rem" }}>
              Tu pipeline actual
            </Typography>
            <PipelineBar activeStep="/dashboard/home" noMargin />
          </Box>
        </Box>

        {/* Right col */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem", minHeight: 0 }}>

          {/* Próximos eventos */}
          <Box sx={{ ...glassCard, p: "0.8125rem 0.9375rem", flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "0.625rem", flexShrink: 0 }}>
              <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>
                Próximos eventos
              </Typography>
              <Box onClick={() => router.push("/dashboard/calendar")}
                sx={{ fontSize: "0.65625rem", fontWeight: 600, color: "primary.main", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.1875rem", "&:hover": { opacity: 0.8 } }}>
                Ver todos <ArrowForwardIcon sx={{ fontSize: "0.6875rem" }} />
              </Box>
            </Box>
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.4375rem", overflowY: "auto", minHeight: 0 }}>
              {upcomingEvents.length > 0 ? upcomingEvents.map((ev, i) => {
                const ec = evColor(ev.type)
                const days = daysUntil(ev.start_date)
                return (
                  <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "0.625rem", p: "0.5rem 0.625rem", borderRadius: "0.5625rem", bgcolor: `${ec}08`, border: "1px solid", borderColor: `${ec}20` }}>
                    <Box sx={{ width: "2.125rem", height: "2.125rem", borderRadius: "0.5rem", flexShrink: 0, bgcolor: `${ec}18`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <EventIcon sx={{ fontSize: "1rem", color: ec }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.primary", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {ev.name}
                      </Typography>
                      <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary", mt: "0.0625rem" }}>
                        {formatEvDate(ev.start_date)}
                      </Typography>
                    </Box>
                    <Box component="span" sx={{ fontSize: "0.625rem", fontWeight: 700, color: ec, bgcolor: `${ec}18`, px: "0.4375rem", py: "0.125rem", borderRadius: "0.75rem", flexShrink: 0 }}>
                      {days === 0 ? "hoy" : days === 1 ? "mañana" : `${days}d`}
                    </Box>
                  </Box>
                )
              }) : (
                <Typography variant="caption" color="text.disabled" sx={{ py: "0.5rem", textAlign: "center" }}>
                  Sin eventos próximos
                </Typography>
              )}
            </Box>
          </Box>

          {/* Acciones rápidas */}
          <Box sx={{ ...glassCard, p: "0.8125rem 0.9375rem", flexShrink: 0 }}>
            <Typography sx={{ fontSize: "0.59375rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", mb: "0.625rem" }}>
              Acciones rápidas
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
              {QUICK_ACTIONS.map(a => (
                <Box key={a.href}
                  onClick={() => router.push(a.href)}
                  sx={{ display: "flex", alignItems: "center", gap: "0.5625rem", p: "0.4375rem 0.5rem", borderRadius: "0.5625rem", cursor: "pointer", transition: "background 0.14s", "&:hover": { bgcolor: `${a.color}0d` } }}
                >
                  <Box sx={{ width: "1.875rem", height: "1.875rem", borderRadius: "0.5rem", flexShrink: 0, bgcolor: `${a.color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, "& svg": { fontSize: "0.9375rem" } }}>
                    {a.icon}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "text.primary" }}>{a.label}</Typography>
                    <Typography sx={{ fontSize: "0.625rem", color: "text.secondary" }}>{a.sub}</Typography>
                  </Box>
                  <ArrowForwardIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
