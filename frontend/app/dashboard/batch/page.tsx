"use client";

/**
 * /dashboard/batch — Scale Engine Phase 9
 *
 * Playground para probar el endpoint POST /api/batch/forecast.
 * Permite:
 *   - Pegar un panel JSON o cargar un CSV simple
 *   - Configurar freq / horizon / columnas / segmentación ABC-XYZ
 *   - Ver el resultado: n_series, duration_s, model_used y tabla de predicciones
 *
 * No usa Celery — el endpoint es síncrono (StatsForecast paralleliza internamente).
 */

import BarChartIcon from "@mui/icons-material/BarChart";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { type BatchForecastResponse } from "@/lib/types";

// ── Demo payload ─────────────────────────────────────────────────────────────

const DEMO_PAYLOAD = JSON.stringify(
  {
    records: [
      ...Array.from({ length: 26 }, (_, i) => ({
        unique_id: "SKU-A",
        ds: new Date(2023, 0, 2 + i * 7).toISOString().slice(0, 10),
        y: Math.round(100 + 20 * Math.sin((i * Math.PI) / 13) + Math.random() * 10),
        cluster_abc: "A",
        cluster_xyz: "X",
      })),
      ...Array.from({ length: 26 }, (_, i) => ({
        unique_id: "SKU-B",
        ds: new Date(2023, 0, 2 + i * 7).toISOString().slice(0, 10),
        y: Math.round(40 + 10 * Math.sin((i * Math.PI) / 13) + Math.random() * 15),
        cluster_abc: "B",
        cluster_xyz: "Z",
      })),
    ],
    freq: "W",
    horizon: 8,
    cluster_abc_col: "cluster_abc",
    cluster_xyz_col: "cluster_xyz",
  },
  null,
  2,
);

// ── Helpers ───────────────────────────────────────────────────────────────────

function wapeColor(wape: number): "success" | "warning" | "error" {
  if (wape < 0.1) return "success";
  if (wape < 0.25) return "warning";
  return "error";
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BatchPage() {
  // Form state
  const [rawJson, setRawJson] = useState<string>(DEMO_PAYLOAD);
  const [freq, setFreq] = useState<string>("W");
  const [horizon, setHorizon] = useState<number>(8);
  const [dateCol, setDateCol] = useState<string>("ds");
  const [targetCol, setTargetCol] = useState<string>("y");
  const [idCol, setIdCol] = useState<string>("unique_id");
  const [abcCol, setAbcCol] = useState<string>("cluster_abc");
  const [xyzCol, setXyzCol] = useState<string>("cluster_xyz");

  // Result state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BatchForecastResponse | null>(null);

  const handleRun = async () => {
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      // Parse JSON — puede fallar si el usuario pegó algo inválido
      let records: unknown[];
      try {
        const parsed = JSON.parse(rawJson) as { records?: unknown[] } | unknown[];
        records = Array.isArray(parsed) ? parsed : ((parsed as { records?: unknown[] }).records ?? []);
      } catch {
        setError("JSON inválido. Revisá el formato del panel (array de objetos o { records: [...] }).");
        setLoading(false);
        return;
      }

      const body = {
        records,
        freq,
        horizon,
        date_col: dateCol,
        target_col: targetCol,
        id_col: idCol,
        cluster_abc_col: abcCol.trim() || null,
        cluster_xyz_col: xyzCol.trim() || null,
      };

      const data = await api.post<BatchForecastResponse>("/api/batch/forecast", body);
      setResult(data);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Error al llamar al endpoint.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Preview: unique predictions for display (cap at 200 rows)
  const previewRows = result?.predictions.slice(0, 200) ?? [];
  const hasMore = (result?.predictions.length ?? 0) > 200;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", mb: "1.5rem" }}>
        <BarChartIcon color="primary" sx={{ fontSize: "1.75rem" }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            Batch Forecast
          </Typography>
          <Typography variant="body2" color="text.secondary">
            StatsForecast vectorizado · POST /api/batch/forecast · Fase 9
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: "1.5rem" }}>
        {/* Left: configuración */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "0.75rem" }}>
              Parámetros del forecast
            </Typography>

            <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {/* Frecuencia */}
              <FormControl size="small" fullWidth>
                <InputLabel>Frecuencia</InputLabel>
                <Select
                  value={freq}
                  label="Frecuencia"
                  onChange={(e) => setFreq(e.target.value)}
                >
                  <MenuItem value="D">Diario (D)</MenuItem>
                  <MenuItem value="W">Semanal (W)</MenuItem>
                  <MenuItem value="ME">Mensual (ME)</MenuItem>
                  <MenuItem value="QE">Trimestral (QE)</MenuItem>
                </Select>
              </FormControl>

              {/* Horizon */}
              <TextField
                label="Horizon (períodos)"
                type="number"
                size="small"
                value={horizon}
                onChange={(e) => setHorizon(Math.max(1, parseInt(e.target.value) || 1))}
                inputProps={{ min: 1, max: 365 }}
              />

              {/* Columnas */}
              <TextField
                label="Columna fecha"
                size="small"
                value={dateCol}
                onChange={(e) => setDateCol(e.target.value)}
              />
              <TextField
                label="Columna target"
                size="small"
                value={targetCol}
                onChange={(e) => setTargetCol(e.target.value)}
              />
              <TextField
                label="Columna ID serie"
                size="small"
                value={idCol}
                onChange={(e) => setIdCol(e.target.value)}
              />
              <Box /> {/* spacer */}

              {/* Segmentación opcional */}
              <Tooltip title="Dejar vacío para modelo único (sin segmentación ABC-XYZ)">
                <TextField
                  label="Columna ABC (opcional)"
                  size="small"
                  value={abcCol}
                  onChange={(e) => setAbcCol(e.target.value)}
                  placeholder="cluster_abc"
                />
              </Tooltip>
              <Tooltip title="Dejar vacío para modelo único (sin segmentación XYZ)">
                <TextField
                  label="Columna XYZ (opcional)"
                  size="small"
                  value={xyzCol}
                  onChange={(e) => setXyzCol(e.target.value)}
                  placeholder="cluster_xyz"
                />
              </Tooltip>
            </Box>
          </Paper>

          {/* JSON panel input */}
          <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "0.5rem" }}>
              Panel JSON
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: "0.75rem" }}>
              Array de registros: <code>[{"{unique_id, ds, y, ...}"}]</code> o <code>{"{records: [...]}"}</code>
            </Typography>
            <TextField
              multiline
              minRows={10}
              maxRows={20}
              fullWidth
              size="small"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              inputProps={{ style: { fontFamily: "monospace", fontSize: "0.75rem" } }}
            />
          </Paper>

          <Button
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
            disabled={loading}
            onClick={() => void handleRun()}
            sx={{ fontWeight: 600 }}
          >
            {loading ? "Ejecutando…" : "Ejecutar Batch Forecast"}
          </Button>

          {error && (
            <Alert severity="error" sx={{ fontSize: "0.875rem" }}>
              {error}
            </Alert>
          )}
        </Box>

        {/* Right: resultado */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {!result && !loading && (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: "0.75rem",
                p: "2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "12rem",
                color: "text.disabled",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              <BarChartIcon sx={{ fontSize: "2.5rem" }} />
              <Typography variant="body2">
                Configurá los parámetros y ejecutá el forecast para ver los resultados.
              </Typography>
            </Paper>
          )}

          {loading && (
            <Paper
              variant="outlined"
              sx={{
                borderRadius: "0.75rem",
                p: "2rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "12rem",
                gap: "1rem",
              }}
            >
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Corriendo StatsForecast…
              </Typography>
            </Paper>
          )}

          {result && (
            <>
              {/* Summary cards */}
              <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "0.75rem" }}>
                  Resultado
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", mb: "0.75rem" }}>
                  <Chip label={`${result.n_series} series`} size="small" color="primary" />
                  <Chip label={`Horizon: ${result.horizon}`} size="small" />
                  <Chip label={`Freq: ${result.freq}`} size="small" />
                  <Chip
                    label={`${result.duration_s.toFixed(2)}s`}
                    size="small"
                    color={result.duration_s < 5 ? "success" : "warning"}
                  />
                </Box>
                <Typography variant="caption" color="text.secondary" display="block">
                  Modelo: <strong>{result.model_used}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Total predicciones: {result.predictions.length.toLocaleString("es-AR")}
                </Typography>
              </Paper>

              {/* Predictions table */}
              <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider" }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Predicciones
                    {hasMore && (
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: "0.5rem" }}>
                        (mostrando primeras 200 de {result.predictions.length})
                      </Typography>
                    )}
                  </Typography>
                </Box>
                <TableContainer sx={{ maxHeight: "28rem" }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>ID Serie</TableCell>
                        <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem" }}>Fecha</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600, fontSize: "0.75rem" }}>
                          Predicción
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewRows.map((row, idx) => (
                        <TableRow key={idx} hover>
                          <TableCell sx={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                            {row.unique_id}
                          </TableCell>
                          <TableCell sx={{ fontSize: "0.75rem" }}>{row.ds}</TableCell>
                          <TableCell align="right" sx={{ fontSize: "0.75rem", fontWeight: 500 }}>
                            {row.predicted.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
