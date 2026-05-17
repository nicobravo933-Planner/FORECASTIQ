import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export default function ForecastPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Typography variant="h4" color="text.primary" fontWeight={700}>Forecast</Typography>
      <Typography color="text.secondary">Phase 2 — Próximamente.</Typography>
    </Box>
  )
}
