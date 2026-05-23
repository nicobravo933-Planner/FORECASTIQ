"use client"

/**
 * /dashboard/analytics — Forecast accuracy agregada por categoría y segmento ABC-XYZ.
 * Solo funciona con el dataset demo 25k SKUs (análisis vectorizado ABC-XYZ).
 * Para series individuales → /dashboard/forecast.
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
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
  ReferenceLine, Cell, ScatterChart, Scatter, Legend,
} from "recharts"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import { addSessionDataset } from "@/lib/sessionDatasets"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]

// Analytics solo soporta W y M (el backend agrega de diario a estos granulares)
const FREQ_CFG: Record<string, { max: number; unit: string; defaultH: number }> = {
  W: { max: 52, unit: "semanas", defaultH: 13 },
  M: { max: 24, unit: "meses",   defaultH: 12 },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkuMetrics {
  sku_id: string; wape: number | null; bias: number | null; mae: number | null
  model: string; n_obs: number; cluster_abc: string | null; cluster_xyz: string | null
}
interface CategoryAnalysisResponse {
  categoria: string; n_skus: number; freq: string; horizon: number; duration_s: number
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const router = useRouter()
  const [categoria, setCategoria]   = useState("Electrónica")
  const [freq, setFreq]             = useState("W")
  const [horizon, setHorizon]       = useState(13)   // semanas por defecto
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [result, setResult]         = useState<CategoryAnalysisResponse | null>(null)
  const [allResults, setAllResults] = useState<CategoryAnalysisResponse[]>([])
  const [activeTable, setActiveTable] = useState<"worst" | "best">("worst")
  const [drillLoading, setDrillLoading] = useState<string | null>(null)

  const cfg = FREQ_CFG[freq] ?? FREQ_CFG["W"]

  const handleFreqChange = (newFreq: string) => {
    setFreq(newFreq)
    setResult(null)
    // Reset horizonte al default de la nueva frecuencia si el actual supera el máximo
    const newCfg = FREQ_CFG[newFreq] ?? FREQ_CFG["W"]
    if (horizon > newCfg.max) setHorizon(newCfg.defaultH)
  }

  const handleAnalyze = async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.get<CategoryAnalysisResponse>(
        `/api/datasets/demo/analyze-category?categoria=${encodeURIComponent(categoria)}&freq=${freq}&horizon=${horizon}&max_skus=200`
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
      setError("Error al cargar el SKU. Intentá de nuevo.")
    } finally { setDrillLoading(null) }
  }

  const segmentData = result
    ? Object.entries(result.by_segment)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([seg, v]) => ({ segment: seg, wape: +((v.wape_mean as number) * 100).toFixed(1), n_skus: v.n_skus as number }))
    : []

  const scatterData = result
    ? [...result.best_skus, ...result.worst_skus]
        .filter((m) => m.wape != null && m.bias != null)
        .map((m) => ({
          sku: m.sku_id,
          wape: +(m.wape! * 100).toFixed(1),
          bias: +(m.bias! * 100).toFixed(1),
          seg: m.cluster_abc && m.cluster_xyz ? `${m.cluster_abc}-${m.cluster_xyz}` : "?",
        }))
    : []

  const compareData = allResults.map((r) => ({
    categoria:  r.categoria,
    wape_medio: +((r.wape_mean ?? 0) * 100).toFixed(1),
    wape_p90:   +((r.wape_p90  ?? 0) * 100).toFixed(1),
  }))

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <InsightsIcon sx={{ color: "primary.main", fontSize: "1.75rem" }} />
        <Box>
          <Typography variant="h4" color="text.primary" fontWeight={700}>Analytics</Typography>
          <Typography variant="body2" color="text.secondary">
            Forecast accuracy por categoría y segmento ABC-XYZ · Dataset demo 25k SKUs
          </Typography>
        </Box>
      </Box>

      {/* Controles */}
      <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", borderRadius: "0.75rem" }}>
        <FormControl size="small" sx={{ minWidth: "11rem" }}>
          <InputLabel>Categoría</InputLabel>
          <Select value={categoria} label="Categoría"
            onChange={(e) => { setCategoria(e.target.value); setResult(null) }}>
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

        {/* Horizonte con unidad visible */}
        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <TextField
            size="small" type="number" label={`Horizonte (${cfg.unit})`}
            value={horizon}
            onChange={(e) => {
              setHorizon(Math.max(1, Math.min(cfg.max, +e.target.value)))
              setResult(null)
            }}
            sx={{ width: "9rem" }}
            inputProps={{ min: 1, max: cfg.max }}
          />
          <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
            máx {cfg.max}
          </Typography>
        </Box>

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
      {error   && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Empty state */}
      {!result && !loading && (
        <Paper variant="outlined" sx={{ p: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", borderRadius: "0.75rem", borderStyle: "dashed" }}>
          <InsightsIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">Configurá los parámetros y ejecutá el análisis</Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="28rem">
            Elegí categoría, frecuencia y cuántos períodos de hold-out evaluar.
            El resultado muestra WAPE y BIAS por segmento ABC-XYZ.
            Clic en cualquier SKU para abrirlo directamente en Forecast.
          </Typography>
        </Paper>
      )}

      {result && (
        <>
          {/* KPIs — parámetros reales del análisis ejecutado */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" }}>
            {[
              { label: "SKUs",        value: result.n_skus.toString() },
              { label: "Hold-out",    value: `${result.horizon} ${FREQ_CFG[result.freq]?.unit ?? "períodos"}` },
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

            <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>
                WAPE (%) por segmento — {result.categoria} · {result.freq} · {result.horizon} {FREQ_CFG[result.freq]?.unit ?? ""}
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

            <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>
                WAPE vs BIAS — mejores + peores 20 SKUs
              </Typography>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart margin={{ top: 4, right: 8, bottom: 20, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="bias" name="BIAS %" type="number" tick={{ fontSize: 11 }} unit="%" label={{ value: "BIAS %", position: "insideBottom", offset: -8, fontSize: 11 }} />
                  <YAxis dataKey="wape" name="WAPE %" type="number" tick={{ fontSize: 11 }} unit="%" />
                  <ReferenceLine x={0}  stroke="#6b7280" strokeDasharray="3 3" />
                  <ReferenceLine y={15} stroke="#22c55e" strokeDasharray="3 3" />
                  <RechartTooltip content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0].payload as { sku: string; wape: number; bias: number; seg: string }
                    return (
                      <Box sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", p: "0.5rem", borderRadius: "0.375rem", fontSize: "0.75rem" }}>
                        <div><strong>{d.sku}</strong></div>
                        <div>WAPE: {d.wape}%</div>
                        <div>BIAS: {d.bias > 0 ? "+" : ""}{d.bias}%</div>
                        <div>Seg: {d.seg}</div>
                      </Box>
                    )
                  }} />
                  <Scatter data={scatterData} fill="#6366f1" fillOpacity={0.7} />
                </ScatterChart>
              </ResponsiveContainer>
              <Typography variant="caption" color="text.disabled">
                BIAS &gt;0 = sobreestima · &lt;0 = subestima
              </Typography>
            </Paper>
          </Box>

          {compareData.length > 1 && (
            <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>Comparativa entre categorías</Typography>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compareData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                  <XAxis dataKey="categoria" tick={{ fontSize: 11 }} />
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
              <Typography variant="subtitle2" fontWeight={600}>Drill-down por SKU</Typography>
              <Typography variant="caption" color="text.secondary">
                Clic en una fila → carga la serie → abre en Forecast
              </Typography>
            </Box>

            <Tabs value={activeTable} onChange={(_, v) => setActiveTable(v)}
              sx={{ mb: "0.75rem", minHeight: "2.25rem",
                "& .MuiTab-root": { textTransform: "none", fontSize: "0.8125rem", minHeight: "2.25rem" } }}>
              <Tab value="worst" label="Peor WAPE (top 20)" />
              <Tab value="best"  label="Mejor WAPE (top 20)" />
            </Tabs>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "background.default" }}>
                    {["SKU", "WAPE", "BIAS", "Segmento", "Obs.", ""].map((h) => (
                      <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary", py: "0.625rem" }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(activeTable === "worst" ? result.worst_skus : result.best_skus).map((m) => (
                    <TableRow key={m.sku_id} hover
                      sx={{ cursor: "pointer", "&:hover .drill-btn": { opacity: 1 } }}
                      onClick={() => handleDrillDown(m.sku_id)}>
                      <TableCell sx={{ fontFamily: "monospace", fontSize: "0.8125rem" }}>{m.sku_id}</TableCell>
                      <TableCell><WapeBadge v={m.wape} /></TableCell>
                      <TableCell><BiasBadge v={m.bias} /></TableCell>
                      <TableCell>
                        {m.cluster_abc && m.cluster_xyz && (
                          <Chip label={`${m.cluster_abc}-${m.cluster_xyz}`} size="small"
                            sx={{ height: "1.125rem", fontSize: "0.625rem" }} />
                        )}
                      </TableCell>
                      <TableCell sx={{ color: "text.disabled", fontSize: "0.75rem" }}>{m.n_obs}</TableCell>
                      <TableCell>
                        <Tooltip title="Cargar serie y abrir en Forecast">
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
      )}
    </Box>
  )
}
