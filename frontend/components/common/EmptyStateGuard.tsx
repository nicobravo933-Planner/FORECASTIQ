"use client"

/**
 * EmptyStateGuard — guarda reutilizable para páginas que requieren contexto.
 *
 * Muestra un empty state centrado con ícono, título, descripción y CTA
 * cuando `condition` es true. Renderiza `children` en caso contrario.
 *
 * Uso:
 *   <EmptyStateGuard
 *     condition={!datasetId}
 *     title="Necesitás un dataset"
 *     description="Subí un CSV para empezar."
 *     ctaLabel="Ir a Datos"
 *     ctaHref="/dashboard/data"
 *   >
 *     {children}
 *   </EmptyStateGuard>
 */

import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Paper from "@mui/material/Paper"
import Typography from "@mui/material/Typography"
import StorageIcon from "@mui/icons-material/Storage"
import Link from "next/link"
import type { SvgIconProps } from "@mui/material/SvgIcon"

interface EmptyStateGuardProps {
  /** Cuando true muestra el empty state en lugar de los children */
  condition: boolean
  title: string
  description: string
  ctaLabel: string
  ctaHref: string
  /** CTA secundario opcional */
  secondaryLabel?: string
  secondaryHref?: string
  /** Ícono MUI opcional — default StorageIcon */
  Icon?: React.ComponentType<SvgIconProps>
  children?: React.ReactNode
}

export function EmptyStateGuard({
  condition,
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryLabel,
  secondaryHref,
  Icon = StorageIcon,
  children,
}: EmptyStateGuardProps) {
  if (!condition) return <>{children}</>

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        px: "1rem",
      }}
    >
      <Paper
        variant="outlined"
        sx={{
          p: { xs: "2rem", sm: "3rem" },
          maxWidth: "26rem",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          textAlign: "center",
          borderStyle: "dashed",
          borderRadius: "1rem",
          bgcolor: "rgba(255,255,255,0.75)",
          backdropFilter: "blur(0.5rem)",
        }}
      >
        {/* Ícono */}
        <Box
          sx={{
            width: "4rem",
            height: "4rem",
            borderRadius: "1rem",
            bgcolor: "rgba(59,130,246,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon sx={{ fontSize: "2rem", color: "primary.main" }} />
        </Box>

        {/* Texto */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {description}
          </Typography>
        </Box>

        {/* CTAs */}
        <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}>
          <Button variant="contained" component={Link} href={ctaHref} sx={{ fontWeight: 600 }}>
            {ctaLabel}
          </Button>
          {secondaryLabel && secondaryHref && (
            <Button variant="outlined" component={Link} href={secondaryHref} color="inherit">
              {secondaryLabel}
            </Button>
          )}
        </Box>
      </Paper>
    </Box>
  )
}
