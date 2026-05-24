"use client"

/**
 * DemoSkuSearchDialog — busca y carga un SKU del dataset demo 25k desde Forecast.
 *
 * Flujo:
 *  1. Usuario abre el diálogo (desde DatasetPicker)
 *  2. Elige categoría → se listan los primeros 100 SKUs de esa categoría
 *  3. Opcionalmente filtra por texto (búsqueda ILIKE en el backend)
 *  4. Hace clic en un SKU → POST /api/datasets/demo/load → dataset_id
 *  5. El dataset_id se registra en sessionDatasets y se devuelve al picker
 *
 * Disponibilidad: el endpoint /api/datasets/demo/load está disponible en todos
 * los tiers (local y ec2) — solo requiere DuckDB + httpfs que siempre están.
 * Los modelos pesados (LightGBM) estarán bloqueados por ForecastConfigPanel
 * si el tier no los soporta.
 */

import { useEffect, useState } from "react"
import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import TextField from "@mui/material/TextField"
import Button from "@mui/material/Button"
import IconButton from "@mui/material/IconButton"
import CircularProgress from "@mui/material/CircularProgress"
import Alert from "@mui/material/Alert"
import List from "@mui/material/List"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemText from "@mui/material/ListItemText"
import Chip from "@mui/material/Chip"
import InputAdornment from "@mui/material/InputAdornment"
import CloseIcon from "@mui/icons-material/Close"
import SearchIcon from "@mui/icons-material/Search"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import { api, ApiError } from "@/lib/api"
import { addSessionDataset } from "@/lib/sessionDatasets"

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIAS = ["Electrónica", "Alimentos", "Indumentaria", "Hogar", "Deportes"]

// Colores por categoría para los chips
const CAT_COLORS: Record<string, "primary" | "secondary" | "success" | "warning" | "error"> = {
  "Electrónica": "primary",
  "Alimentos":   "success",
  "Indumentaria":"secondary",
  "Hogar":       "warning",
  "Deportes":    "error",
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LoadedSku {
  dataset_id: string
  sku_id:     string
  categoria:  string
  rows:       number
  date_range: string
}

interface DemoSkuSearchDialogProps {
  open:     boolean
  onClose:  () => void
  onLoaded: (result: LoadedSku) => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DemoSkuSearchDialog({ open, onClose, onLoaded }: DemoSkuSearchDialogProps) {
  const [categoria, setCategoria] = useState("Electrónica")
  const [search, setSearch]       = useState("")
  const [skus, setSkus]           = useState<string[]>([])
  const [loadingSkus, setLoadingSkus] = useState(false)
  const [loadingSku, setLoadingSku]   = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  // Load SKUs when categoria or search changes (debounced)
  useEffect(() => {
    if (!open) return
    const t = setTimeout(async () => {
      setLoadingSkus(true)
      setError(null)
      try {
        const url = `/api/datasets/demo/skus?categoria=${encodeURIComponent(categoria)}&limit=100${search ? `&search=${encodeURIComponent(search)}` : ""}`
        const res = await api.get<{ skus: string[]; total: number }>(url)
        setSkus(res.skus)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Error al listar SKUs.")
        setSkus([])
      } finally {
        setLoadingSkus(false)
      }
    }, search ? 300 : 0)   // debounce solo cuando hay búsqueda
    return () => clearTimeout(t)
  }, [open, categoria, search])

  const handleSelectSku = async (skuId: string) => {
    setLoadingSku(skuId)
    setError(null)
    try {
      const res = await api.post<{
        dataset_id: string
        sku_id:     string
        rows:       number
        date_range: string
      }>("/api/datasets/demo/load", { sku_id: skuId, categoria, freq: "D" })

      // Registrar en sessionDatasets para que aparezca en futuros picks
      addSessionDataset({
        dataset_id: res.dataset_id,
        filename:   `demo_${res.sku_id}`,
        created_at: new Date().toISOString(),
      })

      onLoaded({
        dataset_id: res.dataset_id,
        sku_id:     res.sku_id,
        categoria,
        rows:       res.rows,
        date_range: res.date_range,
      })
      onClose()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el SKU.")
    } finally {
      setLoadingSku(null)
    }
  }

  const handleClose = () => {
    if (loadingSku) return  // no cerrar mientras carga
    setSearch("")
    setError(null)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: "0.75rem", maxHeight: "80vh" } }}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: "0.625rem", pb: "0.75rem" }}>
        <AutoGraphIcon sx={{ color: "primary.main" }} />
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" fontWeight={700}>Buscar SKU — Dataset demo</Typography>
          <Typography variant="caption" color="text.disabled">
            25 000 SKUs · 3 años diarios · Cloudflare R2
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={!!loadingSku}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: "0.75rem !important", display: "flex", flexDirection: "column", gap: "1rem" }}>

        {/* Categoría chips */}
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: "0.5rem", display: "block" }}>
            Categoría
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
            {CATEGORIAS.map((c) => (
              <Chip
                key={c}
                label={c}
                size="small"
                color={categoria === c ? (CAT_COLORS[c] ?? "primary") : "default"}
                variant={categoria === c ? "filled" : "outlined"}
                onClick={() => { setCategoria(c); setSearch("") }}
                sx={{ cursor: "pointer", fontSize: "0.75rem" }}
              />
            ))}
          </Box>
        </Box>

        {/* Buscador */}
        <TextField
          size="small"
          fullWidth
          placeholder="Filtrar SKU por ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: "1rem", color: "text.disabled" }} />
              </InputAdornment>
            ),
            endAdornment: loadingSkus ? (
              <InputAdornment position="end">
                <CircularProgress size="0.875rem" />
              </InputAdornment>
            ) : undefined,
          }}
        />

        {/* Error */}
        {error && <Alert severity="error" sx={{ fontSize: "0.8125rem" }}>{error}</Alert>}

        {/* Info */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="caption" color="text.disabled">
            {loadingSkus ? "Buscando…" : `${skus.length} SKU${skus.length !== 1 ? "s" : ""} · clic para cargar en Forecast`}
          </Typography>
          <Chip
            label={categoria}
            size="small"
            color={CAT_COLORS[categoria] ?? "primary"}
            variant="outlined"
            sx={{ fontSize: "0.6875rem", height: "1.25rem" }}
          />
        </Box>

        {/* Lista de SKUs */}
        <List
          dense
          disablePadding
          sx={{
            border: "1px solid",
            borderColor: "divider",
            borderRadius: "0.5rem",
            overflow: "auto",
            maxHeight: "18rem",
            bgcolor: "background.paper",
          }}
        >
          {skus.length === 0 && !loadingSkus && (
            <Box sx={{ p: "2rem", textAlign: "center" }}>
              <Typography variant="body2" color="text.disabled">
                {search ? `Sin resultados para "${search}"` : "Sin SKUs disponibles"}
              </Typography>
            </Box>
          )}
          {skus.map((sku, idx) => (
            <ListItemButton
              key={sku}
              onClick={() => handleSelectSku(sku)}
              disabled={!!loadingSku}
              divider={idx < skus.length - 1}
              sx={{ py: "0.375rem", px: "0.875rem" }}
            >
              <ListItemText
                primary={
                  <Typography
                    variant="body2"
                    fontFamily="monospace"
                    fontSize="0.8125rem"
                    color={loadingSku === sku ? "primary.main" : "text.primary"}
                  >
                    {sku}
                  </Typography>
                }
                secondary={
                  <Typography variant="caption" color="text.disabled">
                    {categoria} · diario 2022–2024
                  </Typography>
                }
              />
              {loadingSku === sku && (
                <CircularProgress size="0.875rem" sx={{ ml: "0.5rem", flexShrink: 0 }} />
              )}
            </ListItemButton>
          ))}
        </List>

        {/* Hint tier */}
        <Typography variant="caption" color="text.disabled" sx={{ textAlign: "center" }}>
          La serie se carga como CSV diario. Podés cambiar la frecuencia en Forecast.
          LightGBM requiere tier local.
        </Typography>

      </DialogContent>

      <DialogActions sx={{ px: "1.5rem", pb: "1rem" }}>
        <Button variant="text" color="inherit" onClick={handleClose} disabled={!!loadingSku}>
          Cancelar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
