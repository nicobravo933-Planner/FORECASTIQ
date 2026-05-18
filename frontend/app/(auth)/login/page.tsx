"use client"

/**
 * Login page — Google and GitHub OAuth buttons.
 * Redirects to /dashboard/dataset after successful login.
 */

import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Card from "@mui/material/Card"
import CardContent from "@mui/material/CardContent"
import Divider from "@mui/material/Divider"
import Typography from "@mui/material/Typography"
import GoogleIcon from "@mui/icons-material/Google"
import GitHubIcon from "@mui/icons-material/GitHub"
import { signIn } from "@/lib/auth-client"

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
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
      }}
    >
      <Card sx={{ width: "100%", maxWidth: "24rem", borderRadius: "1rem" }} elevation={3}>
        <CardContent sx={{ p: "2.5rem" }}>
          {/* Logo */}
          <Box sx={{ textAlign: "center", mb: "2rem" }}>
            <Typography variant="h5" color="primary" fontWeight={700} letterSpacing="-0.03em">
              forecastiq
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
              Forecasting con IA para tus ventas
            </Typography>
          </Box>

          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: "1.5rem" }}>
            Iniciá sesión para guardar tus forecasts y acceder a tu historial
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
                borderRadius: "0.5rem",
                textTransform: "none",
                fontWeight: 500,
                borderColor: "divider",
                color: "text.primary",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
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
                borderRadius: "0.5rem",
                textTransform: "none",
                fontWeight: 500,
                borderColor: "divider",
                color: "text.primary",
                "&:hover": { borderColor: "primary.main", bgcolor: "action.hover" },
              }}
            >
              Continuar con GitHub
            </Button>
          </Box>

          <Divider sx={{ my: "1.5rem" }} />

          <Typography variant="caption" color="text.disabled" textAlign="center" display="block">
            También podés usar la app sin cuenta — tus datos no se guardarán entre sesiones.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  )
}
