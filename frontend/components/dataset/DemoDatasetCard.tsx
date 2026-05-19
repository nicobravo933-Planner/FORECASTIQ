"use client"

/**
 * DemoDatasetCard — placeholder for the "Demo dataset" tab.
 * Phase 9 will wire this to the real 25k-SKU Parquet in Supabase Storage
 * served via DuckDB signed-URL queries.
 *
 * For now: shows what the dataset contains + a "coming soon" badge.
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import StorageIcon from "@mui/icons-material/Storage"
import ScheduleIcon from "@mui/icons-material/Schedule"
import CategoryIcon from "@mui/icons-material/Category"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"

const STATS = [
  { icon: <StorageIcon sx={{ fontSize: "1rem" }} />, label: "25 000 SKUs", sub: "productos únicos" },
  { icon: <ScheduleIcon sx={{ fontSize: "1rem" }} />, label: "3 años diarios", sub: "2022 – 2024" },
  { icon: <CategoryIcon sx={{ fontSize: "1rem" }} />, label: "5 categorías", sub: "Electrónica, Alimentos…" },
  { icon: <TrendingUpIcon sx={{ fontSize: "1rem" }} />, label: "~27 M filas", sub: "Parquet · Snappy" },
]

export function DemoDatasetCard() {
  return (
    <Box
      sx={{
        border: "2px dashed",
        borderColor: "divider",
        borderRadius: "0.75rem",
        p: "2.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.75rem",
        textAlign: "center",
      }}
    >
      {/* Badge */}
      <Chip
        label="Disponible en Fase 9"
        size="small"
        sx={{
          bgcolor: "rgba(99,102,241,0.12)",
          color: "primary.light",
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.04em",
          border: "1px solid rgba(99,102,241,0.25)",
        }}
      />

      {/* Heading */}
      <Box>
        <Typography variant="h6" color="text.primary" fontWeight={700} gutterBottom>
          Dataset demo — Ventas empresa retail
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "32rem", lineHeight: 1.7 }}>
          Un dataset sintético de planificación de demanda con patrones realistas: tendencia,
          estacionalidad anual y semanal, outliers y clustering ABC-XYZ.
          Podrás explorar cualquier SKU sin subir nada.
        </Typography>
      </Box>

      {/* Stats grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "36rem",
        }}
      >
        {STATS.map((s) => (
          <Box
            key={s.label}
            sx={{
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "0.625rem",
              p: "0.875rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.375rem",
              alignItems: "flex-start",
            }}
          >
            <Box sx={{ color: "primary.light", display: "flex", alignItems: "center" }}>
              {s.icon}
            </Box>
            <Typography variant="body2" fontWeight={600} color="text.primary">
              {s.label}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              {s.sub}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        El backend leerá el Parquet desde Supabase Storage vía DuckDB — sin cargar 180 MB en memoria.
      </Typography>
    </Box>
  )
}
