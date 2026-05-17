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
  dtype: "date" | "numeric" | "string" | "unknown"
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

// ── Forecast ─────────────────────────────────────────────────────
export type ForecastStatus = "pending" | "running" | "done" | "failed"

export type ModelName = "moving_average" | "holt_winters" | "prophet" | "lightgbm"

export interface PredictionPoint {
  date: string
  predicted: number
  lower: number
  upper: number
}

export interface ForecastResult {
  job_id: string
  status: ForecastStatus
  model_used: ModelName | null
  mape: number | null
  rmse: number | null
  mae: number | null
  predictions: PredictionPoint[]
  created_at: string
}

// ── Chat ─────────────────────────────────────────────────────────
export type ChatRole = "user" | "assistant"

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  created_at: string
}

export type LlmModelId =
  | "deepseek/deepseek-r1-0528:free"
  | "meta-llama/llama-3.3-70b:free"
  | "google/gemini-2.0-flash:free"
  | "qwen/qwen3-235b-a22b:free"
  | "mistralai/mistral-7b-instruct:free"

export interface LlmModel {
  id: LlmModelId
  label: string
}

export const FREE_MODELS: LlmModel[] = [
  { id: "deepseek/deepseek-r1-0528:free", label: "DeepSeek R1" },
  { id: "meta-llama/llama-3.3-70b:free", label: "Llama 3.3 70B" },
  { id: "google/gemini-2.0-flash:free", label: "Gemini 2.0 Flash" },
  { id: "qwen/qwen3-235b-a22b:free", label: "Qwen3 235B" },
  { id: "mistralai/mistral-7b-instruct:free", label: "Mistral 7B" },
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
