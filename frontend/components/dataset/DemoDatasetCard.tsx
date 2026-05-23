"use client"

/**
 * DemoDatasetCard — carga un SKU del dataset sintético via DuckDB + Supabase Storage.
 * Flujo: elegir categoría → cargar SKUs → elegir SKU → cargar serie → ir a Forecast.
 */

import { useEffect, useState } from "react"
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
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import StorageIcon from "@mui/icons-material/Storage"
import ScheduleIcon from "@mui/icons-material/Schedule"
import CategoryIcon from "@mui/icons-material/Category"
import TrendingUpIcon from "@mui/icons-material/TrendingUp"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]

const STATS = [
  { icon: <StorageIcon sx={{ fontSize: "1rem" }} />, label: "25 000 SKUs", sub: "productos únicos" },
  { icon: <ScheduleIcon sx={{ fontSize: "1rem" }} />, label: "3 años diarios", sub: "2022 – 2024" },
  { icon: <CategoryIcon sx={{ fontSize: "1rem" }} />, label: "5 categorías", sub: "Electrónica, Alimentos…" },
  { icon: <TrendingUpIcon sx={{ fontSize: "1rem" }} />, label: "~27 M filas", sub: "Parquet · Snappy" },
]

interface DemoSkusResponse {
  categoria: string
  skus: string[]
  total: number
}

interface DemoLoadResponse {
  dataset_id: string
  sku_id: string
  rows: number
  columns: string[]
  date_range: string
}

export function DemoDatasetCard() {
  const router = useRouter()

  const [categoria, setCategoria]     = useState("Electrónica")
  const [skus, setSkus]               = useState<string[]>([])
  const [skuId, setSkuId]             = useState("")
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [loaded, setLoaded]           = useState<DemoLoadResponse | null>(null)

  // Cargar lista de SKUs cuando cambia la categoría
  useEffect(() => {
    setSkuId("")
    setSkus([])
    setError(null)
    setLoaded(null)
    setLoadingSkus(true)

    api.get<DemoSkusResponse>(`/api/datasets/demo/skus?categoria=${encodeURIComponent(categoria)}`)
      .then((res) => setSkus(res.skus))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error al cargar SKUs."))
      .finally(() => setLoadingSkus(false))
  }, [categoria])

  const handleLoad = async () => {
    if (!skuId) return
    setLoading(true)
    setError(null)
    setLoaded(null)

    try {
      const res = await api.post<DemoLoadResponse>("/api/datasets/demo/load", {
        sku_id: skuId,
        categoria,
        freq: "D",
      })
      setLoaded(res)
      // Pre-cargar en appStore para que Forecast lo reciba automáticamente
      appStore.setActiveDataset(res.dataset_id, "fecha", "ventas", "D")
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al cargar el SKU.")
    } finally {
      setLoading(false)
    }
  }

  const handleGoToForecast = () => router.push("/dashboard/forecast")

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <AutoGraphIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
        <Box>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Dataset demo — Ventas retail
          </Typography>
          <Typography variant="caption" color="text.secondary">
            25 000 SKUs × 3 años · DuckDB lee directamente desde Supabase Storage
          </Typography>
        </Box>
      </Box>

      {/* Stats */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(8.5rem, 1fr))", gap: "0.625rem" }}>
        {STATS.map((s) => (
          <Box key={s.label} sx={{
            bgcolor: "background.paper", border: "1px solid", borderColor: "divider",
            borderRadius: "0.625rem", p: "0.75rem",
            display: "flex", flexDirection: "column", gap: "0.25rem",
          }}>
            <Box sx={{ color: "primary.light" }}>{s.icon}</Box>
            <Typography variant="body2" fontWeight={600} color="text.primary">{s.label}</Typography>
            <Typography variant="caption" color="text.disabled">{s.sub}</Typography>
          </Box>
        ))}
      </Box>

      {/* Selectores */}
      <Box sx={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        {/* Categoría */}
        <FormControl size="small" sx={{ minWidth: "12rem" }}>
          <InputLabel>Categoría</InputLabel>
          <Select
            value={categoria}
            label="Categoría"
            onChange={(e) => setCategoria(e.target.value)}
          >
            {CATEGORIAS.map((c) => (
              <MenuItem key={c} value={c}>{c}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* SKU */}
        <FormControl size="small" sx={{ minWidth: "14rem" }} disabled={loadingSkus || skus.length === 0}>
          <InputLabel>
            {loadingSkus ? "Cargando SKUs…" : "SKU"}
          </InputLabel>
          <Select
            value={skuId}
            label={loadingSkus ? "Cargando SKUs…" : "SKU"}
            onChange={(e) => { setSkuId(e.target.value); setLoaded(null) }}
          >
            {skus.map((s) => (
              <MenuItem key={s} value={s} sx={{ fontSize: "0.8125rem", fontFamily: "monospace" }}>
                {s}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Botón cargar */}
        <Button
          variant="contained"
          startIcon={loading ? <CircularProgress size="1rem" color="inherit" /> : <PlayArrowIcon />}
          onClick={handleLoad}
          disabled={!skuId || loading}
          sx={{ textTransform: "none", fontWeight: 600, height: "2.5rem" }}
        >
          {loading ? "Cargando…" : "Cargar serie"}
        </Button>
      </Box>

      {/* Error */}
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* Éxito — serie cargada */}
      {loaded && (
        <Alert
          severity="success"
          action={
            <Button
              size="small"
              variant="contained"
              onClick={handleGoToForecast}
              sx={{ textTransform: "none", fontWeight: 600, whiteSpace: "nowrap" }}
            >
              Ir a Forecast →
            </Button>
          }
        >
          <strong>{loaded.sku_id}</strong> cargado correctamente —{" "}
          {loaded.rows.toLocaleString("es-AR")} filas · {loaded.date_range}
        </Alert>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
        DuckDB lee solo las filas del SKU elegido — sin descargar los 180 MB completos.
        La serie queda disponible en Forecast con fecha=<code>fecha</code>, objetivo=<code>ventas</code>.
      </Typography>
    </Box>
  )
}
