"use client"

/**
 * Login page — split layout.
 * Left panel: brand + logo + feature bullets (hidden on mobile).
 * Right panel: OAuth buttons card.
 */

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

const FEATURES = [
  { icon: <AutoGraphIcon sx={{ fontSize: "1.125rem" }} />, text: "Detección automática del mejor modelo ML" },
  { icon: <CalendarMonthIcon sx={{ fontSize: "1.125rem" }} />, text: "Eventos y feriados que impactan el forecast" },
  { icon: <ChatIcon sx={{ fontSize: "1.125rem" }} />, text: "Chat IA en tiempo real sobre tus datos" },
  { icon: <LockOpenIcon sx={{ fontSize: "1.125rem" }} />, text: "Tus forecasts privados con RLS por usuario" },
]

export default function LoginPage() {
  const handleGoogle = () =>
    signIn.social({ provider: "google", callbackURL: "/dashboard/dataset" })

  const handleGitHub = () =>
    signIn.social({ provider: "github", callbackURL: "/dashboard/dataset" })

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        bgcolor: "background.default",
        overflow: "hidden",
      }}
    >
      {/* ── Left panel — brand (hidden below md) ── */}
      <Box
        sx={{
          display: { xs: "none", md: "flex" },
          flex: "0 0 52%",
          flexDirection: "column",
          justifyContent: "center",
          px: { md: "6rem", lg: "8rem", xl: "10rem" },
          py: "3rem",
          position: "relative",
          // Subtle radial glow centered on the divider
          "&::before": {
            content: '""',
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse 60% 60% at 100% 50%, rgba(99,102,241,0.16) 0%, transparent 65%)",
            pointerEvents: "none",
          },
        }}
      >
        {/* Logo — absolute, centered on the divider line */}
        <Box
          sx={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translate(50%, -50%)",
            zIndex: 10,
            // Circle background to cover the divider cleanly
            borderRadius: "50%",
            bgcolor: "background.default",
            p: "0.5rem",
            lineHeight: 0,
          }}
        >
          <Image
            src="/logo.png"
            alt="forecastiq"
            width={260}
            height={260}
            style={{ objectFit: "contain", borderRadius: "50%", display: "block" }}
            priority
          />
        </Box>

        {/* Tagline */}
        <Typography
          variant="h2"
          sx={{
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "-0.03em",
            mb: "1rem",
            color: "text.primary",
          }}
        >
          Forecasting con IA
          <br />
          <Box component="span" sx={{ color: "primary.light" }}>
            para tus ventas
          </Box>
        </Typography>

        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: "2.5rem", maxWidth: "28rem", lineHeight: 1.7 }}
        >
          Subí tu CSV, detectamos el modelo óptimo automáticamente y charlás con
          tus datos en lenguaje natural.
        </Typography>

        {/* Feature bullets */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
          {FEATURES.map((f, i) => (
            <Box
              key={i}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                color: "text.secondary",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "2rem",
                  height: "2rem",
                  borderRadius: "0.5rem",
                  bgcolor: "rgba(99,102,241,0.12)",
                  color: "primary.light",
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </Box>
              <Typography variant="body2" color="text.secondary">
                {f.text}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* Bottom badge */}
        <Box sx={{ mt: "3rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Box
            sx={{
              px: "0.625rem",
              py: "0.25rem",
              borderRadius: "0.375rem",
              bgcolor: "rgba(16,185,129,0.12)",
              border: "1px solid rgba(16,185,129,0.25)",
            }}
          >
            <Typography
              variant="caption"
              sx={{ color: "success.main", fontWeight: 600, letterSpacing: "0.04em" }}
            >
              LIVE
            </Typography>
          </Box>
          <Typography variant="caption" color="text.disabled">
            En producción · Railway + Vercel
          </Typography>
        </Box>
      </Box>

      {/* ── Right panel — auth card ── */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: { xs: "1.25rem", sm: "2rem" },
          py: "2rem",
          // Subtle top border accent on mobile (full width)
          borderLeft: { md: "1px solid" },
          borderColor: { md: "divider" },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: "22rem" }}>
          {/* Logo on mobile only */}
          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              justifyContent: "center",
              mb: "2rem",
            }}
          >
            <Image
              src="/logo.png"
              alt="forecastiq"
              width={120}
              height={120}
              style={{ objectFit: "contain", borderRadius: "50%" }}
              priority
            />
          </Box>

          {/* Heading */}
          <Typography
            variant="h5"
            fontWeight={700}
            sx={{ letterSpacing: "-0.02em", mb: "0.375rem" }}
          >
            Bienvenido
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: "2rem" }}>
            Iniciá sesión para guardar tus forecasts y acceder a tu historial.
          </Typography>

          {/* OAuth buttons */}
          <Box sx={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<GoogleIcon />}
              onClick={handleGoogle}
              sx={{
                py: "0.75rem",
                borderRadius: "0.625rem",
                fontWeight: 500,
                fontSize: "0.9375rem",
                borderColor: "divider",
                color: "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "rgba(99,102,241,0.06)",
                  transform: "translateY(-1px)",
                },
              }}
            >
              Continuar con Google
            </Button>

            <Button
              variant="outlined"
              fullWidth
              startIcon={<GitHubIcon />}
              onClick={handleGitHub}
              sx={{
                py: "0.75rem",
                borderRadius: "0.625rem",
                fontWeight: 500,
                fontSize: "0.9375rem",
                borderColor: "divider",
                color: "text.primary",
                transition: "all 0.15s ease",
                "&:hover": {
                  borderColor: "primary.main",
                  bgcolor: "rgba(99,102,241,0.06)",
                  transform: "translateY(-1px)",
                },
              }}
            >
              Continuar con GitHub
            </Button>
          </Box>

          <Typography
            variant="caption"
            color="text.disabled"
            textAlign="center"
            display="block"
            sx={{ mt: "1.5rem", lineHeight: 1.6 }}
          >
            También podés usar la app sin cuenta —{" "}
            <Box
              component="span"
              onClick={async () => {
                try {
                  await authClient.signIn.anonymous()
                  window.location.href = "/dashboard/dataset"
                } catch {
                  // Si falla el login anónimo, redirige igual — la app funciona sin sesión
                  window.location.href = "/dashboard/dataset"
                }
              }}
              sx={{
                color: "primary.main",
                cursor: "pointer",
                fontWeight: 500,
                "&:hover": { textDecoration: "underline" },
              }}
            >
              entrar como invitado
            </Box>
            . Tus datos no se guardarán entre sesiones.
          </Typography>
        </Box>
      </Box>
    </Box>
  )
}
