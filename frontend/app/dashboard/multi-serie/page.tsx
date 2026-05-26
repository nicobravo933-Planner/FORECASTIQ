"use client"

/**
 * /dashboard/multi-serie — UX-MS-2 + MS-B1 + MS-UX1 + MS-UX2
 *
 * Modos de análisis:
 *   "Rápido"    → AutoETS sobre todos los datos → forecast futuro
 *   "Benchmark" → N modelos + train/test split → WAPE real + modelo ganador por entidad (MS-B1)
 *
 * MS-UX1: Tab "Gráfico" — serie histórica + predicción futuras de una entidad
 * MS-UX2: Persistencia — resultado se guarda en localStorage, sobrevive navegación
 *
 * Tier protections:
 *   local → sin límite, todos los modelos  |  ec2 → 150 series, sin AutoARIMA  |  cloud → 50 series
 */

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Alert from "@mui/material/Alert"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Checkbox from "@mui/material/Checkbox"
import Chip from "@mui/material/Chip"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import FormControl from "@mui/material/FormControl"
import FormControlLabel from "@mui/material/FormControlLabel"
import InputLabel from "@mui/material/InputLabel"
import MenuItem from "@mui/material/MenuItem"
import Paper from "@mui/material/Paper"
import Select from "@mui/material/Select"
import Tab from "@mui/material/Tab"
import Tabs from "@mui/material/Tabs"
import TextField from "@mui/material/TextField"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import { DataGrid, type GridColDef, type GridRenderCellParams } from "@mui/x-data-grid"
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip, Legend, ReferenceLine, ResponsiveContainer,
} from "recharts"
import BarChartIcon from "@mui/icons-material/BarChart"
import EmojiEventsIcon from "@mui/icons-material/EmojiEvents"
import GroupWorkIcon from "@mui/icons-material/GroupWork"
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined"
import LockIcon from "@mui/icons-material/Lock"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import ShowChartIcon from "@mui/icons-material/ShowChart"
import DownloadIcon from "@mui/icons-material/Download"
import WarningAmberIcon from "@mui/icons-material/WarningAmber"

import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import { PipelineBar } from "@/components/common/PipelineBar"
import { DatasetSelector } from "@/components/common/DatasetSelector"
import type { BatchForecastResponse } from "@/lib/types"

// ── Constants ──────────────────────────────────────────────────────────────

const FREQ_OPTIONS = [
  { value: "D", label: "Diaria" },
  { value: "W", label: "Semanal" },
  { value: "M", label: "Mensual" },
  { value: "Q", label: "Trimestral" },
]
const FREQ_MAX: Record<string, number> = { D: 90, W: 52, M: 24, Q: 8 }

// Nombres de meses abreviados para el eje X del gráfico
const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

const MODELS_CATALOG = [
  { id: "SeasonalNaive", label: "Seasonal Naive", tooltip: "Baseline estacional — siempre disponible. Copia el mismo período del año anterior." },
  { id: "AutoETS",       label: "AutoETS",        tooltip: "Suavizamiento exponencial automático — disponible en todos los tiers." },
  { id: "AutoARIMA",     label: "AutoARIMA",      tooltip: "ARIMA automático. Más robusto para tendencias complejas, pero lento. Solo tier local." },
  { id: "LightGBM",      label: "LightGBM",       tooltip: "ML con lags lag_1/2/3/12. Mismo pipeline que el Streamlit de referencia. Solo tier local — secuencial, ~1-2s por serie." },
]

const TIER_MAX_SERIES: Record<string, number> = { local: 9999, ec2: 150, cloud: 50 }
const TIER_BLOCKED_MODELS: Record<string, string[]> = {
  local: [],
  ec2:   ["AutoARIMA", "LightGBM"],
  cloud: ["AutoARIMA", "LightGBM"],
}

// Colores semáforo
const wapeColor = (w: number | null) => w === null ? "text.disabled" : w > 0.35 ? "error.main" : w > 0.20 ? "warning.main" : "success.main"
const biasColor = (b: number | null) => b === null ? "text.disabled" : Math.abs(b) > 15 ? "error.main" : Math.abs(b) > 8 ? "warning.main" : "text.primary"

// Colores por modelo para el gráfico
const MODEL_COLORS: Record<string, string> = {
  historical:    "#6366f1",
  predicted:     "#6366f1",
  SeasonalNaive: "#9ca3af",
  AutoETS:       "#10b981",
  AutoARIMA:     "#f59e0b",
  LightGBM:      "#ef4444",
}

// Formateador de eje X: "2024-01-01" → "Ene 24"
function fmtDateAxis(ds: string): string {
  try {
    const d = new Date(ds)
    return `${MONTH_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`
  } catch { return ds }
}

// ── Types ──────────────────────────────────────────────────────────────────

interface ColumnInfo {
  name: string
  dtype: "datetime" | "numeric" | "text"
  sample_values: string[]
}

interface QuickResult extends BatchForecastResponse {
  model_used: string
}

interface BenchmarkAccuracyRow {
  unique_id: string; model: string
  wape: number; bias: number; score: number; n_obs_test: number
}
interface BestModelRow {
  unique_id: string; best_model: string
  wape: number | null; bias: number | null; score: number | null
}
interface ModelRankingRow {
  model: string; wape_mean: number; bias_mean: number; n_wins: number
}
interface BenchmarkResult {
  n_series: number; horizon: number; freq: string; duration_s: number
  train_end: string; test_periods: number; models_used: string[]
  predictions: BatchForecastResponse["predictions"]
  accuracy: BenchmarkAccuracyRow[]; best_models: BestModelRow[]
  model_ranking: ModelRankingRow[]; series_skipped: string[]
}

// Payload persistido en localStorage
interface StoredResult {
  mode: "quick" | "benchmark"
  data: QuickResult | BenchmarkResult
}

// Punto del gráfico inline (histórico + predicción unificados)
interface ChartPoint {
  ds: string
  real?: number
  [model: string]: number | string | undefined
}

// ── Helpers ────────────────────────────────────────────────────────────────

function downloadCsv(predictions: BatchForecastResponse["predictions"], filename: string) {
  const header = "unique_id,ds,predicted"
  const rows   = predictions.map((p) => `${p.unique_id},${p.ds},${p.predicted}`)
  const blob   = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" })
  const url    = URL.createObjectURL(blob)
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function downloadBenchmarkCsv(result: BenchmarkResult) {
  const header = "unique_id,best_model,wape_pct,bias_pct,score"
  const rows   = result.best_models.map((r) =>
    `${r.unique_id},${r.best_model},${r.wape !== null ? (r.wape * 100).toFixed(2) : ""},` +
    `${r.bias !== null ? r.bias.toFixed(2) : ""},${r.score !== null ? r.score.toFixed(4) : ""}`
  )
  const blob = new Blob([header + "\n" + rows.join("\n")], { type: "text/csv" })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement("a")
  a.href = url; a.download = `benchmark_ganadores_${new Date().toISOString().slice(0, 10)}.csv`; a.click()
  URL.revokeObjectURL(url)
}

async function downloadBenchmarkXlsx(result: BenchmarkResult) {
  try {
    const res = await fetch("/api/batch/benchmark-export-xlsx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    })
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const blob = await res.blob()
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = `benchmark_multi_serie_${result.train_end || new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    console.error("Error al descargar Excel:", err)
  }
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function MultiSeriePage() {
  const router = useRouter()

  // Tier
  const [tier, setTier] = useState<"local" | "ec2" | "cloud">("local")

  // Data source
  const [dataMode, setDataMode] = useState<"own" | "demo">("own")

  // Modo análisis — se restaura desde localStorage si hay resultado guardado
  const [analysisMode, setAnalysisMode] = useState<"quick" | "benchmark">(() => {
    const stored = appStore.getLastMultiSerieResult<StoredResult>()
    return stored?.mode ?? "benchmark"
  })

  // Dataset
  const [datasetId, setDatasetId] = useState<string>("")
  const [columns,   setColumns]   = useState<ColumnInfo[]>([])
  const [dateCol,   setDateCol]   = useState<string>("")
  const [targetCol, setTargetCol] = useState<string>("")
  const [entityCol, setEntityCol] = useState<string>("")

  // Forecast config
  const [freq,      setFreq]      = useState<string>("M")
  const [horizon,   setHorizon]   = useState<number>(12)
  const [maxSeries, setMaxSeries] = useState<number>(9999)

  // Modo rápido
  const [quickModel, setQuickModel] = useState<string>("AutoETS")

  // Modo benchmark
  const [selectedModels, setSelectedModels] = useState<string[]>(["SeasonalNaive", "AutoETS"])
  const [trainEnd,       setTrainEnd]       = useState<string>("")

  // Demo
  const [demoCategory, setDemoCategory] = useState<string>("all")

  // Results — MS-UX2: inicializar desde localStorage
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState<string | null>(null)
  const [quickResult,     setQuickResult]     = useState<QuickResult | null>(() => {
    const s = appStore.getLastMultiSerieResult<StoredResult>()
    return s?.mode === "quick" ? (s.data as QuickResult) : null
  })
  const [benchmarkResult, setBenchmarkResult] = useState<BenchmarkResult | null>(() => {
    const s = appStore.getLastMultiSerieResult<StoredResult>()
    return s?.mode === "benchmark" ? (s.data as BenchmarkResult) : null
  })
  const [activeTab,       setActiveTab]       = useState(0)
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 })

  // MS-UX1: gráfico inline por entidad
  const [chartEntity,    setChartEntity]    = useState<string>("")
  const [chartData,      setChartData]      = useState<ChartPoint[]>([])
  const [chartLoading,   setChartLoading]   = useState(false)
  const prevEntityRef = useRef<string>("")

  // Shorthand
  const activeResult      = analysisMode === "benchmark" ? benchmarkResult : quickResult
  const activePredictions = activeResult?.predictions ?? []
  const hasResult         = quickResult !== null || benchmarkResult !== null

  // MS-UX1: cuando cambia la entidad seleccionada, construir los datos del gráfico
  useEffect(() => {
    if (!chartEntity || chartEntity === prevEntityRef.current) return
    prevEntityRef.current = chartEntity

    // Predicciones futuras de esta entidad (ya disponibles en memoria)
    const futurePreds = activePredictions.filter((p) => p.unique_id === chartEntity)
    if (!futurePreds.length) { setChartData([]); return }

    // Cargar datos históricos del dataset si está disponible
    if (!datasetId || !dateCol || !targetCol) {
      // Sin dataset — mostrar solo predicciones
      const points: ChartPoint[] = futurePreds.map((p) => ({
        ds: p.ds, predicted: p.predicted,
      }))
      setChartData(points)
      return
    }

    setChartLoading(true)
    // Cargar hasta 2000 filas del dataset, filtrar por entidad en frontend
    api.get<{ columns: string[]; rows: Record<string, string>[] }>(
      `/api/datasets/${datasetId}/page?page=1&page_size=2000`
    )
      .then((res) => {
        const histPoints = res.rows
          .filter((r) => entityCol && String(r[entityCol] ?? "") === chartEntity)
          .map((r) => ({
            ds:   String(r[dateCol] ?? ""),
            real: parseFloat(String(r[targetCol] ?? "0")),
          }))
          .filter((p) => p.ds && !isNaN(p.real))
          .sort((a, b) => a.ds.localeCompare(b.ds))

        // Determinar el modelo usado para esta entidad
        const modelKey = benchmarkResult
          ? benchmarkResult.best_models.find((m) => m.unique_id === chartEntity)?.best_model ?? "predicted"
          : "predicted"

        // Unir histórico + predicciones en un array cronológico
        const combined: ChartPoint[] = [
          ...histPoints.map((p) => ({ ds: p.ds, real: p.real })),
          ...futurePreds.map((p) => ({ ds: p.ds, [modelKey]: p.predicted })),
        ]
        setChartData(combined)
      })
      .catch(() => {
        // Fallback: solo predicciones
        const modelKey = benchmarkResult
          ? benchmarkResult.best_models.find((m) => m.unique_id === chartEntity)?.best_model ?? "predicted"
          : "predicted"
        setChartData(futurePreds.map((p) => ({ ds: p.ds, [modelKey]: p.predicted })))
      })
      .finally(() => setChartLoading(false))
  }, [chartEntity]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDatasetSelect = useCallback((newId: string) => {
    setDatasetId(newId)
    setDateCol(appStore.getActiveDateCol() ?? "")
    setTargetCol(appStore.getActiveTargetCol() ?? "")
    setFreq(appStore.getActiveFreq() ?? "M")
    setColumns([])
    setQuickResult(null); setBenchmarkResult(null)
    appStore.clearLastMultiSerieResult()
    setError(null)
    api.get<{ columns: ColumnInfo[] }>(`/api/datasets/${newId}/preview`)
      .then((r) => setColumns(r.columns))
      .catch(() => {})
  }, [])

  // On mount
  useEffect(() => {
    api.get<{ tier: string }>("/api/capabilities")
      .then((caps) => {
        const t = (caps.tier ?? "local") as "local" | "ec2" | "cloud"
        setTier(t); setMaxSeries(TIER_MAX_SERIES[t])
        if (t !== "local") setSelectedModels((prev) => prev.filter((m) => m !== "AutoARIMA"))
      })
      .catch(() => {})

    const id      = appStore.getActiveDatasetId()
    const dateC   = appStore.getActiveDateCol()
    const targetC = appStore.getActiveTargetCol()
    const freqS   = appStore.getActiveFreq() ?? "M"
    const entityC = appStore.getEntityCol()

    if (id) {
      setDatasetId(id)
      if (dateC)   setDateCol(dateC)
      if (targetC) setTargetCol(targetC)
      if (entityC) setEntityCol(entityC)
      setFreq(freqS)
      api.get<{ columns: ColumnInfo[] }>(`/api/datasets/${id}/preview`)
        .then((r) => setColumns(r.columns))
        .catch(() => {})
    } else {
      setDataMode("demo")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleModel = (id: string) => {
    setSelectedModels((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((m) => m !== id) : prev) : [...prev, id]
    )
  }

  // ── Run ──────────────────────────────────────────────────────────────────
  const handleRun = async () => {
    setError(null); setLoading(true); setActiveTab(0)
    setChartEntity(""); setChartData([])

    try {
      if (dataMode === "demo") {
        const params = new URLSearchParams({
          freq, horizon: String(horizon), model: quickModel,
          category: demoCategory, max_series: String(maxSeries),
        })
        const data = await api.get<QuickResult>(`/api/batch/demo?${params.toString()}`)
        setQuickResult(data); setBenchmarkResult(null)
        appStore.setLastMultiSerieResult({ mode: "quick", data })
        return
      }

      if (!datasetId || !dateCol || !targetCol || !entityCol) {
        setError("Completá todos los selectores antes de analizar."); return
      }

      if (analysisMode === "quick") {
        const body = {
          dataset_id: datasetId, date_col: dateCol, target_col: targetCol,
          id_col: entityCol, freq, horizon, model: quickModel,
          max_series: tier !== "local" ? maxSeries : undefined,
        }
        const data = await api.post<QuickResult>("/api/batch/forecast-dataset", body)
        setQuickResult(data); setBenchmarkResult(null)
        appStore.setLastMultiSerieResult({ mode: "quick", data })

      } else {
        if (!trainEnd) { setError("Indicá la fecha de fin de entrenamiento."); return }
        if (!selectedModels.length) { setError("Seleccioná al menos un modelo."); return }
        const body = {
          dataset_id: datasetId, date_col: dateCol, target_col: targetCol,
          id_col: entityCol, freq, horizon,
          train_end: trainEnd, models: selectedModels,
          max_series: tier !== "local" ? maxSeries : undefined,
        }
        const data = await api.post<BenchmarkResult>("/api/batch/benchmark-dataset", body)
        setBenchmarkResult(data); setQuickResult(null)
        appStore.setLastMultiSerieResult({ mode: "benchmark", data })
      }

    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al ejecutar el análisis.")
    } finally {
      setLoading(false)
    }
  }

  const handleDrillDown = (uniqueId: string) => {
    if (datasetId) {
      appStore.setActiveDataset(datasetId, dateCol, targetCol, freq)
      if (typeof window !== "undefined") sessionStorage.setItem("fiq_batch_drilldown_id", uniqueId)
    }
    router.push("/dashboard/forecast")
  }

  // ── Derived ──────────────────────────────────────────────────────────────
  const maxHorizon   = FREQ_MAX[freq] ?? 24
  const lockedModels = TIER_BLOCKED_MODELS[tier] ?? []
  const allSeries    = [...new Set(activePredictions.map((p) => p.unique_id))].sort()
  const textCols     = columns.filter((c) => c.dtype === "text")
  const numericCols  = columns.filter((c) => c.dtype === "numeric")
  const canRun       = dataMode === "demo" ? true : !!datasetId && !!dateCol && !!targetCol && !!entityCol

  const quickRankingData = quickResult
    ? allSeries.map((uid) => ({
        uid,
        total: quickResult.predictions.filter((p) => p.unique_id === uid)
                          .reduce((s, p) => s + p.predicted, 0),
      })).sort((a, b) => b.total - a.total)
    : []

  const benchmarkRankingData = benchmarkResult
    ? [...benchmarkResult.best_models].sort((a, b) => (a.wape ?? 1) - (b.wape ?? 1))
    : []

  // Modelos presentes en el gráfico (para la leyenda)
  const chartModelKeys = chartData.length
    ? Object.keys(chartData[0]).filter((k) => k !== "ds" && k !== "real")
    : []

  // Número de tab del gráfico
  const CHART_TAB_IDX = benchmarkResult ? 2 : 1

  const gridCols: GridColDef[] = [
    {
      field: "unique_id", headerName: "Entidad", flex: 1, minWidth: 120,
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
          {p.value as string}
        </Typography>
      ),
    },
    { field: "ds", headerName: "Fecha", flex: 1, minWidth: 110 },
    {
      field: "predicted", headerName: "Predicción", flex: 1, minWidth: 110,
      type: "number", align: "right", headerAlign: "right",
      renderCell: (p: GridRenderCellParams) => (
        <Typography variant="body2" sx={{ fontWeight: 500, fontSize: "0.75rem" }}>
          {(p.value as number).toLocaleString("es-AR", { maximumFractionDigits: 2 })}
        </Typography>
      ),
    },
    {
      field: "__actions", headerName: "", width: 130,
      sortable: false, filterable: false, disableColumnMenu: true,
      renderCell: (p: GridRenderCellParams) => (
        <Tooltip title="Ver en Forecast">
          <Button size="small" variant="outlined"
            startIcon={<ShowChartIcon sx={{ fontSize: "0.75rem !important" }} />}
            onClick={(e) => { e.stopPropagation(); handleDrillDown(p.row.unique_id as string) }}
            sx={{ textTransform: "none", fontSize: "0.6875rem", py: "0.125rem" }}>
            Forecast →
          </Button>
        </Tooltip>
      ),
    },
  ]

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ maxWidth: "90rem", mx: "auto" }}>
      <PipelineBar activeStep="/dashboard/multi-serie" />

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", mb: "1.5rem" }}>
        <GroupWorkIcon sx={{ fontSize: "1.75rem", color: "primary.main" }} />
        <Box>
          <Typography sx={{ fontSize: "1.375rem", fontWeight: 800, lineHeight: 1.2 }}>
            Multi-serie
          </Typography>
          <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary", mt: "0.125rem" }}>
            Forecast vectorizado para datasets con múltiples entidades · StatsForecast (Nixtla)
            {benchmarkResult && (
              <Chip label={benchmarkResult.test_periods > 0 ? `Test real: ${benchmarkResult.test_periods} períodos` : "Sin período de test"}
                size="small" color={benchmarkResult.test_periods > 0 ? "success" : "default"} variant="outlined"
                sx={{ ml: "0.75rem", fontSize: "0.6875rem", height: "1.375rem" }} />
            )}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "22rem 1fr" }, gap: "1.25rem", alignItems: "start" }}>

        {/* ── Config panel ─────────────────────────────────────────────── */}
        <Paper variant="outlined" sx={{ p: "1.25rem", borderRadius: "0.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Modo de análisis */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.375rem", display: "block" }}>
              Modo de análisis
            </Typography>
            <ToggleButtonGroup value={analysisMode} exclusive size="small" fullWidth
              onChange={(_, v) => { if (v) { setAnalysisMode(v as "quick" | "benchmark"); setActiveTab(0) } }}>
              <ToggleButton value="quick" sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}>
                Rápido
              </ToggleButton>
              <ToggleButton value="benchmark" sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}>
                Benchmark ✦
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: "0.25rem", display: "block", lineHeight: 1.4 }}>
              {analysisMode === "quick"
                ? "Un modelo, sin evaluación — ideal para exploración rápida."
                : "Múltiples modelos con train/test split → WAPE real + modelo ganador por entidad."}
            </Typography>
          </Box>

          <Divider />

          {/* Fuente de datos */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.375rem", display: "block" }}>
              Fuente de datos
            </Typography>
            <ToggleButtonGroup value={dataMode} exclusive size="small" fullWidth
              onChange={(_, v) => { if (v) setDataMode(v as "own" | "demo") }}>
              <ToggleButton value="own"  sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}>Dataset propio</ToggleButton>
              <ToggleButton value="demo" sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.75rem" }}>Demo 25k SKUs</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {dataMode === "own" && (
            <>
              <DatasetSelector activeDatasetId={datasetId || null} onSelect={handleDatasetSelect} showEtlBadge={false} />
              {datasetId && (
                <Tooltip title="Columna que identifica cada entidad: departamento, producto, tienda, etc.">
                  <FormControl size="small" fullWidth required>
                    <InputLabel>Columna entidad *</InputLabel>
                    <Select value={entityCol} label="Columna entidad *" onChange={(e) => setEntityCol(e.target.value)}>
                      <MenuItem value=""><em>— Elegí una —</em></MenuItem>
                      {[...textCols, ...numericCols].map((c) => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Tooltip>
              )}
              {!datasetId && <Alert severity="info" sx={{ fontSize: "0.8125rem" }}>Elegí un dataset del selector.</Alert>}
            </>
          )}

          {dataMode === "demo" && (
            <FormControl size="small" fullWidth>
              <InputLabel>Categoría demo</InputLabel>
              <Select value={demoCategory} label="Categoría demo" onChange={(e) => setDemoCategory(e.target.value)}>
                <MenuItem value="all">Todas las categorías</MenuItem>
                <MenuItem value="HOBBIES">Hobbies</MenuItem>
                <MenuItem value="FOODS">Alimentos</MenuItem>
                <MenuItem value="HOUSEHOLD">Hogar</MenuItem>
              </Select>
            </FormControl>
          )}

          <Divider />

          {/* Frecuencia + Horizonte */}
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <FormControl size="small" fullWidth>
              <InputLabel>Frecuencia</InputLabel>
              <Select value={freq} label="Frecuencia"
                onChange={(e) => { const f = e.target.value; setFreq(f); if (horizon > (FREQ_MAX[f] ?? 24)) setHorizon(FREQ_MAX[f] ?? 24) }}>
                {FREQ_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField size="small" type="number" label="Horizonte futuro"
              value={horizon} helperText={`máx ${maxHorizon}`}
              onChange={(e) => setHorizon(Math.max(1, Math.min(maxHorizon, +e.target.value)))}
              inputProps={{ min: 1, max: maxHorizon }} />
          </Box>

          {/* Modo rápido — un modelo */}
          {analysisMode === "quick" && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.375rem", display: "block" }}>Modelo</Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {MODELS_CATALOG.map(({ id, label, tooltip }) => {
                  const locked = lockedModels.includes(id)
                  return (
                    <Tooltip key={id} title={locked ? `${tooltip} — bloqueado en tier ${tier}` : tooltip} arrow>
                      <span>
                        <Box onClick={() => { if (!locked) setQuickModel(id) }}
                          sx={{ display: "flex", alignItems: "center", gap: "0.5rem", px: "0.75rem", py: "0.5rem",
                            borderRadius: "0.5rem", border: "1px solid",
                            borderColor: quickModel === id ? "primary.main" : "divider",
                            bgcolor: quickModel === id ? "rgba(99,102,241,0.06)" : "transparent",
                            cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.5 : 1,
                            transition: "all 0.15s", "&:hover": !locked ? { bgcolor: "action.hover" } : {} }}>
                          {locked && <LockIcon sx={{ fontSize: "0.75rem", color: "text.disabled" }} />}
                          <Typography variant="body2" fontWeight={quickModel === id ? 700 : 400}
                            color={locked ? "text.disabled" : "text.primary"}>{label}</Typography>
                          {locked && <Chip label={tier} size="small" variant="outlined" sx={{ fontSize: "0.625rem", height: "1.125rem", ml: "auto" }} />}
                        </Box>
                      </span>
                    </Tooltip>
                  )
                })}
              </Box>
            </Box>
          )}

          {/* Modo benchmark — checkboxes + train_end */}
          {analysisMode === "benchmark" && (
            <>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.25rem", display: "block" }}>
                  Fin del entrenamiento (Train End) *
                </Typography>
                <TextField size="small" fullWidth type="date"
                  value={trainEnd} onChange={(e) => setTrainEnd(e.target.value)}
                  helperText="Datos posteriores a esta fecha = test real para calcular WAPE."
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ max: new Date().toISOString().slice(0, 10) }} />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.25rem", display: "block" }}>
                  Modelos a comparar
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
                  {MODELS_CATALOG.map(({ id, label, tooltip }) => {
                    const locked  = lockedModels.includes(id)
                    const checked = selectedModels.includes(id)
                    return (
                      <Tooltip key={id} title={locked ? `${tooltip} — bloqueado en tier ${tier}` : tooltip} arrow placement="right">
                        <FormControlLabel disabled={locked}
                          control={<Checkbox size="small" checked={checked && !locked} onChange={() => { if (!locked) toggleModel(id) }} sx={{ py: "0.25rem" }} />}
                          label={<Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <Typography variant="body2" sx={{ fontSize: "0.8125rem" }}>{label}</Typography>
                            {locked && <Chip label={tier} size="small" variant="outlined" sx={{ fontSize: "0.5625rem", height: "1rem" }} />}
                          </Box>}
                          sx={{ m: 0 }} />
                      </Tooltip>
                    )
                  })}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: "0.25rem", display: "block" }}>
                  {selectedModels.length} modelo{selectedModels.length !== 1 ? "s" : ""} · el ganador re-entrena para el forecast futuro.
                </Typography>
              </Box>
            </>
          )}

          {/* Max series (ec2/cloud) */}
          {tier !== "local" && (
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.25rem", display: "block" }}>Máx. series</Typography>
              <TextField size="small" type="number" fullWidth value={maxSeries}
                onChange={(e) => setMaxSeries(Math.max(1, Math.min(TIER_MAX_SERIES[tier], +e.target.value)))}
                helperText={`Tier ${tier}: límite de ${TIER_MAX_SERIES[tier]} series.`}
                inputProps={{ min: 1, max: TIER_MAX_SERIES[tier] }} />
            </Box>
          )}

          {/* Tier badge */}
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", py: "0.5rem", px: "0.75rem", borderRadius: "0.5rem", bgcolor: "action.hover" }}>
            <WarningAmberIcon sx={{ fontSize: "0.875rem", color: tier === "local" ? "success.main" : "warning.main" }} />
            <Typography variant="caption" color="text.secondary">
              {tier === "local"
                ? <><strong>Local</strong> · sin límite · todos los modelos</>
                : <>Tier <strong>{tier}</strong> · máx {TIER_MAX_SERIES[tier]} series · AutoARIMA no disponible</>}
            </Typography>
          </Box>

          <Button variant="contained" fullWidth
            startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
            disabled={loading || !canRun} onClick={() => void handleRun()}
            sx={{ textTransform: "none", fontWeight: 600, py: "0.625rem" }}>
            {loading ? "Analizando…" : analysisMode === "benchmark" ? "Ejecutar Benchmark" : "Analizar"}
          </Button>

          {error && <Alert severity="error" onClose={() => setError(null)} sx={{ fontSize: "0.8125rem" }}>{error}</Alert>}
        </Paper>

        {/* ── Results panel ──────────────────────────────────────────────── */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Empty state */}
          {!hasResult && !loading && (
            <Paper variant="outlined" sx={{ p: "3rem", display: "flex", flexDirection: "column",
              alignItems: "center", gap: "1rem", borderRadius: "0.75rem", borderStyle: "dashed" }}>
              <GroupWorkIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
              <Typography variant="h6" color="text.secondary">
                {canRun ? "Configurá los parámetros y ejecutá el análisis" : "Completá la configuración"}
              </Typography>
              <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="32rem">
                {analysisMode === "benchmark"
                  ? "Benchmark: elegí modelos, definí la fecha de corte, y ForecastIQ evaluará qué modelo predijo mejor el período de test real."
                  : "Rápido: un modelo sobre todos los datos — ideal para ver predicciones en segundos."}
              </Typography>
            </Paper>
          )}

          {/* Loading */}
          {loading && (
            <Paper variant="outlined" sx={{ p: "3rem", display: "flex", alignItems: "center",
              justifyContent: "center", gap: "1rem", borderRadius: "0.75rem", minHeight: "12rem" }}>
              <CircularProgress size={36} />
              <Box>
                <Typography variant="body2" fontWeight={600}>
                  {analysisMode === "benchmark" ? "Corriendo benchmark…" : "Corriendo StatsForecast…"}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {analysisMode === "benchmark"
                    ? "Train → predicciones test → WAPE por entidad → ganador → forecast futuro"
                    : "Puede tardar de 5s a 2min según la cantidad de series"}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* KPI chips — benchmark */}
          {benchmarkResult && !loading && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))", gap: "0.5rem" }}>
              {[
                { label: "Series",        value: benchmarkResult.n_series.toString(), accent: true },
                { label: "Test períodos", value: benchmarkResult.test_periods > 0 ? `${benchmarkResult.test_periods}` : "Sin test", accent: benchmarkResult.test_periods > 0 },
                { label: "Modelos",       value: benchmarkResult.models_used.join(" · "), accent: false },
                { label: "Horizonte",     value: `${benchmarkResult.horizon}`, accent: false },
                { label: "Frecuencia",    value: benchmarkResult.freq, accent: false },
                { label: "Duración",      value: `${benchmarkResult.duration_s.toFixed(1)}s`, accent: false },
              ].map(({ label, value, accent }) => (
                <Paper key={label} elevation={0} variant={accent ? undefined : "outlined"}
                  sx={{ p: "0.75rem", borderRadius: "0.5rem", ...(accent ? { bgcolor: "primary.main", color: "primary.contrastText" } : {}) }}>
                  <Typography variant="caption" sx={{ opacity: accent ? 0.8 : 1, color: accent ? "inherit" : "text.disabled" }}>{label}</Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ mt: "0.125rem", fontSize: "0.8125rem", wordBreak: "break-word" }}>{value}</Typography>
                </Paper>
              ))}
            </Box>
          )}

          {/* KPI chips — rápido */}
          {quickResult && !loading && (
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))", gap: "0.5rem" }}>
              {[
                { label: "Series",       value: quickResult.n_series.toString(), accent: true },
                { label: "Predicciones", value: quickResult.predictions.length.toLocaleString("es-AR"), accent: true },
                { label: "Modelo",       value: quickResult.model_used, accent: false },
                { label: "Frecuencia",   value: quickResult.freq, accent: false },
                { label: "Horizonte",    value: String(quickResult.horizon), accent: false },
                { label: "Duración",     value: `${quickResult.duration_s.toFixed(1)}s`, accent: false },
              ].map(({ label, value, accent }) => (
                <Paper key={label} elevation={0} variant={accent ? undefined : "outlined"}
                  sx={{ p: "0.75rem", borderRadius: "0.5rem", ...(accent ? { bgcolor: "primary.main", color: "primary.contrastText" } : {}) }}>
                  <Typography variant="caption" sx={{ opacity: accent ? 0.8 : 1, color: accent ? "inherit" : "text.disabled" }}>{label}</Typography>
                  <Typography variant="body1" fontWeight={700} sx={{ mt: "0.125rem", fontSize: "0.875rem" }}>{value}</Typography>
                </Paper>
              ))}
            </Box>
          )}

          {/* Tabs */}
          {hasResult && !loading && (
            <>
              <Tabs value={activeTab} onChange={(_, v: number) => setActiveTab(v)}
                sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
                {benchmarkResult && <Tab label="Ganadores"       sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />}
                {benchmarkResult && <Tab label="Ranking modelos" sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />}
                {!benchmarkResult && <Tab label="Accuracy"       sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />}
                {/* Tab Gráfico — MS-UX1 */}
                <Tab icon={<BarChartIcon sx={{ fontSize: "1rem" }} />} iconPosition="start"
                  label="Gráfico"
                  sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
                <Tab label="Predicciones" sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
                <Tab label="Exportar"     sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.875rem" }} />
              </Tabs>

              {/* ── TAB 0: Ganadores (benchmark) ── */}
              {benchmarkResult && activeTab === 0 && (
                <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                  <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider",
                    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <EmojiEventsIcon sx={{ fontSize: "1.125rem", color: "warning.main" }} />
                      <Typography variant="subtitle2" fontWeight={600}>Modelo ganador por entidad</Typography>
                      <Typography component="span" variant="caption" color="text.disabled">
                        ({benchmarkRankingData.length} series · por WAPE{benchmarkResult.test_periods > 0 ? " real" : ""})
                      </Typography>
                    </Box>
                    {benchmarkResult.test_periods > 0
                      ? <Chip icon={<InfoOutlinedIcon sx={{ fontSize: "0.75rem !important" }} />} label={`Test: ${benchmarkResult.test_periods} períodos`} size="small" color="success" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
                      : <Chip icon={<WarningAmberIcon sx={{ fontSize: "0.75rem !important" }} />} label="Sin test (train_end al final del dataset)" size="small" color="warning" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
                    }
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1.5rem 1fr 7rem 5rem 5rem 6rem",
                    gap: "0.5rem", px: "1.25rem", py: "0.375rem",
                    bgcolor: "background.default", borderBottom: "1px solid", borderColor: "divider" }}>
                    {["#", "Entidad", "Mejor modelo", "WAPE%", "BIAS%", ""].map((h, i) => (
                      <Typography key={i} variant="caption" color="text.disabled" sx={{ textAlign: i >= 3 && i <= 4 ? "right" : "left" }}>{h}</Typography>
                    ))}
                  </Box>
                  <Box sx={{ maxHeight: "32rem", overflow: "auto" }}>
                    {benchmarkRankingData.map(({ unique_id, best_model, wape, bias }, idx) => (
                      <Box key={unique_id} sx={{ display: "grid", gridTemplateColumns: "1.5rem 1fr 7rem 5rem 5rem 6rem",
                        gap: "0.5rem", px: "1.25rem", py: "0.5rem",
                        borderBottom: "1px solid", borderColor: "divider",
                        bgcolor: idx % 2 === 0 ? "action.hover" : "transparent",
                        "&:last-child": { borderBottom: "none" }, alignItems: "center" }}>
                        <Typography variant="caption" color="text.disabled" fontWeight={700}>{idx + 1}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{unique_id}</Typography>
                        <Chip label={best_model} size="small"
                          color={best_model === "AutoARIMA" ? "secondary" : best_model === "AutoETS" ? "primary" : best_model === "LightGBM" ? "error" : "default"}
                          variant="outlined" sx={{ fontSize: "0.6875rem", height: "1.375rem", justifySelf: "start" }} />
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.75rem", textAlign: "right", color: wapeColor(wape) }}>
                          {wape !== null ? `${(wape * 100).toFixed(1)}%` : "—"}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.75rem", textAlign: "right", color: biasColor(bias) }}>
                          {bias !== null ? `${bias > 0 ? "+" : ""}${bias.toFixed(1)}%` : "—"}
                        </Typography>
                        <Button size="small" variant="text"
                          startIcon={<ShowChartIcon sx={{ fontSize: "0.75rem !important" }} />}
                          onClick={() => { setChartEntity(unique_id); setActiveTab(CHART_TAB_IDX) }}
                          sx={{ textTransform: "none", fontSize: "0.6875rem", py: "0.125rem" }}>
                          Ver →
                        </Button>
                      </Box>
                    ))}
                  </Box>
                  {benchmarkResult.series_skipped.length > 0 && (
                    <Box sx={{ px: "1.25rem", py: "0.625rem", borderTop: "1px solid", borderColor: "divider", bgcolor: "warning.light" }}>
                      <Typography variant="caption" color="warning.dark">
                        ⚠️ {benchmarkResult.series_skipped.length} serie{benchmarkResult.series_skipped.length !== 1 ? "s" : ""} omitida{benchmarkResult.series_skipped.length !== 1 ? "s" : ""} por datos insuficientes:
                        {" "}{benchmarkResult.series_skipped.slice(0, 5).join(", ")}{benchmarkResult.series_skipped.length > 5 ? ` y ${benchmarkResult.series_skipped.length - 5} más` : ""}
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}

              {/* ── TAB 1: Ranking modelos (benchmark) ── */}
              {benchmarkResult && activeTab === 1 && (
                <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                  <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle2" fontWeight={600}>Ranking global de modelos</Typography>
                    <Typography variant="caption" color="text.disabled">WAPE promedio sobre todas las entidades</Typography>
                  </Box>
                  <Box sx={{ p: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    {benchmarkResult.model_ranking.map((row, idx) => (
                      <Box key={row.model} sx={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                        <Typography variant="body2" fontWeight={800} sx={{ minWidth: "1.5rem", fontSize: "0.875rem" }}
                          color={idx === 0 ? "warning.main" : "text.disabled"}>
                          {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
                        </Typography>
                        <Chip label={row.model} size="small"
                          color={row.model === "AutoARIMA" ? "secondary" : row.model === "AutoETS" ? "primary" : "default"}
                          variant={idx === 0 ? "filled" : "outlined"} sx={{ fontSize: "0.8125rem", minWidth: "8rem" }} />
                        <Box sx={{ flex: 1, minWidth: "8rem" }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", mb: "0.125rem" }}>
                            <Typography variant="caption" fontWeight={700} color={wapeColor(row.wape_mean)}>
                              WAPE {(row.wape_mean * 100).toFixed(1)}%
                            </Typography>
                            <Typography variant="caption" color={biasColor(row.bias_mean)}>
                              BIAS {row.bias_mean > 0 ? "+" : ""}{row.bias_mean.toFixed(1)}%
                            </Typography>
                          </Box>
                          <Box sx={{ height: "0.375rem", bgcolor: "action.hover", borderRadius: "0.25rem", overflow: "hidden" }}>
                            <Box sx={{ height: "100%", borderRadius: "0.25rem", transition: "width 0.5s",
                              width: `${Math.min(row.wape_mean * 100, 100)}%`, bgcolor: wapeColor(row.wape_mean) }} />
                          </Box>
                        </Box>
                        <Tooltip title={`Ganador en ${row.n_wins} de ${benchmarkResult.n_series} entidades`}>
                          <Chip label={`${row.n_wins} victorias`} size="small"
                            color={idx === 0 ? "success" : "default"} variant="outlined" sx={{ fontSize: "0.6875rem" }} />
                        </Tooltip>
                      </Box>
                    ))}
                    {benchmarkResult.model_ranking.length === 0 && (
                      <Typography variant="body2" color="text.disabled" textAlign="center" py="1rem">
                        Sin métricas — el período de test tiene menos de 3 observaciones.
                      </Typography>
                    )}
                  </Box>
                </Paper>
              )}

              {/* ── TAB 0 (rápido): Accuracy ranking ── */}
              {quickResult && activeTab === 0 && (
                <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                  <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle2" fontWeight={600}>Ranking · ordenado por proyección total</Typography>
                  </Box>
                  <Box sx={{ display: "grid", gridTemplateColumns: "1.5rem 1fr 6rem 6rem", gap: "0.5rem",
                    px: "1.25rem", py: "0.375rem", bgcolor: "background.default",
                    borderBottom: "1px solid", borderColor: "divider" }}>
                    {["#", "Entidad", "Total proyectado", ""].map((h, i) => (
                      <Typography key={i} variant="caption" color="text.disabled" sx={{ textAlign: i === 2 ? "right" : "left" }}>{h}</Typography>
                    ))}
                  </Box>
                  <Box sx={{ maxHeight: "28rem", overflow: "auto" }}>
                    {quickRankingData.map(({ uid, total }, idx) => (
                      <Box key={uid} sx={{ display: "grid", gridTemplateColumns: "1.5rem 1fr 6rem 6rem",
                        gap: "0.5rem", px: "1.25rem", py: "0.5rem",
                        borderBottom: "1px solid", borderColor: "divider",
                        bgcolor: idx % 2 === 0 ? "action.hover" : "transparent",
                        "&:last-child": { borderBottom: "none" }, alignItems: "center" }}>
                        <Typography variant="caption" color="text.disabled" fontWeight={700}>{idx + 1}</Typography>
                        <Typography variant="body2" sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}>{uid}</Typography>
                        <Typography variant="body2" fontWeight={600} sx={{ fontSize: "0.75rem", textAlign: "right" }}>
                          {total.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </Typography>
                        <Button size="small" variant="text"
                          startIcon={<ShowChartIcon sx={{ fontSize: "0.75rem !important" }} />}
                          onClick={() => { setChartEntity(uid); setActiveTab(CHART_TAB_IDX) }}
                          sx={{ textTransform: "none", fontSize: "0.6875rem", py: "0.125rem" }}>
                          Ver →
                        </Button>
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ px: "1.25rem", py: "0.75rem", borderTop: "1px solid", borderColor: "divider" }}>
                    <Typography variant="caption" color="text.disabled">
                      ℹ️ Para WAPE real y modelo ganador por entidad, usá el modo <strong>Benchmark</strong>.
                    </Typography>
                  </Box>
                </Paper>
              )}

              {/* ── TAB Gráfico (MS-UX1) ── */}
              {activeTab === CHART_TAB_IDX && (
                <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                  <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider",
                    display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <BarChartIcon sx={{ fontSize: "1.125rem", color: "primary.main" }} />
                      <Typography variant="subtitle2" fontWeight={600}>Serie histórica + forecast</Typography>
                    </Box>
                    <FormControl size="small" sx={{ minWidth: "14rem" }}>
                      <InputLabel sx={{ fontSize: "0.8125rem" }}>Entidad</InputLabel>
                      <Select value={chartEntity} label="Entidad"
                        onChange={(e) => setChartEntity(e.target.value)}
                        sx={{ fontSize: "0.8125rem" }}>
                        <MenuItem value=""><em>— Elegí una entidad —</em></MenuItem>
                        {allSeries.map((uid) => <MenuItem key={uid} value={uid} sx={{ fontSize: "0.8125rem" }}>{uid}</MenuItem>)}
                      </Select>
                    </FormControl>
                    {benchmarkResult && chartEntity && (
                      <Chip
                        label={`Modelo: ${benchmarkResult.best_models.find((m) => m.unique_id === chartEntity)?.best_model ?? "—"}`}
                        size="small" color="primary" variant="outlined" sx={{ fontSize: "0.6875rem" }} />
                    )}
                    {chartLoading && <CircularProgress size="1rem" />}
                  </Box>

                  {!chartEntity && (
                    <Box sx={{ p: "3rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                      <BarChartIcon sx={{ fontSize: "2.5rem", color: "text.disabled" }} />
                      <Typography variant="body2" color="text.secondary">
                        Seleccioná una entidad para ver su serie histórica + predicciones futuras.
                      </Typography>
                      <Typography variant="caption" color="text.disabled">
                        También podés hacer click en &quot;Ver →&quot; en la tabla de Ganadores o Accuracy.
                      </Typography>
                    </Box>
                  )}

                  {chartEntity && chartData.length > 0 && (
                    <Box sx={{ p: "1.25rem" }}>
                      <ResponsiveContainer width="100%" height={340}>
                        <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                          <XAxis dataKey="ds" tickFormatter={fmtDateAxis}
                            tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                          <YAxis tick={{ fontSize: 11 }} width={56}
                            tickFormatter={(v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v/1_000).toFixed(0)}K` : String(v)} />
                          <RechartTooltip
                            contentStyle={{ fontSize: "0.75rem", borderRadius: "0.5rem" }}
                            formatter={(val: number, name: string) => [
                              val.toLocaleString("es-AR", { maximumFractionDigits: 0 }),
                              name === "real" ? "Real" : name,
                            ]}
                            labelFormatter={(ds: string) => fmtDateAxis(ds)}
                          />
                          <Legend wrapperStyle={{ fontSize: "0.75rem" }} />

                          {/* Área histórica */}
                          <defs>
                            <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%"  stopColor={MODEL_COLORS.historical} stopOpacity={0.25} />
                              <stop offset="95%" stopColor={MODEL_COLORS.historical} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <Area type="monotone" dataKey="real" name="Histórico"
                            stroke={MODEL_COLORS.historical} strokeWidth={2}
                            fill="url(#gradHist)" dot={false} connectNulls />

                          {/* Línea de predicción para cada modelo en el gráfico */}
                          {chartModelKeys.map((key) => (
                            <Line key={key} type="monotone" dataKey={key} name={key}
                              stroke={MODEL_COLORS[key] ?? "#6366f1"} strokeWidth={2}
                              strokeDasharray="6 3" dot={{ r: 3 }} connectNulls />
                          ))}
                        </ComposedChart>
                      </ResponsiveContainer>

                      <Typography variant="caption" color="text.disabled" sx={{ mt: "0.5rem", display: "block" }}>
                        Línea sólida = datos históricos reales · línea punteada = forecast del modelo ganador
                        {benchmarkResult && ` (${benchmarkResult.best_models.find((m) => m.unique_id === chartEntity)?.best_model ?? "—"})`}
                      </Typography>
                    </Box>
                  )}

                  {chartEntity && !chartData.length && !chartLoading && (
                    <Box sx={{ p: "2rem", textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        Sin datos para esta entidad. Verificá que la columna entidad y el dataset coincidan.
                      </Typography>
                    </Box>
                  )}
                </Paper>
              )}

              {/* ── TAB Predicciones (DataGrid) ── */}
              {((benchmarkResult && activeTab === CHART_TAB_IDX + 1) || (quickResult && activeTab === CHART_TAB_IDX + 1)) && (
                <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
                  <Box sx={{ px: "1.25rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider" }}>
                    <Typography variant="subtitle2" fontWeight={600}>
                      Predicciones futuras
                      <Typography component="span" variant="caption" color="text.disabled" sx={{ ml: "0.5rem" }}>
                        ({activePredictions.length.toLocaleString("es-AR")} filas)
                        {benchmarkResult && " · modelo ganador por entidad"}
                      </Typography>
                    </Typography>
                  </Box>
                  <DataGrid
                    rows={activePredictions.map((p, idx) => ({ ...p, id: idx }))}
                    columns={gridCols}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[25, 50, 100]}
                    disableRowSelectionOnClick density="compact" autoHeight
                    sx={{ border: "none", fontSize: "0.75rem",
                      "& .MuiDataGrid-columnHeaders": { bgcolor: "background.default" },
                      "& .MuiDataGrid-cell": { borderColor: "divider" } }}
                  />
                </Paper>
              )}

              {/* ── TAB Exportar ── */}
              {((benchmarkResult && activeTab === CHART_TAB_IDX + 2) || (quickResult && activeTab === CHART_TAB_IDX + 2)) && (
                <Paper variant="outlined" sx={{ p: "1.5rem", borderRadius: "0.75rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <Typography variant="subtitle2" fontWeight={600}>Exportar resultados</Typography>

                  <Box sx={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                    <Button variant="contained" startIcon={<DownloadIcon />}
                      onClick={() => downloadCsv(activePredictions, `predicciones_${new Date().toISOString().slice(0, 10)}.csv`)}
                      sx={{ textTransform: "none", fontWeight: 600, alignSelf: "flex-start" }}>
                      CSV predicciones futuras
                    </Button>
                    <Typography variant="caption" color="text.disabled">
                      Columnas: unique_id, ds, predicted — todas las entidades en formato plano
                    </Typography>
                  </Box>

                  {benchmarkResult && (
                    <>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                        <Button variant="outlined" startIcon={<EmojiEventsIcon />}
                          onClick={() => downloadBenchmarkCsv(benchmarkResult)}
                          sx={{ textTransform: "none", fontWeight: 600, alignSelf: "flex-start" }}>
                          CSV modelo ganador por entidad
                        </Button>
                        <Typography variant="caption" color="text.disabled">
                          Columnas: unique_id, best_model, wape_pct, bias_pct, score
                        </Typography>
                      </Box>

                      <Box sx={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                        <Button variant="outlined" color="success" startIcon={<DownloadIcon />}
                          onClick={() => void downloadBenchmarkXlsx(benchmarkResult)}
                          sx={{ textTransform: "none", fontWeight: 600, alignSelf: "flex-start" }}>
                          Excel multi-hoja (Resumen + Ganadores + Ranking + Predicciones + Test vs Real)
                        </Button>
                        <Typography variant="caption" color="text.disabled">
                          5 hojas: Resumen ejecutivo, ganadores con semáforos, ranking global, predicciones futuras, y hoja <strong>Test vs Real</strong> (real vs predicho en período de test — archivo S&amp;OP)
                        </Typography>
                      </Box>
                    </>
                  )}
                </Paper>
              )}
            </>
          )}
        </Box>
      </Box>
    </Box>
  )
}
