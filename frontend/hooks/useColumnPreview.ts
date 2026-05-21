"use client"

/**
 * useColumnPreview — fetches column metadata for a given dataset_id.
 *
 * Used by ForecastConfigPanel to populate the column dropdowns with real
 * column names and their inferred types (datetime | numeric | text).
 *
 * State: idle → loading → ready | error
 */

import { useEffect, useState } from "react"
import { api, ApiError } from "@/lib/api"
import type { DatasetPreview, DatasetColumn } from "@/lib/types"

export type ColumnPreviewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; columns: DatasetColumn[]; totalRows: number }
  | { status: "error"; message: string }

export function useColumnPreview(datasetId: string | null): ColumnPreviewState {
  const [state, setState] = useState<ColumnPreviewState>({ status: "idle" })

  useEffect(() => {
    if (!datasetId) {
      setState({ status: "idle" })
      return
    }

    let cancelled = false
    setState({ status: "loading" })

    api
      .get<DatasetPreview>(`/api/datasets/${datasetId}/preview`)
      .then((res) => {
        if (cancelled) return
        setState({
          status: "ready",
          columns: res.columns,
          totalRows: res.total_rows,
        })
      })
      .catch((err) => {
        if (cancelled) return
        setState({
          status: "error",
          message: err instanceof ApiError ? err.message : "Error al cargar columnas.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [datasetId])

  return state
}
