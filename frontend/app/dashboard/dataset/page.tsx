"use client"

/**
 * Conectar Datos — ingesta de datos.
 *
 * Responsabilidad de esta vista: recibir el archivo y mostrar un preview.
 * Nada más. La selección de columnas y el análisis ocurren en EDA.
 *
 * Flujo:
 *   1. Usuario sube el CSV/Parquet/Excel  → se guarda dataset_id en appStore
 *   2. Se muestra un preview de las primeras filas
 *   3. Botón "Analizar en EDA →" lleva al usuario al análisis
 */

import { Suspense, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import CircularProgress from "@mui/material/CircularProgress"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import ArrowBackIcon from "@mui/icons-material/ArrowBack"
import ArrowForwardIcon from "@mui/icons-material/ArrowForward"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import AssessmentIcon from "@mui/icons-material/Assessment"

import { useDataset } from "@/hooks/useDataset"
import { appStore } from "@/lib/appStore"
import { DataSourceTabs } from "@/components/dataset/DataSourceTabs"
import { DemoDatasetCard } from "@/components/dataset/DemoDatasetCard"
import { ConnectDbCard } from "@/components/dataset/ConnectDbCard"
import { CloudDataCard } from "@/components/dataset/CloudDataCard"
import { DropZone } from "@/components/upload/DropZone"
import { DataPreview } from "@/components/upload/DataPreview"

export default function DatasetPage() {
  const dataset = useDataset()
  const router = useRouter()

  // Persist dataset_id to appStore as soon as upload completes.
  // Columns are intentionally NOT saved here — that's EDA's responsibility.
  const persisted = useRef(false)
  useEffect(() => {
    if (dataset.stage === "preview" && dataset.datasetId && !persisted.current) {
      // Save only the id — EDA will detect columns via /preview and let user edit them
      appStore.setActiveDataset(dataset.datasetId, "", "", "M")
      appStore.clearQualityScore()
      appStore.clearCleanedDataset()
      persisted.current = true
    }
    if (dataset.stage === "idle") persisted.current = false
  }, [dataset.stage, dataset.datasetId])

  // ── CSV / file upload flow ────────────────────────────────────────────────
  const csvFlow = (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

      {dataset.stage === "error" && dataset.error && (
        <Alert severity="error" onClose={dataset.reset}>{dataset.error}</Alert>
      )}

      {/* DropZone — shown while idle or uploading */}
      {(dataset.stage === "idle" || dataset.stage === "uploading") && (
        <DropZone
          onFile={dataset.uploadFile}
          uploading={dataset.stage === "uploading"}
          uploadProgress={dataset.uploadProgress}
          filename={dataset.uploadResponse?.filename}
        />
      )}

      {/* File info bar — shown after upload */}
      {dataset.uploadResponse && dataset.stage !== "uploading" && (
        <Box sx={{
          display: "flex", gap: "1rem", alignItems: "center",
          bgcolor: "background.paper", borderRadius: "0.5rem",
          px: "1rem", py: "0.625rem",
          border: "1px solid", borderColor: "divider", flexWrap: "wrap",
        }}>
          <Typography variant="body2" color="text.secondary">
            📄 <strong>{dataset.uploadResponse.filename}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {dataset.uploadResponse.rows.toLocaleString()} filas ·{" "}
            {dataset.uploadResponse.columns.length} columnas
          </Typography>
          <Button
            variant="outlined" size="small"
            startIcon={<RestartAltIcon />}
            onClick={dataset.reset}
            sx={{ ml: "auto", color: "text.secondary", borderColor: "divider", fontSize: "0.75rem", textTransform: "none" }}
          >
            Cambiar archivo
          </Button>
        </Box>
      )}

      {/* Preview table */}
      {dataset.preview && (
        <DataPreview preview={dataset.preview} />
      )}

      {/* CTA — only after successful upload */}
      {dataset.stage === "preview" && dataset.datasetId && (
        <Box sx={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: "1rem",
          bgcolor: "rgba(59,130,246,0.04)", borderRadius: "0.75rem",
          border: "1px solid rgba(59,130,246,0.18)",
          px: "1.25rem", py: "1rem",
        }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <AssessmentIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
            <Box>
              <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: "text.primary" }}>
                Dataset listo
              </Typography>
              <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                Ahora podés analizar la calidad, detectar outliers y elegir el modelo en EDA.
                La detección de columnas ocurre allí — podés ajustarla manualmente.
              </Typography>
            </Box>
          </Box>
          <Button
            variant="contained"
            size="large"
            endIcon={<ArrowForwardIcon />}
            onClick={() => router.push("/dashboard/eda")}
            sx={{ textTransform: "none", fontWeight: 700, flexShrink: 0 }}
          >
            Analizar en EDA →
          </Button>
        </Box>
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
            Subí un archivo, conectá tu base de datos o usá el dataset demo.
            La selección de columnas y el análisis ocurren en EDA.
          </Typography>
        </Box>
      </Box>

      {/* Tabs */}
      <Suspense fallback={<Box sx={{ display:"flex", justifyContent:"center", mt:"2rem" }}><CircularProgress /></Box>}>
        <DataSourceTabs
          csvContent={csvFlow}
          dbContent={<ConnectDbCard />}
          demoContent={<DemoDatasetCard />}
          cloudContent={<CloudDataCard />}
        />
      </Suspense>
    </Box>
  )
}
