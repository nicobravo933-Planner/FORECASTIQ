"use client"

/**
 * DemoDatasetCard — selección de SKU individual del dataset sintético.
 *
 * El análisis por categoría completa (WAPE/segmento/ABC-XYZ) vive en /dashboard/analytics.
 * Este componente solo conecta la fuente: elige SKU → carga serie → appStore.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Alert from "@mui/material/Alert"
import CircularProgress from "@mui/material/CircularProgress"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import TextField from "@mui/material/TextField"
import Paper from "@mui/material/Paper"
import LinearProgress from "@mui/material/LinearProgress"
import Chip from "@mui/material/Chip"
import Divider from "@mui/material/Divider"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import SearchIcon from "@mui/icons-material/Search"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import InsightsIcon from "@mui/icons-material/Insights"
import { api, ApiError } from "@/lib/api"
import { addSessionDataset } from "@/lib/sessionDatasets"
import { appStore } from "@/lib/appStore"

// ── Types ─────────────────────────────────────────────────────────────────────

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]
const FREQS      = [{ v: "W", l: "Semanal" }, { v: "M", l: "Mensual" }]

interface DemoSkusResponse { categoria: string; skus: string[]; total: number }
interface DemoLoadResponse { dataset_id: string; sku_id: string; rows: number; columns: string[]; date_range: string }

// ── Component ─────────────────────────────────────────────────────────────────

export function DemoDatasetCard() {
  const router = useRouter()

  const [categoria, setCategoria] = useState("Electrónica")
  const [freq, setFreq]           = useState("W")
  const [error, setError]         = useState<string | null>(null)

  const [search, setSearch]           = useState("")
  const [skus, setSkus]               = useState<string[]>([])
  const [skuId, setSkuId]             = useState("")
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loadingSku, setLoadingSku]   = useState(false)
  const [loaded, setLoaded]           = useState<DemoLoadResponse | null>(null)

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
      appStore.setActiveDataset(res.dataset_id, "fecha", "ventas", freq)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el SKU.")
    } finally {
      setLoadingSku(false)
    }
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <AutoGraphIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
        <Box>
          <Typography variant="h6" fontWeight={700} color="text.primary">Dataset demo — Ventas retail</Typography>
          <Typography variant="caption" color="text.secondary">
            25 000 SKUs × 3 años · DuckDB → Cloudflare R2
          </Typography>
        </Box>
      </Box>

      {/* Controles comunes */}
      <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
        <FormControl size="small" sx={{ minWidth: "11rem" }}>
          <InputLabel>Categoría</InputLabel>
          <Select value={categoria} label="Categoría" onChange={(e) => { setCategoria(e.target.value); setLoaded(null) }}>
            {CATEGORIAS.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ width: "8rem" }}>
          <InputLabel>Frecuencia</InputLabel>
          <Select value={freq} label="Frecuencia" onChange={(e) => setFreq(e.target.value)}>
            {FREQS.map((f) => <MenuItem key={f.v} value={f.v}>{f.l}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>

      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* SKU selector */}
      <Paper variant="outlined" sx={{ p: "1rem", borderRadius: "0.75rem", display: "flex", flexDirection: "column", gap: "0.875rem" }}>
        <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>Elegir SKU</Typography>

        <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <TextField
            size="small" label="Buscar SKU" value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="SKU-001, SKU-123…"
            sx={{ minWidth: "12rem" }}
            InputProps={{ startAdornment: <SearchIcon sx={{ fontSize: "1rem", mr: "0.375rem", color: "text.disabled" }} /> }}
          />
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
      </Paper>

      {/* Link a Analytics */}
      <Divider />
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
        <Box>
          <Typography variant="body2" fontWeight={600} color="text.primary">
            ¿Querés analizar toda una categoría?
          </Typography>
          <Typography variant="caption" color="text.secondary">
            WAPE por segmento ABC-XYZ, scatter WAPE vs BIAS, comparativa multi-categoría.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<InsightsIcon />}
          onClick={() => router.push("/dashboard/analytics")}
          sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
        >
          Ir a Analytics →
        </Button>
      </Box>

      {/* Segment legend chips */}
      <Box sx={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        {["A-X: alto vol, baja var", "B-Y: vol medio", "C-Z: bajo vol, alta var"].map((s) => (
          <Chip key={s} label={s} size="small" variant="outlined"
            sx={{ fontSize: "0.6875rem", color: "text.disabled" }} />
        ))}
      </Box>

    </Box>
  )
}
