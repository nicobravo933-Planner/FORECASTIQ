"use client"

/**
 * useEda — fetches all EDA data for a dataset.
 * Uses native fetch (compatible with current setup before TanStack Query migration).
 * All endpoints receive date_col, target_col and freq as query params.
 */

import { useState, useEffect, useCallback } from "react"
import { api } from "@/lib/api"

// ── Types (mirror backend Pydantic models) ────────────────────────────────────

export interface SeriesSummary {
  dataset_id: string
  n_observations: number
  date_start: string
  date_end: string
  history_years: number
  freq: string
  null_count: number
  null_pct: number
  n_gaps: number
  gap_ratio: number
  mean: number
  median: number
  std: number
  min_val: number
  max_val: number
  skewness: number
  kurtosis: number
  cv: number
}

export interface OutlierInfo {
  dataset_id: string
  n_outliers: number
  outlier_pct: number
  outlier_indices: number[]
  outlier_values: number[]
  outlier_dates: string[]
  winsor_lower: number
  winsor_upper: number
  mad_threshold: number
}

export interface QualityBreakdown {
  completeness_score: number
  history_score: number
  regularity_score: number
  outlier_score: number
}

export interface QualityScoreResponse {
  dataset_id: string
  score: number
  label: "poor" | "fair" | "good" | "excellent"
  breakdown: QualityBreakdown
  completeness_msg: string
  history_msg: string
  regularity_msg: string
  outlier_msg: string
  recommendation: string
}

export interface ModelInfo {
  id: string
  label: string
  available: boolean
  reason: string
}

export interface ModelsAvailableResponse {
  dataset_id: string
  quality_score: number
  models: ModelInfo[]
}

interface EdaState {
  summary: SeriesSummary | null
  outliers: OutlierInfo | null
  quality: QualityScoreResponse | null
  models: ModelsAvailableResponse | null
  loading: boolean
  error: string | null
}

interface UseEdaParams {
  datasetId: string | null
  dateCol: string | null
  targetCol: string | null
  freq: string | null
}

export function useEda({ datasetId, dateCol, targetCol, freq }: UseEdaParams) {
  const [state, setState] = useState<EdaState>({
    summary: null,
    outliers: null,
    quality: null,
    models: null,
    loading: false,
    error: null,
  })

  const fetchAll = useCallback(async () => {
    if (!datasetId || !dateCol || !targetCol) return

    const f = freq ?? "M"
    const qs = `date_col=${encodeURIComponent(dateCol)}&target_col=${encodeURIComponent(targetCol)}&freq=${f}`
    const qsNoFreq = `date_col=${encodeURIComponent(dateCol)}&target_col=${encodeURIComponent(targetCol)}`

    setState((s) => ({ ...s, loading: true, error: null }))

    try {
      // Fetch all 4 endpoints in parallel
      const [summary, outliers, quality, models] = await Promise.all([
        api.get<SeriesSummary>(`/api/eda/${datasetId}/summary?${qs}`),
        api.get<OutlierInfo>(`/api/eda/${datasetId}/outliers?${qsNoFreq}`),
        api.get<QualityScoreResponse>(`/api/eda/${datasetId}/quality-score?${qs}`),
        api.get<ModelsAvailableResponse>(`/api/eda/${datasetId}/models-available?${qs}`),
      ])
      setState({ summary, outliers, quality, models, loading: false, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error cargando análisis EDA"
      setState((s) => ({ ...s, loading: false, error: msg }))
    }
  }, [datasetId, dateCol, targetCol, freq])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  return { ...state, refetch: fetchAll }
}
