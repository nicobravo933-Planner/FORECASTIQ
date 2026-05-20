"use client";

/**
 * DriftCard — MLOps Phase 8
 * Shows Evidently drift detection results for a dataset.
 * Green = no drift, Yellow = borderline, Red = drift detected.
 * Also shows a link to the full HTML Evidently report.
 */

import AssessmentIcon from "@mui/icons-material/Assessment";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { type DriftSummary } from "@/lib/types";

interface DriftCardProps {
  summary: DriftSummary | null;
  loading: boolean;
  error: string | null;
}

/** Returns badge config based on number of drift reports available. */
function driftStatus(summary: DriftSummary | null): {
  label: string;
  color: "success" | "warning" | "error" | "default";
  icon: React.ReactNode;
} {
  if (!summary || summary.reports.length === 0) {
    return {
      label: "Sin reportes",
      color: "default",
      icon: <AssessmentIcon fontSize="small" />,
    };
  }
  // Heuristic: if there is only one report (latest), assume no drift checked yet
  if (summary.reports.length === 1) {
    return {
      label: "1 reporte disponible",
      color: "success",
      icon: <CheckCircleOutlineIcon fontSize="small" />,
    };
  }
  if (summary.reports.length <= 3) {
    return {
      label: `${summary.reports.length} reportes`,
      color: "warning",
      icon: <WarningAmberIcon fontSize="small" />,
    };
  }
  return {
    label: `${summary.reports.length} reportes`,
    color: "error",
    icon: <ErrorOutlineIcon fontSize="small" />,
  };
}

export function DriftCard({ summary, loading, error }: DriftCardProps) {
  const status = driftStatus(summary);

  return (
    <Card variant="outlined" sx={{ borderRadius: "0.75rem", height: "100%" }}>
      <CardContent sx={{ p: "1.25rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "0.75rem" }}>
          <AssessmentIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            Data Drift (Evidently)
          </Typography>
        </Box>

        <Divider sx={{ mb: "1rem" }} />

        {loading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: "2rem" }}>
            <CircularProgress size="1.5rem" />
          </Box>
        )}

        {error && !loading && (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        )}

        {!loading && !error && (
          <>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", mb: "1rem" }}>
              <Tooltip title="Reportes Evidently generados para este dataset">
                <Chip
                  icon={status.icon as React.ReactElement}
                  label={status.label}
                  color={status.color}
                  variant="outlined"
                  size="small"
                />
              </Tooltip>
            </Box>

            {summary && summary.reports.length > 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Últimos reportes:
                </Typography>
                {summary.reports.slice(0, 5).map((r) => (
                  <Button
                    key={r.name}
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size="small"
                    variant="text"
                    sx={{ justifyContent: "flex-start", fontSize: "0.75rem", px: "0.25rem" }}
                  >
                    {r.name}
                  </Button>
                ))}
              </Box>
            )}

            {summary && !summary.latest_url && (
              <Typography variant="body2" color="text.secondary">
                No hay reportes de drift generados. Ejecutá un forecast sobre este dataset.
              </Typography>
            )}

            {summary?.latest_url && (
              <Button
                href={summary.latest_url}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                sx={{ mt: "1rem", fontSize: "0.8125rem" }}
                startIcon={<AssessmentIcon />}
              >
                Ver reporte completo
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
