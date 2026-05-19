"use client"

/**
 * ConnectDbCard — placeholder for the "Connect DB" tab.
 * Backlog enterprise: supports PostgreSQL, BigQuery, Snowflake, S3/Parquet.
 * Connection strings are EPHEMERAL — never persisted, never logged.
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import StorageRoundedIcon from "@mui/icons-material/StorageRounded"
import ShieldIcon from "@mui/icons-material/Shield"
import LinkIcon from "@mui/icons-material/Link"
import CloudIcon from "@mui/icons-material/Cloud"

const SUPPORTED = [
  { icon: <StorageRoundedIcon sx={{ fontSize: "1.25rem" }} />, label: "PostgreSQL" },
  { icon: <CloudIcon sx={{ fontSize: "1.25rem" }} />, label: "BigQuery" },
  { icon: <CloudIcon sx={{ fontSize: "1.25rem" }} />, label: "Snowflake" },
  { icon: <LinkIcon sx={{ fontSize: "1.25rem" }} />, label: "S3 / Parquet" },
]

export function ConnectDbCard() {
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
        label="Backlog enterprise"
        size="small"
        sx={{
          bgcolor: "rgba(6,182,212,0.10)",
          color: "secondary.main",
          fontWeight: 600,
          fontSize: "0.75rem",
          letterSpacing: "0.04em",
          border: "1px solid rgba(6,182,212,0.22)",
        }}
      />

      {/* Heading */}
      <Box>
        <Typography variant="h6" color="text.primary" fontWeight={700} gutterBottom>
          Conectar base de datos propia
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: "32rem", lineHeight: 1.7 }}>
          Ingresá tu connection string y una query SQL — el backend la ejecuta, descarta
          la conexión de inmediato y nunca persiste tus credenciales.
        </Typography>
      </Box>

      {/* Supported engines */}
      <Box sx={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", justifyContent: "center" }}>
        {SUPPORTED.map((db) => (
          <Box
            key={db.label}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "0.5rem",
              px: "0.875rem",
              py: "0.5rem",
              color: "text.secondary",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", color: "secondary.main" }}>
              {db.icon}
            </Box>
            <Typography variant="body2" fontWeight={500}>
              {db.label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Security note */}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-start",
          gap: "0.625rem",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "0.625rem",
          px: "1rem",
          py: "0.75rem",
          maxWidth: "32rem",
          textAlign: "left",
        }}
      >
        <ShieldIcon sx={{ fontSize: "1rem", color: "success.main", mt: "0.125rem", flexShrink: 0 }} />
        <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
          <strong>Seguridad:</strong> la connection string nunca se guarda en Supabase, nunca aparece
          en logs de OTel ni en Sentry. Se usa para una única query SELECT y se descarta en memoria.
          Solo se aceptan queries de lectura — no DDL ni DML.
        </Typography>
      </Box>
    </Box>
  )
}
