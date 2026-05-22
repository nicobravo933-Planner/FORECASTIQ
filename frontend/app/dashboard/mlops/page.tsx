"use client";

/**
 * /dashboard/mlops — MLOps Phase 8
 * Integrates ExperimentTable + DriftCard + MLflowLink.
 * Fetches experiment runs from GET /api/experiments.
 * Fetches drift summary from GET /api/drift/{dataset_id} when a dataset_id is selected.
 */

import RefreshIcon from "@mui/icons-material/Refresh";
import ScienceIcon from "@mui/icons-material/Science";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DriftCard } from "@/components/mlops/DriftCard";
import { ExperimentTable } from "@/components/mlops/ExperimentTable";
import { MLflowLink } from "@/components/mlops/MLflowLink";
import { WapeTrendChart } from "@/components/mlops/WapeTrendChart";
import { api, ApiError } from "@/lib/api";
import { type DriftSummary, type MlflowRun } from "@/lib/types";

export default function MlopsPage() {
  // ── Experiment runs ────────────────────────────────────────────
  const [runs, setRuns] = useState<MlflowRun[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsError, setRunsError] = useState<string | null>(null);

  // ── Drift ──────────────────────────────────────────────────────
  const [selectedDatasetId, setSelectedDatasetId] = useState<string>("");
  const [driftSummary, setDriftSummary] = useState<DriftSummary | null>(null);
  const [driftLoading, setDriftLoading] = useState(false);
  const [driftError, setDriftError] = useState<string | null>(null);

  // Unique dataset IDs extracted from runs (for the selector)
  const datasetIds = useMemo<string[]>(() => {
    const ids = runs.map((r) => r.dataset_id).filter(Boolean);
    return [...new Set(ids)];
  }, [runs]);

  // Latest Dagshub URL (from the most recent run that has one)
  const dagshabUrl = useMemo(
    () => runs.find((r) => r.dagshub_url)?.dagshub_url ?? null,
    [runs],
  );

  // ── Fetch runs ─────────────────────────────────────────────────
  const fetchRuns = useCallback(async () => {
    setRunsLoading(true);
    setRunsError(null);
    try {
      const data = await api.get<MlflowRun[]>("/api/experiments");
      setRuns(data);
      // Auto-select the first dataset with a run
      if (data.length > 0 && !selectedDatasetId) {
        const firstId = data.find((r) => r.dataset_id)?.dataset_id ?? "";
        setSelectedDatasetId(firstId);
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al cargar experimentos.";
      setRunsError(msg);
    } finally {
      setRunsLoading(false);
    }
  }, [selectedDatasetId]);

  // ── Fetch drift summary ────────────────────────────────────────
  const fetchDrift = useCallback(async (datasetId: string) => {
    if (!datasetId) return;
    setDriftLoading(true);
    setDriftError(null);
    try {
      const data = await api.get<DriftSummary>(`/api/drift/${datasetId}`);
      setDriftSummary(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al cargar reporte de drift.";
      setDriftError(msg);
      setDriftSummary(null);
    } finally {
      setDriftLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRuns();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedDatasetId) void fetchDrift(selectedDatasetId);
  }, [selectedDatasetId, fetchDrift]);

  return (
    <Box>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: "1.5rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <ScienceIcon color="primary" sx={{ fontSize: "1.75rem" }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>
              MLOps
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Experimentos MLflow · Detección de drift · Dagshub
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <MLflowLink dagshabUrl={dagshabUrl} datasetId={selectedDatasetId} />
          <Tooltip title="Actualizar">
            <IconButton onClick={() => void fetchRuns()} disabled={runsLoading} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Experiment table */}
      <Typography variant="subtitle1" fontWeight={600} sx={{ mb: "0.75rem" }}>
        Historial de experimentos
      </Typography>

      <ExperimentTable runs={runs} loading={runsLoading} error={runsError} />

      {/* Drift section */}
      <Box sx={{ mt: "2rem", mb: "0.75rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Reportes de Drift
        </Typography>

        {datasetIds.length > 0 && (
          <Select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            size="small"
            displayEmpty
            sx={{ fontSize: "0.8125rem", minWidth: "14rem" }}
          >
            <MenuItem value="" disabled>
              Seleccionar dataset
            </MenuItem>
            {datasetIds.map((id) => (
              <MenuItem key={id} value={id} sx={{ fontSize: "0.8125rem" }}>
                {id.slice(0, 16)}…
              </MenuItem>
            ))}
          </Select>
        )}
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <DriftCard
            summary={driftSummary}
            loading={driftLoading}
            error={driftError}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          {/* WAPE trend chart — uses already-loaded runs, no extra fetch */}
          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "0.75rem",
              p: "1.25rem",
              height: "20rem",
              maxHeight: "20rem",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "0.75rem", flexShrink: 0 }}>
              Evolución WAPE por run
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <WapeTrendChart runs={runs} />
            </Box>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
