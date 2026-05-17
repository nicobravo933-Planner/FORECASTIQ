"use client"

/**
 * DropZone — drag-and-drop CSV upload area.
 * Calls onFile(file) when a valid CSV is dropped or selected.
 */

import { useCallback, useState } from "react"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import LinearProgress from "@mui/material/LinearProgress"
import UploadFileIcon from "@mui/icons-material/UploadFile"
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline"

interface DropZoneProps {
  onFile: (file: File) => void
  uploading: boolean
  uploadProgress: number
  filename?: string
}

export function DropZone({ onFile, uploading, uploadProgress, filename }: DropZoneProps) {
  const [dragOver, setDragOver] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFile(file)
    },
    [onFile],
  )

  const done = uploadProgress === 100 && !!filename

  return (
    <Box
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      sx={{
        border: "2px dashed",
        borderColor: dragOver ? "primary.main" : done ? "success.main" : "divider",
        borderRadius: "0.75rem",
        bgcolor: dragOver ? "primary.main" : "background.paper",
        transition: "all 0.2s ease",
        p: "2.5rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        cursor: uploading ? "not-allowed" : "pointer",
        opacity: uploading ? 0.85 : 1,
      }}
    >
      {done ? (
        <CheckCircleOutlineIcon sx={{ fontSize: "3rem", color: "success.main" }} />
      ) : (
        <UploadFileIcon sx={{ fontSize: "3rem", color: dragOver ? "background.default" : "primary.main" }} />
      )}

      <Typography
        variant="h6"
        color={dragOver ? "background.default" : "text.primary"}
        textAlign="center"
      >
        {done
          ? filename
          : uploading
          ? "Subiendo archivo…"
          : "Arrastrá tu CSV aquí"}
      </Typography>

      <Typography
        variant="body2"
        color={dragOver ? "background.default" : "text.secondary"}
        textAlign="center"
      >
        {done ? "Archivo subido correctamente" : "o seleccioná desde tu computadora · máx. 10 MB"}
      </Typography>

      {uploading && (
        <Box sx={{ width: "100%", maxWidth: "20rem" }}>
          <LinearProgress
            variant="determinate"
            value={uploadProgress}
            sx={{ borderRadius: "0.25rem", height: "0.5rem" }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: "0.25rem", display: "block", textAlign: "center" }}>
            {uploadProgress}%
          </Typography>
        </Box>
      )}

      {!uploading && !done && (
        <Button
          component="label"
          variant="outlined"
          size="small"
          sx={{ mt: "0.25rem" }}
        >
          Seleccionar archivo
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={handleChange}
          />
        </Button>
      )}
    </Box>
  )
}
