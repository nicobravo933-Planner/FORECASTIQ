"use client"

/**
 * useDataset — manages the full Phase 1 dataset flow:
 *   upload CSV → fetch preview → detect model
 *
 * State machine: idle → uploading → previewing → detecting → done | error
 */

import { useState, useCallback } from "react"
import { api, ApiError } from "@/lib/api"
import type { UploadResponse, DatasetPreview, DetectionResult, DataFreq } from "@/lib/types"

type Stage = "idle" | "uploading" | "preview" | "detecting" | "done" | "error"

interface DatasetState {
  stage: Stage
  uploadProgress: number          // 0-100 (simulated — fetch doesn't expose progress)
  datasetId: string | null
  uploadResponse: UploadResponse | null
  preview: DatasetPreview | null
  detection: DetectionResult | null
  error: string | null
}

const INITIAL: DatasetState = {
  stage: "idle",
  uploadProgress: 0,
  datasetId: null,
  uploadResponse: null,
  preview: null,
  detection: null,
  error: null,
}

export function useDataset() {
  const [state, setState] = useState<DatasetState>(INITIAL)

  // Helper to patch state partially
  const patch = useCallback((partial: Partial<DatasetState>) => {
    setState((prev) => ({ ...prev, ...partial }))
  }, [])

  /** Step 1: Upload the CSV file */
  const uploadFile = useCallback(
    async (file: File) => {
      patch({ stage: "uploading", uploadProgress: 10, error: null })

      try {
        const formData = new FormData()
        formData.append("file", file)

        // Simulate incremental progress while request is in-flight
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

        // Automatically fetch preview after upload
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

  /** Step 2: Fetch column preview (called automatically after upload) */
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

  /** Step 3: Run model detection after user selects date + target columns */
  const detectModel = useCallback(
    async (dateColumn: string, targetColumn: string, freq: DataFreq = "M") => {
      if (!state.datasetId) return
      patch({ stage: "detecting", error: null })

      try {
        const result = await api.post<DetectionResult>(
          `/api/datasets/${state.datasetId}/detect`,
          { date_column: dateColumn, target_column: targetColumn, freq },
        )
        patch({ detection: result, stage: "done" })
      } catch (err) {
        patch({
          stage: "error",
          error: err instanceof ApiError ? err.message : "Error en la detección de modelo.",
        })
      }
    },
    [state.datasetId, patch],
  )

  /** Reset to initial state (upload another file) */
  const reset = useCallback(() => setState(INITIAL), [])

  return {
    ...state,
    uploadFile,
    fetchPreview,
    detectModel,
    reset,
  }
}
