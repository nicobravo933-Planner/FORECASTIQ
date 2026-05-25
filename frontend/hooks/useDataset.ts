"use client"

/**
 * useDataset — gestiona el flujo de subida de archivos.
 *
 * Responsabilidad: upload + preview. Nada más.
 * La selección de columnas y la detección de modelo ocurren en EDA.
 *
 * Estado: idle → uploading → preview | error
 */

import { useState, useCallback } from "react"
import { api, ApiError } from "@/lib/api"
import { addSessionDataset } from "@/lib/sessionDatasets"
import type { UploadResponse, DatasetPreview } from "@/lib/types"

type Stage = "idle" | "uploading" | "preview" | "error"

interface DatasetState {
  stage: Stage
  uploadProgress: number
  datasetId: string | null
  uploadResponse: UploadResponse | null
  preview: DatasetPreview | null
  error: string | null
}

const INITIAL: DatasetState = {
  stage: "idle",
  uploadProgress: 0,
  datasetId: null,
  uploadResponse: null,
  preview: null,
  error: null,
}

export function useDataset() {
  const [state, setState] = useState<DatasetState>(INITIAL)

  const patch = useCallback((partial: Partial<DatasetState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  /** Sube el archivo y obtiene el preview automáticamente */
  const uploadFile = useCallback(
    async (file: File) => {
      patch({ stage: "uploading", uploadProgress: 10, error: null })

      try {
        const formData = new FormData()
        formData.append("file", file)

        const progressInterval = setInterval(() => {
          setState((prev) => ({
            ...prev,
            uploadProgress: Math.min(prev.uploadProgress + 15, 85),
          }))
        }, 400)

        const res = await api.upload<UploadResponse>("/api/datasets/upload", formData)
        clearInterval(progressInterval)

        patch({
          uploadProgress: 100,
          datasetId: res.dataset_id,
          uploadResponse: res,
          stage: "preview",
        })

        addSessionDataset({
          dataset_id: res.dataset_id,
          filename:   res.filename,
          created_at: new Date().toISOString(),
        })

        // Fetch preview automatically
        await fetchPreview(res.dataset_id)
      } catch (err) {
        patch({
          stage: "error",
          error: err instanceof ApiError ? err.message : "Error al subir el archivo.",
        })
      }
    },
    [patch], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const fetchPreview = useCallback(
    async (id: string) => {
      try {
        const preview = await api.get<DatasetPreview>(`/api/datasets/${id}/preview`)
        patch({ preview, stage: "preview" })
      } catch (err) {
        patch({
          stage: "error",
          error: err instanceof ApiError ? err.message : "Error al obtener preview.",
        })
      }
    },
    [patch],
  )

  const reset = useCallback(() => setState(INITIAL), [])

  return { ...state, uploadFile, fetchPreview, reset }
}
