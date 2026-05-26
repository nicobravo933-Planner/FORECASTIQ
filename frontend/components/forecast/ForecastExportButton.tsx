"use client"

/**
 * ForecastExportButton — EXP-1b
 *
 * Split button with 3 export options:
 *   1. Excel analítico (primary) — 4 sheets: Resumen, Predicciones, Error mensual, Parámetros
 *   2. CSV predicciones — tabular flat file
 *   3. JSON — full result as serialized JSON
 *
 * Renders only when jobId is provided.
 * Uses native browser blob download — no page navigation.
 */

import { useRef, useState } from "react"
import type { ReactNode } from "react"
import Box from "@mui/material/Box"
import Button from "@mui/material/Button"
import ButtonGroup from "@mui/material/ButtonGroup"
import CircularProgress from "@mui/material/CircularProgress"
import ClickAwayListener from "@mui/material/ClickAwayListener"
import Grow from "@mui/material/Grow"
import MenuItem from "@mui/material/MenuItem"
import MenuList from "@mui/material/MenuList"
import Paper from "@mui/material/Paper"
import Popper from "@mui/material/Popper"
import Snackbar from "@mui/material/Snackbar"
import Alert from "@mui/material/Alert"
import Tooltip from "@mui/material/Tooltip"
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown"
import DownloadIcon from "@mui/icons-material/Download"
import TableChartIcon from "@mui/icons-material/TableChart"
import DataObjectIcon from "@mui/icons-material/DataObject"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ForecastExportButtonProps {
  jobId: string
  disabled?: boolean
  size?: "small" | "medium" | "large"
}

type ExportFormat = "xlsx" | "csv" | "json"

interface ExportOption {
  format:      ExportFormat
  label:       string
  description: string
  icon:        ReactNode
  mimeType:    string
  ext:         string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const OPTIONS: ExportOption[] = [
  {
    format:      "xlsx",
    label:       "Excel analítico",
    description: "Resumen + Predicciones + Error mensual + Parámetros",
    icon:        <TableChartIcon sx={{ fontSize: "1rem" }} />,
    mimeType:    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext:         ".xlsx",
  },
  {
    format:      "csv",
    label:       "CSV predicciones",
    description: "Tabla plana: fecha, predicho, lower, upper",
    icon:        <DownloadIcon sx={{ fontSize: "1rem" }} />,
    mimeType:    "text/csv",
    ext:         ".csv",
  },
  {
    format:      "json",
    label:       "JSON completo",
    description: "Resultado completo serializado",
    icon:        <DataObjectIcon sx={{ fontSize: "1rem" }} />,
    mimeType:    "application/json",
    ext:         ".json",
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function ForecastExportButton({
  jobId,
  disabled = false,
  size = "small",
}: ForecastExportButtonProps) {
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState<ExportFormat | null>(null)
  const [toast, setToast]       = useState<{ msg: string; severity: "success" | "error" } | null>(null)
  const anchorRef = useRef<HTMLDivElement>(null)

  const handleDownload = async (option: ExportOption) => {
    if (loading) return
    setOpen(false)
    setLoading(option.format)
    try {
      const url = `/api/forecast/${jobId}/export?format=${option.format}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error desconocido" }))
        throw new Error(String(err.detail ?? "Error en la descarga"))
      }
      const blob = await res.blob()
      // Trigger browser download without navigating away
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = blobUrl
      a.download = `forecastiq_${jobId.slice(0, 8)}${option.ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
      setToast({ msg: `Descargado como ${option.label}`, severity: "success" })
    } catch (err) {
      setToast({
        msg: err instanceof Error ? err.message : "Error al descargar",
        severity: "error",
      })
    } finally {
      setLoading(null)
    }
  }

  const primaryOption = OPTIONS[0]   // Excel — always the default

  return (
    <Box sx={{ display: "inline-flex" }}>
      <ButtonGroup
        ref={anchorRef}
        variant="outlined"
        size={size}
        disabled={disabled || loading !== null}
        sx={{ borderRadius: "0.375rem" }}
        aria-label="export options"
      >
        {/* Primary: Excel download */}
        <Tooltip title="Exportar análisis completo como Excel (4 hojas)">
          <Button
            startIcon={
              loading === "xlsx"
                ? <CircularProgress size="0.875rem" color="inherit" />
                : <TableChartIcon sx={{ fontSize: "1rem" }} />
            }
            onClick={() => handleDownload(primaryOption)}
            sx={{ textTransform: "none", fontWeight: 600, fontSize: "0.8125rem" }}
          >
            Exportar Excel
          </Button>
        </Tooltip>

        {/* Dropdown toggle */}
        <Button
          size={size}
          aria-controls={open ? "export-menu" : undefined}
          aria-expanded={open ? "true" : undefined}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
          sx={{ px: "0.25rem" }}
        >
          <ArrowDropDownIcon />
        </Button>
      </ButtonGroup>

      {/* Dropdown menu */}
      <Popper
        sx={{ zIndex: 9 }}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        placement="bottom-end"
        transition
        disablePortal
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{ transformOrigin: placement === "bottom-end" ? "right top" : "right bottom" }}
          >
            <Paper
              elevation={4}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "0.5rem",
                mt: "0.25rem",
                minWidth: "16rem",
              }}
            >
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <MenuList id="export-menu" autoFocusItem>
                  {OPTIONS.map((opt) => (
                    <MenuItem
                      key={opt.format}
                      onClick={() => handleDownload(opt)}
                      disabled={loading !== null}
                      sx={{ gap: "0.75rem", py: "0.625rem" }}
                    >
                      <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>
                        {loading === opt.format
                          ? <CircularProgress size="1rem" color="inherit" />
                          : opt.icon
                        }
                      </Box>
                      <Box>
                        <Box component="span" sx={{ fontWeight: 600, fontSize: "0.875rem", display: "block" }}>
                          {opt.label}
                        </Box>
                        <Box component="span" sx={{ fontSize: "0.75rem", color: "text.secondary" }}>
                          {opt.description}
                        </Box>
                      </Box>
                    </MenuItem>
                  ))}
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>

      {/* Success / error toast */}
      <Snackbar
        open={toast !== null}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast?.severity ?? "info"}
          onClose={() => setToast(null)}
          sx={{ fontSize: "0.8125rem" }}
        >
          {toast?.msg}
        </Alert>
      </Snackbar>
    </Box>
  )
}
