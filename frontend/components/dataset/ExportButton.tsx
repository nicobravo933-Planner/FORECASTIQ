"use client"

/**
 * ExportButton — downloads a dataset as Parquet or CSV.
 *
 * Uses the browser's native download via a temporary <a> tag to avoid
 * needing auth headers — the endpoint is public by dataset_id.
 *
 * Props:
 *   datasetId  — the dataset to export (original or _etl cleaned version)
 *   label      — optional override for the button label
 *   variant    — MUI button variant (default: "outlined")
 *   size       — MUI button size (default: "small")
 */

import { useState } from "react"
import Button from "@mui/material/Button"
import ButtonGroup from "@mui/material/ButtonGroup"
import CircularProgress from "@mui/material/CircularProgress"
import Tooltip from "@mui/material/Tooltip"
import DownloadIcon from "@mui/icons-material/Download"
// Base URL duplicada localmente para evitar fetch auth overhead en descarga directa
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

interface ExportButtonProps {
  datasetId: string
  label?: string
  variant?: "text" | "outlined" | "contained"
  size?: "small" | "medium" | "large"
  /** Show both Parquet + CSV buttons (default: true) */
  showBoth?: boolean
}

export function ExportButton({
  datasetId,
  label,
  variant = "outlined",
  size = "small",
  showBoth = true,
}: ExportButtonProps) {
  const [downloading, setDownloading] = useState<"parquet" | "csv" | null>(null)

  const handleDownload = async (format: "parquet" | "csv") => {
    if (downloading) return
    setDownloading(format)
    try {
      // Fetch the file as blob so we can trigger a browser download
      const url = `${API_URL}/api/datasets/${datasetId}/export?format=${format}`
      const res = await fetch(url)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Error al descargar" }))
        throw new Error(err.detail ?? "Error al descargar")
      }
      const blob = await res.blob()
      const ext  = format === "parquet" ? "parquet" : "csv"
      const filename = `forecastiq_${datasetId.slice(0, 8)}.${ext}`

      // Trigger native browser download without leaving the page
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = href
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      document.body.removeChild(anchor)
      URL.revokeObjectURL(href)
    } catch (err) {
      console.error("Export error:", err)
    } finally {
      setDownloading(null)
    }
  }

  if (!showBoth) {
    // Single-format button (Parquet only)
    return (
      <Tooltip title="Descarga el dataset como Parquet comprimido — ideal para pandas, DuckDB y Spark">
        <span>
          <Button
            variant={variant}
            size={size}
            startIcon={
              downloading === "parquet"
                ? <CircularProgress size="0.9rem" />
                : <DownloadIcon />
            }
            onClick={() => handleDownload("parquet")}
            disabled={!!downloading}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            {label ?? "Descargar Parquet"}
          </Button>
        </span>
      </Tooltip>
    )
  }

  // Split button: Parquet (primary) + CSV (secondary)
  return (
    <ButtonGroup variant={variant} size={size} disabled={!!downloading}>
      <Tooltip title="Parquet snappy — 3-5× más compacto que CSV, ideal para ML">
        <Button
          startIcon={
            downloading === "parquet"
              ? <CircularProgress size="0.9rem" />
              : <DownloadIcon />
          }
          onClick={() => handleDownload("parquet")}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          {label ?? "Parquet"}
        </Button>
      </Tooltip>
      <Tooltip title="CSV UTF-8 — compatible con Excel y cualquier herramienta">
        <Button
          startIcon={
            downloading === "csv"
              ? <CircularProgress size="0.9rem" />
              : <DownloadIcon />
          }
          onClick={() => handleDownload("csv")}
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          CSV
        </Button>
      </Tooltip>
    </ButtonGroup>
  )
}
