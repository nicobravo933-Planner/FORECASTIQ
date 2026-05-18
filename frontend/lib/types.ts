/**
 * Shared TypeScript types used across the frontend.
 * Backend Pydantic models should mirror these.
 */

// ── Health ──────────────────────────────────────────────────────
export interface HealthResponse {
  status: string
  version: string
  environment: string
}

// ── Dataset ─────────────────────────────────────────────────────
export interface UploadResponse {
  dataset_id: string
  filename: string
  rows: number
  columns: string[]
}

export interface DatasetColumn {
  name: string
  dtype: "datetime" | "numeric" | "text" | "unknown"
  sample_values: string[]
}

export interface DatasetPreview {
  dataset_id: string
  columns: DatasetColumn[]
  rows: Record<string, unknown>[]
  total_rows: number
}

export interface DetectionResult {
  model: "moving_average" | "holt_winters" | "sarima" | "lightgbm"
  reason: string
  n_observations: number
  has_trend: boolean
  trend_direction: "increasing" | "decreasing" | "no trend"
  trend_p_value: number
  seasonality_period: number | null
  has_seasonality: boolean
  cv: number
  outlier_count: number
  outlier_pct: number
  outlier_indices: number[]
  confidence: number
}

export type DataFreq = "D" | "W" | "M" | "Q"

// ── Forecast ────────────────────────────────────────────────────
export type ForecastStatus = "pending" | "started" | "done" | "failed"

export type ModelName = "moving_average" | "holt_winters" | "sarima" | "lightgbm"

export interface ForecastRunRequest {
  dataset_id: string
  date_column: string
  target_column: string
  freq: DataFreq
  horizon: number
  model_override?: ModelName | null
}

export interface ForecastStatusResponse {
  job_id: string
  status: ForecastStatus
  progress_pct: number
  step: string
}

export interface PredictionPoint {
  date: string
  predicted: number
  lower: number
  upper: number
}

export interface HistoricalPoint {
  date: string
  value: number
}

export interface ForecastMetrics {
  wape: number | null
  mae: number | null
  bias: number | null
  rmse: number | null
  mape: number | null
  fva: number | null
}

export interface ForecastResult {
  job_id: string
  status: ForecastStatus
  dataset_id: string
  model_used: ModelName
  freq: DataFreq
  horizon: number
  metrics: ForecastMetrics
  historical: HistoricalPoint[]
  predictions: PredictionPoint[]
  created_at: string
}

// ── Chat ────────────────────────────────────────────────────────
export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  created_at: string
  isStreaming?: boolean
}

export type SseEventType =
  | "token"
  | "tool_call"
  | "tool_result"
  | "suggestions"
  | "done"
  | "error"

export interface SseEvent {
  type: SseEventType
  content?: string       // token
  tool?: string          // tool_call / tool_result
  input?: unknown        // tool_call
  result?: unknown       // tool_result
  items?: string[]       // suggestions
  message?: string       // error
}

export type LlmModelId =
  | "openrouter/owl-alpha"
  | "nvidia/nemotron-3-super-120b-a12b:free"
  | "poolside/laguna-m.1:free"
  | "openai/gpt-oss-120b:free"
  | "z-ai/glm-4.5-air:free"
  | "deepseek/deepseek-v4-flash:free"
  | "minimax/minimax-m2.5:free"

export interface LlmModel {
  id: LlmModelId
  label: string
}

export const FREE_MODELS: LlmModel[] = [
  { id: "openrouter/owl-alpha",                   label: "OWL Alpha" },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", label: "Nemotron 120B" },
  { id: "poolside/laguna-m.1:free",               label: "Laguna M.1" },
  { id: "openai/gpt-oss-120b:free",               label: "GPT OSS 120B" },
  { id: "z-ai/glm-4.5-air:free",                  label: "GLM 4.5 Air" },
  { id: "deepseek/deepseek-v4-flash:free",        label: "DeepSeek V4 Flash" },
  { id: "minimax/minimax-m2.5:free",              label: "MiniMax M2.5" },
]

// ── Events ───────────────────────────────────────────────────────
export type EventType = "holiday" | "promotion" | "seasonal" | "other"

export interface CalendarEvent {
  id: string
  name: string
  type: EventType
  start_date: string
  end_date: string
  impact_pct: number | null
  is_global: boolean
}

// ── Forecast Compare ────────────────────────────────────────────
export interface ComparePoint {
  date:        string
  baseline:    number
  with_events: number
  lower:       number
  upper:       number
}

export interface ForecastCompareResponse {
  job_id:         string
  model_used:     string
  events_applied: number
  predictions:    ComparePoint[]
}
