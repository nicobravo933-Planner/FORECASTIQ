"use client"

/**
 * DatasetSelector — selector de dataset activo + configuración de columnas.
 *
 * Flujo:
 *  1. Usuario elige un dataset del dropdown
 *  2. Se llama /preview, se detectan columnas con heurísticas
 *  3. Se muestran dos selects (fecha / objetivo) pre-rellenados con la detección
 *  4. El usuario puede confirmar o cambiar antes de activar
 *  5. appStore se actualiza y onSelect() se llama con el dataset_id resuelto
 *
 * Si el dataset ya tiene columnas en appStore (viene del flujo upload/dataset),
 * los selects muestran esas columnas y el usuario puede cambiarlas en cualquier momento.
 */

import { useCallback, useEffect, useState } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import CircularProgress from "@mui/material/CircularProgress"
import Divider from "@mui/material/Divider"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import ListSubheader from "@mui/material/ListSubheader"
import MenuItem from "@mui/material/MenuItem"
import Select from "@mui/material/Select"
import Tooltip from "@mui/material/Tooltip"
import Typography from "@mui/material/Typography"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import CheckCircleIcon from "@mui/icons-material/CheckCircle"
import CleaningServicesIcon from "@mui/icons-material/CleaningServices"
import FolderIcon from "@mui/icons-material/Folder"
import OpenInNewIcon from "@mui/icons-material/OpenInNew"
import Link from "next/link"
import { api } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import { getSessionIds } from "@/lib/sessionDatasets"
import type { DatasetColumn, DatasetListItem, DatasetListResponse, DatasetPreview } from "@/lib/types"

interface DatasetSelectorProps {
  onSelect: (datasetId: string) => void
  activeDatasetId: string | null
  showEtlBadge?: boolean
}

// Demo defaults — always known
const DEMO_SKU    = "SKU-00001"
const DEMO_FREQ   = "D"
const DEMO_DATE   = "fecha"
const DEMO_TARGET = "ventas"

function pickDateCol(cols: DatasetColumn[]): string {
  const priority = ["fecha", "date", "ds", "time", "periodo", "mes", "week", "day"]
  for (const cand of priority) {
    const found = cols.find((c) => c.name.toLowerCase() === cand || c.dtype === "datetime")
    if (found) return found.name
  }
  const withDate = cols.find((c) =>
    c.name.toLowerCase().includes("date") || c.name.toLowerCase().includes("fecha")
  )
  return withDate?.name ?? cols[0]?.name ?? ""
}

function pickTargetCol(cols: DatasetColumn[], dateCol: string): string {
  const numerics = cols.filter((c) => c.dtype === "numeric" && c.name !== dateCol)
  const priority = ["ventas", "value", "y", "target", "qty", "demand", "sales", "cantidad", "cantidad_vendida"]
  for (const cand of priority) {
    const found = numerics.find((c) => c.name.toLowerCase() === cand)
    if (found) return found.name
  }
  return numerics[0]?.name ?? cols.find((c) => c.name !== dateCol)?.name ?? ""
}

function estimateFreq(rows: Record<string, unknown>[], dateCol: string): string {
  const vals = rows
    .slice(0, 6)
    .map((r) => new Date(String(r[dateCol] ?? "")).getTime())
    .filter((t) => !isNaN(t))
    .sort((a, b) => a - b)
  if (vals.length < 2) return "M"
  const diffDays = (vals[vals.length - 1] - vals[0]) / (vals.length - 1) / 86_400_000
  if (diffDays <= 1.5) return "D"
  if (diffDays <= 8)   return "W"
  if (diffDays <= 95)  return "M"
  return "Q"
}

function fmtRows(n: number | null): string {
  if (n == null) return ""
  if (n >= 1_000_000) return ` · ${(n / 1_000_000).toFixed(1)}M filas`
  if (n >= 1_000)     return ` · ${(n / 1_000).toFixed(0)}k filas`
  return ` · ${n} filas`
}

export function DatasetSelector({
  onSelect,
  activeDatasetId,
  showEtlBadge = true,
}: DatasetSelectorProps) {
  const [myDatasets, setMyDatasets]   = useState<DatasetListItem[]>([])
  const [loading, setLoading]         = useState(true)
  const [activating, setActivating]   = useState(false)
  const [selectedId, setSelectedId]   = useState<string>(activeDatasetId ?? "")

  // Column state — shown as inline dropdowns once a dataset is active
  const [availCols, setAvailCols]     = useState<DatasetColumn[]>([])
  const [dateCol, setDateCol]         = useState<string>(appStore.getActiveDateCol() ?? "")
  const [targetCol, setTargetCol]     = useState<string>(appStore.getActiveTargetCol() ?? "")
  const [freq, setFreq]               = useState<string>(appStore.getActiveFreq() ?? "M")

  const cleanedId = appStore.getCleanedDatasetId()

  // Load user datasets
  const loadDatasets = useCallback(() => {
    const ids = getSessionIds()
    const url = ids ? `/api/datasets/?session_ids=${encodeURIComponent(ids)}` : "/api/datasets/"
    api.get<DatasetListResponse>(url)
      .then((r) => setMyDatasets(r.datasets))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDatasets() }, [loadDatasets])

  // Sync when parent changes activeDatasetId (e.g. user came from upload flow)
  useEffect(() => {
    if (!activeDatasetId) return
    setSelectedId(activeDatasetId)
    const storedDate   = appStore.getActiveDateCol() ?? ""
    const storedTarget = appStore.getActiveTargetCol() ?? ""
    const storedFreq   = appStore.getActiveFreq() ?? "M"
    setDateCol(storedDate)
    setTargetCol(storedTarget)
    setFreq(storedFreq)

    // If we have the dataset id but no columns yet, load preview to populate dropdowns
    if (!storedDate || !storedTarget) {
      api.get<DatasetPreview>(`/api/datasets/${activeDatasetId}/preview`)
        .then((p) => {
          setAvailCols(p.columns)
          const d = pickDateCol(p.columns)
          const t = pickTargetCol(p.columns, d)
          const f = estimateFreq(p.rows, d)
          setDateCol(d)
          setTargetCol(t)
          setFreq(f)
          appStore.setActiveDataset(activeDatasetId, d, t, f)
          onSelect(activeDatasetId)
        })
        .catch(() => {})
    } else {
      // Columns already known — just populate the available list for the dropdowns
      if (activeDatasetId !== "__demo__") {
        api.get<DatasetPreview>(`/api/datasets/${activeDatasetId}/preview`)
          .then((p) => setAvailCols(p.columns))
          .catch(() => {})
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDatasetId])

  // When user changes date/target col dropdowns, update appStore immediately
  const handleColChange = useCallback(
    (newDate: string, newTarget: string, newFreq?: string) => {
      const resolvedFreq = newFreq ?? freq
      setDateCol(newDate)
      setTargetCol(newTarget)
      if (newFreq) setFreq(newFreq)
      if (activeDatasetId) {
        appStore.setActiveDataset(activeDatasetId, newDate, newTarget, resolvedFreq)
        appStore.clearQualityScore()
        onSelect(activeDatasetId)
      }
    },
    [activeDatasetId, freq, onSelect]
  )

  const handleActivate = useCallback(
    async (dsId: string) => {
      if (!dsId) return
      setActivating(true)
      try {
        if (dsId === "__demo__") {
          const res = await api.post<{ dataset_id: string; rows: number }>(
            "/api/datasets/demo/load",
            { sku_id: DEMO_SKU, categoria: "Electrónica", freq: DEMO_FREQ }
          )
          setAvailCols([]) // demo columns are fixed
          setDateCol(DEMO_DATE)
          setTargetCol(DEMO_TARGET)
          setFreq(DEMO_FREQ)
          appStore.setActiveDataset(res.dataset_id, DEMO_DATE, DEMO_TARGET, DEMO_FREQ)
          appStore.clearQualityScore()
          appStore.clearCleanedDataset()
          onSelect(res.dataset_id)
          return
        }

        const preview = await api.get<DatasetPreview>(`/api/datasets/${dsId}/preview`)
        setAvailCols(preview.columns)

        const d = pickDateCol(preview.columns)
        const t = pickTargetCol(preview.columns, d)
        const f = estimateFreq(preview.rows, d)
        setDateCol(d)
        setTargetCol(t)
        setFreq(f)

        appStore.setActiveDataset(dsId, d, t, f)
        appStore.clearQualityScore()
        if (dsId !== cleanedId) appStore.clearCleanedDataset()
        onSelect(dsId)
      } catch {
        setAvailCols([])
        appStore.setActiveDataset(dsId, "", "", "M")
        appStore.clearQualityScore()
        onSelect(dsId)
      } finally {
        setActivating(false)
      }
    },
    [cleanedId, onSelect]
  )

  const handleChange = (value: string) => {
    setSelectedId(value)
    void handleActivate(value)
  }

  const isActiveCleaned = showEtlBadge && activeDatasetId === cleanedId && !!cleanedId
  const isDemo          = selectedId === "__demo__" || (activeDatasetId != null && !myDatasets.find((d) => d.dataset_id === activeDatasetId))
  const showColPickers  = !!activeDatasetId && !isDemo && availCols.length > 0

  const FREQ_OPTIONS = [
    { value: "D", label: "Diaria"    },
    { value: "W", label: "Semanal"   },
    { value: "M", label: "Mensual"   },
    { value: "Q", label: "Trimestral"},
  ]

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>

      {/* ── Dataset dropdown ── */}
      <FormControl size="small" sx={{ minWidth: "16rem" }}>
        <InputLabel sx={{ fontSize: "0.8125rem" }}>Dataset</InputLabel>
        <Select
          value={selectedId}
          label="Dataset"
          onChange={(e) => handleChange(e.target.value)}
          disabled={activating || loading}
          renderValue={(val) => {
            if (!val) return <Typography sx={{ fontSize: "0.8125rem", color: "text.disabled" }}>Ninguno</Typography>
            const ds        = myDatasets.find((d) => d.dataset_id === val)
            const isCleaned = val === cleanedId
            return (
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {ds ? <FolderIcon sx={{ fontSize: "0.875rem", color: "text.secondary" }} />
                    : <AutoGraphIcon sx={{ fontSize: "0.875rem", color: "primary.main" }} />}
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }} noWrap>
                  {ds ? ds.filename : "Demo"}
                </Typography>
                {isCleaned && showEtlBadge && (
                  <Chip label="ETL ✓" size="small"
                    sx={{ height: "1.1rem", fontSize: "0.625rem", fontWeight: 700,
                      bgcolor: "rgba(34,197,94,0.12)", color: "#16a34a" }} />
                )}
              </Box>
            )
          }}
          sx={{ fontSize: "0.8125rem" }}
        >
          <ListSubheader sx={{ fontSize: "0.6875rem", lineHeight: "1.75rem" }}>Demo</ListSubheader>
          <MenuItem value="__demo__" sx={{ fontSize: "0.8125rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
              <AutoGraphIcon sx={{ fontSize: "1rem", color: "primary.main", flexShrink: 0 }} />
              <Box>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>Dataset demo</Typography>
                <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>25k SKUs · Parquet</Typography>
              </Box>
            </Box>
          </MenuItem>

          {myDatasets.length > 0 && (
            <ListSubheader sx={{ fontSize: "0.6875rem", lineHeight: "1.75rem" }}>Mis datasets</ListSubheader>
          )}
          {myDatasets.map((ds) => (
            <MenuItem key={ds.dataset_id} value={ds.dataset_id} sx={{ fontSize: "0.8125rem" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                <FolderIcon sx={{ fontSize: "1rem", color: "text.secondary", flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }} noWrap>{ds.filename}</Typography>
                    {ds.dataset_id === cleanedId && showEtlBadge && (
                      <Chip label="ETL ✓" size="small"
                        sx={{ height: "0.9375rem", fontSize: "0.5625rem", fontWeight: 700,
                          bgcolor: "rgba(34,197,94,0.12)", color: "#16a34a" }} />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>
                    {ds.dataset_id.slice(0, 8)}…{fmtRows(ds.rows)}
                  </Typography>
                </Box>
                {ds.dataset_id === activeDatasetId && (
                  <CheckCircleIcon sx={{ fontSize: "0.875rem", color: "success.main", flexShrink: 0 }} />
                )}
              </Box>
            </MenuItem>
          ))}
          {!loading && myDatasets.length === 0 && (
            <MenuItem disabled sx={{ fontSize: "0.75rem", color: "text.disabled", fontStyle: "italic" }}>
              Sin datasets subidos aún
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {/* ── Spinner ── */}
      {(activating || (loading && !myDatasets.length)) && (
        <CircularProgress size="1rem" />
      )}

      {/* ── Column pickers — only for user datasets ── */}
      {showColPickers && (
        <>
          <Divider orientation="vertical" flexItem sx={{ mx: "0.125rem" }} />

          {/* Date column */}
          <FormControl size="small" sx={{ minWidth: "9rem" }}>
            <InputLabel sx={{ fontSize: "0.75rem" }}>Columna fecha</InputLabel>
            <Select
              value={dateCol}
              label="Columna fecha"
              onChange={(e) => handleColChange(e.target.value, targetCol)}
              sx={{ fontSize: "0.8125rem" }}
            >
              {availCols.map((c) => (
                <MenuItem key={c.name} value={c.name} sx={{ fontSize: "0.8125rem" }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <Box component="span" sx={{
                      fontSize: "0.5625rem", px: "0.3rem", py: "0.0625rem", borderRadius: "0.25rem",
                      bgcolor: c.dtype === "datetime" ? "rgba(99,102,241,0.12)" : "rgba(0,0,0,0.06)",
                      color: c.dtype === "datetime" ? "#6366f1" : "text.secondary",
                      fontWeight: 600, letterSpacing: "0.04em",
                    }}>
                      {c.dtype.slice(0, 4).toUpperCase()}
                    </Box>
                    {c.name}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Target column */}
          <FormControl size="small" sx={{ minWidth: "9rem" }}>
            <InputLabel sx={{ fontSize: "0.75rem" }}>Columna objetivo</InputLabel>
            <Select
              value={targetCol}
              label="Columna objetivo"
              onChange={(e) => handleColChange(dateCol, e.target.value)}
              sx={{ fontSize: "0.8125rem" }}
            >
              {availCols
                .filter((c) => c.name !== dateCol)
                .map((c) => (
                  <MenuItem key={c.name} value={c.name} sx={{ fontSize: "0.8125rem" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Box component="span" sx={{
                        fontSize: "0.5625rem", px: "0.3rem", py: "0.0625rem", borderRadius: "0.25rem",
                        bgcolor: c.dtype === "numeric" ? "rgba(16,185,129,0.12)" : "rgba(0,0,0,0.06)",
                        color: c.dtype === "numeric" ? "#10b981" : "text.secondary",
                        fontWeight: 600, letterSpacing: "0.04em",
                      }}>
                        {c.dtype.slice(0, 4).toUpperCase()}
                      </Box>
                      {c.name}
                    </Box>
                  </MenuItem>
                ))}
            </Select>
          </FormControl>

          {/* Frequency */}
          <FormControl size="small" sx={{ minWidth: "7.5rem" }}>
            <InputLabel sx={{ fontSize: "0.75rem" }}>Frecuencia</InputLabel>
            <Select
              value={freq}
              label="Frecuencia"
              onChange={(e) => handleColChange(dateCol, targetCol, e.target.value)}
              sx={{ fontSize: "0.8125rem" }}
            >
              {FREQ_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value} sx={{ fontSize: "0.8125rem" }}>{o.label}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      )}

      {/* ── ETL badge ── */}
      {isActiveCleaned && !activating && (
        <Tooltip title="Usás la versión limpia del ETL. El forecast usará estos datos automáticamente.">
          <Chip label="ETL ✓" size="small"
            icon={<CleaningServicesIcon sx={{ fontSize: "0.75rem !important" }} />}
            sx={{ bgcolor: "rgba(34,197,94,0.1)", color: "#15803d", fontWeight: 700,
              fontSize: "0.6875rem", border: "1px solid rgba(34,197,94,0.25)" }} />
        </Tooltip>
      )}

      {/* ── Link to Datos ── */}
      <Tooltip title="Explorar o subir datasets">
        <Button component={Link} href="/dashboard/data" size="small" variant="text"
          endIcon={<OpenInNewIcon sx={{ fontSize: "0.6875rem" }} />}
          sx={{ fontSize: "0.75rem", textTransform: "none", color: "text.secondary", px: "0.5rem" }}>
          Datos
        </Button>
      </Tooltip>
    </Box>
  )
}
