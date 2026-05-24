"use client"

/**
 * /dashboard/analytics — Forecast accuracy agregada multi-serie.
 *
 * Tab "Mis datos":  dataset propio con columna de agrupación → POST /{id}/analyze-multi
 * Tab "Demo":       dataset 25k SKUs de R2 → GET /demo/analyze-category
 *
 * El drill-down desde la tabla lleva a Forecast con la serie del id seleccionado.
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Paper from "@mui/material/Paper"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import LinearProgress from "@mui/material/LinearProgress"
import Divider from "@mui/material/Divider"
import Chip from "@mui/material/Chip"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import Tooltip from "@mui/material/Tooltip"
import TextField from "@mui/material/TextField"
import InsightsIcon from "@mui/icons-material/Insights"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import StorageIcon from "@mui/icons-material/Storage"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
  ReferenceLine, Cell, ScatterChart, Scatter, Legend,
} from "recharts"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import { addSessionDataset } from "@/lib/sessionDatasets"
import { getSessionIds } from "@/lib/sessionDatasets"
import type { DatasetListItem } from "@/lib/types"
import { useColumnPreview } from "@/hooks/useColumnPreview"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]

const FREQ_OPTIONS = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
  { value: "Q", label: "Trimestral" },
]

const FREQ_CFG: Record<string, { max: number; unit: string; defaultH: number }> = {
  D: { max: 90,  unit: "días",    defaultH: 30  },
  W: { max: 52,  unit: "semanas", defaultH: 13  },
  M: { max: 24,  unit: "meses",   defaultH: 12  },
  Q: { max: 8,   unit: "trimestres", defaultH: 4 },
}

const MODEL_OPTIONS = [
  { value: "AutoETS",       label: "AutoETS",        desc: "Mejor para series estacionales. Default." },
  { value: "SeasonalNaive", label: "Seasonal Naive", desc: "Baseline rápido. Siempre disponible." },
  { value: "AutoARIMA",     label: "AutoARIMA",      desc: "Más robusto, ~3-5x más lento." },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkuMetrics {
  sku_id: string; wape: number | null; bias: number | null; mae: number | null
  model: string; n_obs: number; cluster_abc: string | null; cluster_xyz: string | null
}
interface CategoryAnalysisResponse {
  categoria: string; n_skus: number; freq: string; horizon: number; duration_s: number
  model_used: string
  n_obs_median: number | null; n_skus_short: number; min_obs_required: number
  wape_mean: number | null; wape_p50: number | null; wape_p90: number | null; bias_mean: number | null
  by_segment: Record<string, { wape_mean: number; n_skus: number }>
  worst_skus: SkuMetrics[]; best_skus: SkuMetrics[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function wapeColor(v: number): string {
  if (v < 0.15) return "#22c55e"
  if (v < 0.30) return "#f59e0b"
  return "#ef4444"
}

function WapeBadge({ v }: { v: number | null }) {
  if (v === null) return <Typography variant="caption" color="text.disabled">—</Typography>
  const color = v < 0.15 ? "success" : v < 0.30 ? "warning" : "error"
  return <Chip label={(v * 100).toFixed(1) + "%"} size="small" color={color} variant="outlined"
    sx={{ height: "1.25rem", fontSize: "0.6875rem", fontFamily: "monospace" }} />
}

function BiasBadge({ v }: { v: number | null }) {
  if (v === null) return <Typography variant="caption" color="text.disabled">—</Typography>
  const color = Math.abs(v) < 0.05 ? "success" : Math.abs(v) < 0.15 ? "warning" : "error"
  const label = (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"
  return <Chip label={label} size="small" color={color} variant="outlined"
    sx={{ height: "1.25rem", fontSize: "0.6875rem", fontFamily: "monospace" }} />
}

// ── Sub-component: ResultsView (shared between both tabs) ──────────────────────

function ResultsView({
  result,
  allResults,
  activeTable,
  setActiveTable,
  drillLoading,
  onDrillDown,
  idLabel = "ID",
  freqCfg = FREQ_CFG,
}: {
  result: CategoryAnalysisResponse
  allResults: CategoryAnalysisResponse[]
  activeTable: "worst" | "best"
  setActiveTable: (v: "worst" | "best") => void
  drillLoading: string | null
  onDrillDown: (id: string) => void
  idLabel?: string
  freqCfg?: typeof FREQ_CFG
}) {
  const cfg = freqCfg[result.freq] ?? freqCfg["M"]

  const segmentData = Object.entries(result.by_segment)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([seg, v]) => ({ segment: seg, wape: +((v.wape_mean as number) * 100).toFixed(1), n_skus: v.n_skus as number }))

  const scatterData = [...result.best_skus, ...result.worst_skus]
    .filter((m) => m.wape != null && m.bias != null)
    .map((m) => ({
      sku: m.sku_id,
      wape: +(m.wape! * 100).toFixed(1),
      bias: +(m.bias! * 100).toFixed(1),
      seg: m.cluster_abc && m.cluster_xyz ? `${m.cluster_abc}-${m.cluster_xyz}` : "?",
    }))

  const compareData = allResults.map((r) => ({
    label:      r.categoria,
    wape_medio: +((r.wape_mean ?? 0) * 100).toFixed(1),
    wape_p90:   +((r.wape_p90  ?? 0) * 100).toFixed(1),
  }))

  return (
    <>
      {/* Badge validación */}
      {result.n_skus_short > 0 && (
        <Alert severity="warning" sx={{ fontSize: "0.8125rem" }}>
          <strong>{result.n_skus_short} serie{result.n_skus_short > 1 ? "s" : ""} descartadas</strong>
          {" "}por tener menos de <strong>{result.min_obs_required} observaciones</strong> requeridas para {result.model_used}.
          {result.n_obs_median !== null && <> Mediana: <strong>{result.n_obs_median}</strong> obs.</>}
          {" "}Reducí el horizonte o usá SeasonalNaive.
        </Alert>
      )}

      {/* KPIs */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" }}>
        {[
          { label: "Series",      value: result.n_skus.toString() },
          { label: "Modelo",      value: result.model_used },
          { label: "Hold-out",    value: `${result.horizon} ${cfg?.unit ?? "períodos"}` },
          { label: "WAPE medio",  value: result.wape_mean != null ? (result.wape_mean * 100).toFixed(1) + "%" : "—" },
          { label: "WAPE p50",    value: result.wape_p50  != null ? (result.wape_p50  * 100).toFixed(1) + "%" : "—" },
          { label: "WAPE p90",    value: result.wape_p90  != null ? (result.wape_p90  * 100).toFixed(1) + "%" : "—" },
          { label: "BIAS medio",  value: result.bias_mean != null ? (result.bias_mean > 0 ? "+" : "") + (result.bias_mean * 100).toFixed(1) + "%" : "—" },
          { label: "Duración",    value: `${result.duration_s}s` },
        ].map(({ label, value }) => (
          <Paper key={label} variant="outlined" sx={{ p: "1rem", borderRadius: "0.75rem" }}>
            <Typography variant="caption" color="text.disabled">{label}</Typography>
            <Typography variant="h5" fontWeight={700} color="text.primary" sx={{ mt: "0.25rem" }}>{value}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Charts */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: "1.25rem" }}>
        {segmentData.length > 0 && (
          <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>
              WAPE (%) por segmento
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={segmentData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="segment" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit="%" domain={[0, "auto"]} />
                <RechartTooltip formatter={(v: number) => [`${v}%`, "WAPE"]} contentStyle={{ fontSize: "0.75rem" }} />
                <ReferenceLine y={15} stroke="#22c55e" strokeDasharray="4 2" label={{ value: "15%", fontSize: 10, fill: "#22c55e" }} />
                <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: "30%", fontSize: 10, fill: "#f59e0b" }} />
                <Bar dataKey="wape" radius={[4, 4, 0, 0]}>
                  {segmentData.map((d) => <Cell key={d.segment} fill={wapeColor(d.wape / 100)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Typography variant="caption" color="text.disabled">Verde &lt;15% · Amarillo 15-30% · Rojo &gt;30%</Typography>
          </Paper>
        )}

        {scatterData.length > 0 && (
          <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>
              WAPE vs BIAS — mejores + peores 20
            </Typography>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="bias" name="BIAS %" type="number" tick={{ fontSize: 11 }} unit="%" label={{ value: "BIAS %", position: "insideBottom", offset: -8, fontSize: 11 }} />
                <YAxis dataKey="wape" name="WAPE %" type="number" tick={{ fontSize: 11 }} unit="%" />
                <ReferenceLine x={0} stroke="#6b7280" strokeDasharray="3 3" />
                <ReferenceLine y={15} stroke="#22c55e" strokeDasharray="3 3" />
                <RechartTooltip content={({ payload }) => {
                  if (!payload?.length) return null
                  const d = payload[0].payload as { sku: string; wape: number; bias: number; seg: string }
                  return (
                    <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", p: "0.5rem", borderRadius: "0.375rem", fontSize: "0.75rem" }}>
                      <div><strong>{d.sku}</strong></div>
                      <div>WAPE: {d.wape}%</div>
                      <div>BIAS: {d.bias > 0 ? "+" : ""}{d.bias}%</div>
                      {d.seg !== "?" && <div>Seg: {d.seg}</div>}
                    </Box>
                  )
                }} />
                <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.7} />
              </ScatterChart>
            </ResponsiveContainer>
            <Typography variant="caption" color="text.disabled">BIAS &gt;0 = sobreestima · &lt;0 = subestima</Typography>
          </Paper>
        )}
      </Box>

      {compareData.length > 1 && (
        <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>Comparativa acumulada</Typography>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={compareData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} unit="%" />
              <RechartTooltip contentStyle={{ fontSize: "0.75rem" }} formatter={(v: number) => [`${v}%`]} />
              <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
              <Bar dataKey="wape_medio" name="WAPE medio" fill="#6366f1" radius={[3, 3, 0, 0]} />
              <Bar dataKey="wape_p90"   name="WAPE p90"   fill="#06b6d4" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      )}

      <Divider />

      {/* Tabla drill-down */}
      <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <Typography variant="subtitle2" fontWeight={600}>Drill-down por {idLabel}</Typography>
          <Typography variant="caption" color="text.secondary">
            Clic en una fila → abre en Forecast
          </Typography>
        </Box>
        <Tabs value={activeTable} onChange={(_, v) => setActiveTable(v)}
          sx={{ mb: "0.75rem", minHeight: "2.25rem", "& .MuiTab-root": { textTransform: "none", fontSize: "0.8125rem", minHeight: "2.25rem" } }}>
          <Tab value="worst" label="Peor WAPE (top 20)" />
          <Tab value="best"  label="Mejor WAPE (top 20)" />
        </Tabs>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                {[idLabel, "WAPE", "BIAS", "Obs.", ""].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary", py: "0.625rem" }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {(activeTable === "worst" ? result.worst_skus : result.best_skus).map((m) => (
                <TableRow key={m.sku_id} hover
                  sx={{ cursor: "pointer", "&:hover .drill-btn": { opacity: 1 } }}
                  onClick={() => onDrillDown(m.sku_id)}>
                  <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{m.sku_id}</TableCell>
                  <TableCell><WapeBadge v={m.wape} /></TableCell>
                  <TableCell><BiasBadge v={m.bias} /></TableCell>
                  <TableCell sx={{ color: "text.disabled", fontSize: "0.75rem" }}>{m.n_obs}</TableCell>
                  <TableCell>
                    <Tooltip title="Abrir en Forecast">
                      {drillLoading === m.sku_id ? (
                        <CircularProgress size="0.875rem" />
                      ) : (
                        <Button className="drill-btn" size="small" variant="outlined"
                          startIcon={<ShowChartIcon sx={{ fontSize: "0.75rem !important" }} />}
                          sx={{ opacity: 0, transition: "opacity 0.15s", textTransform: "none", fontSize: "0.6875rem", py: "0.125rem" }}>
                          Forecast →
                        </Button>
                      )}
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </>
  )
}

// ── Tab "Mis datos" ───────────────────────────────────────────────────────────

function MisDatosTab() {
  const router = useRouter()
  const [datasetId, setDatasetId]   = useState("")
  const [dateCol, setDateCol]       = useState("")
  const [idCol, setIdCol]           = useState("")
  const [valueCol, setValueCol]     = useState("")
  const [freq, setFreq]             = useState("M")
  const [horizon, setHorizon]       = useState(12)
  const [model, setModel]           = useState("AutoETS")
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<CategoryAnalysisResponse | null>(null)
  const [allResults, setAllResults] = useState<CategoryAnalysisResponse[]>([])
  const [activeTable, setActiveTable] = useState<"worst" | "best">("worst")
  const [drillLoading, setDrillLoading] = useState<string | null>(null)
  const [datasets, setDatasets]     = useState<DatasetListItem[]>([])
  const [loadingDs, setLoadingDs]   = useState(false)

  const preview = useColumnPreview(datasetId || null)
  const columns = preview.status === "ready" ? preview.columns : []
  const cfg = FREQ_CFG[freq] ?? FREQ_CFG["M"]

  // Cargar lista de datasets al montar
  useState(() => {
    setLoadingDs(true)
    const ids = getSessionIds()
    const url = ids ? `/api/datasets/?session_ids=${encodeURIComponent(ids)}` : "/api/datasets/"
    api.get<{ datasets: DatasetListItem[] }>(url)
      .then((r) => setDatasets(r.datasets))
      .catch(() => {})
      .finally(() => setLoadingDs(false))
  })

  const handleAnalyze = async () => {
    if (!datasetId || !dateCol || !idCol || !valueCol) {
      setError("Completá todos los campos: dataset, columna fecha, columna ID y columna valor.")
      return
    }
    setLoading(true); setError(null)
    try {
      const res = await api.post<CategoryAnalysisResponse>(
        `/api/datasets/${datasetId}/analyze-multi`,
        { date_col: dateCol, id_col: idCol, value_col: valueCol, freq, horizon, model, max_series: 500 }
      )
      setResult(res)
      setAllResults((prev) => [...prev, res])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error en el análisis.")
    } finally { setLoading(false) }
  }

  const handleDrillDown = async (serieId: string) => {
    // Para datos propios: pre-cargamos el dataset en appStore con los parámetros de columna
    // y navegamos a Forecast — el usuario ya tiene el dataset cargado
    setDrillLoading(serieId)
    appStore.setActiveDataset(datasetId, dateCol, valueCol, freq)
    router.push("/dashboard/forecast")
    setDrillLoading(null)
  }

  // Auto-seleccionar columnas cuando cambia el dataset
  const handleDatasetChange = (id: string) => {
    setDatasetId(id); setDateCol(""); setIdCol(""); setValueCol(""); setResult(null)
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Panel de configuración */}
      <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", borderRadius: "0.75rem" }}>

        {/* Dataset */}
        <FormControl size="small" sx={{ minWidth: "14rem" }}>
          <InputLabel>Dataset</InputLabel>
          <Select value={datasetId} label="Dataset" onChange={(e) => handleDatasetChange(e.target.value)}>
            {loadingDs && <MenuItem disabled>Cargando…</MenuItem>}
            {datasets.map((d) => (
              <MenuItem key={d.dataset_id} value={d.dataset_id}>
                <Box>
                  <Typography variant="body2" noWrap>{d.filename}</Typography>
                  <Typography variant="caption" color="text.disabled">{d.rows?.toLocaleString("es-AR")} filas</Typography>
                </Box>
              </MenuItem>
            ))}
            {!loadingDs && datasets.length === 0 && (
              <MenuItem disabled>
                <Typography variant="caption" color="text.disabled">Sin datasets. Subí un CSV primero.</Typography>
              </MenuItem>
            )}
          </Select>
        </FormControl>

        {/* Columnas — sólo cuando hay preview */}
        {columns.length > 0 && (
          <>
            <FormControl size="small" sx={{ minWidth: "9rem" }}>
              <InputLabel>Columna fecha</InputLabel>
              <Select value={dateCol} label="Columna fecha" onChange={(e) => setDateCol(e.target.value)}>
                {columns.filter((c) => c.dtype === "datetime" || c.dtype === "text").map((c) => (
                  <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: "9rem" }}>
              <InputLabel>Columna ID</InputLabel>
              <Select value={idCol} label="Columna ID" onChange={(e) => setIdCol(e.target.value)}>
                {columns.filter((c) => c.dtype === "text" || c.dtype === "numeric").map((c) => (
                  <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: "9rem" }}>
              <InputLabel>Columna valor</InputLabel>
              <Select value={valueCol} label="Columna valor" onChange={(e) => setValueCol(e.target.value)}>
                {columns.filter((c) => c.dtype === "numeric").map((c) => (
                  <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </>
        )}

        {/* Frecuencia */}
        <FormControl size="small" sx={{ width: "9rem" }}>
          <InputLabel>Frecuencia</InputLabel>
          <Select value={freq} label="Frecuencia" onChange={(e) => { setFreq(e.target.value); setResult(null) }}>
            {FREQ_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Horizonte */}
        <TextField size="small" type="number" label={`Horizonte (${cfg.unit})`}
          value={horizon} onChange={(e) => setHorizon(Math.max(1, Math.min(cfg.max, +e.target.value)))}
          sx={{ width: "9rem" }} inputProps={{ min: 1, max: cfg.max }} />

        {/* Modelo */}
        <FormControl size="small" sx={{ minWidth: "10rem" }}>
          <InputLabel>Modelo</InputLabel>
          <Select value={model} label="Modelo"
            renderValue={(v) => MODEL_OPTIONS.find((o) => o.value === v)?.label ?? v}
            onChange={(e) => { setModel(e.target.value); setResult(null) }}>
            {MODEL_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography variant="body2" fontWeight={500}>{o.label}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6875rem" }}>{o.desc}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="contained"
          startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
          onClick={handleAnalyze} disabled={loading || !datasetId}
          sx={{ textTransform: "none", fontWeight: 600 }}>
          {loading ? "Analizando…" : "Analizar"}
        </Button>
      </Paper>

      {/* Hint formato esperado */}
      {!datasetId && (
        <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>
          Necesitás un CSV con al menos 3 columnas: <strong>fecha</strong>, <strong>ID de serie</strong> (producto, cliente, tienda…) y <strong>valor</strong> (ventas, unidades…).
          Subilo en <strong>Conectar Datos → Subir CSV</strong> o conectá una DB con formato <code>[fecha, id, valor]</code>.
        </Alert>
      )}

      {preview.status === "error" && (
        <Alert severity="error">{preview.message}</Alert>
      )}

      {loading && <LinearProgress sx={{ borderRadius: "0.25rem" }} />}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Empty state */}
      {!result && !loading && datasetId && (
        <Paper variant="outlined" sx={{ p: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", borderRadius: "0.75rem", borderStyle: "dashed" }}>
          <StorageIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">Configurá las columnas y ejecutá el análisis</Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="28rem">
            Seleccioná la columna de fecha, la columna que identifica cada serie (producto, cliente, tienda…)
            y la columna de valor numérico. El motor vectorizado de Nixtla calcula WAPE y BIAS para cada serie simultáneamente.
          </Typography>
        </Paper>
      )}

      {result && (
        <ResultsView
          result={result} allResults={allResults}
          activeTable={activeTable} setActiveTable={setActiveTable}
          drillLoading={drillLoading} onDrillDown={handleDrillDown}
          idLabel={idCol || "ID"} freqCfg={FREQ_CFG}
        />
      )}
    </Box>
  )
}

// ── Tab "Demo 25k SKUs" ───────────────────────────────────────────────────────

function DemoTab() {
  const router = useRouter()
  const [categoria, setCategoria]   = useState("Electrónica")
  const [freq, setFreq]             = useState("W")
  const [horizon, setHorizon]       = useState(13)
  const [model, setModel]           = useState("AutoETS")
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<CategoryAnalysisResponse | null>(null)
  const [allResults, setAllResults] = useState<CategoryAnalysisResponse[]>([])
  const [activeTable, setActiveTable] = useState<"worst" | "best">("worst")
  const [drillLoading, setDrillLoading] = useState<string | null>(null)

  const freqCfgDemo: typeof FREQ_CFG = {
    W: { max: 52, unit: "semanas", defaultH: 13 },
    M: { max: 24, unit: "meses",   defaultH: 12 },
  }
  const cfg = freqCfgDemo[freq] ?? freqCfgDemo["W"]

  const handleFreqChange = (newFreq: string) => {
    setFreq(newFreq); setResult(null)
    const nc = freqCfgDemo[newFreq] ?? freqCfgDemo["W"]
    if (horizon > nc.max) setHorizon(nc.defaultH)
  }

  const handleAnalyze = async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.get<CategoryAnalysisResponse>(
        `/api/datasets/demo/analyze-category?categoria=${encodeURIComponent(categoria)}&freq=${freq}&horizon=${horizon}&max_skus=200&model=${model}`
      )
      setResult(res)
      setAllResults((prev) => [...prev.filter((r) => r.categoria !== res.categoria), res])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error en el análisis.")
    } finally { setLoading(false) }
  }

  const handleDrillDown = async (skuId: string) => {
    setDrillLoading(skuId)
    try {
      const res = await api.post<{ dataset_id: string; sku_id: string; rows: number }>(
        "/api/datasets/demo/load",
        { sku_id: skuId, categoria, freq: "D" }
      )
      addSessionDataset({ dataset_id: res.dataset_id, filename: `demo_${res.sku_id}`, created_at: new Date().toISOString() })
      appStore.setActiveDataset(res.dataset_id, "fecha", "ventas", freq)
      router.push("/dashboard/forecast")
    } catch {
      setError("Error al cargar el SKU.")
    } finally { setDrillLoading(null) }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
      {/* Controles */}
      <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", borderRadius: "0.75rem" }}>
        <FormControl size="small" sx={{ minWidth: "11rem" }}>
          <InputLabel>Categoría</InputLabel>
          <Select value={categoria} label="Categoría" onChange={(e) => { setCategoria(e.target.value); setResult(null) }}>
            {CATEGORIAS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ width: "9rem" }}>
          <InputLabel>Frecuencia</InputLabel>
          <Select value={freq} label="Frecuencia" onChange={(e) => handleFreqChange(e.target.value)}>
            <MenuItem value="W">Semanal</MenuItem>
            <MenuItem value="M">Mensual</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TextField size="small" type="number" label={`Horizonte (${cfg.unit})`}
            value={horizon} onChange={(e) => { setHorizon(Math.max(1, Math.min(cfg.max, +e.target.value))); setResult(null) }}
            sx={{ width: "9rem" }} inputProps={{ min: 1, max: cfg.max }} />
          <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>máx {cfg.max}</Typography>
        </Box>

        <FormControl size="small" sx={{ minWidth: "10rem" }}>
          <InputLabel>Modelo</InputLabel>
          <Select value={model} label="Modelo"
            renderValue={(v) => MODEL_OPTIONS.find((o) => o.value === v)?.label ?? v}
            onChange={(e) => { setModel(e.target.value); setResult(null) }}>
            {MODEL_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                <Box sx={{ display: "flex", flexDirection: "column" }}>
                  <Typography variant="body2" fontWeight={500}>{o.label}</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: "0.6875rem" }}>{o.desc}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button variant="contained"
          startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
          onClick={handleAnalyze} disabled={loading}
          sx={{ textTransform: "none", fontWeight: 600 }}>
          {loading ? `Analizando ${categoria}…` : `Analizar ${categoria}`}
        </Button>

        {allResults.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
            {allResults.length} categoría{allResults.length > 1 ? "s" : ""} acumuladas
          </Typography>
        )}
      </Paper>

      {loading && <LinearProgress sx={{ borderRadius: "0.25rem" }} />}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {!result && !loading && (
        <Paper variant="outlined" sx={{ p: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", borderRadius: "0.75rem", borderStyle: "dashed" }}>
          <AutoGraphIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">Dataset demo 25k SKUs · Cloudflare R2</Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="28rem">
            Elegí categoría, frecuencia y horizonte. El motor vectorizado Nixtla corre
            StatsForecast sobre hasta 200 SKUs simultáneamente y retorna WAPE y BIAS por segmento ABC-XYZ.
          </Typography>
        </Paper>
      )}

      {result && (
        <ResultsView
          result={result} allResults={allResults}
          activeTable={activeTable} setActiveTable={setActiveTable}
          drillLoading={drillLoading} onDrillDown={handleDrillDown}
          idLabel="SKU" freqCfg={freqCfgDemo}
        />
      )}
    </Box>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [mainTab, setMainTab] = useState<"mis-datos" | "demo">("mis-datos")

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <InsightsIcon sx={{ color: "primary.main", fontSize: "1.75rem" }} />
        <Box>
          <Typography variant="h4" color="text.primary" fontWeight={700}>Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Forecast accuracy multi-serie — datos propios o dataset demo 25k SKUs
          </Typography>
        </Box>
      </Box>

      {/* Tabs principales */}
      <Tabs
        value={mainTab}
        onChange={(_, v) => setMainTab(v)}
        sx={{
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTab-root": { textTransform: "none", fontWeight: 600 },
        }}
      >
        <Tab
          value="mis-datos"
          icon={<StorageIcon sx={{ fontSize: "1rem" }} />}
          iconPosition="start"
          label="Mis datos"
        />
        <Tab
          value="demo"
          icon={<AutoGraphIcon sx={{ fontSize: "1rem" }} />}
          iconPosition="start"
          label="Demo 25k SKUs"
        />
      </Tabs>

      {mainTab === "mis-datos" && <MisDatosTab />}
      {mainTab === "demo"      && <DemoTab />}
    </Box>
  )
}
