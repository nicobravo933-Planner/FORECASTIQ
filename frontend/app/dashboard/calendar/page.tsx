import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export default function CalendarPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Typography variant="h4" color="text.primary" fontWeight={700}>Calendario</Typography>
      <Typography color="text.secondary">Phase 3 — Próximamente.</Typography>
    </Box>
  )
}
