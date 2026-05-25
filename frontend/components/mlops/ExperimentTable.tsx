"use client";

/**
 * ExperimentTable — MLOps Phase 8
 * Displays MLflow experiment runs in a sortable table.
 * Columns: run name, model, freq, horizon, WAPE, MAE, date, Dagshub link, delete.
 */

import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { api } from "@/lib/api";
import { type MlflowRun } from "@/lib/types";

interface ExperimentTableProps {
  runs: MlflowRun[];
  loading: boolean;
  error: string | null;
  onDeleted?: (runId: string) => void;
  /** Called when user clicks "Ver en Forecast" — receives the run's dataset_id */
  onDrillDown?: (datasetId: string) => void;
}

function wapeColor(wape: number | null): "success" | "warning" | "error" | "default" {
  if (wape === null) return "default";
  if (wape < 10) return "success";
  if (wape < 25) return "warning";
  return "error";
}

function formatDate(isoString: string): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return isoString;
  }
}

export function ExperimentTable({ runs, loading, error, onDeleted, onDrillDown }: ExperimentTableProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting]   = useState(false);

  const handleDelete = async () => {
    if (!confirmId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/experiments/${confirmId}`);
      onDeleted?.(confirmId);
    } catch { /* run may not exist remotely */ }
    finally { setDeleting(false); setConfirmId(null); }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: "3rem" }}><CircularProgress size="2rem" /></Box>;
  }
  if (error) {
    return <Typography color="error" sx={{ py: "1.5rem" }}>{error}</Typography>;
  }
  if (runs.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: "1.5rem" }}>
        No hay experimentos registrados aún. Ejecutá un forecast para ver los runs de MLflow.
      </Typography>
    );
  }

  return (
    <>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "0.75rem" }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              {["Run", "Modelo", "Freq", "Horizonte", "WAPE %", "MAE", "Fecha", "Acciones"].map((h) => (
                <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  {h}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {runs.map((run) => (
              <TableRow key={run.run_id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                <TableCell sx={{ fontSize: "0.8125rem", fontFamily: "monospace" }}>
                  {run.run_name || run.run_id.slice(0, 8)}
                </TableCell>

                <TableCell>
                  <Chip label={run.model || "—"} size="small" variant="outlined" sx={{ fontSize: "0.75rem" }} />
                </TableCell>

                <TableCell sx={{ fontSize: "0.8125rem" }}>{run.freq || "—"}</TableCell>
                <TableCell sx={{ fontSize: "0.8125rem" }}>{run.horizon || "—"}</TableCell>

                <TableCell>
                  {run.wape !== null ? (
                    <Chip label={`${run.wape.toFixed(1)}%`} size="small" color={wapeColor(run.wape)}
                      sx={{ fontSize: "0.75rem", fontWeight: 600 }} />
                  ) : (
                    <Typography variant="caption" color="text.disabled">—</Typography>
                  )}
                </TableCell>

                <TableCell sx={{ fontSize: "0.8125rem" }}>
                  {run.mae !== null ? run.mae.toFixed(2) : "—"}
                </TableCell>

                <TableCell sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                  {formatDate(run.start_time)}
                </TableCell>

                <TableCell sx={{ pr: "0.5rem", whiteSpace: "nowrap" }}>
                  {/* Drill-down to Forecast — only when dataset_id is available */}
                  {run.dataset_id && onDrillDown && (
                    <Tooltip title="Ver en Forecast">
                      <IconButton size="small" onClick={() => onDrillDown(run.dataset_id!)}
                        sx={{ color: "primary.main" }}>
                        <ShowChartIcon sx={{ fontSize: "1rem" }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  {run.dagshub_url && (
                    <Tooltip title="Ver en Dagshub">
                      <IconButton size="small" href={run.dagshub_url} target="_blank"
                        rel="noopener noreferrer" component="a">
                        <OpenInNewIcon sx={{ fontSize: "1rem" }} />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Borrar experimento">
                    <IconButton size="small" onClick={() => setConfirmId(run.run_id)}
                      sx={{ color: "text.disabled", "&:hover": { color: "error.main" } }}>
                      <DeleteOutlineIcon sx={{ fontSize: "1rem" }} />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Confirm dialog */}
      <Dialog open={!!confirmId} onClose={() => !deleting && setConfirmId(null)}>
        <DialogTitle>Borrar experimento</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: "0.875rem" }}>
            ¿Estás seguro? Esta acción borra el run <strong>{confirmId?.slice(0, 8)}…</strong> de
            MLflow y no se puede deshacer. En Dagshub quedará marcado como &quot;Deleted&quot;.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmId(null)} disabled={deleting} sx={{ textTransform: "none" }}>
            Cancelar
          </Button>
          <Button onClick={() => void handleDelete()} disabled={deleting} color="error"
            variant="contained" sx={{ textTransform: "none" }}>
            {deleting ? <CircularProgress size="1rem" color="inherit" /> : "Borrar"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
