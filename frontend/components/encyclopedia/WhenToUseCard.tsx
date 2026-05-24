"use client"

/**
 * WhenToUseCard — "¿Cuándo usar este modelo?" card with min requirements table.
 */

import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"
import Box from "@mui/material/Box"
import Chip from "@mui/material/Chip"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Typography from "@mui/material/Typography"

interface Requirement {
  condition: string
  value: string
  met?: boolean  // undefined = neutral
}

interface WhenToUseCardProps {
  model: string
  minObservations: number
  requirements: Requirement[]
  proscons?: { pros: string[]; cons: string[] }
}

export function WhenToUseCard({ model, minObservations, requirements, proscons }: WhenToUseCardProps) {
  return (
    <Box
      sx={{
        my: "1.5rem",
        borderRadius: "0.75rem",
        border: "1px solid",
        borderColor: "divider",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: "1.25rem",
          py: "0.75rem",
          bgcolor: "primary.main",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: "0.9375rem" }}>
          ¿Cuándo usar {model}?
        </Typography>
        <Chip
          label={`Mín. ${minObservations} obs.`}
          size="small"
          sx={{ bgcolor: "rgba(255,255,255,0.2)", color: "#fff", fontWeight: 600, fontSize: "0.75rem" }}
        />
      </Box>

      {/* Requirements table */}
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "action.hover" }}>
            <TableCell sx={{ fontWeight: 600, fontSize: "0.8125rem", color: "text.secondary" }}>Condición</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: "0.8125rem", color: "text.secondary" }}>Requerimiento</TableCell>
            <TableCell sx={{ fontWeight: 600, fontSize: "0.8125rem", color: "text.secondary" }} align="center">Estado</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {requirements.map((r, i) => (
            <TableRow key={i} sx={{ "&:last-child td": { border: 0 } }}>
              <TableCell sx={{ fontSize: "0.8125rem" }}>{r.condition}</TableCell>
              <TableCell sx={{ fontSize: "0.8125rem", fontFamily: "monospace", color: "text.secondary" }}>{r.value}</TableCell>
              <TableCell align="center">
                {r.met === true && <CheckCircleIcon sx={{ fontSize: "1rem", color: "success.main" }} />}
                {r.met === false && <WarningAmberIcon sx={{ fontSize: "1rem", color: "warning.main" }} />}
                {r.met === undefined && <Box sx={{ width: "0.75rem", height: "0.75rem", borderRadius: "50%", bgcolor: "action.disabled", mx: "auto" }} />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Pros / Cons */}
      {proscons && (
        <Box sx={{ display: "flex", gap: 0, borderTop: "1px solid", borderColor: "divider" }}>
          <Box sx={{ flex: 1, p: "0.875rem 1rem", borderRight: "1px solid", borderColor: "divider" }}>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "success.main", mb: "0.375rem" }}>✓ VENTAJAS</Typography>
            {proscons.pros.map((p, i) => (
              <Typography key={i} sx={{ fontSize: "0.8125rem", color: "text.secondary", mb: "0.25rem" }}>• {p}</Typography>
            ))}
          </Box>
          <Box sx={{ flex: 1, p: "0.875rem 1rem" }}>
            <Typography sx={{ fontSize: "0.75rem", fontWeight: 700, color: "error.main", mb: "0.375rem" }}>✗ LIMITACIONES</Typography>
            {proscons.cons.map((c, i) => (
              <Typography key={i} sx={{ fontSize: "0.8125rem", color: "text.secondary", mb: "0.25rem" }}>• {c}</Typography>
            ))}
          </Box>
        </Box>
      )}
    </Box>
  )
}
