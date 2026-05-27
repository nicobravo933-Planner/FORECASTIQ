"use client"

/**
 * HomeDashboard — v5
 *
 * Layout:
 *  Hero   — logo + nombre usuario + pipeline + chips tier (sin cambios)
 *  Zona A — gráfico profesional full-width con range slider + tooltip card
 *  Zona B — 4 donuts animados SVG (WAPE · FVA · Quality · Horizonte)
 *
 * Detección automática del último análisis:
 *   Lee ForecastResult (serie única) y MultiSerieResult (batch/benchmark)
 *   Muestra el más reciente comparando timestamps.
 *
 * Fixes vs v4:
 *   - Nombre usuario: hidratado en useEffect (evita SSR null)
 *   - KPIs reemplazados por donuts animados
 *   - Gráfico: líneas finas, área degradado, tooltip div flotante, range slider
 *   - Sin labels "DEMO" ni "Vista previa"
 *   - FABs bottom-left sin colisión con chat
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useTheme }       from "@mui/material/styles"
import Box                from "@mui/material/Box"
import Typography         from "@mui/material/Typography"
import CircularProgress   from "@mui/material/CircularProgress"
import Drawer             from "@mui/material/Drawer"
import Divider            from "@mui/material/Divider"
import Tooltip            from "@mui/material/Tooltip"
import Dialog             from "@mui/material/Dialog"
import DialogTitle        from "@mui/material/DialogTitle"
import DialogContent      from "@mui/material/DialogContent"
import DialogContentText  from "@mui/material/DialogContentText"
import DialogActions      from "@mui/material/DialogActions"
import Button             from "@mui/material/Button"
import Slider             from "@mui/material/Slider"
import { useRouter }      from "next/navigation"
import { useSession }     from "@/lib/auth-client"
import ArrowForwardIcon   from "@mui/icons-material/ArrowForward"
import CloudDoneIcon      from "@mui/icons-material/CloudDone"
import CloudOffIcon       from "@mui/icons-material/CloudOff"
import ComputerIcon       from "@mui/icons-material/Computer"
import UploadFileIcon     from "@mui/icons-material/UploadFile"
import ShowChartIcon      from "@mui/icons-material/ShowChart"
import SmartToyIcon       from "@mui/icons-material/SmartToy"
import BarChartIcon       from "@mui/icons-material/BarChart"
import EventIcon          from "@mui/icons-material/Event"
import BoltIcon           from "@mui/icons-material/Bolt"
import CloseIcon          from "@mui/icons-material/Close"
import RestartAltIcon     from "@mui/icons-material/RestartAlt"
import DnsIcon            from "@mui/icons-material/Dns"
import { api }            from "@/lib/api"
import { PipelineBar }    from "@/components/common/PipelineBar"
import { useCapabilities } from "@/hooks/useCapabilities"
import { appStore }       from "@/lib/appStore"
import type { ForecastResult, CalendarEvent } from "@/lib/types"
import type { SxProps }   from "@mui/material"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface StoredMultiSerie {
  mode: "quick" | "benchmark"
  data: {
    n_series?: number
    freq?: string
    horizon?: number
    duration_s?: number
    run_at?: string
    model_ranking?: { model: string; wape_mean: number; n_wins: number }[]
    best_models?: { unique_id: string; best_model: string; wape: number | null }[]
    predictions?: { unique_id: string; ds: string; predicted: number }[]
  }
}

// Unified last-analysis type for display
type LastAnalysis =
  | { kind: "single"; result: ForecastResult; ts: number }
  | { kind: "multi";  result: StoredMultiSerie; ts: number }
  | null

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const DAYS_ES   = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"]
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]
const MONTHS_S  = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const fmtDate = (d: Date) =>
  `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
const fmtTime = (d: Date) =>
  d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
const daysUntil = (s: string) => {
  const t = new Date(); t.setHours(0,0,0,0)
  const e = new Date(s); e.setHours(0,0,0,0)
  return Math.ceil((e.getTime() - t.getTime()) / 86_400_000)
}
const evColor = (type: string) =>
  type === "holiday" ? "#3b82f6" : type === "promotion" ? "#f59e0b" : type === "seasonal" ? "#10b981" : "#8b5cf6"
const fmtEvDate = (d: string) => {
  const dt = new Date(d + "T00:00:00")
  return `${dt.getDate()} ${MONTHS_S[dt.getMonth()]}`
}
const fmtY = (v: number) =>
  v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M`
  : v >= 1_000 ? `${(v/1_000).toFixed(0)}K`
  : v.toFixed(0)

const LOGO_SIZE = "11.75rem"

const MODEL_COLORS: Record<string, string> = {
  moving_average: "#3b82f6", holt_winters: "#0ea5e9", sarima: "#8b5cf6",
  lightgbm: "#10b981", ses: "#f59e0b", holt_simple: "#ef4444", linear_splines: "#06b6d4",
}
const MODEL_LABELS: Record<string, string> = {
  moving_average: "Moving Average", holt_winters: "Holt-Winters", sarima: "SARIMA",
  lightgbm: "LightGBM", ses: "SES", holt_simple: "Holt Simple", linear_splines: "Splines",
}
const MODEL_SHORT: Record<string, string> = {
  moving_average: "MA", holt_winters: "HW", sarima: "SARIMA",
  lightgbm: "LGB", ses: "SES", holt_simple: "Holt", linear_splines: "Spl",
}

const QUICK_ACTIONS = [
  { icon: <UploadFileIcon />, label: "Subir dataset",  sub: "CSV · Parquet · DB",            color: "#3b82f6", href: "/dashboard/dataset"  },
  { icon: <ShowChartIcon />,  label: "Nuevo forecast", sub: "Detección automática de modelo", color: "#8b5cf6", href: "/dashboard/forecast" },
  { icon: <SmartToyIcon />,   label: "Chat IA",        sub: "Preguntá en lenguaje natural",   color: "#f59e0b", href: "/dashboard/chat"     },
  { icon: <BarChartIcon />,   label: "Multi-serie",    sub: "Batch 25k SKUs · Nixtla",        color: "#ec4899", href: "/dashboard/batch"    },
]

// ─────────────────────────────────────────────────────────────────────────────
// Animated SVG Donut
// ─────────────────────────────────────────────────────────────────────────────

interface DonutProps {
  value: number        // 0-100
  label: string        // e.g. "WAPE"
  display: string      // e.g. "32.4%"
  color: string
  bg?: string          // track color (default: color + "18")
  size?: number        // px, default 88
  stroke?: number      // default 7
  subtitle?: string
}

function AnimatedDonut({ value, label, display, color, bg, size = 88, stroke = 7, subtitle }: DonutProps) {
  const [animVal, setAnimVal] = useState(0)
  const r   = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (animVal / 100) * circ

  useEffect(() => {
    // Animate from 0 to value over ~800ms
    let start: number | null = null
    const target = Math.max(0, Math.min(100, value))
    const step = (ts: number) => {
      if (!start) start = ts
      const prog = Math.min((ts - start) / 800, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - prog, 3)
      setAnimVal(eased * target)
      if (prog < 1) requestAnimationFrame(step)
    }
    const raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.375rem" }}>
      <Box sx={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={bg ?? `${color}22`} strokeWidth={stroke} />
          {/* Progress */}
          <circle cx={size/2} cy={size/2} r={r}
            fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${dash.toFixed(2)} ${(circ - dash).toFixed(2)}`}
            strokeLinecap="round" />
        </svg>
        {/* Center text */}
        <Box sx={{
          position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 0,
        }}>
          <Typography sx={{ fontSize: size * 0.165 + "px", fontWeight: 800, color, lineHeight: 1, fontFamily: "Inter,sans-serif" }}>
            {display}
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontSize: "0.625rem", fontWeight: 700, color: "text.disabled", letterSpacing: "0.07em", textTransform: "uppercase" }}>
        {label}
      </Typography>
      {subtitle && (
        <Typography sx={{ fontSize: "0.575rem", color: "text.disabled", textAlign: "center", lineHeight: 1.3, maxWidth: "5.5rem" }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Professional chart — single series
// ─────────────────────────────────────────────────────────────────────────────

interface ChartPoint {
  i: number       // global index
  x: number       // SVG x
  y: number       // SVG y
  date: string
  value: number
  isFx: boolean
  lower?: number
  upper?: number
}

function ProfessionalChart({
  result, rangeStart, rangeEnd,
}: {
  result: ForecastResult
  rangeStart: number
  rangeEnd: number
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; date: string; value: string; isFx: boolean
  } | null>(null)

  const W = 820, H = 270
  const PAD = { t: 26, b: 22, l: 52, r: 16 }
  const cW  = W - PAD.l - PAD.r
  const cH  = H - PAD.t - PAD.b

  const hist  = result.historical
  const preds = result.predictions
  // Explicit type so TS knows lower/upper are optional on every element
  const all: { date: string; value: number; isFx: boolean; lower?: number; upper?: number }[] = [
    ...hist.map(p => ({ date: p.date, value: p.value, isFx: false })),
    ...preds.map(p => ({ date: p.date, value: p.predicted, isFx: true, lower: p.lower, upper: p.upper })),
  ]

  // Apply range slice
  const total   = all.length
  const iStart  = Math.floor(rangeStart / 100 * (total - 1))
  const iEnd    = Math.ceil(rangeEnd / 100 * (total - 1))
  const visible = all.slice(iStart, iEnd + 1)
  if (visible.length < 2) return null

  const vals   = visible.map(p => p.value)
  const uppers = visible.filter(p => p.upper != null).map(p => p.upper as number)
  const minV   = Math.min(...vals, ...visible.filter(p=>p.lower!=null).map(p=>p.lower as number)) * 0.88
  const maxV   = Math.max(...vals, ...uppers) * 1.08

  const xS = (i: number) => PAD.l + (i / (visible.length - 1)) * cW
  const yS = (v: number) => PAD.t + cH - ((v - minV) / (maxV - minV)) * cH

  const histPts  = visible.filter(p => !p.isFx)
  const fxPts    = visible.filter(p => p.isFx)
  const fxOffset = histPts.length - 1

  const histPath = histPts.map((p, i) => `${i===0?"M":"L"}${xS(i).toFixed(1)},${yS(p.value).toFixed(1)}`).join(" ")
  const fxPath   = fxOffset >= 0 && fxPts.length > 0 ? [
    `M${xS(fxOffset).toFixed(1)},${yS(histPts[histPts.length-1]?.value ?? fxPts[0].value).toFixed(1)}`,
    ...fxPts.map((p, i) => `L${xS(fxOffset+1+i).toFixed(1)},${yS(p.value).toFixed(1)}`),
  ].join(" ") : ""

  const ciPath = fxPts.length >= 2 ? [
    ...fxPts.map((p, i) => `${i===0?"M":"L"}${xS(fxOffset+1+i).toFixed(1)},${yS(p.upper!).toFixed(1)}`),
    ...fxPts.slice().reverse().map((p, i) => `L${xS(fxOffset+fxPts.length-i).toFixed(1)},${yS(p.lower!).toFixed(1)}`),
    "Z",
  ].join(" ") : ""

  const histAreaPath = histPts.length > 1
    ? `${histPath} L${xS(fxOffset)},${PAD.t+cH} L${PAD.l},${PAD.t+cH} Z`
    : ""

  const gridVals = [
    minV + (maxV-minV)*0.80,
    minV + (maxV-minV)*0.55,
    minV + (maxV-minV)*0.28,
  ]

  // Sparse X labels
  const labelEvery = Math.max(1, Math.floor(visible.length / 7))

  // Build hit-test points
  const hitPts: ChartPoint[] = [
    ...histPts.map((p, i) => ({
      i, x: xS(i), y: yS(p.value), date: p.date.slice(0,7),
      value: p.value, isFx: false,
    })),
    ...fxPts.map((p, i) => ({
      i: fxOffset+1+i, x: xS(fxOffset+1+i), y: yS(p.value), date: p.date.slice(0,7),
      value: p.value, isFx: true, lower: p.lower, upper: p.upper,
    })),
  ]

  const handleMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current; if (!svg) return
    const rect = svg.getBoundingClientRect()
    const mx = (e.clientX - rect.left) * (W / rect.width)
    let best = hitPts[0], bd = Infinity
    for (const p of hitPts) { const d = Math.abs(p.x - mx); if (d < bd) { bd = d; best = p } }
    if (bd < 32) {
      setTooltip({
        x: (best.x / W) * rect.width + rect.left,
        y: (best.y / H) * rect.height + rect.top,
        date: best.date,
        value: best.isFx
          ? `${best.value.toFixed(0)}  [${(best.lower ?? 0).toFixed(0)}–${(best.upper ?? 0).toFixed(0)}]`
          : best.value.toFixed(0),
        isFx: best.isFx,
      })
    } else setTooltip(null)
  }

  const uniqueId = `chart-${result.job_id?.slice(0,8) ?? "home"}`

  return (
    <Box ref={containerRef} sx={{ width: "100%", height: "100%", position: "relative" }}>
      <svg ref={svgRef} width="100%" height="100%"
        viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet"
        style={{ display: "block", overflow: "visible", cursor: "crosshair" }}
        onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)}>
        <defs>
          <linearGradient id={`hg-${uniqueId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#3b82f6" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* Axes */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+cH} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
        <line x1={PAD.l} y1={PAD.t+cH} x2={W-PAD.r} y2={PAD.t+cH} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />

        {/* Grid */}
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={yS(v)} x2={W-PAD.r} y2={yS(v)}
              stroke="rgba(148,163,184,0.1)" strokeWidth={1} strokeDasharray="4,5" />
            <text x={PAD.l-6} y={yS(v)+3.5} textAnchor="end" fontSize={9}
              fill="rgba(148,163,184,0.55)" fontFamily="Inter,monospace">
              {fmtY(v)}
            </text>
          </g>
        ))}

        {/* Forecast zone */}
        {fxPts.length > 0 && (
          <rect x={xS(fxOffset)} y={PAD.t} width={W-PAD.r-xS(fxOffset)} height={cH}
            fill="rgba(139,92,246,0.03)" />
        )}

        {/* Area fill */}
        {histAreaPath && <path d={histAreaPath} fill={`url(#hg-${uniqueId})`} />}

        {/* CI band */}
        {ciPath && <path d={ciPath} fill="rgba(139,92,246,0.1)" />}

        {/* Historical line — thin, professional */}
        {histPath && (
          <path d={histPath} fill="none" stroke="#3b82f6" strokeWidth={1.6}
            strokeLinecap="round" strokeLinejoin="round" />
        )}

        {/* Forecast line */}
        {fxPath && (
          <path d={fxPath} fill="none" stroke="#8b5cf6" strokeWidth={1.5}
            strokeDasharray="7,4" strokeLinecap="round" />
        )}

        {/* Handoff dot only */}
        {fxPts.length > 0 && histPts.length > 0 && (
          <circle
            cx={xS(fxOffset)}
            cy={yS(histPts[histPts.length-1].value)}
            r={4.5} fill="#8b5cf6" stroke="white" strokeWidth={1.5}
          />
        )}

        {/* Divider */}
        {fxPts.length > 0 && (
          <line x1={xS(fxOffset)} y1={PAD.t} x2={xS(fxOffset)} y2={PAD.t+cH}
            stroke="rgba(148,163,184,0.28)" strokeWidth={1} strokeDasharray="4,4" />
        )}

        {/* X labels */}
        {visible.map((p, i) => {
          if (i % labelEvery !== 0 && i !== visible.length-1) return null
          return (
            <text key={i} x={xS(i)} y={H-6} textAnchor="middle" fontSize={8.5}
              fill={p.isFx ? "rgba(139,92,246,0.75)" : "rgba(148,163,184,0.5)"}
              fontWeight={p.isFx ? "600" : "400"} fontFamily="Inter,monospace">
              {p.date.slice(0,7)}
            </text>
          )
        })}

        {/* Section labels — top */}
        {histPts.length > 2 && (
          <text x={PAD.l+8} y={PAD.t-8} fontSize={8.5}
            fill="rgba(59,130,246,0.45)" fontWeight="700" letterSpacing="0.08em" fontFamily="Inter,sans-serif">
            HISTÓRICO
          </text>
        )}
        {fxPts.length > 0 && (
          <text x={xS(fxOffset)+8} y={PAD.t-8} fontSize={8.5}
            fill="rgba(139,92,246,0.75)" fontWeight="700" letterSpacing="0.08em" fontFamily="Inter,sans-serif">
            FORECAST ({fxPts.length} per.) →
          </text>
        )}

        {/* Legend removed from SVG — rendered as HTML below the slider */}

        {/* Hover dot */}
        {tooltip && svgRef.current && (() => {
          const rect = svgRef.current!.getBoundingClientRect()
          const svgX = (tooltip.x - rect.left) * (W / rect.width)
          const svgY = (tooltip.y - rect.top)  * (H / rect.height)
          return (
            <circle cx={svgX} cy={svgY} r={4.5}
              fill="white" stroke={tooltip.isFx ? "#8b5cf6" : "#3b82f6"} strokeWidth={2} />
          )
        })()}
      </svg>

      {/* Tooltip — native div, positioned in viewport */}
      {tooltip && (
        <Box sx={{
          position: "fixed",
          left: tooltip.x + 14,
          top:  tooltip.y - 36,
          zIndex: 9999,
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: tooltip.isFx ? "rgba(139,92,246,0.4)" : "rgba(59,130,246,0.3)",
          borderRadius: "0.5rem",
          boxShadow: "0 0.5rem 1.5rem rgba(0,0,0,0.15)",
          px: "0.75rem",
          py: "0.4rem",
          minWidth: "7rem",
          pointerEvents: "none",
        }}>
          <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled", fontFamily: "monospace" }}>
            {tooltip.date}
          </Typography>
          <Typography sx={{ fontSize: "0.875rem", fontWeight: 700, color: tooltip.isFx ? "#8b5cf6" : "#3b82f6", lineHeight: 1.3, fontFamily: "monospace" }}>
            {tooltip.value}
          </Typography>
          {tooltip.isFx && (
            <Typography sx={{ fontSize: "0.575rem", color: "text.disabled" }}>IC 90%</Typography>
          )}
        </Box>
      )}
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Demo chart — static, clean, no labels
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_H  = [142,158,175,163,148,171,189,202,195,178,165,183,210,228,214,197,181,205,234,251,238,219,203,221]
const DEMO_P  = [238,255,269,281,273,262]
const DEMO_U  = DEMO_P.map(v => Math.round(v*1.13))
const DEMO_L  = DEMO_P.map(v => Math.round(v*0.87))
const DEMO_MH = ["May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic","Ene","Feb","Mar","Abr"]
const DEMO_MP = ["May","Jun","Jul","Ago","Sep","Oct"]

function DemoChart({ animKey }: { animKey: number }) {
  const W = 820, H = 270
  const PAD = { t: 26, b: 22, l: 52, r: 16 }
  const cW = W-PAD.l-PAD.r, cH = H-PAD.t-PAD.b
  const allV = [...DEMO_H, ...DEMO_U]
  const minV = Math.min(...allV)*0.86, maxV = Math.max(...allV)*1.08
  const total = DEMO_H.length + DEMO_P.length
  const fxS = DEMO_H.length - 1
  const xS = (i: number) => PAD.l + (i/(total-1))*cW
  const yS = (v: number) => PAD.t + cH - ((v-minV)/(maxV-minV))*cH
  const histPath = DEMO_H.map((v,i)=>`${i===0?"M":"L"}${xS(i).toFixed(1)},${yS(v).toFixed(1)}`).join(" ")
  const fxPath = [`M${xS(fxS).toFixed(1)},${yS(DEMO_H[fxS]).toFixed(1)}`,
    ...DEMO_P.map((v,i)=>`L${xS(fxS+1+i).toFixed(1)},${yS(v).toFixed(1)}`)].join(" ")
  const ciPath = [
    ...DEMO_U.map((v,i)=>`${i===0?"M":"L"}${xS(fxS+1+i).toFixed(1)},${yS(v).toFixed(1)}`),
    ...DEMO_L.slice().reverse().map((v,i)=>`L${xS(fxS+DEMO_L.length-i).toFixed(1)},${yS(v).toFixed(1)}`),
    "Z"].join(" ")
  const histArea = `${histPath} L${xS(fxS)},${PAD.t+cH} L${PAD.l},${PAD.t+cH} Z`
  const gridVals = [minV+(maxV-minV)*0.80, minV+(maxV-minV)*0.55, minV+(maxV-minV)*0.28]
  // HL = historical line dash length, FL = forecast line dash length
  // Hist animation: 2.2s starting at 0.1s
  // Forecast starts AFTER hist ends: delay = 0.1 + 2.2 + 0.2 = 2.5s
  const HL = 1500, FL = 420, k = `d${animKey}`
  return (
    <Box sx={{ width: "100%", height: "100%" }}>
      <svg key={k} width="100%" height="100%" viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet" style={{ display: "block", overflow: "visible" }}>
        <defs>
          <linearGradient id={`dg-${k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t+cH} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
        <line x1={PAD.l} y1={PAD.t+cH} x2={W-PAD.r} y2={PAD.t+cH} stroke="rgba(148,163,184,0.18)" strokeWidth={1} />
        {gridVals.map((v,i) => (
          <g key={i}>
            <line x1={PAD.l} y1={yS(v)} x2={W-PAD.r} y2={yS(v)} stroke="rgba(148,163,184,0.1)" strokeWidth={1} strokeDasharray="4,5" />
            <text x={PAD.l-6} y={yS(v)+3.5} textAnchor="end" fontSize={9} fill="rgba(148,163,184,0.5)" fontFamily="Inter,monospace">{fmtY(v)}</text>
          </g>
        ))}
        <rect x={xS(fxS)} y={PAD.t} width={W-PAD.r-xS(fxS)} height={cH} fill="rgba(139,92,246,0.03)" />
        <path d={histArea} fill={`url(#dg-${k})`} style={{ opacity: 0, animation: `dF 0.5s ease 0.3s both` }} />
        <path d={ciPath} fill="rgba(139,92,246,0.1)" style={{ opacity: 0, animation: `dF 0.4s ease 2.9s both` }} />
        <path d={histPath} fill="none" stroke="#3b82f6" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
          style={{ strokeDasharray: HL, strokeDashoffset: HL, animation: `dL 2.2s cubic-bezier(0.4,0,0.2,1) 0.1s forwards` }} />
        <path d={fxPath} fill="none" stroke="#8b5cf6" strokeWidth={1.5} strokeLinecap="round"
          style={{ strokeDasharray: `7 4`, strokeDashoffset: FL, animation: `dFx 1.4s cubic-bezier(0.4,0,0.2,1) 2.5s forwards` }} />
        <line x1={xS(fxS)} y1={PAD.t} x2={xS(fxS)} y2={PAD.t+cH} stroke="rgba(148,163,184,0.28)" strokeWidth={1} strokeDasharray="4,4" />
        <circle cx={xS(fxS)} cy={yS(DEMO_H[fxS])} r={4.5} fill="#8b5cf6" stroke="white" strokeWidth={1.5}
          style={{ opacity: 0, animation: `dF 0.3s ease 2.45s both` }} />
        {DEMO_H.map((_,i) => i%4!==0?null:(
          <text key={i} x={xS(i)} y={H-6} textAnchor="middle" fontSize={8.5} fill="rgba(148,163,184,0.45)" fontFamily="Inter,monospace">{DEMO_MH[i]}</text>
        ))}
        {DEMO_MP.map((m,i) => (
          <text key={i} x={xS(fxS+1+i)} y={H-6} textAnchor="middle" fontSize={8.5} fill="rgba(139,92,246,0.7)" fontWeight="600" fontFamily="Inter,monospace">{m}</text>
        ))}
        <text x={PAD.l+8} y={PAD.t-8} fontSize={8.5} fill="rgba(59,130,246,0.4)" fontWeight="700" letterSpacing="0.08em" fontFamily="Inter,sans-serif">HISTÓRICO</text>
        {/* FORECAST label dentro del área forecast, sin pisar la leyenda */}
        <text x={xS(fxS)+8} y={PAD.t+16} fontSize={8.5} fill="rgba(139,92,246,0.7)" fontWeight="700" letterSpacing="0.08em" fontFamily="Inter,sans-serif">FORECAST →</text>
        {/* Legend eliminada del SVG — se renderiza como HTML bajo el chart */}
      </svg>
      <style>{`
        @keyframes dL  { from { stroke-dashoffset: ${HL}; } to { stroke-dashoffset: 0; } }
        @keyframes dFx { from { stroke-dashoffset: ${FL}; } to { stroke-dashoffset: 0; } }
        @keyframes dF  { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
      {/* Legend HTML — centrada bajo el chart, aparece al final de la animación */}
      <Box sx={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: "0.875rem", mt: "0.25rem",
        opacity: 0, animation: "dF 0.4s ease 4.2s both",
      }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <Box sx={{ width: "1rem", height: "1.5px", bgcolor: "#3b82f6", borderRadius: "1px" }} />
          <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled" }}>Real</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <Box sx={{ width: "1rem", height: "1.5px", background: "repeating-linear-gradient(90deg,#8b5cf6 0,#8b5cf6 4px,transparent 4px,transparent 7px)" }} />
          <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled" }}>Forecast</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <Box sx={{ width: "0.7rem", height: "0.5rem", borderRadius: "0.15rem", bgcolor: "rgba(139,92,246,0.22)" }} />
          <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled" }}>IC 90%</Typography>
        </Box>
      </Box>
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-serie summary panel (Zona B when last analysis is multi-serie)
// ─────────────────────────────────────────────────────────────────────────────

function MultiSerieSummary({ stored }: { stored: StoredMultiSerie }) {
  const d = stored.data
  const ranking = d.model_ranking ?? []
  const winner  = ranking[0]
  const wapePct = winner ? winner.wape_mean * 100 : null
  const wapeNorm = wapePct != null ? Math.max(0, Math.min(100, 100 - wapePct)) : 0
  const wapeColor = wapePct == null ? "#94a3b8" : wapePct < 15 ? "#10b981" : wapePct < 30 ? "#f59e0b" : "#ef4444"

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem", height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <BarChartIcon sx={{ fontSize: "0.875rem", color: "primary.main" }} />
        <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "text.secondary" }}>
          Multi-serie · {d.n_series ?? "—"} series · {stored.mode === "benchmark" ? "Benchmark" : "Rápido"}
        </Typography>
      </Box>
      <Divider />
      {winner && (
        <AnimatedDonut
          value={wapeNorm} label="WAPE Global" display={wapePct != null ? `${wapePct.toFixed(1)}%` : "—"}
          color={wapeColor} size={80} subtitle={`${winner.model} · ${winner.n_wins} victorias`} />
      )}
      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem", mt: "0.25rem" }}>
        {ranking.slice(0,3).map((r, i) => (
          <Box key={r.model} sx={{ display: "flex", alignItems: "center", gap: "0.5rem", px: "0.5rem", py: "0.3rem", borderRadius: "0.4rem", bgcolor: i===0 ? "rgba(16,185,129,0.08)" : "transparent" }}>
            <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", minWidth: "0.75rem" }}>{i===0?"🥇":i===1?"🥈":"🥉"}</Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "text.primary", flex: 1 }}>{r.model}</Typography>
            <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: r.wape_mean < 0.2 ? "#10b981" : r.wape_mean < 0.35 ? "#f59e0b" : "#ef4444" }}>
              {(r.wape_mean*100).toFixed(1)}%
            </Typography>
          </Box>
        ))}
      </Box>
      <Box sx={{ mt: "auto", px: "0.5rem", py: "0.35rem", borderRadius: "0.4rem", bgcolor: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.15)" }}>
        <Typography sx={{ fontSize: "0.6rem", color: "text.disabled", letterSpacing: "0.06em", fontWeight: 700 }}>SERIES ANALIZADAS</Typography>
        <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: "primary.main" }}>{d.n_series ?? "—"}</Typography>
        <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>{d.freq} · horizonte {d.horizon}</Typography>
      </Box>
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single-serie donut panel (Zona B)
// ─────────────────────────────────────────────────────────────────────────────

function SingleSerieDonuts({ result, filename }: { result: ForecastResult; filename: string | null }) {
  const m     = result.metrics
  const wape  = m.wape != null ? m.wape * 100 : null
  const fva   = m.fva  != null ? m.fva  * 100 : null
  const qs    = appStore.getQualityScore()
  const qScore = qs?.score ?? null

  // WAPE: lower is better → invert for donut fill (0%=full circle, 100%=empty)
  const wapeNorm = wape != null ? Math.max(0, 100 - Math.min(wape, 100)) : 0
  const wapeColor = wape == null ? "#94a3b8" : wape < 15 ? "#10b981" : wape < 30 ? "#f59e0b" : "#ef4444"

  // FVA: positive = good. Map -50..+50 to 0..100
  const fvaNorm  = fva != null ? Math.max(0, Math.min(100, (fva + 50))) : 0
  const fvaColor = fva == null ? "#94a3b8" : fva > 10 ? "#10b981" : fva > 0 ? "#f59e0b" : "#ef4444"
  const fvaDisplay = fva != null ? `${fva > 0 ? "+" : ""}${fva.toFixed(1)}` : "—"

  // Quality score direct
  const qColor = qScore == null ? "#94a3b8" : qScore >= 80 ? "#10b981" : qScore >= 60 ? "#3b82f6" : qScore >= 30 ? "#f59e0b" : "#ef4444"

  // Horizon coverage: show horizon / 24 as % (max 24 periods = 100%)
  const horizNorm = Math.min(100, (result.horizon / 24) * 100)
  const mc = MODEL_COLORS[result.model_used] ?? "#6366f1"

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem", height: "100%", alignItems: "center", justifyContent: "space-around", py: "0.25rem" }}>
      {/* Donuts 2x2 */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", width: "100%" }}>
        <Tooltip title="WAPE: Weighted Absolute Percentage Error. Menor es mejor. Verde < 15%, amarillo < 30%, rojo ≥ 30%." arrow>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <AnimatedDonut value={wapeNorm} label="WAPE" display={wape != null ? `${wape.toFixed(1)}%` : "—"} color={wapeColor} size={82} />
          </Box>
        </Tooltip>
        <Tooltip title="FVA: Forecast Value Added vs Naïve estacional. Positivo = modelo supera al baseline." arrow>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <AnimatedDonut value={fvaNorm} label="FVA" display={fvaDisplay} color={fvaColor} size={82} subtitle="vs Naïve" />
          </Box>
        </Tooltip>
        <Tooltip title="Calidad del dataset (0-100): completitud, historia, regularidad y outliers." arrow>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <AnimatedDonut value={qScore ?? 0} label="Calidad" display={qScore != null ? `${qScore}` : "—"} color={qColor} size={82} subtitle="dataset score" />
          </Box>
        </Tooltip>
        <Tooltip title="Períodos de forecast configurados. Referencia: 24 períodos = 100%." arrow>
          <Box sx={{ display: "flex", justifyContent: "center" }}>
            <AnimatedDonut value={horizNorm} label="Horizonte" display={`${result.horizon}`} color={mc} size={82} subtitle={`períodos · ${result.freq}`} />
          </Box>
        </Tooltip>
      </Box>

      {/* Footer: model + dataset */}
      <Box sx={{ width: "100%", px: "0.25rem" }}>
        <Divider sx={{ mb: "0.5rem" }} />
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography sx={{ fontSize: "0.575rem", fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em" }}>MODELO</Typography>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: mc }}>
              {MODEL_LABELS[result.model_used] ?? result.model_used}
            </Typography>
          </Box>
          {filename && (
            <Box sx={{ maxWidth: "5rem" }}>
              <Typography sx={{ fontSize: "0.575rem", fontWeight: 700, color: "text.disabled", letterSpacing: "0.06em" }}>FUENTE</Typography>
              <Typography sx={{ fontSize: "0.65rem", color: "text.secondary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {filename}
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function HomeDashboard() {
  const { data: session } = useSession()
  const router   = useRouter()
  const { caps } = useCapabilities()
  const theme    = useTheme()

  // Nombre usuario — hidratado en useEffect para evitar SSR mismatch
  const [firstName, setFirstName] = useState<string | null>(null)
  useEffect(() => {
    if (session?.user?.name) {
      setFirstName(session.user.name.split(" ")[0])
    }
  }, [session?.user?.name])

  const glass: SxProps = {
    bgcolor: theme.palette.mode === "dark" ? theme.palette.background.paper : "rgba(255,255,255,0.88)",
    backdropFilter: "blur(0.625rem)",
    borderRadius: "0.875rem",
    border: "1px solid",
    borderColor: theme.palette.mode === "dark" ? "divider" : "rgba(219,234,254,0.8)",
    boxShadow: "0 0.0625rem 0.375rem rgba(0,0,0,0.05)",
  }

  // Clock
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Health
  const [health, setHealth] = useState<{ status: string } | null>(null)
  const [healthLoading, setHealthLoading] = useState(true)
  useEffect(() => {
    api.get<{ status: string }>("/health")
      .then(r => setHealth(r)).catch(() => setHealth(null))
      .finally(() => setHealthLoading(false))
  }, [])
  const isOnline = health?.status === "ok"

  // appStore
  const [filename, setFilename] = useState<string | null>(null)

  // Last analysis — detect single vs multi, pick most recent
  const [lastAnalysis, setLastAnalysis] = useState<LastAnalysis>(null)

  const syncLastAnalysis = useCallback(() => {
    const single = appStore.getLastResult<ForecastResult>()
    const multi  = appStore.getLastMultiSerieResult<StoredMultiSerie>()
    setFilename(appStore.getDatasetFilename())

    const tsS = single?.created_at ? new Date(single.created_at).getTime() : 0
    const tsM = multi?.data?.run_at ? new Date(multi.data.run_at as string).getTime() : 0

    if (!single && !multi) { setLastAnalysis(null); return }
    if (single && (!multi || tsS >= tsM)) {
      setLastAnalysis({ kind: "single", result: single, ts: tsS })
    } else if (multi) {
      setLastAnalysis({ kind: "multi", result: multi, ts: tsM })
    }
  }, [])

  useEffect(() => {
    syncLastAnalysis()
    window.addEventListener("storage", syncLastAnalysis)
    window.addEventListener("fiq:store-update", syncLastAnalysis)
    return () => {
      window.removeEventListener("storage", syncLastAnalysis)
      window.removeEventListener("fiq:store-update", syncLastAnalysis)
    }
  }, [syncLastAnalysis])

  // Demo loop
  const [demoKey, setDemoKey] = useState(0)
  useEffect(() => {
    if (lastAnalysis) return
    const id = setInterval(() => setDemoKey(k => k + 1), 9000)
    return () => clearInterval(id)
  }, [lastAnalysis])

  // Range slider for chart zoom (0-100)
  const [rangeStart, setRangeStart] = useState(0)
  const [rangeEnd,   setRangeEnd]   = useState(100)

  // Reset range when analysis changes
  useEffect(() => {
    setRangeStart(0); setRangeEnd(100)
  }, [lastAnalysis])

  // Events
  const [upcomingEvents, setUpcomingEvents] = useState<CalendarEvent[]>([])
  const fetchEvents = useCallback(async () => {
    try {
      const res = await api.get<{ events: CalendarEvent[] }>(
        `/api/events?year=${new Date().getFullYear()}&include_holidays=true`
      )
      const today = new Date(); today.setHours(0,0,0,0)
      setUpcomingEvents(
        res.events.filter(e => new Date(e.start_date) >= today)
          .sort((a,b) => a.start_date.localeCompare(b.start_date))
          .slice(0, 6)
      )
    } catch { /* silencioso */ }
  }, [])
  useEffect(() => { void fetchEvents() }, [fetchEvents])

  // Drawers + dialogs
  const [actionsOpen, setActionsOpen] = useState(false)
  const [eventsOpen,  setEventsOpen]  = useState(false)
  const [resetOpen,   setResetOpen]   = useState(false)

  // Reset
  const handleReset = () => {
    appStore.setActiveDataset("", "", "", "")
    appStore.clearQualityScore()
    appStore.clearDetectionReport()
    appStore.clearDetectedModel()
    appStore.clearLastResult()
    appStore.clearCleanedDataset()
    appStore.clearEntityCol()
    if (typeof window !== "undefined") {
      localStorage.removeItem("fiq_active_job_id")
      localStorage.removeItem("fiq_last_multi_serie_result")
    }
    setLastAnalysis(null)
    setFilename(null)
    setResetOpen(false)
    window.dispatchEvent(new CustomEvent("fiq:store-update"))
  }

  // Derived
  const single   = lastAnalysis?.kind === "single" ? lastAnalysis.result : null
  const multi    = lastAnalysis?.kind === "multi"  ? lastAnalysis.result : null
  const modelUsed = single?.model_used ?? null
  const wape     = single?.metrics.wape != null ? single.metrics.wape * 100 : null
  const fva      = single?.metrics.fva  != null ? single.metrics.fva  * 100 : null
  const nextEv   = upcomingEvents[0] ?? null
  const nextEvDays = nextEv ? daysUntil(nextEv.start_date) : null
  const TierIcon = caps.tier === "local" ? ComputerIcon : caps.tier === "ec2" ? DnsIcon : caps.backend_online ? CloudDoneIcon : CloudOffIcon

  // Range slider label
  const sliderLabel = (v: number) => `${v}%`

  return (
    <Box sx={{
      height: "100%", display: "flex", flexDirection: "column",
      gap: "0.875rem", overflow: "hidden",
      px: "1.5rem", pt: "3rem", pb: "1.125rem",
      position: "relative",
    }}>

      {/* ══ HERO ══ */}
      <Box sx={{
        background: "var(--fiq-appbar-bg, linear-gradient(135deg, #0f2044 0%, #1a3868 100%))",
        borderRadius: "1rem", p: "1.75rem 1.5rem",
        height: "8rem", minHeight: "8rem",
        display: "flex", alignItems: "center", gap: "1.25rem",
        position: "relative", overflow: "visible", flexShrink: 0,
      }}>
        <Box sx={{ position: "absolute", inset: 0, borderRadius: "1rem", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          <Box sx={{ position: "absolute", right: "-1.875rem", top: "-1.875rem", width: "12.5rem", height: "12.5rem", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.04)" }} />
          <Box sx={{ position: "absolute", right: "5rem", bottom: "-3.125rem", width: "10rem", height: "10rem", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.03)" }} />
        </Box>

        {/* Logo */}
        <Box sx={{ position: "absolute", left: "1.5rem", top: "50%", transform: "translateY(-50%)", zIndex: 5, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="ForecastIQ" style={{
            width: LOGO_SIZE, height: LOGO_SIZE, borderRadius: "50%", objectFit: "cover", display: "block",
            filter: "drop-shadow(0 0.5rem 2.5rem rgba(0,0,0,0.45)) drop-shadow(0 0.125rem 0.5rem rgba(59,130,246,0.35))",
          }} />
        </Box>
        <Box sx={{ width: LOGO_SIZE, flexShrink: 0 }} />

        {/* Left text */}
        <Box sx={{ flexShrink: 0, position: "relative", zIndex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minWidth: "16rem" }}>
          <Typography sx={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.45)", letterSpacing: "0.08em", textTransform: "uppercase", mb: "0.2rem" }}>
            {now ? `${fmtDate(now)} · ${fmtTime(now)}` : "\u00a0"}
          </Typography>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03rem", lineHeight: 1.15, mb: "0.2rem", whiteSpace: "nowrap" }}>
            {firstName
              ? <><Box component="span" sx={{ color: "rgba(255,255,255,0.7)" }}>Bienvenido, </Box>
                  <Box component="span" sx={{ color: "#93c5fd" }}>{firstName}</Box></>
              : <Box component="span" sx={{ color: "#fff" }}>Bienvenido</Box>
            }
          </Typography>
          <Typography sx={{ fontSize: "0.75rem", color: "rgba(255,255,255,0.45)", lineHeight: 1.4 }}>
            Conectá tus ventas · IA · Series de tiempo
          </Typography>
        </Box>

        {/* Pipeline */}
        <Box sx={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", zIndex: 1,
          "& > div": { background: "transparent !important", bgcolor: "transparent !important", border: "none !important", boxShadow: "none !important", mb: "0 !important", px: "0 !important", py: "0 !important" },
          "& .MuiChip-filled":                           { bgcolor: "rgba(34,197,94,0.22) !important", color: "#4ade80 !important", borderRadius: "1rem !important", "& .MuiSvgIcon-root": { color: "#4ade80 !important" } },
          "& .MuiChip-outlined":                         { borderColor: "rgba(255,255,255,0.35) !important", color: "rgba(255,255,255,0.7) !important", borderRadius: "1rem !important" },
          "& .MuiChip-colorPrimary.MuiChip-outlined":    { borderColor: "#93c5fd !important", color: "#93c5fd !important", borderRadius: "1rem !important" },
          "& .MuiChip-colorDefault":                     { bgcolor: "rgba(255,255,255,0.08) !important", color: "rgba(255,255,255,0.4) !important", borderColor: "rgba(255,255,255,0.15) !important", borderRadius: "1rem !important" },
        }}>
          <PipelineBar activeStep="/dashboard/home" noMargin />
        </Box>

        {/* Right chips */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem", alignItems: "flex-end", justifyContent: "center", flexShrink: 0, position: "relative", zIndex: 1 }}>
          <Box component="span" sx={{ fontSize: "0.75rem", fontWeight: 600, px: "0.875rem", py: "0.3rem", borderRadius: "1.25rem", bgcolor: "rgba(255,255,255,0.14)", color: "#fff", display: "flex", alignItems: "center", gap: "0.375rem" }}>
            <TierIcon sx={{ fontSize: "0.875rem" }} />{caps.tier_label}
          </Box>
          <Box component="span" sx={{
            fontSize: "0.75rem", fontWeight: 600, px: "0.875rem", py: "0.3rem", borderRadius: "1.25rem",
            bgcolor: isOnline ? "rgba(34,197,94,0.18)" : healthLoading ? "rgba(156,163,175,0.18)" : "rgba(239,68,68,0.18)",
            color:   isOnline ? "#4ade80" : healthLoading ? "#d1d5db" : "#f87171",
            display: "flex", alignItems: "center", gap: "0.4rem",
          }}>
            {healthLoading
              ? <CircularProgress size="0.625rem" color="inherit" />
              : <Box component="span" sx={{ width: "0.4rem", height: "0.4rem", borderRadius: "50%", flexShrink: 0, bgcolor: isOnline ? "#22c55e" : "#ef4444",
                  animation: isOnline ? "pulse 2s ease-in-out infinite" : "none",
                  "@keyframes pulse": { "0%,100%": { boxShadow: "0 0 0 0.1875rem rgba(34,197,94,0.25)" }, "50%": { boxShadow: "0 0 0 0.4375rem rgba(34,197,94,0.06)" } },
                } as SxProps} />
            }
            {healthLoading ? "Conectando…" : isOnline ? "Backend online" : "Backend offline"}
          </Box>
          {caps.hardware_label && (
            <Box component="span" sx={{ fontSize: "0.6875rem", px: "0.75rem", py: "0.25rem", borderRadius: "1.25rem", bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.55)" }}>
              {caps.hardware_label}
            </Box>
          )}
        </Box>
      </Box>

      {/* ══ MAIN AREA — chart + donuts ══ */}
      <Box sx={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 13rem", gap: "0.875rem", mt: "1.5rem" }}>

        {/* Zona A — Chart */}
        <Box sx={{ ...glass, display: "flex", flexDirection: "column", p: "0.625rem 0.75rem 0.5rem", minHeight: 0, overflow: "hidden" }}>

          {/* Chart header */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "0.375rem", flexShrink: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "text.primary" }}>
                {lastAnalysis
                  ? lastAnalysis.kind === "single" ? "Último forecast" : "Último análisis multi-serie"
                  : "Forecast"
                }
              </Typography>
              {modelUsed && (
                <Box component="span" sx={{ fontSize: "0.6rem", fontWeight: 700, px: "0.45rem", py: "0.1rem", borderRadius: "0.5rem", bgcolor: `${MODEL_COLORS[modelUsed]??"#8b5cf6"}18`, color: MODEL_COLORS[modelUsed]??"#8b5cf6" }}>
                  {MODEL_SHORT[modelUsed] ?? modelUsed}
                </Box>
              )}
              {multi && (
                <Box component="span" sx={{ fontSize: "0.6rem", fontWeight: 700, px: "0.45rem", py: "0.1rem", borderRadius: "0.5rem", bgcolor: "rgba(236,72,153,0.1)", color: "#ec4899" }}>
                  {multi.data.n_series ?? "?"} series
                </Box>
              )}
              {single && wape !== null && (
                <Box component="span" sx={{ fontSize: "0.6rem", fontWeight: 700, px: "0.45rem", py: "0.1rem", borderRadius: "0.5rem", bgcolor: "rgba(16,185,129,0.1)", color: "#10b981" }}>
                  WAPE {wape.toFixed(1)}%
                </Box>
              )}
              {single && fva !== null && (
                <Box component="span" sx={{ fontSize: "0.6rem", fontWeight: 700, px: "0.45rem", py: "0.1rem", borderRadius: "0.5rem", bgcolor: fva >= 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: fva >= 0 ? "#10b981" : "#ef4444" }}>
                  FVA {fva >= 0 ? "+" : ""}{fva.toFixed(1)}pp
                </Box>
              )}
            </Box>
            <Box sx={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {lastAnalysis && (
                <Tooltip title="Limpiar y empezar de cero" arrow>
                  <Box onClick={() => setResetOpen(true)} sx={{
                    display: "flex", alignItems: "center", gap: "0.25rem",
                    fontSize: "0.6875rem", fontWeight: 600, color: "text.disabled",
                    cursor: "pointer", px: "0.6rem", py: "0.3rem",
                    borderRadius: "0.5rem", border: "1px solid", borderColor: "divider",
                    transition: "all 0.14s",
                    "&:hover": { color: "error.main", borderColor: "error.light", bgcolor: "rgba(239,68,68,0.06)" },
                  }}>
                    <RestartAltIcon sx={{ fontSize: "0.875rem" }} />
                    Empezar de cero
                  </Box>
                </Tooltip>
              )}
              <Box onClick={() => router.push(lastAnalysis?.kind === "multi" ? "/dashboard/multi-serie" : "/dashboard/forecast")}
                sx={{ fontSize: "0.6875rem", fontWeight: 600, color: "primary.main", display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer", px: "0.6875rem", py: "0.3rem", borderRadius: "0.5rem", border: "1px solid", borderColor: "divider", "&:hover": { bgcolor: "rgba(59,130,246,0.06)" } }}>
                {lastAnalysis ? "Ver análisis completo" : "Ejecutar forecast"}
                <ArrowForwardIcon sx={{ fontSize: "0.75rem" }} />
              </Box>
            </Box>
          </Box>

          {/* Chart body */}
          <Box sx={{ flex: 1, minHeight: 0, position: "relative" }}>
            {single
              ? <ProfessionalChart result={single} rangeStart={rangeStart} rangeEnd={rangeEnd} />
              : <DemoChart animKey={demoKey} />
            }
            {/* Multi-serie: no chart preview, show placeholder */}
            {multi && (
              <Box sx={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
                <BarChartIcon sx={{ fontSize: "3rem", color: "primary.main", opacity: 0.35 }} />
                <Typography variant="body2" color="text.secondary" textAlign="center">
                  Último análisis: <strong>Multi-serie</strong> · {multi.data.n_series} series · {multi.data.freq} · horizonte {multi.data.horizon}
                </Typography>
                <Box onClick={() => router.push("/dashboard/multi-serie")}
                  sx={{ fontSize: "0.8rem", fontWeight: 600, color: "primary.main", cursor: "pointer", px: "1rem", py: "0.45rem", borderRadius: "0.5rem", bgcolor: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", "&:hover": { bgcolor: "rgba(59,130,246,0.13)" } }}>
                  Ver resultados multi-serie →
                </Box>
              </Box>
            )}
          </Box>

          {/* Range slider — only for single series chart */}
          {single && (() => {
            return (
              <Box sx={{ flexShrink: 0, px: "1rem", pt: "0.25rem", pb: "0.125rem" }}>
                <Slider
                  value={[rangeStart, rangeEnd]}
                  onChange={(_, v) => {
                    const [s, e] = v as number[]
                    if (e - s >= 10) { setRangeStart(s); setRangeEnd(e) }
                  }}
                  min={0} max={100} step={1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={sliderLabel}
                  size="small"
                  sx={{
                    color: "primary.main", mt: "0.1rem",
                    "& .MuiSlider-thumb": { width: "0.625rem", height: "0.625rem" },
                    "& .MuiSlider-track": { height: "0.1875rem", background: `linear-gradient(to right, #3b82f6, #8b5cf6)`, border: "none" },
                    "& .MuiSlider-rail":  { height: "0.1875rem", opacity: 0.18 },
                    py: "0.3rem",
                  }}
                />
                {/* Bottom row: range labels + centred legend */}
                <Box sx={{ display: "flex", alignItems: "center", mt: "-0.375rem" }}>
                  <Typography sx={{ fontSize: "0.5625rem", color: "rgba(59,130,246,0.7)", fontWeight: 600, minWidth: "4.5rem" }}>● Histórico</Typography>
                  {/* Legend — centred */}
                  <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.875rem" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Box sx={{ width: "1rem", height: "1.5px", bgcolor: "#3b82f6", borderRadius: "1px" }} />
                      <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled" }}>Real</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Box sx={{ width: "1rem", height: "1.5px", background: "repeating-linear-gradient(90deg,#8b5cf6 0,#8b5cf6 4px,transparent 4px,transparent 7px)", borderRadius: "1px" }} />
                      <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled" }}>Forecast</Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                      <Box sx={{ width: "0.7rem", height: "0.5rem", borderRadius: "0.15rem", bgcolor: "rgba(139,92,246,0.22)" }} />
                      <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled" }}>IC 90%</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ fontSize: "0.5625rem", color: "text.disabled", minWidth: "4.5rem", textAlign: "right" }}>{rangeStart}%–{rangeEnd}%</Typography>
                  <Typography sx={{ fontSize: "0.5625rem", color: "rgba(139,92,246,0.7)", fontWeight: 600, minWidth: "4rem", textAlign: "right" }}>Forecast ●</Typography>
                </Box>
              </Box>
            )
          })()}
        </Box>

        {/* Zona B — Sidebar panel */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.625rem", minHeight: 0, overflow: "hidden" }}>

          {/* ── Quick actions + next event card ── */}
          <Box sx={{ ...glass, p: "0.75rem", flexShrink: 0 }}>
            {/* Buttons row */}
            <Box sx={{ display: "flex", gap: "0.375rem", mb: "0.625rem" }}>
              <Box onClick={() => setEventsOpen(true)} sx={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: "0.3rem", px: "0.5rem", py: "0.4rem", borderRadius: "0.5rem",
                bgcolor: "rgba(59,130,246,0.07)", border: "1px solid", borderColor: "rgba(59,130,246,0.2)",
                cursor: "pointer", transition: "all 0.13s",
                "&:hover": { bgcolor: "rgba(59,130,246,0.13)", borderColor: "primary.main" },
              }}>
                <EventIcon sx={{ fontSize: "0.8rem", color: "primary.main" }} />
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: "primary.main" }}>Eventos</Typography>
                {upcomingEvents.length > 0 && (
                  <Box sx={{ width: "0.875rem", height: "0.875rem", borderRadius: "50%", bgcolor: "primary.main", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Typography sx={{ fontSize: "0.45rem", fontWeight: 800, color: "#fff" }}>{upcomingEvents.length}</Typography>
                  </Box>
                )}
              </Box>
              <Box onClick={() => setActionsOpen(true)} sx={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
                gap: "0.3rem", px: "0.5rem", py: "0.4rem", borderRadius: "0.5rem",
                bgcolor: "primary.main", cursor: "pointer", transition: "all 0.13s",
                "&:hover": { bgcolor: "primary.dark" },
              }}>
                <BoltIcon sx={{ fontSize: "0.8rem", color: "#fff" }} />
                <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "#fff" }}>Acciones</Typography>
              </Box>
            </Box>

            {/* Next event preview */}
            {nextEv && (
              <Box sx={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                p: "0.5rem", borderRadius: "0.5rem",
                bgcolor: `${evColor(nextEv.type)}08`, border: "1px solid", borderColor: `${evColor(nextEv.type)}22`,
              }}>
                <Box sx={{
                  width: "2rem", height: "2rem", flexShrink: 0, borderRadius: "0.375rem",
                  bgcolor: `${evColor(nextEv.type)}18`,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                }}>
                  <Typography sx={{ fontSize: "0.45rem", fontWeight: 700, color: evColor(nextEv.type), lineHeight: 1, textTransform: "uppercase" }}>
                    {fmtEvDate(nextEv.start_date).split(" ")[1]}
                  </Typography>
                  <Typography sx={{ fontSize: "0.875rem", fontWeight: 800, color: evColor(nextEv.type), lineHeight: 1.1 }}>
                    {fmtEvDate(nextEv.start_date).split(" ")[0]}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 700, color: "text.primary", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextEv.name}</Typography>
                  <Typography sx={{ fontSize: "0.6rem", color: "text.secondary" }}>
                    {nextEvDays === 0 ? "hoy" : nextEvDays === 1 ? "mañana" : `en ${nextEvDays}d`}
                  </Typography>
                </Box>
                <Box component="span" sx={{ fontSize: "0.5rem", fontWeight: 700, color: evColor(nextEv.type), bgcolor: `${evColor(nextEv.type)}18`, px: "0.3rem", py: "0.1rem", borderRadius: "0.3rem", flexShrink: 0 }}>
                  {nextEv.type}
                </Box>
              </Box>
            )}
            {!nextEv && (
              <Typography sx={{ fontSize: "0.65rem", color: "text.disabled", textAlign: "center", py: "0.25rem" }}>Sin eventos próximos</Typography>
            )}
          </Box>

          {/* ── Metrics donuts or multi-serie summary ── */}
          <Box sx={{ ...glass, p: "0.875rem 0.75rem", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {single
              ? <SingleSerieDonuts result={single} filename={filename} />
              : multi
                ? <MultiSerieSummary stored={multi} />
                : (
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.75rem", textAlign: "center" }}>
                    <ShowChartIcon sx={{ fontSize: "2rem", color: "text.disabled", opacity: 0.35 }} />
                    <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.6 }}>
                      Ejecutá un forecast para ver métricas aquí
                    </Typography>
                    <Box onClick={() => router.push("/dashboard/dataset")}
                      sx={{ fontSize: "0.75rem", fontWeight: 600, color: "primary.main", cursor: "pointer", px: "0.75rem", py: "0.4rem", borderRadius: "0.5rem", bgcolor: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)", "&:hover": { bgcolor: "rgba(59,130,246,0.13)" } }}>
                      Subir dataset →
                    </Box>
                  </Box>
                )
            }
          </Box>
        </Box>

      </Box>

      {/* ══ DRAWER — Acciones ══ */}
      <Drawer anchor="left" open={actionsOpen} onClose={() => setActionsOpen(false)}
        PaperProps={{ sx: { width: "17rem", p: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <BoltIcon sx={{ color: "primary.main", fontSize: "1.125rem" }} />
            <Typography variant="h6" fontWeight={700}>Acciones rápidas</Typography>
          </Box>
          <Box onClick={() => setActionsOpen(false)} sx={{ cursor: "pointer", color: "text.disabled", "&:hover": { color: "text.primary" } }}>
            <CloseIcon fontSize="small" />
          </Box>
        </Box>
        <Divider />
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {QUICK_ACTIONS.map(a => (
            <Box key={a.href} onClick={() => { router.push(a.href); setActionsOpen(false) }}
              sx={{ display: "flex", alignItems: "center", gap: "0.75rem", p: "0.75rem", borderRadius: "0.75rem", cursor: "pointer", border: "1px solid", borderColor: "divider", transition: "all 0.13s", "&:hover": { bgcolor: `${a.color}0c`, borderColor: `${a.color}30` } }}>
              <Box sx={{ width: "2rem", height: "2rem", borderRadius: "0.5rem", flexShrink: 0, bgcolor: `${a.color}14`, display: "flex", alignItems: "center", justifyContent: "center", color: a.color, "& svg": { fontSize: "1rem" } }}>{a.icon}</Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.primary" }}>{a.label}</Typography>
                <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>{a.sub}</Typography>
              </Box>
              <ArrowForwardIcon sx={{ fontSize: "0.875rem", color: "text.disabled" }} />
            </Box>
          ))}
        </Box>
      </Drawer>

      {/* ══ DRAWER — Eventos ══ */}
      <Drawer anchor="left" open={eventsOpen} onClose={() => setEventsOpen(false)}
        PaperProps={{ sx: { width: "19rem", p: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" } }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <EventIcon sx={{ color: "primary.main", fontSize: "1.125rem" }} />
            <Typography variant="h6" fontWeight={700}>Próximos eventos</Typography>
          </Box>
          <Box onClick={() => setEventsOpen(false)} sx={{ cursor: "pointer", color: "text.disabled", "&:hover": { color: "text.primary" } }}>
            <CloseIcon fontSize="small" />
          </Box>
        </Box>
        <Divider />
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto" }}>
          {upcomingEvents.length > 0 ? upcomingEvents.map((ev, i) => {
            const ec = evColor(ev.type); const days = daysUntil(ev.start_date)
            return (
              <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "0.75rem", p: "0.75rem", borderRadius: "0.75rem", bgcolor: `${ec}08`, border: "1px solid", borderColor: `${ec}22` }}>
                <Box sx={{ width: "2.5rem", height: "2.5rem", borderRadius: "0.5rem", flexShrink: 0, bgcolor: `${ec}18`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <Typography sx={{ fontSize: "0.5rem", fontWeight: 700, color: ec, lineHeight: 1 }}>{fmtEvDate(ev.start_date).split(" ")[1]?.toUpperCase()}</Typography>
                  <Typography sx={{ fontSize: "1rem", fontWeight: 800, color: ec, lineHeight: 1.15 }}>{fmtEvDate(ev.start_date).split(" ")[0]}</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.primary" }}>{ev.name}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary" }}>
                    {days === 0 ? "hoy" : days === 1 ? "mañana" : `en ${days} días`}
                  </Typography>
                </Box>
                <Box component="span" sx={{ fontSize: "0.575rem", fontWeight: 700, color: ec, bgcolor: `${ec}18`, px: "0.4rem", py: "0.15rem", borderRadius: "0.4rem", flexShrink: 0 }}>
                  {ev.type}
                </Box>
              </Box>
            )
          }) : (
            <Typography variant="body2" color="text.disabled" sx={{ py: "1rem", textAlign: "center" }}>Sin eventos próximos</Typography>
          )}
        </Box>
        <Box onClick={() => { router.push("/dashboard/calendar"); setEventsOpen(false) }}
          sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", p: "0.625rem", borderRadius: "0.625rem", border: "1px solid", borderColor: "divider", cursor: "pointer", "&:hover": { bgcolor: "rgba(59,130,246,0.05)" } }}>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "primary.main" }}>Ver calendario completo</Typography>
          <ArrowForwardIcon sx={{ fontSize: "0.875rem", color: "primary.main" }} />
        </Box>
      </Drawer>

      {/* ══ DIALOG — Reset ══ */}
      <Dialog open={resetOpen} onClose={() => setResetOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <RestartAltIcon sx={{ color: "warning.main" }} />
          Empezar de cero
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            Limpiará el dataset activo, el último forecast (serie única y multi-serie), quality score y modelo detectado. Los datos en el servidor no se modifican.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetOpen(false)} sx={{ textTransform: "none" }}>Cancelar</Button>
          <Button onClick={handleReset} color="warning" variant="contained" sx={{ textTransform: "none" }} startIcon={<RestartAltIcon />}>
            Limpiar y empezar de cero
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}
