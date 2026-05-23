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
  detectedModel: "fiq_detected_model",      // cached model recommendation per dataset
  detectedDsId:  "fiq_detected_dataset_id", // which dataset the cache belongs to
  pendingMsgs:   "fiq_pending_messages",    // transferencia globo → chat completo
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
  setActiveJobId(jobId: string): void { safeSet(KEYS.jobId, jobId) },
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
}
