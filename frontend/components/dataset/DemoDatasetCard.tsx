"use client"

/**
 * DemoDatasetCard — dos modos de trabajo con el dataset sintético.
 *
 * Modo 1 — SKU individual:
 *   Buscador por texto → selector de SKU → carga la serie → Forecast
 *
 * Modo 2 — Categoría completa:
 *   Elige categoría → StatsForecast vectorizado sobre todos los SKUs →
 *   tabla de métricas WAPE/BIAS por SKU → drill-down al hacer click
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Chip from "@mui/material/Chip"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import TextField from "@mui/material/TextField"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Paper from "@mui/material/Paper"
import LinearProgress from "@mui/material/LinearProgress"
import Tooltip from "@mui/material/Tooltip"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import SearchIcon from "@mui/icons-material/Search"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import BarChartIcon from "@mui/icons-material/BarChart"
import PersonSearchIcon from "@mui/icons-material/PersonSearch"
import { api, ApiError } from "@/lib/api"
import { addSessionDataset } from "@/lib/sessionDatasets"
import { appStore } from "@/lib/appStore"

// ── Types ─────────────────────────────────────────────────────────────────────

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]
const FREQS      = [{ v: "W", l: "Semanal" }, { v: "M", l: "Mensual" }]

interface DemoSkusResponse  { categoria: string; skus: string[]; total: number }
interface DemoLoadResponse  { dataset_id: string; sku_id: string; rows: number; columns: string[]; date_range: string }
interface SkuMetrics {
  sku_id: string; wape: number | null; mae: number | null; bias: number | null
  model: string; n_obs: number; cluster_abc: string | null; cluster_xyz: string | null
}
interface CategoryAnalysisResponse {
  categoria: string; n_skus: number; freq: string; horizon: number; duration_s: number
  wape_mean: number | null; wape_p50: number | null; wape_p90: number | null; bias_mean: number | null
  by_segment: Record<string, { wape_mean: number; n_skus: number }>
  worst_skus: SkuMetrics[]; best_skus: SkuMetrics[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function WapeBadge({ v }: { v: number | null }) {
  if (v === null) return <Typography variant="caption" color="text.disabled">—</Typography>
  const color = v < 0.15 ? "success" : v < 0.30 ? "warning" : "error"
  return (
    <Chip label={v.toFixed(3)} size="small" color={color} variant="outlined"
      sx={{ height: "1.25rem", fontSize: "0.6875rem", fontFamily: "monospace" }} />
  )
}

function BiasBadge({ v }: { v: number | null }) {
  if (v === null) return <Typography variant="caption" color="text.disabled">—</Typography>
  const color = Math.abs(v) < 0.05 ? "success" : Math.abs(v) < 0.15 ? "warning" : "error"
  const label = (v > 0 ? "+" : "") + v.toFixed(3)
  return (
    <Chip label={label} size="small" color={color} variant="outlined"
      sx={{ height: "1.25rem", fontSize: "0.6875rem", fontFamily: "monospace" }} />
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DemoDatasetCard() {
  const router  = useRouter()
  const [mode, setMode]         = useState(0)  // 0=SKU, 1=Categoría
  const [categoria, setCategoria] = useState("Electrónica")
  const [freq, setFreq]         = useState("W")
  const [horizon, setHorizon]   = useState(12)
  const [error, setError]       = useState<string | null>(null)

  // ── Modo 1: SKU individual ─────────────────────────────────────────────────
  const [search, setSearch]         = useState("")
  const [skus, setSkus]             = useState<string[]>([])
  const [skuId, setSkuId]           = useState("")
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loadingSku, setLoadingSku] = useState(false)
  const [loaded, setLoaded]         = useState<DemoLoadResponse | null>(null)

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const fetchSkus = useCallback((cat: string, q: string) => {
    setLoadingSkus(true)
    setSkus([])
    const url = `/api/datasets/demo/skus?categoria=${encodeURIComponent(cat)}&search=${encodeURIComponent(q)}&limit=100`
    api.get<DemoSkusResponse>(url)
      .then((r) => setSkus(r.skus))
      .catch((e) => setError(e instanceof ApiError ? e.message : "Error al cargar SKUs."))
      .finally(() => setLoadingSkus(false))
  }, [])

  // Cargar SKUs al cambiar categoría (inmediato) o búsqueda (debounced 400ms)
  useEffect(() => {
    setSkuId(""); setLoaded(null); setError(null)
    fetchSkus(categoria, "")
    setSearch("")
  }, [categoria, fetchSkus])

  const handleSearchChange = (val: string) => {
    setSearch(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => fetchSkus(categoria, val), 400)
  }

  const handleLoadSku = async () => {
    if (!skuId) return
    setLoadingSku(true); setError(null); setLoaded(null)
    try {
      const res = await api.post<DemoLoadResponse>("/api/datasets/demo/load", { sku_id: skuId, categoria, freq: "D" })
      setLoaded(res)
      addSessionDataset({ dataset_id: res.dataset_id, filename: `demo_${res.sku_id}`, created_at: new Date().toISOString() })
      appStore.setActiveDataset(res.dataset_id, "fecha", "ventas", "D")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el SKU.")
    } finally {
      setLoadingSku(false)
    }
  }

  // ── Modo 2: Categoría completa ─────────────────────────────────────────────
  const [analyzing, setAnalyzing]   = useState(false)
  const [analysis, setAnalysis]     = useState<CategoryAnalysisResponse | null>(null)
  const [activeTable, setActiveTable] = useState<"worst" | "best">("worst")

  const handleAnalyze = async () => {
    setAnalyzing(true); setError(null); setAnalysis(null)
    try {
      const res = await api.post<CategoryAnalysisResponse>(
        `/api/datasets/demo/analyze-category?categoria=${encodeURIComponent(categoria)}&freq=${freq}&horizon=${horizon}&max_skus=200`,
        {}
      )
      setAnalysis(res)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error en el análisis.")
    } finally {
      setAnalyzing(false)
    }
  }

  const handleDrillDown = async (skuMetric: SkuMetrics) => {
    setMode(0)
    setSkuId(skuMetric.sku_id)
    // Cargar directamente la serie del SKU
    setLoadingSku(true); setError(null); setLoaded(null)
    try {
      const res = await api.post<DemoLoadResponse>("/api/datasets/demo/load", {
        sku_id: skuMetric.sku_id, categoria, freq: "D"
      })
      setLoaded(res)
      addSessionDataset({ dataset_id: res.dataset_id, filename: `demo_${res.sku_id}`, created_at: new Date().toISOString() })
      appStore.setActiveDataset(res.dataset_id, "fecha", "ventas", "D")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el SKU.")
    } finally { setLoadingSku(false) }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <AutoGraphIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
        <Box>
          <Typography variant="h6" fontWeight={700} color="text.primary">Dataset demo — Ventas retail</Typography>
          <Typography variant="caption" color="text.secondary">
            25 000 SKUs × 3 años · DuckDB → Supabase Storage
          </Typography>
        </Box>
      </Box>

      {/* Controles comunes */}
      <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: "11rem" }}>
          <InputLabel>Categoría</InputLabel>
          <Select value={categoria} label="Categoría" onChange={(e) => { setCategoria(e.target.value); setAnalysis(null) }}>
            {CATEGORIAS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: "8rem" }}>
          <InputLabel>Frecuencia</InputLabel>
          <Select value={freq} label="Frecuencia" onChange={(e) => setFreq(e.target.value)}>
            {FREQS.map((f) => <MenuItem key={f.v} value={f.v}>{f.l}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField
          size="small" type="number" label="Horizonte" value={horizon}
          onChange={(e) => setHorizon(Math.max(4, Math.min(52, +e.target.value)))}
          sx={{ width: "7rem" }} inputProps={{ min: 4, max: 52 }}
        />
      </Box>

      {/* Modo tabs */}
      <Tabs value={mode} onChange={(_, v) => setMode(v)}
        sx={{ borderBottom: "1px solid", borderColor: "divider", minHeight: "2.5rem",
          "& .MuiTab-root": { textTransform: "none", fontSize: "0.875rem", minHeight: "2.5rem" } }}>
        <Tab icon={<PersonSearchIcon sx={{ fontSize: "1rem" }} />} iconPosition="start" label="SKU individual" />
        <Tab icon={<BarChartIcon    sx={{ fontSize: "1rem" }} />} iconPosition="start" label="Categoría completa" />
      </Tabs>

      {/* Error */}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* ── MODO 1: SKU individual ─────────────────────────────────────── */}
      {mode === 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>

            {/* Buscador */}
            <TextField
              size="small" label="Buscar SKU" value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="SKU-001, SKU-123…"
              sx={{ minWidth: "12rem" }}
              InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: "1rem", mr: "0.375rem", color: "text.disabled" }} /> }}
            />

            {/* Selector de SKU */}
            <FormControl size="small" sx={{ minWidth: "13rem" }} disabled={loadingSkus}>
              <InputLabel>{loadingSkus ? "Cargando…" : `SKUs (${skus.length})`}</InputLabel>
              <Select value={skuId} label={loadingSkus ? "Cargando…" : `SKUs (${skus.length})`}
                onChange={(e) => { setSkuId(e.target.value); setLoaded(null) }}>
                {skus.map((s) => (
                  <MenuItem key={s} value={s} sx={{ fontSize: "0.8125rem", fontFamily: "monospace" }}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              variant="contained"
              startIcon={loadingSku ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
              onClick={handleLoadSku} disabled={!skuId || loadingSku}
              sx={{ textTransform: "none", fontWeight: 600, height: "2.5rem" }}
            >
              {loadingSku ? "Cargando…" : "Cargar serie"}
            </Button>
          </Box>

          {loadingSkus && <LinearProgress sx={{ borderRadius: "0.25rem" }} />}

          {loaded && (
            <Alert severity="success"
              action={
                <Button size="small" variant="contained" onClick={() => router.push("/dashboard/forecast")}
                  sx={{ textTransform: "none", fontWeight: 600 }}>
                  Ir a Forecast →
                </Button>
              }>
              <strong>{loaded.sku_id}</strong> — {loaded.rows.toLocaleString("es-AR")} filas · {loaded.date_range}
            </Alert>
          )}

          <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
            DuckDB descarga solo las filas del SKU elegido. Columnas: fecha, ventas, precio, stock.
          </Typography>
        </Box>
      )}

      {/* ── MODO 2: Categoría completa ─────────────────────────────────── */}
      {mode === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          <Box sx={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
            <Button
              variant="contained"
              startIcon={analyzing ? <CircularProgress size="1rem" color="inherit" /> : <BarChartIcon />}
              onClick={handleAnalyze} disabled={analyzing}
              sx={{ textTransform: "none", fontWeight: 600 }}
            >
              {analyzing ? "Analizando… (puede tardar ~30s)" : `Analizar ${categoria}`}
            </Button>
            {analyzing && <Typography variant="caption" color="text.secondary">
              StatsForecast AutoETS vectorizado sobre 200 SKUs con hold-out {horizon} períodos
            </Typography>}
          </Box>

          {analyzing && <LinearProgress sx={{ borderRadius: "0.25rem" }} />}

          {analysis && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

              {/* Métricas agregadas */}
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(9rem, 1fr))", gap: "0.625rem" }}>
                {[
                  { label: "SKUs analizados", value: analysis.n_skus, fmt: (v: number) => v.toString() },
                  { label: "WAPE medio",       value: analysis.wape_mean,  fmt: (v: number) => v.toFixed(3) },
                  { label: "WAPE p50",         value: analysis.wape_p50,   fmt: (v: number) => v.toFixed(3) },
                  { label: "WAPE p90",         value: analysis.wape_p90,   fmt: (v: number) => v.toFixed(3) },
                  { label: "BIAS medio",       value: analysis.bias_mean,  fmt: (v: number) => (v > 0 ? "+" : "") + v.toFixed(3) },
                  { label: "Duración",         value: analysis.duration_s, fmt: (v: number) => `${v}s` },
                ].map(({ label, value, fmt }) => (
                  <Box key={label} sx={{ bgcolor: "background.paper", border: "1px solid", borderColor: "divider", borderRadius: "0.625rem", p: "0.75rem" }}>
                    <Typography variant="caption" color="text.disabled">{label}</Typography>
                    <Typography variant="h6" fontWeight={700} color="text.primary" sx={{ mt: "0.125rem" }}>
                      {value != null ? fmt(value as number) : "—"}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Por segmento ABC-XYZ */}
              {Object.keys(analysis.by_segment).length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: "0.5rem" }}>WAPE por segmento ABC-XYZ</Typography>
                  <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    {Object.entries(analysis.by_segment)
                      .sort((a, b) => a[0].localeCompare(b[0]))
                      .map(([seg, vals]) => {
                        const w = vals.wape_mean as number
                        const color = w < 0.15 ? "success" : w < 0.30 ? "warning" : "error"
                        return (
                          <Chip key={seg} color={color} variant="outlined" size="small"
                            label={`${seg}: ${w.toFixed(3)} (${vals.n_skus} SKUs)`}
                            sx={{ fontSize: "0.75rem", fontFamily: "monospace" }} />
                        )
                      })}
                  </Box>
                </Box>
              )}

              {/* Tabla SKUs mejor/peor */}
              <Box>
                <Tabs value={activeTable} onChange={(_, v) => setActiveTable(v)}
                  sx={{ mb: "0.75rem", minHeight: "2.25rem",
                    "& .MuiTab-root": { textTransform: "none", fontSize: "0.8125rem", minHeight: "2.25rem" } }}>
                  <Tab value="worst" label={`Peor WAPE (top 20)`} />
                  <Tab value="best"  label={`Mejor WAPE (top 20)`} />
                </Tabs>

                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "0.625rem" }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: "background.default" }}>
                        {["SKU", "WAPE", "BIAS", "Segmento", "Obs.", ""].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary", py: "0.625rem" }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(activeTable === "worst" ? analysis.worst_skus : analysis.best_skus).map((m) => (
                        <TableRow key={m.sku_id} hover
                          sx={{ cursor: "pointer", "&:hover .drill": { opacity: 1 } }}
                          onClick={() => handleDrillDown(m)}>
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
                            <Tooltip title="Drill-down: cargar serie y hacer Forecast">
                              <Button className="drill" size="small" variant="outlined"
                                sx={{ opacity: 0, transition: "opacity 0.15s", textTransform: "none", fontSize: "0.75rem", py: "0.125rem" }}>
                                Analizar →
                              </Button>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                <Typography variant="caption" color="text.disabled" sx={{ mt: "0.5rem", display: "block" }}>
                  Click en una fila → carga la serie en modo SKU individual → podés correr Forecast con LightGBM
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
