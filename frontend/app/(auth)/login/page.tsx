"use client"

/**
 * Login page — space dark layout.
 *
 * Background: canvas particle system (same visual as the landing page).
 * Theme tokens resolve to spaceAuth (dark) via AuthThemeRegistry.
 *
 * Structure:
 *  - Full-viewport dark background with animated particle canvas (fixed)
 *  - Centered glass card with OAuth buttons
 *  - Left decorative panel on md+ with tagline + feature bullets
 */

import { useEffect, useRef } from "react"
import Image from "next/image"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Typography from "@mui/material/Typography"
import GoogleIcon from "@mui/icons-material/Google"
import GitHubIcon from "@mui/icons-material/GitHub"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth"
import ChatIcon from "@mui/icons-material/Chat"
import LockOpenIcon from "@mui/icons-material/LockOpen"
import { signIn, authClient } from "@/lib/auth-client"

// ── Particle canvas hook ──────────────────────────────────────────────────────

function useParticleCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let W = 0, H = 0
    let raf = 0

    interface Particle {
      x: number; y: number; r: number
      vx: number; vy: number; alpha: number
    }
    let particles: Particle[] = []

    function resize() {
      W = canvas!.width  = window.innerWidth
      H = canvas!.height = window.innerHeight
      init()
    }

    function init() {
      particles = []
      const count = Math.floor((W * H) / 13000)
      for (let i = 0; i < count; i++) {
        particles.push({
          x:     Math.random() * W,
          y:     Math.random() * H,
          r:     Math.random() * 1.4 + 0.5,
          vx:    (Math.random() - 0.5) * 0.15,
          vy:    -(Math.random() * 0.10 + 0.03),
          alpha: Math.random() * 0.35 + 0.08,
        })
      }
    }

    function frame() {
      ctx!.clearRect(0, 0, W, H)

      // Draw connecting lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const d  = Math.sqrt(dx * dx + dy * dy)
          if (d < 115) {
            ctx!.beginPath()
            ctx!.moveTo(particles[i].x, particles[i].y)
            ctx!.lineTo(particles[j].x, particles[j].y)
            ctx!.strokeStyle = `rgba(56,189,248,${0.055 * (1 - d / 115)})`
            ctx!.lineWidth = 0.6
            ctx!.stroke()
          }
        }
      }

      // Draw particles
      for (const p of particles) {
        ctx!.beginPath()
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(56,189,248,${p.alpha})`
        ctx!.fill()

        p.x += p.vx
        p.y += p.vy
        if (p.y < -6) p.y = H + 6
        if (p.x < -6) p.x = W + 6
        if (p.x > W + 6) p.x = -6
      }

      raf = requestAnimationFrame(frame)
    }

    resize()
    frame()
    window.addEventListener("resize", resize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", resize)
    }
  }, [canvasRef])
}

// ── Feature bullets ───────────────────────────────────────────────────────────

const FEATURES = [
  { icon: <AutoGraphIcon sx={{ fontSize: "1.125rem" }} />, text: "Detección automática del mejor modelo ML" },
  { icon: <CalendarMonthIcon sx={{ fontSize: "1.125rem" }} />, text: "Eventos y feriados que impactan el forecast" },
  { icon: <ChatIcon sx={{ fontSize: "1.125rem" }} />, text: "Chat IA en tiempo real sobre tus datos" },
  { icon: <LockOpenIcon sx={{ fontSize: "1.125rem" }} />, text: "Tus forecasts privados con RLS por usuario" },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useParticleCanvas(canvasRef)

  const handleGoogle = () =>
    signIn.social({ provider: "google", callbackURL: "/dashboard/home" })
  const handleGitHub = () =>
    signIn.social({ provider: "github", callbackURL: "/dashboard/home" })

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", bgcolor: "background.default", overflow: "hidden", position: "relative" }}>

      {/* ── Particle canvas (fixed, behind everything) ── */}
      <Box
        component="canvas"
        ref={canvasRef}
        sx={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}
      />

      {/* ── Radial glow accents ── */}
      <Box sx={{
        position: "fixed", top: "-11rem", left: "50%",
        transform: "translateX(-50%)",
        width: "43rem", height: "31rem", zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, rgba(56,189,248,0.07) 0%, transparent 70%)",
      }} />
      <Box sx={{
        position: "fixed", top: "40%", right: "-6rem",
        width: "31rem", height: "31rem", zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at center, rgba(139,92,246,0.06) 0%, transparent 70%)",
      }} />

      {/* ── Left panel — brand (md+) ── */}
      <Box sx={{
        display: { xs: "none", md: "flex" },
        flex: "0 0 52%",
        flexDirection: "column",
        justifyContent: "center",
        px: { md: "5rem", lg: "7rem", xl: "9rem" },
        py: "3rem",
        position: "relative",
        zIndex: 1,
        // Glow toward the divider + the divider line itself, both behind the logo
        "&::before": {
          content: '""',
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse 60% 60% at 100% 50%, rgba(56,189,248,0.07) 0%, transparent 65%)",
          pointerEvents: "none",
        },
        // Divider rendered here so the logo container (zIndex:10) paints over it
        "&::after": {
          content: '""',
          display: { xs: "none", md: "block" },
          position: "absolute",
          right: 0, top: 0, bottom: 0,
          width: "1px",
          bgcolor: "divider",
          zIndex: 1,
          pointerEvents: "none",
        },
      }}>

        {/* Logo centered on the divider */}
        <Box sx={{
          position: "absolute",
          right: 0, top: "50%",
          transform: "translate(50%, -50%)",
          zIndex: 10,
          borderRadius: "50%",
          bgcolor: "background.default",
          p: "0.875rem",
          lineHeight: 0,
          // Padding extra para que el fondo tape el divider a ambos lados
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
        }}>
          <Image
            src="/logo.png" alt="ForecastIQ"
            width={240} height={240}
            style={{ objectFit: "contain", borderRadius: "50%", display: "block" }}
            priority
          />
        </Box>

        {/* Live badge */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "1.75rem" }}>
          <Box sx={{
            px: "0.625rem", py: "0.25rem", borderRadius: "0.375rem",
            bgcolor: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.25)",
          }}>
            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 700, letterSpacing: "0.06em" }}>
              LIVE
            </Typography>
          </Box>
          <Typography variant="caption" color="text.disabled">
            En producción · EC2 + Vercel
          </Typography>
        </Box>

        {/* Tagline */}
        <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.15, letterSpacing: "-0.03em", mb: "1rem" }}>
          Forecasting con IA
          <br />
          <Box component="span" sx={{
            background: "linear-gradient(100deg, #38bdf8 0%, #8b5cf6 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}>
            para tus ventas
          </Box>
        </Typography>

        <Typography variant="body1" color="text.secondary" sx={{ mb: "2.5rem", maxWidth: "28rem", lineHeight: 1.7 }}>
          Subí tu CSV, detectamos el modelo óptimo automáticamente y charlás con
          tus datos en lenguaje natural.
        </Typography>

        {/* Feature bullets */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {FEATURES.map((f, i) => (
            <Box key={i} sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Box sx={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: "2rem", height: "2rem", borderRadius: "0.5rem",
                bgcolor: "rgba(56,189,248,0.10)",
                color: "primary.main",
                flexShrink: 0,
              }}>
                {f.icon}
              </Box>
              <Typography variant="body2" color="text.secondary">{f.text}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* ── Right panel — auth card ── */}
      <Box sx={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: { xs: "1.25rem", sm: "2rem" },
        py: "2rem",
        position: "relative",
        zIndex: 1,
        // The divider is rendered as a ::before on the LEFT panel so the logo
        // container (zIndex:10) sits naturally above it — no border on this Box.
      }}>
        {/* Glass card */}
        <Box sx={{
          width: "100%",
          maxWidth: "22rem",
          bgcolor: "background.paper",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "1.25rem",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 2rem 5rem rgba(0,0,0,0.5), 0 0 0 1px rgba(56,189,248,0.06) inset",
          p: { xs: "1.75rem", sm: "2.25rem" },
        }}>

          {/* Logo on mobile only */}
          <Box sx={{ display: { xs: "flex", md: "none" }, justifyContent: "center", mb: "1.75rem" }}>
            <Image
              src="/logo.png" alt="ForecastIQ"
              width={96} height={96}
              style={{ objectFit: "contain", borderRadius: "50%" }}
              priority
            />
          </Box>

          {/* Heading */}
          <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: "-0.02em", mb: "0.375rem" }}>
            Bienvenido
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: "2rem", lineHeight: 1.6 }}>
            Iniciá sesión para guardar tus forecasts y acceder a tu historial.
          </Typography>

          {/* OAuth buttons */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogle}
            >
              Continuar con Google
            </Button>

            <Button
              variant="outlined"
              fullWidth
              startIcon={<GitHubIcon />}
              onClick={handleGitHub}
            >
              Continuar con GitHub
            </Button>
          </Box>

          {/* Divider */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", my: "1.5rem" }}>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
            <Typography variant="caption" color="text.disabled">o</Typography>
            <Box sx={{ flex: 1, height: "1px", bgcolor: "divider" }} />
          </Box>

          {/* Guest entry */}
          <Button
            variant="text"
            fullWidth
            onClick={async () => {
              try {
                await authClient.signIn.anonymous()
                window.location.href = "/dashboard/home"
              } catch {
                // Anonymous sign-in failed — redirect anyway, app works without session
                window.location.href = "/dashboard/home"
              }
            }}
            sx={{
              color: "text.secondary",
              fontSize: "0.875rem",
              fontWeight: 500,
              py: "0.625rem",
              borderRadius: "0.625rem",
              border: "1px solid",
              borderColor: "divider",
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.04)",
                borderColor: "rgba(255,255,255,0.18)",
                color: "text.primary",
              },
            }}
          >
            Entrar como invitado
          </Button>

          <Typography variant="caption" color="text.disabled" textAlign="center" display="block" sx={{ mt: "1.25rem", lineHeight: 1.6 }}>
            Como invitado tus datos no se guardarán entre sesiones.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
