"use client";

/**
 * /dashboard/batch — Forecast vectorizado multi-serie.
 *
 * Dos modos:
 *   1. "Dataset activo" (default) — lee appStore, envía dataset_id al backend
 *      vía POST /api/batch/forecast-dataset. El backend descarga el CSV y corre
 *      StatsForecast. El usuario sólo elige id_col (si es multi-serie), freq y horizon.
 *
 *   2. "Panel JSON" (avanzado, colapsable) — el textarea original para paste manual
 *      o integración programática. Llama a POST /api/batch/forecast.
 *
 * Drill-down: clic en una fila → navega a Forecast con esa serie pre-seleccionada.
 */

import BarChartIcon from "@mui/icons-material/BarChart";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DatasetLinkedIcon from "@mui/icons-material/DatasetLinked";
import CodeIcon from "@mui/icons-material/Code";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import DownloadIcon from "@mui/icons-material/Download";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";
import { appStore } from "@/lib/appStore";
import { type BatchForecastResponse } from "@/lib/types";

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  { value: "D",  label: "Diaria" },
  { value: "W",  label: "Semanal" },
  { value: "M",  label: "Mensual" },
  { value: "Q",  label: "Trimestral" },
];

const FREQ_MAX: Record<string, number> = { D: 90, W: 52, M: 24, Q: 8 };

// Demo payload for advanced mode
const DEMO_PAYLOAD = JSON.stringify(
  {
    records: [
      ...Array.from({ length: 24 }, (_, i) => ({
        unique_id: "SKU-A",
        ds: new Date(2023, i % 12, 1).toISOString().slice(0, 10),
        y: Math.round(100 + 20 * Math.sin((i * Math.PI) / 12) + Math.random() * 10),
      })),
      ...Array.from({ length: 24 }, (_, i) => ({
        unique_id: "SKU-B",
        ds: new Date(2023, i % 12, 1).toISOString().slice(0, 10),
        y: Math.round(40 + 10 * Math.sin((i * Math.PI) / 12) + Math.random() * 15),
      })),
    ],
    freq: "M",
    horizon: 6,
  },
  null,
  2,
);

// ── Types ─────────────────────────────────────────────────────────────────────

interface ColumnInfo {
  name: string;
  dtype: "datetime" | "numeric" | "text";
  sample_values: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function seriesCount(predictions: BatchForecastResponse["predictions"]): number {
  return new Set(predictions.map((p) => p.unique_id)).size;
}

function downloadCsv(predictions: BatchForecastResponse["predictions"], filename: string) {
  const header = "unique_id,ds,predicted";
  const rows = predictions.map((p) => `${p.unique_id},${p.ds},${p.predicted}`);
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function BatchPage() {
  const router = useRouter();

  // ── Dataset activo ──────────────────────────────────────────────────────────
  const [datasetId, setDatasetId]   = useState<string>("");
  const [dsFilename, setDsFilename] = useState<string>("");
  const [columns, setColumns]       = useState<ColumnInfo[]>([]);
  const [loadingCols, setLoadingCols] = useState(false);

  // Parámetros para modo dataset
  const [dateCol, setDateCol]     = useState<string>("");
  const [targetCol, setTargetCol] = useState<string>("");
  const [idCol, setIdCol]         = useState<string>("");     // vacío = serie única
  const [freq, setFreq]           = useState<string>("M");
  const [horizon, setHorizon]     = useState<number>(12);

  // ── Modo avanzado (JSON) ────────────────────────────────────────────────────
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [rawJson, setRawJson]           = useState<string>(DEMO_PAYLOAD);
  const [jsonDateCol, setJsonDateCol]   = useState("ds");
  const [jsonTargetCol, setJsonTargetCol] = useState("y");
  const [jsonIdCol, setJsonIdCol]       = useState("unique_id");
  const [jsonFreq, setJsonFreq]         = useState("W");
  const [jsonHorizon, setJsonHorizon]   = useState(8);

  // ── Resultado ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<BatchForecastResponse | null>(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [mode, setMode] = useState<"dataset" | "json">("dataset");

  // ── Cargar dataset activo al montar ────────────────────────────────────────
  useEffect(() => {
    const id      = appStore.getActiveDatasetId();
    const dateC   = appStore.getActiveDateCol();
    const targetC = appStore.getActiveTargetCol();
    const freqS   = appStore.getActiveFreq() ?? "M";

    if (!id) return;
    setDatasetId(id);
    setFreq(freqS);
    if (dateC) setDateCol(dateC);
    if (targetC) setTargetCol(targetC);

    // Cargar preview de columnas
    setLoadingCols(true);
    api.get<{ columns: ColumnInfo[]; total_rows: number; dataset_id: string; rows: unknown[] }>(
      `/api/datasets/${id}/preview`
    )
      .then((res) => {
        setColumns(res.columns);
        // Auto-selección si las columnas guardadas no están en el preview
        if (!dateC || !res.columns.find((c) => c.name === dateC)) {
          const dt = res.columns.find((c) => c.dtype === "datetime");
          if (dt) setDateCol(dt.name);
        }
        if (!targetC || !res.columns.find((c) => c.name === targetC)) {
          const num = res.columns.find((c) => c.dtype === "numeric");
          if (num) setTargetCol(num.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCols(false));

    // Intentar obtener el filename
    const sessionIds = typeof window !== "undefined"
      ? localStorage.getItem("fiq_session_datasets") ?? ""
      : "";
    const ids = sessionIds ? encodeURIComponent(
      JSON.parse(sessionIds).map((d: { dataset_id: string }) => d.dataset_id).join(",")
    ) : "";
    const url = ids ? `/api/datasets/?session_ids=${ids}` : "/api/datasets/";
    api.get<{ datasets: { dataset_id: string; filename: string }[] }>(url)
      .then((res) => {
        const ds = res.datasets.find((d) => d.dataset_id === id);
        if (ds) setDsFilename(ds.filename);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ejecutar en modo dataset ────────────────────────────────────────────────
  const handleRunDataset = async () => {
    if (!datasetId || !dateCol || !targetCol) {
      setError("Configurá las columnas de fecha y valor antes de ejecutar.");
      return;
    }
    setError(null); setResult(null); setFilterSeries(""); setLoading(true);
    try {
      const body = {
        dataset_id: datasetId,
        date_col:   dateCol,
        target_col: targetCol,
        id_col:     idCol || null,
        freq,
        horizon,
      };
      const data = await api.post<BatchForecastResponse>("/api/batch/forecast-dataset", body);
      setResult(data);
      setMode("dataset");
      setPaginationModel({ page: 0, pageSize: 25 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al ejecutar el forecast.");
    } finally { setLoading(false); }
  };

  // ── Ejecutar en modo JSON ───────────────────────────────────────────────────
  const handleRunJson = async () => {
    setError(null); setResult(null); setFilterSeries(""); setLoading(true);
    try {
      let records: unknown[];
      try {
        const parsed = JSON.parse(rawJson) as { records?: unknown[] } | unknown[];
        records = Array.isArray(parsed)
          ? parsed
          : ((parsed as { records?: unknown[] }).records ?? []);
      } catch {
        setError("JSON inválido. Revisá el formato (array de objetos o { records: [...] }).");
        setLoading(false);
        return;
      }
      const body = {
        records,
        freq: jsonFreq,
        horizon: jsonHorizon,
        date_col:   jsonDateCol,
        target_col: jsonTargetCol,
        id_col:     jsonIdCol,
      };
      const data = await api.post<BatchForecastResponse>("/api/batch/forecast", body);
      setResult(data);
      setMode("json");
      setPaginationModel({ page: 0, pageSize: 25 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al llamar al endpoint.");
    } finally { setLoading(false); }
  };

  // ── Drill-down: navegar a Forecast con la serie seleccionada ───────────────
  // Passes unique_id via sessionStorage so ForecastPage can pre-filter
  const handleDrillDown = (uniqueId: string) => {
    if (mode === "dataset" && datasetId) {
      appStore.setActiveDataset(datasetId, dateCol, targetCol, freq);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("fiq_batch_drilldown_id", uniqueId);
      }
      router.push("/dashboard/forecast");
    }
  };

  // ── Rows for DataGrid — add stable id ────────────────────────────────────
  const allSeries = result
    ? [...new Set(result.predictions.map((p) => p.unique_id))].sort()
    : [];
  const gridRows = result
    ? result.predictions.map((p, idx) => ({ ...p, id: idx }))
    : [];

  // ── DataGrid column definitions ───────────────────────────────────────────
  const gridCols: GridColDef[] = [
    ...(allSeries.length > 1
      ? [{
          field: "unique_id",
          headerName: "ID Serie",
          flex: 1,
          minWidth: 120,
          renderCell: (params: GridRenderCellParams) => (
            <Typography
              variant="body2"
              sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
              {params.value as string}
            </Typography>
          ),
        } as GridColDef]
      : []),
    { field: "ds",        headerName: "Fecha",      flex: 1, minWidth: 110 },
    {
      field: "predicted",
      headerName: "Predicción",
      flex: 1,
      minWidth: 110,
      type: "number",
      align: "right",
      headerAlign: "right",
      renderCell: (params: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
          {(params.value as number).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
        </Typography>
      ),
    },
    ...(mode === "dataset"
      ? [{
          field: "__actions",
          headerName: "",
          width: 130,
          sortable: false,
          filterable: false,
          disableColumnMenu: true,
          renderCell: (params: GridRenderCellParams) => (
            <Tooltip title="Ver esta serie en Forecast">
              <Button
                size="small"
                variant="outlined"
                startIcon={<ShowChartIcon sx={{ fontSize: "0.75rem !important" }} />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDrillDown(params.row.unique_id as string);
                }}
                sx={{ textTransform: "none", fontSize: "0.6875rem", py: "0.125rem" }}>
                Forecast →
              </Button>
            </Tooltip>
          ),
        } as GridColDef]
      : []),
  ];

  const numericCols = columns.filter((c) => c.dtype === "numeric");
  const datetimeCols = columns.filter((c) => c.dtype === "datetime" || c.dtype === "text");
  const textCols = columns.filter((c) => c.dtype === "text");
  const maxHorizon = FREQ_MAX[freq] ?? 24;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <BarChartIcon color="primary" sx={{ fontSize: "1.75rem" }} />
          <Box>
            <Typography variant="h5" fontWeight={700}>Batch Forecast</Typography>
            <Typography variant="body2" color="text.secondary">
              Forecast vectorizado multi-serie · StatsForecast (Nixtla) · sin Celery
            </Typography>
          </Box>
        </Box>
        {result && (
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />}
            onClick={() => downloadCsv(result.predictions, `batch_forecast_${new Date().toISOString().slice(0,10)}.csv`)}
            sx={{ textTransform: "none" }}>
            Exportar CSV
          </Button>
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "22rem 1fr" }, gap: "1.25rem", alignItems: "start" }}>

        {/* ── Panel izquierdo: configuración ──────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Modo Dataset activo */}
          <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "1rem" }}>
              <DatasetLinkedIcon sx={{ fontSize: "1.125rem", color: "primary.main" }} />
              <Typography variant="subtitle2" fontWeight={600}>Dataset activo</Typography>
            </Box>

            {!datasetId ? (
              <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>
                No hay dataset activo. Subí un archivo o conectá una DB desde{" "}
                <strong>Conectar Datos</strong>, luego volvé aquí.
                <Button size="small" href="/dashboard/dataset"
                  sx={{ textTransform: "none", mt: "0.5rem", display: "block" }}>
                  Ir a Conectar Datos →
                </Button>
              </Alert>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                {/* Filename */}
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                  <Chip label={dsFilename || datasetId.slice(0, 12) + "…"} size="small"
                    color="primary" variant="outlined"
                    sx={{ fontFamily: "monospace", fontSize: "0.75rem", maxWidth: "100%" }} />
                  {loadingCols && <CircularProgress size="0.875rem" />}
                </Box>

                {/* Columna fecha */}
                <FormControl size="small" fullWidth>
                  <InputLabel>Columna fecha</InputLabel>
                  <Select value={dateCol} label="Columna fecha" onChange={(e) => setDateCol(e.target.value)}>
                    {datetimeCols.map((c) => (
                      <MenuItem key={c.name} value={c.name}>
                        <Box>
                          <Typography variant="body2">{c.name}</Typography>
                          <Typography variant="caption" color="text.disabled">
                            {c.sample_values[0]}
                          </Typography>
                        </Box>
                      </MenuItem>
                    ))}
                    {columns.filter((c) => c.dtype !== "datetime").map((c) => (
                      <MenuItem key={c.name + "_"} value={c.name} sx={{ opacity: 0.6 }}>
                        {c.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Columna valor */}
                <FormControl size="small" fullWidth>
                  <InputLabel>Columna valor</InputLabel>
                  <Select value={targetCol} label="Columna valor" onChange={(e) => setTargetCol(e.target.value)}>
                    {numericCols.map((c) => (
                      <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                {/* Columna ID serie (opcional) */}
                <Tooltip title="Si tu dataset tiene múltiples series (ej. sku_id, cliente_id), elegí la columna aquí. Si es una sola serie, dejá vacío.">
                  <FormControl size="small" fullWidth>
                    <InputLabel>Columna ID serie (opcional)</InputLabel>
                    <Select value={idCol} label="Columna ID serie (opcional)"
                      onChange={(e) => setIdCol(e.target.value)}>
                      <MenuItem value=""><em>Serie única (sin agrupación)</em></MenuItem>
                      {[...textCols, ...numericCols].map((c) => (
                        <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Tooltip>

                {/* Frecuencia + Horizonte */}
                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <FormControl size="small" fullWidth>
                    <InputLabel>Frecuencia</InputLabel>
                    <Select value={freq} label="Frecuencia"
                      onChange={(e) => {
                        setFreq(e.target.value);
                        const max = FREQ_MAX[e.target.value] ?? 24;
                        if (horizon > max) setHorizon(max);
                      }}>
                      {FREQ_OPTIONS.map((o) => (
                        <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="number" label={`Horizonte`}
                    value={horizon}
                    onChange={(e) => setHorizon(Math.max(1, Math.min(maxHorizon, +e.target.value)))}
                    helperText={`máx ${maxHorizon}`}
                    inputProps={{ min: 1, max: maxHorizon }} />
                </Box>

                <Button variant="contained" fullWidth
                  startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
                  disabled={loading || !dateCol || !targetCol}
                  onClick={() => void handleRunDataset()}
                  sx={{ textTransform: "none", fontWeight: 600 }}>
                  {loading ? "Ejecutando…" : "Ejecutar Batch Forecast"}
                </Button>
              </Box>
            )}
          </Paper>

          {/* Modo avanzado (JSON) — colapsable */}
          <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
            <Box
              sx={{ px: "1.25rem", py: "0.875rem", display: "flex", alignItems: "center",
                justifyContent: "space-between", cursor: "pointer",
                "&:hover": { bgcolor: "action.hover" }, transition: "background 0.15s" }}
              onClick={() => setAdvancedOpen((v) => !v)}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CodeIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
                  Modo avanzado — Panel JSON
                </Typography>
              </Box>
              {advancedOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </Box>

            <Collapse in={advancedOpen}>
              <Divider />
              <Box sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
                <Typography variant="caption" color="text.secondary">
                  Pegá un array de registros o <code>{"{records: [...]}"}</code>. Útil para integración
                  programática o datos que no están en Supabase.
                </Typography>

                <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                  <TextField size="small" label="Col. fecha" value={jsonDateCol}
                    onChange={(e) => setJsonDateCol(e.target.value)} />
                  <TextField size="small" label="Col. valor" value={jsonTargetCol}
                    onChange={(e) => setJsonTargetCol(e.target.value)} />
                  <TextField size="small" label="Col. ID" value={jsonIdCol}
                    onChange={(e) => setJsonIdCol(e.target.value)} />
                  <FormControl size="small">
                    <InputLabel>Freq</InputLabel>
                    <Select value={jsonFreq} label="Freq" onChange={(e) => setJsonFreq(e.target.value)}>
                      {FREQ_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="number" label="Horizonte"
                    value={jsonHorizon}
                    onChange={(e) => setJsonHorizon(Math.max(1, +e.target.value))}
                    inputProps={{ min: 1, max: 365 }} />
                </Box>

                <TextField multiline minRows={8} maxRows={16} fullWidth size="small"
                  value={rawJson} onChange={(e) => setRawJson(e.target.value)}
                  inputProps={{ style: { fontFamily: "monospace", fontSize: "0.6875rem" } }} />

                <Button variant="outlined" fullWidth
                  startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
                  disabled={loading}
                  onClick={() => void handleRunJson()}
                  sx={{ textTransform: "none" }}>
                  {loading ? "Ejecutando…" : "Ejecutar desde JSON"}
                </Button>
              </Box>
            </Collapse>
          </Paper>

          {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        </Box>

        {/* ── Panel derecho: resultado ─────────────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Empty / loading */}
          {!result && !loading && (
            <Paper variant="outlined" sx={{ p: "3rem", display: "flex", flexDirection: "column",
              alignItems: "center", gap: "1rem", borderRadius: "0.75rem", borderStyle: "dashed" }}>
              <BarChartIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
              <Typography variant="h6" color="text.secondary">
                {datasetId ? "Configurá las columnas y ejecutá" : "Conectá un dataset primero"}
              </Typography>
              <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="26rem">
                El motor vectorizado de Nixtla corre en paralelo sobre todas las series
                simultáneamente. La duración depende del número de series y el horizonte.
              </Typography>
            </Paper>
          )}

          {loading && (
            <Paper variant="outlined" sx={{ p: "3rem", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "1rem", borderRadius: "0.75rem", minHeight: "12rem" }}>
              <CircularProgress size={32} />
              <Box>
                <Typography variant="body2">Corriendo StatsForecast…</Typography>
                <Typography variant="caption" color="text.disabled">
                  Esto puede tardar 5–60s dependiendo del número de series
                </Typography>
              </Box>
            </Paper>
          )}

          {result && (
            <>
              {/* KPIs — config (outlined) vs resultado (filled) */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <Typography variant="caption" color="text.disabled" sx={{ pl: "0.125rem" }}>Configuración</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))", gap: "0.5rem" }}>
                  {[
                    { label: "Frecuencia", value: result.freq },
                    { label: "Horizonte",  value: result.horizon.toString() },
                    { label: "Modelo",     value: result.model_used },
                  ].map(({ label, value }) => (
                    <Paper key={label} variant="outlined"
                      sx={{ p: "0.75rem", borderRadius: "0.5rem", borderColor: "divider" }}>
                      <Typography variant="caption" color="text.disabled">{label}</Typography>
                      <Typography variant="body1" fontWeight={600} sx={{ mt: "0.125rem", fontSize: "0.875rem" }}>{value}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                <Typography variant="caption" color="text.disabled" sx={{ pl: "0.125rem" }}>Resultado</Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))", gap: "0.5rem" }}>
                  {[
                    { label: "Series",       value: result.n_series.toString() },
                    { label: "Predicciones", value: result.predictions.length.toLocaleString("es-AR") },
                    { label: "Duración",     value: `${result.duration_s.toFixed(2)}s` },
                  ].map(({ label, value }) => (
                    <Paper key={label} elevation={0}
                      sx={{ p: "0.75rem", borderRadius: "0.5rem",
                        bgcolor: "primary.main", color: "primary.contrastText" }}>
                      <Typography variant="caption" sx={{ opacity: 0.75 }}>{label}</Typography>
                      <Typography variant="body1" fontWeight={700} sx={{ mt: "0.125rem", fontSize: "0.875rem" }}>{value}</Typography>
                    </Paper>
                  ))}
                </Box>
              </Box>

              {/* DataGrid de predicciones */}
              <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid",
                  borderColor: "divider", display: "flex", alignItems: "center",
                  justifyContent: "space-between" }}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Predicciones
                    <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: "0.5rem" }}>
                      ({result.predictions.length.toLocaleString("es-AR")} filas · sorting y filtros habilitados)
                    </Typography>
                  </Typography>
                </Box>
                <DataGrid
                  rows={gridRows}
                  columns={gridCols}
                  paginationModel={paginationModel}
                  onPaginationModelChange={setPaginationModel}
                  pageSizeOptions={[25, 50, 100]}
                  disableRowSelectionOnClick
                  density="compact"
                  autoHeight
                  sx={{
                    border: "none",
                    fontSize: "0.75rem",
                    "& .MuiDataGrid-columnHeaders": { bgcolor: "background.default" },
                    "& .MuiDataGrid-cell": { borderColor: "divider" },
                  }}
                />
              </Paper>

              {/* Hint drill-down */}
              {mode === "dataset" && allSeries.length > 1 && (
                <Typography variant="caption" color="text.disabled">
                  Usá los filtros de columna para aislar una serie, luego hacé clic en
                  &quot;Forecast →&quot; para analizarla en detalle.
                </Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
