"use client"

/**
 * HomeDashboard — Portada de bienvenida del dashboard.
 * Layout vertical sin scroll: hero strip → status 4col → cards 3×2 + actividad.
 * Logo flotante sobresale del hero strip (overflow:visible + position:absolute).
 */

import { useEffect, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { useRouter } from "next/navigation"
import { useSession } from "@/lib/auth-client"
import StorageIcon from "@mui/icons-material/Storage"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"
import SmartToyIcon from "@mui/icons-material/SmartToy"
import ScienceIcon from "@mui/icons-material/Science"
import BarChartIcon from "@mui/icons-material/BarChart"
import CloudDoneIcon from "@mui/icons-material/CloudDone"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import type { SxProps } from "@mui/material"

// ── Data ──────────────────────────────────────────────────────────────────────
const FEATURE_CARDS = [
  { id: "datasets",  icon: <StorageIcon />,       label: "Mis Datasets",    desc: "Subi tu CSV o explora el demo de 25k SKUs · 3 anos de ventas",         color: "#3b82f6", href: "/dashboard/dataset"  },
  { id: "forecast",  icon: <ShowChartIcon />,      label: "Forecast",        desc: "4 modelos ML con seleccion automatica · intervalos de confianza",       color: "#8b5cf6", href: "/dashboard/forecast" },
  { id: "calendar",  icon: <CalendarMonthIcon />,  label: "Calendario",      desc: "Eventos, promociones y feriados que impactan tus ventas",               color: "#06b6d4", href: "/dashboard/calendar" },
  { id: "chat",      icon: <SmartToyIcon />,       label: "Chat IA",         desc: "Preguntale a tus datos en lenguaje natural · streaming SSE",            color: "#f59e0b", href: "/dashboard/chat"     },
  { id: "mlops",     icon: <ScienceIcon />,        label: "MLOps",           desc: "MLflow tracking + Evidently AI drift detection por dataset",            color: "#10b981", href: "/dashboard/mlops"    },
  { id: "batch",     icon: <BarChartIcon />,       label: "Batch Analytics", desc: "Analisis ABC-XYZ vectorizado sobre 25k SKUs con Nixtla StatsForecast",  color: "#ec4899", href: "/dashboard/batch"    },
]

const STATUS_ITEMS = [
  { icon: <CloudDoneIcon />,   label: "Backend",      value: "AWS EC2",   sub: "Online · FastAPI 0.115",    color: "#22c55e" },
  { icon: <ScienceIcon />,     label: "Modelos ML",   value: "4 activos", sub: "MA · HW · SARIMA · LGB",    color: "#3b82f6" },
  { icon: <CheckCircleIcon />, label: "Fases",        value: "11 / 14",   sub: "PySpark completa",          color: "#8b5cf6" },
  { icon: <StorageIcon />,     label: "Dataset demo", value: "25k SKUs",  sub: "256 MB · Supabase Storage", color: "#06b6d4" },
]

const ACTIVITY_ITEMS = [
  { icon: <TrendingUpIcon />,   label: "Forecast ejecutado", sub: "ventas_electronica · LightGBM", time: "hace 2h", color: "#8b5cf6" },
  { icon: <UploadFileIcon />,   label: "Dataset subido",     sub: "ventas_q1_2026.csv · 4.2 MB",   time: "hace 5h", color: "#3b82f6" },
  { icon: <WarningAmberIcon />, label: "Drift detectado",    sub: "Holt-Winters · WAPE +6.2%",     time: "ayer",    color: "#f59e0b" },
  { icon: <SmartToyIcon />,     label: "Chat IA · 12 msgs",  sub: "Que categoria crecio mas?",      time: "ayer",    color: "#10b981" },
]

// ── Date helpers ──────────────────────────────────────────────────────────────
const DAYS_ES   = ["Domingo","Lunes","Martes","Miercoles","Jueves","Viernes","Sabado"]
const MONTHS_ES = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"]

function formatDateES(d: Date) {
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} ${d.getFullYear()}`
}
function formatTimeES(d: Date) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

// ── Sizes ─────────────────────────────────────────────────────────────────────
// Logo: base 9rem × 1.3 = 11.7rem → redondeado a 11.75rem
const LOGO_SIZE = "11.75rem"
// How much the logo overflows below the hero strip
const LOGO_OVERFLOW = "3.5rem"

// ── Main Component ────────────────────────────────────────────────────────────
export function HomeDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [now, setNow] = useState(new Date())
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const firstName = session?.user?.name ? session.user.name.split(" ")[0] : null

  return (
    // Vertical flex - no scroll, padding propio (main da padding cero en /home)
    <Box sx={{
      height: "100%", display: "flex", flexDirection: "column",
      gap: "0.875rem", overflow: "hidden",
      px: "1.5rem", pt: "3rem", pb: "1.125rem",
    }}>

      {/* ── Hero strip ──────────────────────────────────────────────────────── */}
      {/*
        overflow:visible permite que el logo absoluto sobresalga hacia abajo.
        Los blobs decorativos tienen su propio contenedor con overflow:hidden
        para no salirse del strip visualmente.
        Un spacer invisible (width = LOGO_SIZE) mantiene el espacio del logo en el flujo.
      */}
      <Box sx={{
        background: "linear-gradient(135deg, #0f2044 0%, #1a3868 100%)",
        borderRadius: "1rem",
        p: "1.125rem 1.5rem",
        display: "flex", alignItems: "center", gap: "1.25rem",
        position: "relative",
        overflow: "visible",  // logo escapa sin recortarse
        flexShrink: 0,
      }}>

        {/* Decorative blobs — clipped inside the strip */}
        <Box sx={{ position: "absolute", inset: 0, borderRadius: "1rem", overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
          <Box sx={{ position: "absolute", right: "-1.875rem", top: "-1.875rem", width: "12.5rem", height: "12.5rem", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.04)" }} />
          <Box sx={{ position: "absolute", right: "5rem", bottom: "-3.125rem", width: "10rem", height: "10rem", borderRadius: "50%", bgcolor: "rgba(255,255,255,0.03)" }} />
        </Box>

        {/*
          Logo: position absolute centrado verticalmente, zIndex alto para flotar
          por delante del strip. El spacer mantiene el hueco en el flujo flex.
        */}
        <Box sx={{ position: "absolute", left: "1.5rem", top: "50%", transform: "translateY(-50%)", zIndex: 5, flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="ForecastIQ"
            style={{
              width: LOGO_SIZE, height: LOGO_SIZE,
              borderRadius: "50%",
              objectFit: "cover",
              display: "block",
              filter: "drop-shadow(0 0.5rem 2.5rem rgba(0,0,0,0.45)) drop-shadow(0 0.125rem 0.5rem rgba(59,130,246,0.35))",
            }}
          />
        </Box>

        {/* Spacer — same width as the logo, keeps text from sliding under it */}
        <Box sx={{ width: LOGO_SIZE, flexShrink: 0 }} />

        {/* Text block */}
        <Box sx={{ flex: 1, position: "relative", zIndex: 1 }}>
          <Typography sx={{ fontSize: "0.6875rem", color: "rgba(255,255,255,0.55)", letterSpacing: "0.08em", textTransform: "uppercase", mb: "0.3rem" }}>
            {formatDateES(now)} &middot; {formatTimeES(now)}
          </Typography>
          <Typography sx={{ fontSize: "1.5rem", fontWeight: 800, color: "#fff", letterSpacing: "-0.03rem", mb: "0.3rem", lineHeight: 1.15 }}>
            {firstName
              ? <><span>Bienvenido, </span><Box component="span" sx={{ color: "#93c5fd" }}>{firstName}</Box></>
              : "Bienvenido"
            }
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "rgba(255,255,255,0.65)", lineHeight: 1.4 }}>
            Conecta tus ventas &middot; Obtene forecasts con IA al instante &middot; Charla con tus numeros
          </Typography>
        </Box>

        {/* Right badges */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem", alignItems: "flex-end", flexShrink: 0, position: "relative", zIndex: 1 }}>
          <Box component="span" sx={{
            fontSize: "0.75rem", fontWeight: 600, px: "0.875rem", py: "0.3125rem",
            borderRadius: "1.25rem", bgcolor: "rgba(255,255,255,0.14)", color: "#fff", letterSpacing: "0.04em",
          }}>
            Phase 11 — PySpark
          </Box>
          <Box component="span" sx={{
            fontSize: "0.75rem", fontWeight: 600, px: "0.875rem", py: "0.3125rem",
            borderRadius: "1.25rem", bgcolor: "rgba(34,197,94,0.18)", color: "#4ade80",
            display: "flex", alignItems: "center", gap: "0.4375rem",
          }}>
            <Box component="span" sx={{
              width: "0.4375rem", height: "0.4375rem", borderRadius: "50%", bgcolor: "#22c55e", flexShrink: 0,
              animation: "pulseDot 2s ease-in-out infinite",
              "@keyframes pulseDot": {
                "0%, 100%": { boxShadow: "0 0 0 0.1875rem rgba(34,197,94,0.25)" },
                "50%":      { boxShadow: "0 0 0 0.4375rem rgba(34,197,94,0.06)" },
              },
            } as SxProps} />
            Live en produccion
          </Box>
          <Box component="span" sx={{
            fontSize: "0.6875rem", fontWeight: 500, px: "0.75rem", py: "0.25rem",
            borderRadius: "1.25rem", bgcolor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
          }}>
            forecastiq.vercel.app
          </Box>
        </Box>
      </Box>

      {/* ── Status strip — 4 columns ─────────────────────────────────────────── */}
      {/*
        mt compensates for the logo overflow so the strip doesn't
        visually collide with the floating logo.
      */}
      <Box sx={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem",
        flexShrink: 0,
        mt: `calc(${LOGO_OVERFLOW} * 0.6)`,
      }}>
        {STATUS_ITEMS.map((s, i) => (
          <Box key={i} sx={{
            bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(0.625rem)",
            borderRadius: "0.75rem", p: "0.6875rem 0.875rem",
            border: "1px solid rgba(219,234,254,0.7)",
            boxShadow: "0 0.0625rem 0.25rem rgba(0,0,0,0.04)",
            display: "flex", alignItems: "center", gap: "0.6875rem",
          }}>
            <Box sx={{
              width: "2.25rem", height: "2.25rem", borderRadius: "0.5625rem", flexShrink: 0,
              bgcolor: `${s.color}15`, display: "flex", alignItems: "center", justifyContent: "center",
              color: s.color, "& svg": { fontSize: "1.1875rem" },
            }}>
              {s.icon}
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.625rem", color: "text.disabled", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", mb: "0.0625rem" }}>
                {s.label}
              </Typography>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: "text.primary", lineHeight: 1.1 }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", mt: "0.0625rem" }}>
                {s.sub}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Cards 3x2 + Activity panel ──────────────────────────────────────── */}
      <Box sx={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 16rem", gap: "0.875rem", minHeight: 0 }}>

        {/* Feature cards — 3 cols x 2 rows, content centered */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "1fr 1fr", gap: "0.75rem", minHeight: 0 }}>
          {FEATURE_CARDS.map((card) => {
            const hovered = hoveredCard === card.id
            return (
              <Box
                key={card.id}
                onClick={() => router.push(card.href)}
                onMouseEnter={() => setHoveredCard(card.id)}
                onMouseLeave={() => setHoveredCard(null)}
                sx={{
                  bgcolor: hovered ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(0.625rem)",
                  borderRadius: "0.875rem",
                  p: "1.25rem 1rem",
                  border: `1px solid ${hovered ? card.color + "55" : "rgba(219,234,254,0.7)"}`,
                  boxShadow: hovered ? `0 0.375rem 1.5rem ${card.color}1a` : "0 0.0625rem 0.25rem rgba(0,0,0,0.05)",
                  cursor: "pointer",
                  transition: "all 0.18s cubic-bezier(0.4,0,0.2,1)",
                  transform: hovered ? "translateY(-0.125rem)" : "none",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  textAlign: "center", overflow: "hidden",
                }}
              >
                <Box sx={{
                  width: "3rem", height: "3rem", borderRadius: "0.75rem",
                  bgcolor: hovered ? `${card.color}22` : `${card.color}14`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: card.color, mb: "0.75rem", flexShrink: 0,
                  transition: "background 0.18s ease",
                  "& svg": { fontSize: "1.375rem" },
                }}>
                  {card.icon}
                </Box>
                <Typography sx={{ fontSize: "0.875rem", fontWeight: 600, color: "text.primary", mb: "0.3rem" }}>
                  {card.label}
                </Typography>
                <Typography sx={{ fontSize: "0.75rem", color: "text.secondary", lineHeight: 1.5 }}>
                  {card.desc}
                </Typography>
                {hovered && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", mt: "0.625rem", flexShrink: 0 }}>
                    <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: card.color }}>Abrir</Typography>
                    <ArrowForwardIcon sx={{ fontSize: "0.8125rem", color: card.color }} />
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>

        {/* Activity panel */}
        <Box sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <Typography sx={{
            fontSize: "0.6875rem", fontWeight: 600, color: "text.disabled",
            letterSpacing: "0.08em", textTransform: "uppercase", mb: "0.75rem", flexShrink: 0,
          }}>
            Actividad reciente
          </Typography>
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", minHeight: 0 }}>
            {ACTIVITY_ITEMS.map((a, i) => (
              <Box key={i} sx={{
                bgcolor: "rgba(255,255,255,0.85)", backdropFilter: "blur(0.625rem)",
                borderRadius: "0.75rem", p: "0.6875rem 0.8125rem",
                border: "1px solid rgba(219,234,254,0.7)",
                boxShadow: "0 0.0625rem 0.1875rem rgba(0,0,0,0.04)",
                display: "flex", gap: "0.6875rem", alignItems: "flex-start", flexShrink: 0,
              }}>
                <Box sx={{
                  width: "2rem", height: "2rem", borderRadius: "0.5rem", flexShrink: 0,
                  bgcolor: `${a.color}14`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: a.color, mt: "0.0625rem",
                  "& svg": { fontSize: "1rem" },
                }}>
                  {a.icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600, color: "text.primary" }}>{a.label}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.secondary", mt: "0.125rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.sub}</Typography>
                  <Typography sx={{ fontSize: "0.6875rem", color: "text.disabled", mt: "0.125rem" }}>{a.time}</Typography>
                </Box>
              </Box>
            ))}
            <Box sx={{ p: "0.375rem 0.125rem", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }}>
                <Typography sx={{ fontSize: "0.75rem", fontWeight: 600, color: "primary.main" }}>Ver todo</Typography>
                <ArrowForwardIcon sx={{ fontSize: "0.8125rem", color: "primary.main" }} />
              </Box>
            </Box>
          </Box>
        </Box>

      </Box>
    </Box>
  )
}
