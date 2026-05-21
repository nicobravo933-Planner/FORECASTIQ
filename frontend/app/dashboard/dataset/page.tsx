"use client"

/**
 * Dataset page — data source selection + Phase 1 upload flow.
 *
 * Three tabs:
 *   0. Upload CSV  → full existing flow (DropZone → Preview → ColumnSelector → ModelRecommendation)
 *   1. Demo dataset → placeholder (Phase 9: DuckDB + Supabase Storage Parquet)
 *   2. Connect DB   → placeholder (backlog enterprise: ephemeral connection string)
 */

import { useEffect, useRef } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import RestartAltIcon from "@mui/icons-material/RestartAlt"

import { useDataset } from "@/hooks/useDataset"
import { appStore } from "@/lib/appStore"
import { DataSourceTabs } from "@/components/dataset/DataSourceTabs"
import { DemoDatasetCard } from "@/components/dataset/DemoDatasetCard"
import { ConnectDbCard } from "@/components/dataset/ConnectDbCard"
import { DropZone } from "@/components/upload/DropZone"
import { DataPreview } from "@/components/upload/DataPreview"
import { ColumnSelector } from "@/components/upload/ColumnSelector"
import { ModelRecommendation } from "@/components/upload/ModelRecommendation"

export default function DatasetPage() {
  const dataset = useDataset()

  // Persist active dataset context to appStore once detection is complete.
  // This pre-fills the Forecast page so the user never has to copy-paste the dataset ID.
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
      {/* Error banner */}
      {dataset.stage === "error" && dataset.error && (
        <Alert severity="error" onClose={dataset.reset}>
          {dataset.error}
        </Alert>
      )}

      {/* Step 1 — DropZone */}
      {(dataset.stage === "idle" || dataset.stage === "uploading") && (
        <DropZone
          onFile={dataset.uploadFile}
          uploading={dataset.stage === "uploading"}
          uploadProgress={dataset.uploadProgress}
          filename={dataset.uploadResponse?.filename}
        />
      )}

      {/* Upload summary pill */}
      {dataset.uploadResponse && dataset.stage !== "uploading" && (
        <Box
          sx={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            bgcolor: "background.paper",
            borderRadius: "0.5rem",
            px: "1rem",
            py: "0.625rem",
            border: "1px solid",
            borderColor: "divider",
            flexWrap: "wrap",
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
            variant="text"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={dataset.reset}
            sx={{ ml: "auto", color: "text.disabled", fontSize: "0.75rem" }}
          >
            Cambiar archivo
          </Button>
        </Box>
      )}

      {/* Step 2 — DataPreview */}
      {dataset.preview && <DataPreview preview={dataset.preview} />}

      {/* Step 3 — ColumnSelector */}
      {dataset.preview && dataset.stage !== "done" && (
        <ColumnSelector
          preview={dataset.preview}
          detecting={dataset.stage === "detecting"}
          onDetect={dataset.detectModel}
        />
      )}

      {/* Step 4 — ModelRecommendation */}
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
      {/* Page header */}
      <Box>
        <Typography variant="h4" color="text.primary" fontWeight={700} sx={{ letterSpacing: "-0.02em" }}>
          Dataset
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
          Elegí cómo conectar tus datos y detectamos el mejor modelo automáticamente.
        </Typography>
      </Box>

      {/* Tabs */}
      <DataSourceTabs
        csvContent={csvFlow}
        demoContent={<DemoDatasetCard />}
        dbContent={<ConnectDbCard />}
      />
    </Box>
  )
}
