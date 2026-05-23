"use client"

/**
 * DatasetPicker — selector visual de datasets disponibles.
 *
 * Reemplaza el campo "Dataset ID" (UUID) en ForecastConfigPanel.
 * Enumera tres fuentes en orden:
 *   1. Dataset demo cargados en la sesión (sessionDatasets con prefijo "demo_")
 *   2. CSVs subidos por el usuario (api/datasets/)
 *   3. Conexión DB activa (localStorage fiq_db_connection)
 *
 * Al seleccionar, devuelve { datasetId, dateCol, targetCol, freq } para que
 * ForecastConfigPanel los aplique directamente sin que el usuario toque nada más.
 */

import { useCallback, useEffect, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import ListSubheader from "@mui/material/ListSubheader"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import CircularProgress from "@mui/material/CircularProgress"
import Button from "@mui/material/Button"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import StorageIcon from "@mui/icons-material/Storage"
import AddIcon from "@mui/icons-material/Add"
import { api } from "@/lib/api"
import { getSessionIds } from "@/lib/sessionDatasets"
import type { DatasetListItem } from "@/lib/types"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PickerDataset {
  dataset_id: string
  label:      string          // human-readable name
  sublabel:   string          // rows / date range / extra info
  source:     "demo" | "csv" | "db"
  // Pre-filled column hints when known (demo datasets always have these)
  dateCol?:   string
  targetCol?: string
  freq?:      string
}

interface DatasetPickerProps {
  value:    string            // current dataset_id
  onChange: (ds: PickerDataset) => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sourceIcon(source: PickerDataset["source"]) {
  if (source === "demo") return <AutoGraphIcon sx={{ fontSize: "0.875rem", color: "primary.main" }} />
  if (source === "csv")  return <UploadFileIcon sx={{ fontSize: "0.875rem", color: "text.secondary" }} />
  return                        <StorageIcon    sx={{ fontSize: "0.875rem", color: "text.secondary" }} />
}

function sourceLabel(source: PickerDataset["source"]) {
  if (source === "demo") return "Demo"
  if (source === "csv")  return "CSV"
  return "DB"
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DatasetPicker({ value, onChange }: DatasetPickerProps) {
  const [datasets, setDatasets] = useState<PickerDataset[]>([])
  const [loading, setLoading]   = useState(true)

  const loadDatasets = useCallback(async () => {
    setLoading(true)
    const result: PickerDataset[] = []

    // 1. CSVs y datasets demo desde la API (incluye session_ids anónimos)
    try {
      const ids = getSessionIds()
      const url = ids
        ? `/api/datasets/?session_ids=${encodeURIComponent(ids)}`
        : "/api/datasets/"
      const res = await api.get<{ datasets: DatasetListItem[] }>(url)

      for (const ds of res.datasets) {
        const isDemo = ds.filename.startsWith("demo_")
        // Extraer SKU-id del nombre "demo_SKU-XXXXX"
        const skuId = isDemo ? ds.filename.replace("demo_", "") : null

        result.push({
          dataset_id: ds.dataset_id,
          label:      isDemo ? (skuId ?? ds.filename) : ds.filename,
          sublabel:   ds.rows
            ? `${ds.rows.toLocaleString("es-AR")} filas · ${ds.columns?.length ?? "?"} columnas`
            : ds.filename,
          source:     isDemo ? "demo" : "csv",
          ...(isDemo
            ? { dateCol: "fecha", targetCol: "ventas", freq: "D" }
            : {}),
        })
      }
    } catch { /* no hay datasets subidos — continúa */ }

    // 2. DB conectada (localStorage)
    try {
      if (typeof window !== "undefined") {
        const conn = JSON.parse(localStorage.getItem("fiq_db_connection") ?? "null") as
          | { connection_string: string; engine: string; dataset_id?: string }
          | null
        if (conn?.dataset_id) {
          result.push({
            dataset_id: conn.dataset_id,
            label:      `Base de datos (${conn.engine})`,
            sublabel:   "Última query ejecutada",
            source:     "db",
          })
        }
      }
    } catch { /* sin DB */ }

    setDatasets(result)
    setLoading(false)

    // Si el valor actual no está en la lista pero es un UUID válido, lo agrego como "desconocido"
    if (value && !result.find((d) => d.dataset_id === value)) {
      setDatasets((prev) => [
        ...prev,
        {
          dataset_id: value,
          label:      value.slice(0, 8) + "…",
          sublabel:   "ID externo",
          source:     "csv",
        },
      ])
    }
  }, [value])

  useEffect(() => { loadDatasets() }, [loadDatasets])

  const selected = datasets.find((d) => d.dataset_id === value)

  const demos = datasets.filter((d) => d.source === "demo")
  const csvs  = datasets.filter((d) => d.source === "csv")
  const dbs   = datasets.filter((d) => d.source === "db")

  const hasAny = datasets.length > 0

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <FormControl size="small" fullWidth>
        <InputLabel>
          {loading ? "Cargando datasets…" : "Dataset activo"}
        </InputLabel>
        <Select
          value={value}
          label={loading ? "Cargando datasets…" : "Dataset activo"}
          disabled={loading}
          onChange={(e) => {
            const picked = datasets.find((d) => d.dataset_id === e.target.value)
            if (picked) onChange(picked)
          }}
          renderValue={() =>
            selected ? (
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {sourceIcon(selected.source)}
                <Typography variant="body2" sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selected.label}
                </Typography>
                <Chip
                  label={sourceLabel(selected.source)}
                  size="small"
                  sx={{ height: "1.125rem", fontSize: "0.5625rem", flexShrink: 0 }}
                />
              </Box>
            ) : (
              <Typography variant="body2" color="text.disabled">Sin dataset seleccionado</Typography>
            )
          }
          endAdornment={
            loading ? <CircularProgress size="1rem" sx={{ mr: "2rem" }} /> : undefined
          }
        >
          {/* Sin resultados */}
          {!loading && !hasAny && (
            <MenuItem disabled>
              <Typography variant="caption" color="text.disabled">
                No hay datasets disponibles
              </Typography>
            </MenuItem>
          )}

          {/* Demo datasets */}
          {demos.length > 0 && (
            <ListSubheader sx={{ lineHeight: "2rem", fontSize: "0.6875rem", bgcolor: "background.default" }}>
              Dataset demo
            </ListSubheader>
          )}
          {demos.map((d) => (
            <MenuItem key={d.dataset_id} value={d.dataset_id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                {sourceIcon(d.source)}
                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  <Typography variant="body2" noWrap fontFamily="monospace" fontSize="0.8125rem">
                    {d.label}
                  </Typography>
                  <Typography variant="caption" color="text.disabled" noWrap>
                    {d.sublabel}
                  </Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}

          {/* CSVs subidos */}
          {csvs.length > 0 && (
            <ListSubheader sx={{ lineHeight: "2rem", fontSize: "0.6875rem", bgcolor: "background.default" }}>
              Mis archivos CSV
            </ListSubheader>
          )}
          {csvs.map((d) => (
            <MenuItem key={d.dataset_id} value={d.dataset_id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                {sourceIcon(d.source)}
                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  <Typography variant="body2" noWrap fontSize="0.8125rem">{d.label}</Typography>
                  <Typography variant="caption" color="text.disabled" noWrap>{d.sublabel}</Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}

          {/* Base de datos */}
          {dbs.length > 0 && (
            <ListSubheader sx={{ lineHeight: "2rem", fontSize: "0.6875rem", bgcolor: "background.default" }}>
              Base de datos
            </ListSubheader>
          )}
          {dbs.map((d) => (
            <MenuItem key={d.dataset_id} value={d.dataset_id}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" }}>
                {sourceIcon(d.source)}
                <Box sx={{ flex: 1, overflow: "hidden" }}>
                  <Typography variant="body2" noWrap fontSize="0.8125rem">{d.label}</Typography>
                  <Typography variant="caption" color="text.disabled" noWrap>{d.sublabel}</Typography>
                </Box>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Hint cuando no hay nada o para conectar más */}
      {!loading && (
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.375rem" }}>
          <Typography variant="caption" color="text.disabled">
            {hasAny
              ? `${datasets.length} dataset${datasets.length > 1 ? "s" : ""} disponible${datasets.length > 1 ? "s" : ""}`
              : "Conectá una fuente de datos primero"}
          </Typography>
          <Tooltip title="Ir a Conectar Datos para subir un CSV, usar el dataset demo o conectar una DB">
            <Button
              size="small" variant="text"
              startIcon={<AddIcon sx={{ fontSize: "0.75rem !important" }} />}
              href="/dashboard/dataset"
              sx={{ textTransform: "none", fontSize: "0.6875rem", color: "text.secondary", py: 0 }}
            >
              Conectar fuente
            </Button>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}
