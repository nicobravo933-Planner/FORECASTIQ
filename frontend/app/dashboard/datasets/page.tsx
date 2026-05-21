"use client"

/**
 * Datasets page — UX-2.
 * Lists all datasets uploaded by the current user.
 * Click a row → pre-fills the Forecast page and navigates there.
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
import PlayArrowIcon from "@mui/icons-material/PlayArrow"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import ContentCopyIcon from "@mui/icons-material/ContentCopy"
import StorageIcon from "@mui/icons-material/Storage"
import { api, ApiError } from "@/lib/api"
import { appStore } from "@/lib/appStore"
import type { DatasetListItem, DatasetListResponse } from "@/lib/types"

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function fmtRows(n: number | null): string {
  if (n == null) return "—"
  return n.toLocaleString("es-AR")
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DatasetsPage() {
  const router = useRouter()
  const [datasets, setDatasets]   = useState<DatasetListItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [copied, setCopied]       = useState<string | null>(null)

  useEffect(() => {
    api.get<DatasetListResponse>("/api/datasets/")
      .then((res) => setDatasets(res.datasets))
      .catch((err) => setError(err instanceof ApiError ? err.message : "Error al cargar datasets."))
      .finally(() => setLoading(false))
  }, [])

  // Copy dataset_id to clipboard with visual feedback
  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(id).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 1500)
  }

  // Select a dataset → store in appStore → navigate to Forecast
  const handleSelect = (ds: DatasetListItem) => {
    // Store context — columns are unknown until the user selects them in Forecast
    // We store the dataset_id; Forecast page will show column dropdowns from preview
    appStore.setActiveDataset(ds.dataset_id, "", "", "M")
    router.push("/dashboard/forecast")
  }

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
            Todos tus CSVs subidos. Hacé clic en una fila para usar ese dataset en el Forecast.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          size="small"
          startIcon={<UploadFileIcon />}
          href="/dashboard/dataset"
          sx={{ textTransform: "none", alignSelf: "flex-start" }}
        >
          Subir nuevo
        </Button>
      </Box>

      {/* Error */}
      {error && <Alert severity="error">{error}</Alert>}

      {/* Skeleton while loading */}
      {loading && (
        <Paper variant="outlined" sx={{ borderRadius: "0.75rem", overflow: "hidden" }}>
          {[...Array(4)].map((_, i) => (
            <Box key={i} sx={{ px: "1.5rem", py: "0.875rem", borderBottom: "1px solid", borderColor: "divider" }}>
              <Skeleton variant="text" width="60%" />
              <Skeleton variant="text" width="40%" sx={{ mt: "0.25rem" }} />
            </Box>
          ))}
        </Paper>
      )}

      {/* Empty state */}
      {!loading && !error && datasets.length === 0 && (
        <Paper
          variant="outlined"
          sx={{
            p: "3rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            borderRadius: "0.75rem",
            borderStyle: "dashed",
          }}
        >
          <StorageIcon sx={{ fontSize: "3rem", color: "text.disabled" }} />
          <Typography variant="h6" color="text.secondary">
            Todavía no subiste ningún dataset
          </Typography>
          <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth="24rem">
            Subí tu primer CSV desde la página Dataset y aparecerá aquí para que puedas reutilizarlo sin volver a subirlo.
          </Typography>
          <Button variant="contained" startIcon={<UploadFileIcon />} href="/dashboard/dataset">
            Subir primer dataset
          </Button>
        </Paper>
      )}

      {/* Table */}
      {!loading && datasets.length > 0 && (
        <TableContainer
          component={Paper}
          variant="outlined"
          sx={{ borderRadius: "0.75rem", overflow: "hidden" }}
        >
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: "background.default" }}>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary", py: "0.75rem" }}>
                  Archivo
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }} align="right">
                  Filas
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  Columnas
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  Subido
                </TableCell>
                <TableCell sx={{ fontWeight: 600, fontSize: "0.75rem", color: "text.secondary" }}>
                  ID
                </TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {datasets.map((ds) => (
                <TableRow
                  key={ds.dataset_id}
                  hover
                  onClick={() => handleSelect(ds)}
                  sx={{
                    cursor: "pointer",
                    transition: "background 0.15s",
                    "&:hover .run-btn": { opacity: 1 },
                  }}
                >
                  {/* Filename */}
                  <TableCell sx={{ py: "0.875rem" }}>
                    <Typography variant="body2" fontWeight={500} color="text.primary" noWrap sx={{ maxWidth: "16rem" }}>
                      {ds.filename}
                    </Typography>
                  </TableCell>

                  {/* Rows */}
                  <TableCell align="right">
                    <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>
                      {fmtRows(ds.rows)}
                    </Typography>
                  </TableCell>

                  {/* Column chips — show first 4, +N badge if more */}
                  <TableCell>
                    <Box sx={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", maxWidth: "20rem" }}>
                      {ds.columns.slice(0, 4).map((col) => (
                        <Chip
                          key={col}
                          label={col}
                          size="small"
                          sx={{
                            fontSize: "0.6875rem",
                            height: "1.25rem",
                            bgcolor: "background.default",
                            color: "text.secondary",
                            border: "1px solid",
                            borderColor: "divider",
                          }}
                        />
                      ))}
                      {ds.columns.length > 4 && (
                        <Chip
                          label={`+${ds.columns.length - 4}`}
                          size="small"
                          sx={{
                            fontSize: "0.6875rem",
                            height: "1.25rem",
                            bgcolor: "primary.dark",
                            color: "primary.light",
                          }}
                        />
                      )}
                    </Box>
                  </TableCell>

                  {/* Created at */}
                  <TableCell>
                    <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: "nowrap" }}>
                      {fmtDate(ds.created_at)}
                    </Typography>
                  </TableCell>

                  {/* Truncated ID + copy button */}
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                      <Typography
                        variant="caption"
                        color="text.disabled"
                        sx={{ fontFamily: "monospace", fontSize: "0.6875rem" }}
                      >
                        {ds.dataset_id.slice(0, 8)}…
                      </Typography>
                      <Tooltip title={copied === ds.dataset_id ? "¡Copiado!" : "Copiar ID"} placement="top">
                        <IconButton
                          size="small"
                          onClick={(e) => handleCopy(ds.dataset_id, e)}
                          sx={{ opacity: 0.5, "&:hover": { opacity: 1 }, p: "0.125rem" }}
                        >
                          <ContentCopyIcon sx={{ fontSize: "0.875rem", color: copied === ds.dataset_id ? "success.main" : "text.disabled" }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>

                  {/* Action button — appears on hover */}
                  <TableCell align="right" sx={{ pr: "1rem" }}>
                    <Tooltip title="Usar en Forecast" placement="left">
                      <IconButton
                        className="run-btn"
                        size="small"
                        onClick={(e) => { e.stopPropagation(); handleSelect(ds) }}
                        sx={{
                          opacity: 0,
                          transition: "opacity 0.15s",
                          bgcolor: "primary.dark",
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Footer count */}
      {!loading && datasets.length > 0 && (
        <Typography variant="caption" color="text.disabled">
          {datasets.length} dataset{datasets.length !== 1 ? "s" : ""} · Solo vos podés ver los tuyos
        </Typography>
      )}

    </Box>
  )
}
