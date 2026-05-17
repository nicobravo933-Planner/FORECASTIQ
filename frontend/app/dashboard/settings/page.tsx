import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export default function SettingsPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Typography variant="h4" color="text.primary" fontWeight={700}>Ajustes</Typography>
      <Typography color="text.secondary">Phase 5 — Próximamente.</Typography>
    </Box>
  )
}
