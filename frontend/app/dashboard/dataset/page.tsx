"use client"

/**
 * Dataset page — Phase 1 main flow:
 *   1. DropZone (upload CSV)
 *   2. DataPreview (first 10 rows + column types)
 *   3. ColumnSelector (pick date + target + freq)
 *   4. ModelRecommendation (badge + explanation)
 */

import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Alert from "@mui/material/Alert"
import Button from "@mui/material/Button"
import RestartAltIcon from "@mui/icons-material/RestartAlt"
import { useDataset } from "@/hooks/useDataset"
import { DropZone } from "@/components/upload/DropZone"
import { DataPreview } from "@/components/upload/DataPreview"
import { ColumnSelector } from "@/components/upload/ColumnSelector"
import { ModelRecommendation } from "@/components/upload/ModelRecommendation"

export default function DatasetPage() {
  const dataset = useDataset()

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
      {/* Page header */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" color="text.primary" fontWeight={700}>
            Dataset
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: "0.25rem" }}>
            Subí tu CSV de ventas y detectamos el mejor modelo automáticamente.
          </Typography>
        </Box>
        {dataset.stage !== "idle" && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<RestartAltIcon />}
            onClick={dataset.reset}
            color="inherit"
          >
            Nuevo archivo
          </Button>
        )}
      </Box>

      {/* Error banner */}
      {dataset.stage === "error" && dataset.error && (
        <Alert severity="error" onClose={dataset.reset}>
          {dataset.error}
        </Alert>
      )}

      {/* Step 1 — always visible until done */}
      {(dataset.stage === "idle" || dataset.stage === "uploading") && (
        <DropZone
          onFile={dataset.uploadFile}
          uploading={dataset.stage === "uploading"}
          uploadProgress={dataset.uploadProgress}
          filename={dataset.uploadResponse?.filename}
        />
      )}

      {/* Upload summary once done */}
      {dataset.uploadResponse && dataset.stage !== "uploading" && (
        <Box
          sx={{
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            bgcolor: "background.paper",
            borderRadius: "0.5rem",
            px: "1rem",
            py: "0.75rem",
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
        </Box>
      )}

      {/* Step 2 — preview table */}
      {dataset.preview && (
        <DataPreview preview={dataset.preview} />
      )}

      {/* Step 3 — column selector (shown when preview is ready, detection not yet run) */}
      {dataset.preview && dataset.stage !== "done" && (
        <ColumnSelector
          preview={dataset.preview}
          detecting={dataset.stage === "detecting"}
          onDetect={dataset.detectModel}
        />
      )}

      {/* Step 4 — model recommendation */}
      {dataset.detection && dataset.stage === "done" && (
        <ModelRecommendation
          result={dataset.detection}
          onRunForecast={() => {
            // Navigation to forecast page will be wired in Phase 2
            window.location.href = "/dashboard/forecast"
          }}
        />
      )}
    </Box>
  )
}
