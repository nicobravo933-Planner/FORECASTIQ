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

import { Suspense, useEffect, useRef, useState } from "react"
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
import LayersIcon from "@mui/icons-material/Layers"
import Tooltip from "@mui/material/Tooltip"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import Chip from "@mui/material/Chip"

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

  // MSE-1a: optional entity/grouping column for multi-entity batch forecast
  const [entityCol, setEntityCol] = useState<string>("")

  // Persist dataset_id to appStore as soon as upload completes.
  // Columns are intentionally NOT saved here — that's EDA's responsibility.
  const persisted = useRef(false)
  useEffect(() => {
    if (dataset.stage === "preview" && dataset.datasetId && !persisted.current) {
      // Save only the id — EDA will detect columns via /preview and let user edit them
      appStore.setActiveDataset(dataset.datasetId, "", "", "M")
      appStore.clearQualityScore()
      appStore.clearCleanedDataset()
      appStore.clearEntityCol()
      // Persist filename so other views can show the file name instead of the UUID
      if (dataset.uploadResponse?.filename) {
        appStore.setDatasetFilename(dataset.uploadResponse.filename)
      }
      persisted.current = true
    }
    if (dataset.stage === "idle") persisted.current = false
  }, [dataset.stage, dataset.datasetId, dataset.uploadResponse])

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
          display: "flex", flexDirection: "column", gap: "1rem",
          bgcolor: "rgba(59,130,246,0.04)", borderRadius: "0.75rem",
          border: "1px solid rgba(59,130,246,0.18)",
          px: "1.25rem", py: "1rem",
        }}>
          {/* MSE-1a: selector de columna de entidad — solo si hay columnas de texto */}
          {dataset.preview && dataset.preview.columns.some((c: { dtype: string }) => c.dtype === "text") && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <LayersIcon sx={{ fontSize: "1rem", color: "text.secondary" }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Columna de entidad (opcional)
                </Typography>
                <Tooltip title="Si tu dataset tiene múltiples productos, departamentos o tiendas, seleccioná aquí la columna de agrupación. ForecastIQ la usará para el Batch Forecast multi-entidad.">
                  <Chip label="?" size="small" variant="outlined"
                    sx={{ height: "1.25rem", width: "1.25rem", fontSize: "0.625rem", cursor: "help" }} />
                </Tooltip>
              </Box>
              <FormControl size="small" sx={{ maxWidth: "18rem" }}>
                <InputLabel>Columna de agrupación</InputLabel>
                <Select
                  value={entityCol}
                  label="Columna de agrupación"
                  onChange={(e) => {
                    const val = e.target.value
                    setEntityCol(val)
                    if (val) appStore.setEntityCol(val)
                    else appStore.clearEntityCol()
                  }}
                >
                  <MenuItem value=""><em>Sin agrupación (serie única)</em></MenuItem>
                  {dataset.preview.columns
                    .filter((c: { dtype: string }) => c.dtype === "text")
                    .map((c: { name: string }) => (
                      <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>
                    ))
                  }
                </Select>
              </FormControl>
              {entityCol && (
                <Alert severity="info" sx={{ fontSize: "0.8125rem", py: "0.25rem" }}>
                  Columna <strong>{entityCol}</strong> guardada. Irá pre-seleccionada en Batch Forecast.
                </Alert>
              )}
            </Box>
          )}

          {/* Divider visual */}
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <AssessmentIcon sx={{ color: "primary.main", fontSize: "1.5rem" }} />
              <Box>
                <Typography sx={{ fontSize: "0.9375rem", fontWeight: 700, color: "text.primary" }}>
                  Dataset listo
                </Typography>
                <Typography sx={{ fontSize: "0.8125rem", color: "text.secondary" }}>
                  Analizá la calidad y detectá outliers en EDA.{entityCol ? ` Columna de entidad: ${entityCol}.` : ""}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {entityCol && (
                <Button
                  variant="outlined"
                  size="large"
                  startIcon={<LayersIcon />}
                  onClick={() => router.push("/dashboard/multi-serie")}
                  sx={{ textTransform: "none", fontWeight: 600, flexShrink: 0 }}
                >
                  Batch Forecast →
                </Button>
              )}
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
          </Box>
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
