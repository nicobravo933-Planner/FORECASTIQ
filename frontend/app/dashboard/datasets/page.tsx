"use client"

/**
 * Mis Datasets — lista todo lo conectado desde "Conectar Datos".
 *
 * Muestra:
 *   1. Entrada fija: Dataset demo 25k SKUs (siempre disponible)
 *   2. Datasets del usuario autenticado (Supabase, por user_id)
 *   3. Datasets de sesión anónima (localStorage, para modo sin login)
 *
 * Click en una fila → navega a Forecast con ese dataset pre-cargado.
 * NO tiene función de subida — eso es exclusivo de "Conectar Datos".
 */

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Paper from "@mui/material/Paper"
import Table from "@mui/material/Table"
import TableBody from "@mui/material/TableBody"
import TableCell from "@mui/material/TableCell"
import TableContainer from "@mui/material/TableContainer"
import TableHead from "@mui/material/TableHead"
import TableRow from "@mui/material/TableRow"
import Chip from "@mui/material/Chip"
import Tooltip from "@mui/material/Tooltip"
import IconButton from "@mui/material/IconButton"
import Button from "@mui/material/Button"
import Skeleton from "@mui/material/Skeleton"
import Alert from "@mui/material/Alert"
import Divider from "@mui/material/Divider"
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import AddIcon from "@mui/icons-material/Add"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import StorageIcon from "@mui/icons-material/Storage"
import AutoGraphIcon from "@mui/icons-material/AutoGraph"
import StarIcon from "@mui/icons-material/Star"
import { api } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import { getSessionIds } from "@/lib/sessionDatasets"
import type { DatasetListItem, DatasetListResponse } from "@/lib/types"

// ── Constante: entrada fija del dataset demo ──────────────────────────────────

const DEMO_ENTRY: DatasetListItem = {
  dataset_id: "__demo__",
  filename:   "Dataset demo — Ventas retail 25k SKUs",
  rows:       27_375_000,
  columns:    ["fecha", "ventas", "precio", "stock", "sku_id", "categoria"],
  created_at: "2022-01-01T00:00:00",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  if (iso === "2022-01-01T00:00:00") return "Siempre disponible"
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch { return iso }
}

function fmtRows(n: number | null): string {
  if (n == null) return "—"
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}k`
  return n.toLocaleString("es-AR")
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const router  = useRouter()
  const [datasets, setDatasets] = useState<DatasetListItem[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [copied, setCopied]     = useState<string | null>(null)

  useEffect(() => {
    const sessionIds = getSessionIds()
    const url = sessionIds
      ? `/api/datasets/?session_ids=${encodeURIComponent(sessionIds)}`
      : "/api/datasets/"

    api.get<DatasetListResponse>(url)
      .then((res) => setDatasets(res.datasets))
      .catch(() => setError("No se pudo conectar al backend. Verificá que esté corriendo."))
      .finally(() => setLoading(false))
  }, [])

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (id === "__demo__") return
    navigator.clipboard.writeText(id).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  const handleSelect = (ds: DatasetListItem) => {
    if (ds.dataset_id === "__demo__") {
      router.push("/dashboard/explorer?source=demo")
      return
    }
    appStore.setActiveDataset(ds.dataset_id, "", "", "M")
    // Abrir en explorer — el usuario puede elegir forecast desde ahí
    router.push(`/dashboard/explorer?source=csv&dsId=${ds.dataset_id}`)
  }

  // Combinar: demo siempre primero, luego datasets reales
  const allDatasets = [DEMO_ENTRY, ...datasets]

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "2rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.625rem", mb: "0.25rem" }}>
            <StorageIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
            <Typography variant="h4" color="text.primary" fontWeight={700}>
              Mis Datasets
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Todo lo conectado desde <strong>Conectar Datos</strong>. Hacé clic en una fila para usar en Forecast.
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          href="/dashboard/dataset"
          sx={{ textTransform: "none", alignSelf: "flex-start" }}
        >
          Conectar datos
        </Button>
      </Box>

      {/* Error */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Skeleton */}
      {loading && (
        <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
          {[...Array(3)].map((_, i) => (
            <Box key={i} sx={{ px: "1.5rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider" }}>
              <Skeleton variant="text" width="55%" />
              <Skeleton variant="text" width="35%" sx={{ mt: "0.25rem" }} />
            </Box>
          ))}
        </Paper>
      )}

      {/* Table */}
      {!loading && (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary", py: "0.75rem" }}>
                  Nombre
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }} align="right">
                  Filas
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  Columnas
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  Disponible desde
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  ID
                </TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {allDatasets.map((ds, idx) => {
                const isDemo = ds.dataset_id === "__demo__"
                return (
                  <>
                    {/* Divider entre demo y datos reales */}
                    {idx === 1 && datasets.length > 0 && (
                      <TableRow key="divider">
                        <TableCell colSpan={6} sx={{ py: "0.25rem", px: "1rem", bgcolor: "background.default" }}>
                          <Typography variant="caption" color="text.disabled" fontWeight={600}>
                            Tus datasets
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                    <TableRow
                      key={ds.dataset_id}
                      hover
                      onClick={() => handleSelect(ds)}
                      sx={{
                        cursor: "pointer",
                        transition: "background 0.15s",
                        bgcolor: isDemo ? "rgba(99,102,241,0.03)" : "transparent",
                        "&:hover .run-btn": { opacity: 1 },
                      }}
                    >
                      {/* Nombre */}
                      <TableCell sx={{ py: "0.875rem" }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          {isDemo
                            ? <AutoGraphIcon sx={{ fontSize: "1rem", color: "primary.light", flexShrink: 0 }} />
                            : <StorageIcon   sx={{ fontSize: "1rem", color: "text.disabled",  flexShrink: 0 }} />
                          }
                          <Typography variant="body2" fontWeight={isDemo ? 600 : 500} color="text.primary" noWrap sx={{ maxWidth: "18rem" }}>
                            {ds.filename}
                          </Typography>
                          {isDemo && (
                            <Chip label="Demo" size="small" sx={{ height: "1.125rem", fontSize: "0.625rem", bgcolor: "rgba(99,102,241,0.1)", color: "primary.light", border: "1px solid rgba(99,102,241,0.2)" }} />
                          )}
                        </Box>
                      </TableCell>

                      {/* Filas */}
                      <TableCell align="right">
                        <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                          {fmtRows(ds.rows)}
                        </Typography>
                      </TableCell>

                      {/* Columnas */}
                      <TableCell>
                        <Box sx={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", maxWidth: "18rem" }}>
                          {ds.columns.slice(0, 4).map((col) => (
                            <Chip key={col} label={col} size="small" sx={{ fontSize: "0.6875rem", height: "1.25rem", bgcolor: "background.default", color: "text.secondary", border: "1px solid", borderColor: "divider" }} />
                          ))}
                          {ds.columns.length > 4 && (
                            <Chip label={`+${ds.columns.length - 4}`} size="small" sx={{ fontSize: "0.6875rem", height: "1.25rem", bgcolor: "primary.dark", color: "primary.light" }} />
                          )}
                        </Box>
                      </TableCell>

                      {/* Fecha */}
                      <TableCell>
                        <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
                          {fmtDate(ds.created_at)}
                        </Typography>
                      </TableCell>

                      {/* ID */}
                      <TableCell>
                        {!isDemo && (
                          <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                            <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace", fontSize: "0.6875rem" }}>
                              {ds.dataset_id.slice(0, 8)}…
                            </Typography>
                            <Tooltip title={copied === ds.dataset_id ? "¡Copiado!" : "Copiar ID"} placement="top">
                              <IconButton size="small" onClick={(e) => handleCopy(ds.dataset_id, e)} sx={{ opacity: 0.5, "&:hover": { opacity: 1 }, p: "0.125rem" }}>
                                <ContentCopyIcon sx={{ fontSize: "0.875rem", color: copied === ds.dataset_id ? "success.main" : "text.disabled" }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                      </TableCell>

                      {/* Acción */}
                      <TableCell align="right" sx={{ pr: "1rem" }}>
                        <Tooltip title={isDemo ? "Explorar demo" : "Usar en Forecast"} placement="left">
                          <IconButton
                            className="run-btn"
                            size="small"
                            onClick={(e) => { e.stopPropagation(); handleSelect(ds) }}
                            sx={{
                              opacity: 0,
                              transition: "opacity 0.15s",
                              bgcolor: isDemo ? "primary.main" : "primary.dark",
                              color: "primary.light",
                              "&:hover": { bgcolor: "primary.main" },
                              width: "1.75rem",
                              height: "1.75rem",
                            }}
                          >
                            <PlayArrowIcon sx={{ fontSize: "1rem" }} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  </>
                )
              })}

              {/* Empty state para datasets propios */}
              {!loading && datasets.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} sx={{ py: "2rem", textAlign: "center" }}>
                    <Typography variant="body2" color="text.disabled">
                      Todavía no conectaste ningún dataset propio.{" "}
                      <Button variant="text" size="small" href="/dashboard/dataset" sx={{ textTransform: "none", p: 0, verticalAlign: "baseline" }}>
                        Conectar datos →
                      </Button>
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Footer */}
      {!loading && datasets.length > 0 && (
        <Typography variant="caption" color="text.disabled">
          {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} propios · 1 demo siempre disponible
        </Typography>
      )}
    </Box>
  )
}
