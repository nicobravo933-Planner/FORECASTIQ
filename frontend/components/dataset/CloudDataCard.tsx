"use client"

/**
 * CloudDataCard — placeholder para el tab "Cloud / Data Lake".
 * Fase 13: BigQuery, Snowflake, S3/Parquet.
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import CloudIcon from "@mui/icons-material/Cloud"

const SOURCES = [
  { label: "BigQuery",  hint: "Service account JSON" },
  { label: "Snowflake", hint: "Account + warehouse" },
  { label: "S3 / Parquet", hint: "Bucket + IAM key" },
  { label: "Azure Blob", hint: "Connection string" },
]

export function CloudDataCard() {
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
        gap: "1.5rem",
        textAlign: "center",
      }}
    >
      <Chip
        label="Fase 13 — Roadmap"
        size="small"
        sx={{
          bgcolor: "rgba(6,182,212,0.10)",
          color: "secondary.main",
          fontWeight: 600,
          fontSize: "0.75rem",
          border: "1px solid rgba(6,182,212,0.22)",
        }}
      />
      <CloudIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
      <Box>
        <Typography variant="h6" color="text.primary" fontWeight={700} gutterBottom>
          Cloud / Data Lake
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "30rem", lineHeight: 1.7 }}>
          Conectá BigQuery, Snowflake, S3 o Azure Blob directamente. Las credenciales se usan
          para una única query y se descartan en memoria — nunca se persisten.
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", justifyContent: "center" }}>
        {SOURCES.map((s) => (
          <Box
            key={s.label}
            sx={{
              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.2rem",
              bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
              borderRadius: "0.5rem", px: "0.875rem", py: "0.5rem",
            }}
          >
            <Typography variant="body2" fontWeight={500} color="text.secondary">{s.label}</Typography>
            <Typography variant="caption" color="text.disabled">{s.hint}</Typography>
          </Box>
        ))}
      </Box>
    </Box>
  )
}
