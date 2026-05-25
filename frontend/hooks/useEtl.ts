"use client"

/**
 * useEtl — state and fetch logic for E2 ETL operations.
 *
 * Exposes two async actions:
 *   applyWinsorize(pLower, pUpper) → calls GET /api/eda/{id}/winsorize
 *   applyFillGaps(method)          → calls GET /api/eda/{id}/fill-gaps
 *
 * Both actions persist the cleaned dataset_id to appStore so the
 * Forecast page automatically picks up the clean data.
 */

import { useState, useCallback } from "react"
import { api } from "@/lib/api"
import { appStore } from "@/lib/appStore"

// ── Types (mirror backend Pydantic models) ────────────────────────────────────

export interface EtlPoint {
  date: string
  original: number | null
  cleaned: number | null
  imputed: boolean
  winsorized: boolean
}

export interface WinsorizeResult {
  dataset_id: string
  cleaned_dataset_id: string
  p_lower: number
  p_upper: number
  winsor_lower: number
  winsor_upper: number
  n_winsorized: number
  series: EtlPoint[]
  new_quality_score: number
  new_quality_label: string
}

export interface FillGapsResult {
  dataset_id: string
  cleaned_dataset_id: string
  method: string
  n_imputed: number
  series: EtlPoint[]
  new_quality_score: number
  new_quality_label: string
}

export type EtlMode = "winsorize" | "fill-gaps" | null

interface EtlState {
  mode: EtlMode
  winsorize: WinsorizeResult | null
  fillGaps: FillGapsResult | null
  loading: boolean
  error: string | null
  // ID del dataset activo en el store (puede ser el _etl ya aplicado)
  activeDatasetId: string | null
}

interface UseEtlParams {
  datasetId: string | null
  dateCol: string | null
  targetCol: string | null
  freq: string | null
}

export function useEtl({ datasetId, dateCol, targetCol, freq }: UseEtlParams) {
  const [state, setState] = useState<EtlState>({
    mode: null,
    winsorize: null,
    fillGaps: null,
    loading: false,
    error: null,
    activeDatasetId: datasetId,
  })

  // Builds the common query string shared by both endpoints
  const baseQs = useCallback(() => {
    if (!dateCol || !targetCol) return null
    const f = freq ?? "M"
    return `date_col=${encodeURIComponent(dateCol)}&target_col=${encodeURIComponent(targetCol)}&freq=${f}`
  }, [dateCol, targetCol, freq])

  const applyWinsorize = useCallback(
    async (pLower: number, pUpper: number) => {
      const qs = baseQs()
      if (!datasetId || !qs) return

      setState((s) => ({ ...s, loading: true, error: null, mode: "winsorize" }))

      try {
        const result = await api.get<WinsorizeResult>(
          `/api/eda/${datasetId}/winsorize?${qs}&p_lower=${pLower}&p_upper=${pUpper}`
        )

        // Persist cleaned dataset to appStore so Forecast picks it up
        const dc = dateCol ?? ""
        const tc = targetCol ?? ""
        const fr = freq ?? "M"
        appStore.setActiveDataset(result.cleaned_dataset_id, dc, tc, fr)
        appStore.setCleanedDataset(result.cleaned_dataset_id)  // F2.2: badge ETL en ForecastContextBar

        setState((s) => ({
          ...s,
          loading: false,
          winsorize: result,
          activeDatasetId: result.cleaned_dataset_id,
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error aplicando winsorización"
        setState((s) => ({ ...s, loading: false, error: msg }))
      }
    },
    [datasetId, dateCol, targetCol, freq, baseQs]
  )

  const applyFillGaps = useCallback(
    async (method: "ffill" | "linear") => {
      const qs = baseQs()
      if (!datasetId || !qs) return

      setState((s) => ({ ...s, loading: true, error: null, mode: "fill-gaps" }))

      try {
        const result = await api.get<FillGapsResult>(
          `/api/eda/${datasetId}/fill-gaps?${qs}&method=${method}`
        )

        const dc = dateCol ?? ""
        const tc = targetCol ?? ""
        const fr = freq ?? "M"
        appStore.setActiveDataset(result.cleaned_dataset_id, dc, tc, fr)
        appStore.setCleanedDataset(result.cleaned_dataset_id)  // F2.2: badge ETL en ForecastContextBar

        setState((s) => ({
          ...s,
          loading: false,
          fillGaps: result,
          activeDatasetId: result.cleaned_dataset_id,
        }))
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error imputando gaps"
        setState((s) => ({ ...s, loading: false, error: msg }))
      }
    },
    [datasetId, dateCol, targetCol, freq, baseQs]
  )

  // Reset: vuelve al dataset original (pre-ETL)
  const resetToOriginal = useCallback(() => {
    if (!datasetId || !dateCol || !targetCol) return
    appStore.setActiveDataset(datasetId, dateCol, targetCol, freq ?? "M")
    setState((s) => ({
      ...s,
      winsorize: null,
      fillGaps: null,
      mode: null,
      error: null,
      activeDatasetId: datasetId,
    }))
  }, [datasetId, dateCol, targetCol, freq])

  return {
    ...state,
    applyWinsorize,
    applyFillGaps,
    resetToOriginal,
  }
}
