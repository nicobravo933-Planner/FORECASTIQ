import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export default function HomePage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        bgcolor: "background.default",
      }}
    >
      <Typography variant="h1" color="primary" fontWeight={700}>
        forecastiq
      </Typography>
      <Typography variant="h5" color="text.secondary">
        Forecasting automatizado con IA · Próximamente
      </Typography>
      <Typography variant="caption" color="text.disabled">
        Phase 0 — Foundation ✓
      </Typography>
    </Box>
  )
}
