import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"

export default function ChatPage() {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <Typography variant="h4" color="text.primary" fontWeight={700}>Chat IA</Typography>
      <Typography color="text.secondary">Phase 4 — Próximamente.</Typography>
    </Box>
  )
}
