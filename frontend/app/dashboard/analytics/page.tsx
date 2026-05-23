"use client"

/**
 * /dashboard/analytics — Dashboard de métricas agregadas de demand planning.
 *
 * Opción B: visualización profesional con:
 *   - WAPE por categoría/segmento (bar chart)
 *   - Distribución de BIAS (scatter WAPE vs BIAS)
 *   - Comparativa multi-categoría
 *   - Drill-down al Dataset demo
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
import InsightsIcon from "@mui/icons-material/Insights"
import BarChartIcon from "@mui/icons-material/BarChart"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, ResponsiveContainer,
  ReferenceLine, Cell, ScatterChart, Scatter, Legend,
} from "recharts"
import { api, ApiError } from "@/lib/api"

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]

interface SkuMetrics {
  sku_id: string; wape: number | null; bias: number | null
  cluster_abc: string | null; cluster_xyz: string | null
}
interface CategoryAnalysisResponse {
  categoria: string; n_skus: number; freq: string; horizon: number; duration_s: number
  wape_mean: number | null; wape_p50: number | null; wape_p90: number | null; bias_mean: number | null
  by_segment: Record<string, { wape_mean: number; n_skus: number }>
  worst_skus: SkuMetrics[]; best_skus: SkuMetrics[]
}

function wapeColor(v: number): string {
  if (v < 0.15) return "#22c55e"
  if (v < 0.30) return "#f59e0b"
  return "#ef4444"
}

export default function AnalyticsPage() {
  const router = useRouter()
  const [categoria, setCategoria] = useState("Electrónica")
  const [freq, setFreq]           = useState("W")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [result, setResult]       = useState<CategoryAnalysisResponse | null>(null)
  const [allResults, setAllResults] = useState<CategoryAnalysisResponse[]>([])

  const handleAnalyze = async () => {
    setLoading(true); setError(null)
    try {
      const res = await api.post<CategoryAnalysisResponse>(
        `/api/datasets/demo/analyze-category?categoria=${encodeURIComponent(categoria)}&freq=${freq}&horizon=12&max_skus=200`,
        {}
      )
      setResult(res)
      setAllResults((prev) => [...prev.filter((r) => r.categoria !== res.categoria), res])
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error en el análisis.")
    } finally { setLoading(false) }
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
            Forecast accuracy agregada por categoría y segmento ABC-XYZ
          </Typography>
        </Box>
      </Box>

      {/* Controles */}
      <Paper variant="outlined" sx={{ p: "1.25rem", display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end", borderRadius: "0.75rem" }}>
        <FormControl size="small" sx={{ minWidth: "11rem" }}>
          <InputLabel>Categoría</InputLabel>
          <Select value={categoria} label="Categoría" onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: "9rem" }}>
          <InputLabel>Frecuencia</InputLabel>
          <Select value={freq} label="Frecuencia" onChange={(e) => setFreq(e.target.value)}>
            <MenuItem value="W">Semanal</MenuItem>
            <MenuItem value="M">Mensual</MenuItem>
          </Select>
        </FormControl>
        <Button variant="contained"
          startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
          onClick={handleAnalyze} disabled={loading}
          sx={{ textTransform: "none", fontWeight: 600 }}>
          {loading ? "Analizando… (~30s)" : `Analizar ${categoria}`}
        </Button>
        {allResults.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
            {allResults.length} categoría{allResults.length > 1 ? "s" : ""} analizadas · acumuladas para comparar
          </Typography>
        )}
      </Paper>

      {loading && <LinearProgress sx={{ borderRadius: "0.25rem" }} />}
      {error   && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Empty state */}
      {!result && !loading && (
        <Paper variant="outlined" sx={{ p: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", borderRadius: "0.75rem", borderStyle: "dashed" }}>
          <InsightsIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">Seleccioná una categoría y analizá</Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="28rem">
            StatsForecast AutoETS vectorizado sobre 200 SKUs con hold-out 12 períodos.
            Verás WAPE/BIAS por segmento ABC-XYZ y scatter de excepciones para drill-down.
          </Typography>
        </Paper>
      )}

      {result && (
        <>
          {/* KPIs */}
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.75rem" }}>
            {[
              { label: "SKUs",       value: result.n_skus.toString() },
              { label: "WAPE medio", value: result.wape_mean != null ? (result.wape_mean * 100).toFixed(1) + "%" : "—" },
              { label: "WAPE p50",   value: result.wape_p50  != null ? (result.wape_p50  * 100).toFixed(1) + "%" : "—" },
              { label: "WAPE p90",   value: result.wape_p90  != null ? (result.wape_p90  * 100).toFixed(1) + "%" : "—" },
              { label: "BIAS medio", value: result.bias_mean != null ? (result.bias_mean > 0 ? "+" : "") + (result.bias_mean * 100).toFixed(1) + "%" : "—" },
              { label: "Duración",   value: `${result.duration_s}s` },
            ].map(({ label, value }) => (
              <Paper key={label} variant="outlined" sx={{ p: "1rem", borderRadius: "0.75rem" }}>
                <Typography variant="caption" color="text.disabled">{label}</Typography>
                <Typography variant="h5" fontWeight={700} color="text.primary" sx={{ mt: "0.25rem" }}>{value}</Typography>
              </Paper>
            ))}
          </Box>

          {/* Charts */}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: "1.25rem" }}>

            {/* WAPE por segmento */}
            <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem" }}>
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "1rem" }}>
                WAPE (%) por segmento — {result.categoria}
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

            {/* WAPE vs BIAS scatter */}
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
                BIAS &gt;0 = sobreestima (stock excesivo) · &lt;0 = subestima (quiebre de stock)
              </Typography>
            </Paper>
          </Box>

          {/* Comparativa multi-categoría */}
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
          <Button variant="outlined" startIcon={<BarChartIcon />}
            onClick={() => router.push("/dashboard/dataset?tab=2")}
            sx={{ textTransform: "none", alignSelf: "flex-start" }}>
            Drill-down por SKU →
          </Button>
        </>
      )}
    </Box>
  )
}
