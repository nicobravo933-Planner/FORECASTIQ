"use client"

/**
 * Conectar Datos — página principal de ingesta.
 * (Antes llamada "Dataset" / "Subir CSV")
 *
 * Cuatro tabs:
 *   0. Archivo       → CSV, Excel, Parquet local (upload existente)
 *   1. Base de datos → conexión efímera PostgreSQL/MySQL/SQLite
 *   2. Cloud / Lake  → BigQuery, Snowflake, S3 (Fase 13 — bloqueado)
 *   3. Dataset demo  → 25k SKUs en Supabase Storage vía DuckDB
 */

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import Chip from "@mui/material/Chip"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import ComputerIcon from "@mui/icons-material/Computer"

import { useDataset } from "@/hooks/useDataset"
import { useCapabilities } from "@/hooks/useCapabilities"
import { appStore } from "@/lib/appStore"
import { DataSourceTabs } from "@/components/dataset/DataSourceTabs"
import { DemoDatasetCard } from "@/components/dataset/DemoDatasetCard"
import { ConnectDbCard } from "@/components/dataset/ConnectDbCard"
import { CloudDataCard } from "@/components/dataset/CloudDataCard"
import { DropZone } from "@/components/upload/DropZone"
import { DataPreview } from "@/components/upload/DataPreview"
import { ColumnSelector } from "@/components/upload/ColumnSelector"
import { ModelRecommendation } from "@/components/upload/ModelRecommendation"

export default function DatasetPage() {
  const dataset = useDataset()
  const { caps, loading: capsLoading } = useCapabilities()
  const router = useRouter()

  // Persist active dataset context to appStore once detection is complete.
  const persisted = useRef(false)
  useEffect(() => {
    if (dataset.stage === "done" && dataset.datasetId && dataset.detection && !persisted.current) {
      appStore.setActiveDataset(
        dataset.datasetId,
        dataset.selectedDateColumn ?? "",
        dataset.selectedTargetColumn ?? "",
        dataset.selectedFreq ?? "M",
      )
      persisted.current = true
    }
    if (dataset.stage === "idle") persisted.current = false
  }, [dataset.stage, dataset.datasetId, dataset.detection, dataset.selectedDateColumn, dataset.selectedTargetColumn, dataset.selectedFreq])

  // ── CSV upload flow (Tab 0 content) ─────────────────────────────────────────
  const csvFlow = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {dataset.stage === "error" && dataset.error && (
        <Alert severity="error" onClose={dataset.reset}>{dataset.error}</Alert>
      )}
      {(dataset.stage === "idle" || dataset.stage === "uploading") && (
        <DropZone
          onFile={dataset.uploadFile}
          uploading={dataset.stage === "uploading"}
          uploadProgress={dataset.uploadProgress}
          filename={dataset.uploadResponse?.filename}
        />
      )}
      {dataset.uploadResponse && dataset.stage !== "uploading" && (
        <Box
          sx={{
            display: "flex", gap: "1rem", alignItems: "center",
            bgcolor: "background.paper", borderRadius: "0.5rem",
            px: "1rem", py: "0.625rem",
            border: "1px solid", borderColor: "divider", flexWrap: "wrap",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            📄 <strong>{dataset.uploadResponse.filename}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dataset.uploadResponse.rows.toLocaleString()} filas ·{" "}
            {dataset.uploadResponse.columns.length} columnas
          </Typography>
          <Button
            variant="text" size="small"
            startIcon={<RestartAltIcon />}
            onClick={dataset.reset}
            sx={{ ml: "auto", color: "text.disabled", fontSize: "0.75rem" }}
          >
            Cambiar archivo
          </Button>
        </Box>
      )}
      {dataset.preview && <DataPreview preview={dataset.preview} />}
      {dataset.preview && dataset.stage !== "done" && (
        <ColumnSelector
          preview={dataset.preview}
          detecting={dataset.stage === "detecting"}
          onDetect={dataset.detectModel}
        />
      )}
      {dataset.detection && dataset.stage === "done" && (
        <ModelRecommendation
          result={dataset.detection}
          onRunForecast={() => { window.location.href = "/dashboard/forecast" }}
        />
      )}
    </Box>
  )

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}>

      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
        <Box>
          <Button
            size="small" variant="text" startIcon={<ArrowBackIcon />}
            onClick={() => router.push("/dashboard/data")}
            sx={{ textTransform: "none", color: "text.secondary", mb: "0.5rem", pl: 0 }}>
            Volver a Datos
          </Button>
          <Typography variant="h4" color="text.primary" fontWeight={700} sx={{ letterSpacing: "-0.02em" }}>
            Conectar Datos
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
            Subí un archivo, conectá tu base de datos o usá el dataset demo para empezar a forecasting.
          </Typography>
        </Box>

        {/* Server tier badge — solo visible en modo local */}
        {!capsLoading && caps.tier === "local" && (
          <Chip
            icon={<ComputerIcon sx={{ fontSize: "0.875rem !important" }} />}
            label="Backend local"
            size="small"
            sx={{
              bgcolor: "rgba(16,185,129,0.12)",
              color: "success.main",
              border: "1px solid rgba(16,185,129,0.3)",
              fontWeight: 600,
              fontSize: "0.75rem",
            }}
          />
        )}
      </Box>

      {/* Tabs */}
      <DataSourceTabs
        caps={caps}
        csvContent={csvFlow}
        dbContent={<ConnectDbCard />}
        demoContent={<DemoDatasetCard />}
        cloudContent={<CloudDataCard />}
      />
    </Box>
  )
}
