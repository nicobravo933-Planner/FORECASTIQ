/**
 * appStore — lightweight global state via localStorage.
 *
 * Stores the active dataset_id and job_id so the Chat page
 * can access context without a full state management library.
 * Phase 5 will replace this with per-user session storage.
 */

const KEYS = {
  datasetId:     "fiq_active_dataset_id",
  jobId:         "fiq_active_job_id",
  dateColumn:    "fiq_active_date_col",
  targetColumn:  "fiq_active_target_col",
  freq:          "fiq_active_freq",
  detectedModel: "fiq_detected_model",
  detectedDsId:  "fiq_detected_dataset_id",
  pendingMsgs:   "fiq_pending_messages",
  qualityScore:  "fiq_quality_score",
  qualityLabel:  "fiq_quality_label",
  modelsAvail:   "fiq_models_available",
  detectionReport: "fiq_detection_report",
  pendingModel:    "fiq_pending_model",
  cleanedDatasetId: "fiq_cleaned_dataset_id",
  lastResult:    "fiq_last_forecast_result",  // ForecastResult completo — persiste entre navegaciones
  entityCol:     "fiq_entity_col",             // MSE-1a: columna de agrupación para batch multi-entidad
  datasetFilename: "fiq_active_dataset_filename", // nombre del archivo subido (para mostrar en UI)
} as const

function safeGet(key: string): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(key)
}

function safeSet(key: string, value: string): void {
  if (typeof window === "undefined") return
  localStorage.setItem(key, value)
}

export const appStore = {
  // ── Dataset ──────────────────────────────────────────────────────────────
  setActiveDataset(id: string, dateCol: string, targetCol: string, freq: string): void {
    safeSet(KEYS.datasetId,    id)
    safeSet(KEYS.dateColumn,   dateCol)
    safeSet(KEYS.targetColumn, targetCol)
    safeSet(KEYS.freq,         freq)
  },

  getActiveDatasetId(): string | null  { return safeGet(KEYS.datasetId)    },
  getActiveDateCol():   string | null  { return safeGet(KEYS.dateColumn)   },
  getActiveTargetCol(): string | null  { return safeGet(KEYS.targetColumn) },
  getActiveFreq():      string | null  { return safeGet(KEYS.freq)         },

  // ── Forecast job ──────────────────────────────────────────────────────────
  setActiveJobId(jobId: string): void {
    safeSet(KEYS.jobId, jobId)
    // Dispara evento custom para sincronizar componentes en el mismo tab
    // (window 'storage' solo funciona entre tabs distintos)
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("fiq:store-update"))
    }
  },
  getActiveJobId(): string | null     { return safeGet(KEYS.jobId)  },

  // ── Detected model cache ──────────────────────────────────────────────────
  // Avoids re-running model detection when navigating back to /forecast
  // for the same dataset. Cache is invalidated when a different dataset is used.
  setDetectedModel(datasetId: string, model: string): void {
    safeSet(KEYS.detectedModel, model)
    safeSet(KEYS.detectedDsId, datasetId)
  },
  getDetectedModel(datasetId: string): string | null {
    if (!datasetId) return null
    const cachedDsId = safeGet(KEYS.detectedDsId)
    if (cachedDsId !== datasetId) return null  // cache miss — different dataset
    return safeGet(KEYS.detectedModel)
  },
  clearDetectedModel(): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(KEYS.detectedModel)
    localStorage.removeItem(KEYS.detectedDsId)
  },

  // ── Snapshot for chat context ─────────────────────────────────────────────
  getChatContext(): { datasetId: string | null; jobId: string | null } {
    return {
      datasetId: safeGet(KEYS.datasetId),
      jobId:     safeGet(KEYS.jobId),
    }
  },

  // ── E5: Quality score + modelos disponibles ────────────────────────────────
  // Persiste el último quality score calculado para el dataset activo.
  // El Forecast page lo lee para bloquear/desbloquear modelos sin re-llamar al backend.
  setQualityScore(score: number, label: string, modelIds: string[]): void {
    safeSet(KEYS.qualityScore, String(score))
    safeSet(KEYS.qualityLabel, label)
    safeSet(KEYS.modelsAvail, JSON.stringify(modelIds))
  },
  getQualityScore(): { score: number; label: string; modelIds: string[] } | null {
    const raw = safeGet(KEYS.qualityScore)
    if (!raw) return null
    return {
      score:    parseInt(raw, 10),
      label:    safeGet(KEYS.qualityLabel) ?? "poor",
      modelIds: JSON.parse(safeGet(KEYS.modelsAvail) ?? "[]") as string[],
    }
  },
  clearQualityScore(): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(KEYS.qualityScore)
    localStorage.removeItem(KEYS.qualityLabel)
    localStorage.removeItem(KEYS.modelsAvail)
  },

  // ── E6: Detection report cache ──────────────────────────────────────────
  // Persists the full DetectionResult so DetectionReportModal can render
  // without re-calling the backend when navigating back to /forecast.
  setDetectionReport(report: Record<string, unknown>): void {
    safeSet(KEYS.detectionReport, JSON.stringify(report))
  },
  getDetectionReport(): Record<string, unknown> | null {
    const raw = safeGet(KEYS.detectionReport)
    if (!raw) return null
    try { return JSON.parse(raw) as Record<string, unknown> } catch { return null }
  },
  clearDetectionReport(): void {
    if (typeof window === "undefined") return
    localStorage.removeItem(KEYS.detectionReport)
  },

  // ── Pending messages (globo → chat page) ─────────────────────────────────
  savePendingMessages(msgs: unknown[]): void {
    safeSet(KEYS.pendingMsgs, JSON.stringify(msgs))
  },
  popPendingMessages(): unknown[] {
    const raw = safeGet(KEYS.pendingMsgs)
    if (!raw) return []
    localStorage.removeItem(KEYS.pendingMsgs)
    try { return JSON.parse(raw) as unknown[] } catch { return [] }
  },

  // ── UX-1e: pending model pre-selection from Encyclopedia ──────────────────
  // Set when user clicks "Try in Forecast" from an encyclopedia chapter.
  // Forecast page reads and clears this on mount to pre-select the model.
  setPendingModel(modelId: string): void {
    safeSet(KEYS.pendingModel, modelId)
  },
  popPendingModel(): string | null {
    const val = safeGet(KEYS.pendingModel)
    if (typeof window !== "undefined") localStorage.removeItem(KEYS.pendingModel)
    return val
  },

  // ── F2.2: cleaned dataset (post-ETL) ─────────────────────────────────────
  // etl/page.tsx writes this when ETL succeeds.
  // forecast/page.tsx reads it to show the ForecastContextBar badge.
  setCleanedDataset(id: string): void {
    safeSet(KEYS.cleanedDatasetId, id)
  },
  getCleanedDatasetId(): string | null {
    return safeGet(KEYS.cleanedDatasetId)
  },
  clearCleanedDataset(): void {
    if (typeof window !== "undefined") localStorage.removeItem(KEYS.cleanedDatasetId)
  },

  // ── Last forecast result (persiste entre navegaciones) ───────────────────
  // Se guarda al terminar el forecast y se restaura al volver a /forecast o /home.
  // Límite: ~500 KB serializado. Si el JSON es mayor se silencia sin romper.
  setLastResult(result: unknown): void {
    try {
      const json = JSON.stringify(result)
      if (json.length > 500_000) return  // evitar llenar el localStorage
      safeSet(KEYS.lastResult, json)
    } catch { /* silenciar — el resultado sigue en estado React */ }
  },
  getLastResult<T>(): T | null {
    const raw = safeGet(KEYS.lastResult)
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  },
  clearLastResult(): void {
    if (typeof window !== "undefined") localStorage.removeItem(KEYS.lastResult)
  },

  // ── MSE-1a: entity column for batch multi-entity forecasting ──────────────
  // Set from dataset/page.tsx when user picks a grouping column.
  // batch/page.tsx reads it to pre-populate the ID serie selector.
  setEntityCol(col: string): void {
    safeSet(KEYS.entityCol, col)
  },
  getEntityCol(): string | null {
    return safeGet(KEYS.entityCol)
  },
  clearEntityCol(): void {
    if (typeof window !== "undefined") localStorage.removeItem(KEYS.entityCol)
  },

  // ── Dataset filename (para mostrar en UI) ──────────────────────────────
  // Persists the original filename so multi-serie and batch can show
  // "departamentos_test.csv" instead of a UUID.
  setDatasetFilename(filename: string): void {
    safeSet(KEYS.datasetFilename, filename)
  },
  getDatasetFilename(): string | null {
    return safeGet(KEYS.datasetFilename)
  },
  clearDatasetFilename(): void {
    if (typeof window !== "undefined") localStorage.removeItem(KEYS.datasetFilename)
  },

  // ── Multi-serie last result (MS-UX2) ────────────────────────────────
  // Persists the last benchmark/quick result so the user can navigate away
  // and come back without losing the analysis. Same 500 KB limit as forecast.
  setLastMultiSerieResult(result: unknown): void {
    try {
      const json = JSON.stringify(result)
      if (json.length > 500_000) return
      safeSet("fiq_last_multi_serie_result", json)
    } catch { /* silenciar */ }
  },
  getLastMultiSerieResult<T>(): T | null {
    const raw = safeGet("fiq_last_multi_serie_result")
    if (!raw) return null
    try { return JSON.parse(raw) as T } catch { return null }
  },
  clearLastMultiSerieResult(): void {
    if (typeof window !== "undefined") localStorage.removeItem("fiq_last_multi_serie_result")
  },
}
