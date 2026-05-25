"use client"

/**
 * DatasetSelector — selector de dataset activo reutilizable.
 *
 * Muestra los datasets del usuario + el dataset demo como opciones.
 * Al seleccionar, usa /preview para detectar columnas date/target,
 * actualiza appStore y llama onSelect(datasetId).
 *
 * Usado en: EDA, ETL (y opcionalmente Forecast).
 * No reemplaza la vista Datos — es solo para elegir qué analizar.
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
import type { DatasetListItem, DatasetListResponse, DatasetPreview } from "@/lib/types"

interface DatasetSelectorProps {
  /** Called when a dataset is activated — passes the resolved dataset_id */
  onSelect: (datasetId: string) => void
  /** Currently active dataset_id — shown as selected in the dropdown */
  activeDatasetId: string | null
  /** Show "ETL ✓" badge when the cleaned dataset is active */
  showEtlBadge?: boolean
}

// Demo defaults — columns are always known, no need for detection
const DEMO_SKU    = "SKU-00001"
const DEMO_FREQ   = "D"
const DEMO_DATE   = "fecha"
const DEMO_TARGET = "ventas"

/** Heuristic: pick the most likely date column from preview columns */
function pickDateCol(cols: DatasetPreview["columns"]): string {
  const dateCandidates = ["fecha", "date", "ds", "time", "periodo", "mes", "week", "day"]
  for (const cand of dateCandidates) {
    const found = cols.find(
      (c) => c.name.toLowerCase() === cand || c.dtype === "datetime"
    )
    if (found) return found.name
  }
  // Fallback: first column with "date" in the name
  const withDate = cols.find((c) => c.name.toLowerCase().includes("date") || c.name.toLowerCase().includes("fecha"))
  return withDate?.name ?? cols[0]?.name ?? ""
}

/** Heuristic: pick the most likely target column (numeric, not date) */
function pickTargetCol(cols: DatasetPreview["columns"]): string {
  const numericCols = cols.filter((c) => c.dtype === "numeric")
  // Prefer columns named "ventas", "value", "y", "target", "qty", "demand", "sales"
  const namePriority = ["ventas", "value", "y", "target", "qty", "demand", "sales", "cantidad"]
  for (const cand of namePriority) {
    const found = numericCols.find((c) => c.name.toLowerCase() === cand)
    if (found) return found.name
  }
  return numericCols[0]?.name ?? cols[1]?.name ?? ""
}

/** Heuristic: estimate frequency from date column sample values */
function estimateFreq(dateValues: string[]): string {
  if (dateValues.length < 2) return "M"
  try {
    const dates = dateValues
      .slice(0, 5)
      .map((v) => new Date(v).getTime())
      .filter((t) => !isNaN(t))
      .sort((a, b) => a - b)
    if (dates.length < 2) return "M"
    const diffMs = (dates[dates.length - 1] - dates[0]) / (dates.length - 1)
    const diffDays = diffMs / 86_400_000
    if (diffDays <= 1.5) return "D"
    if (diffDays <= 8)   return "W"
    if (diffDays <= 95)  return "M"
    return "Q"
  } catch {
    return "M"
  }
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
  const [myDatasets, setMyDatasets] = useState<DatasetListItem[]>([])
  const [loading, setLoading]       = useState(true)
  const [activating, setActivating] = useState(false)
  const [selectedId, setSelectedId] = useState<string>(activeDatasetId ?? "")
  const cleanedId                   = appStore.getCleanedDatasetId()

  // Load user datasets list
  const loadDatasets = useCallback(() => {
    const ids = getSessionIds()
    const url = ids
      ? `/api/datasets/?session_ids=${encodeURIComponent(ids)}`
      : "/api/datasets/"
    api
      .get<DatasetListResponse>(url)
      .then((r) => setMyDatasets(r.datasets))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadDatasets() }, [loadDatasets])

  // Sync dropdown when parent changes activeDatasetId externally
  useEffect(() => {
    if (activeDatasetId) setSelectedId(activeDatasetId)
  }, [activeDatasetId])

  /**
   * Activate a dataset:
   *  - demo  → load via API, columns are known
   *  - user  → call /preview, run heuristics to pick date/target/freq
   */
  const handleActivate = useCallback(
    async (dsId: string) => {
      if (!dsId || dsId === activeDatasetId) return
      setActivating(true)
      try {
        if (dsId === "__demo__") {
          const res = await api.post<{ dataset_id: string; rows: number }>(
            "/api/datasets/demo/load",
            { sku_id: DEMO_SKU, categoria: "Electrónica", freq: DEMO_FREQ }
          )
          appStore.setActiveDataset(res.dataset_id, DEMO_DATE, DEMO_TARGET, DEMO_FREQ)
          appStore.clearQualityScore()
          appStore.clearCleanedDataset()
          onSelect(res.dataset_id)
          return
        }

        // User dataset: preview → heuristic column detection
        const preview = await api.get<DatasetPreview>(
          `/api/datasets/${dsId}/preview`
        )
        const dateCol   = pickDateCol(preview.columns)
        const targetCol = pickTargetCol(preview.columns)

        // Estimate frequency from sample values of the date column
        const dateSamples = preview.rows
          .map((r) => String(r[dateCol] ?? ""))
          .filter(Boolean)
        const freq = estimateFreq(dateSamples)

        appStore.setActiveDataset(dsId, dateCol, targetCol, freq)
        appStore.clearQualityScore()
        // If this is the cleaned dataset, preserve it; otherwise clear
        if (dsId !== cleanedId) appStore.clearCleanedDataset()
        onSelect(dsId)
      } catch {
        // Fallback: activate with empty cols — EDA will show a warning
        appStore.setActiveDataset(dsId, "", "", "M")
        appStore.clearQualityScore()
        onSelect(dsId)
      } finally {
        setActivating(false)
      }
    },
    [activeDatasetId, cleanedId, onSelect]
  )

  const handleChange = (value: string) => {
    setSelectedId(value)
    void handleActivate(value)
  }

  const isActiveCleaned = showEtlBadge && activeDatasetId === cleanedId && !!cleanedId

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>

      {/* ── Dropdown ─────────────────────────────────────────────── */}
      <FormControl size="small" sx={{ minWidth: "18rem" }}>
        <InputLabel sx={{ fontSize: "0.8125rem" }}>Dataset activo</InputLabel>
        <Select
          value={selectedId}
          label="Dataset activo"
          onChange={(e) => handleChange(e.target.value)}
          disabled={activating || loading}
          renderValue={(val) => {
            if (!val) {
              return (
                <Typography sx={{ fontSize: "0.8125rem", color: "text.disabled" }}>
                  Ninguno seleccionado
                </Typography>
              )
            }
            const ds        = myDatasets.find((d) => d.dataset_id === val)
            const isCleaned = val === cleanedId
            return (
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {ds
                  ? <FolderIcon    sx={{ fontSize: "0.875rem", color: "text.secondary" }} />
                  : <AutoGraphIcon sx={{ fontSize: "0.875rem", color: "primary.main"  }} />
                }
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }} noWrap>
                  {ds ? ds.filename : "Dataset demo"}
                </Typography>
                {isCleaned && showEtlBadge && (
                  <Chip
                    label="ETL ✓"
                    size="small"
                    icon={<CleaningServicesIcon sx={{ fontSize: "0.625rem !important" }} />}
                    sx={{
                      height: "1.1rem", fontSize: "0.625rem", fontWeight: 700,
                      bgcolor: "rgba(34,197,94,0.12)", color: "#16a34a",
                    }}
                  />
                )}
              </Box>
            )
          }}
          sx={{ fontSize: "0.8125rem" }}
        >
          {/* Demo option */}
          <ListSubheader sx={{ fontSize: "0.6875rem", lineHeight: "1.75rem" }}>
            Dataset de ejemplo
          </ListSubheader>
          <MenuItem value="__demo__" sx={{ fontSize: "0.8125rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
              <AutoGraphIcon sx={{ fontSize: "1rem", color: "primary.main", flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }}>Dataset demo</Typography>
                <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>
                  25k SKUs · Parquet · Cloudflare R2
                </Typography>
              </Box>
            </Box>
          </MenuItem>

          {/* User datasets */}
          {myDatasets.length > 0 && (
            <ListSubheader sx={{ fontSize: "0.6875rem", lineHeight: "1.75rem" }}>
              Mis datasets
            </ListSubheader>
          )}
          {myDatasets.map((ds) => {
            const isCleaned = ds.dataset_id === cleanedId
            const isActive  = ds.dataset_id === activeDatasetId
            return (
              <MenuItem key={ds.dataset_id} value={ds.dataset_id} sx={{ fontSize: "0.8125rem" }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                  <FolderIcon sx={{ fontSize: "1rem", color: "text.secondary", flexShrink: 0 }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                      <Typography sx={{ fontSize: "0.8125rem", fontWeight: 600 }} noWrap>
                        {ds.filename}
                      </Typography>
                      {isCleaned && showEtlBadge && (
                        <Chip
                          label="ETL ✓"
                          size="small"
                          sx={{
                            height: "0.9375rem", fontSize: "0.5625rem", fontWeight: 700,
                            bgcolor: "rgba(34,197,94,0.12)", color: "#16a34a",
                          }}
                        />
                      )}
                    </Box>
                    <Typography sx={{ fontSize: "0.65625rem", color: "text.secondary" }}>
                      {ds.dataset_id.slice(0, 8)}…{fmtRows(ds.rows)}
                    </Typography>
                  </Box>
                  {isActive && (
                    <CheckCircleIcon sx={{ fontSize: "0.875rem", color: "success.main", flexShrink: 0 }} />
                  )}
                </Box>
              </MenuItem>
            )
          })}

          {/* Empty state */}
          {!loading && myDatasets.length === 0 && (
            <MenuItem disabled sx={{ fontSize: "0.75rem", color: "text.disabled", fontStyle: "italic" }}>
              Sin datasets subidos aún
            </MenuItem>
          )}
        </Select>
      </FormControl>

      {/* Spinner while activating */}
      {(activating || (loading && !myDatasets.length)) && (
        <CircularProgress size="1rem" />
      )}

      {/* ETL badge — shown outside dropdown too when relevant */}
      {isActiveCleaned && !activating && (
        <Tooltip title="Usás la versión limpia del ETL. El forecast usará estos datos automáticamente.">
          <Chip
            label="ETL ✓ — datos limpios"
            size="small"
            icon={<CleaningServicesIcon sx={{ fontSize: "0.75rem !important" }} />}
            sx={{
              bgcolor: "rgba(34,197,94,0.1)", color: "#15803d",
              fontWeight: 700, fontSize: "0.6875rem",
              border: "1px solid rgba(34,197,94,0.25)",
            }}
          />
        </Tooltip>
      )}

      {/* Link to Datos view */}
      <Divider orientation="vertical" flexItem />
      <Tooltip title="Explorar o subir datasets">
        <Button
          component={Link}
          href="/dashboard/data"
          size="small"
          variant="text"
          endIcon={<OpenInNewIcon sx={{ fontSize: "0.6875rem" }} />}
          sx={{
            fontSize: "0.75rem", textTransform: "none",
            color: "text.secondary", px: "0.5rem",
          }}
        >
          Explorar datos
        </Button>
      </Tooltip>
    </Box>
  )
}
