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

export interface DatasetListItem {
  dataset_id: string
  filename:   string
  rows:       number | null
  columns:    string[]
  created_at: string
}

export interface DatasetListResponse {
  datasets: DatasetListItem[]
  total:    number
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
  // E6: decision tree steps
  decision_steps: DecisionStep[]
}

/** E6 — one step of the transparent detection pipeline */
export interface DecisionStep {
  step: number
  label: string
  passed: boolean
  value: string
  threshold: string
  explanation: string
}

export type DataFreq = "D" | "W" | "M" | "Q"

// ── Model Parameters (E4 — ParameterExplorer) ───────────────────────────────

export interface HoltWintersParams {
  alpha: number           // smoothing level (0-1)
  beta: number            // smoothing trend (0-1)
  gamma: number           // smoothing seasonal (0-1)
  seasonal_periods: number
  use_seasonal: boolean
}

export interface SarimaParams {
  order: [number, number, number]           // [p, d, q]
  seasonal_order: [number, number, number, number]  // [P, D, Q, s]
}

export interface MovingAverageParams {
  window: number
}

export interface LightGBMParams {
  best_params: Record<string, number>
  used_cache: boolean
  max_lag: number
  n_trials: number
}

export type ModelParams =
  | HoltWintersParams
  | SarimaParams
  | MovingAverageParams
  | LightGBMParams
  | Record<string, unknown>  // fallback para tipos futuros

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
  force_reoptimize?: boolean
  test_periods?: number   // 0 = hold-out auto 20%; N = hold-out manual N períodos
  cv_folds?: number       // 0 = sin CV; 2–5 = TimeSeriesSplit k folds
  manual_params?: Record<string, unknown> | null  // E4: parámetros manuales del usuario
  // F2.3: trim training series to this date (null = full history)
  train_start_date?: string | null
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

// ── CV Results (Paso 3) ───────────────────────────────────────────────

export interface CvFold {
  fold:        number
  train_size:  number
  test_size:   number
  train_start: string
  train_end:   string
  test_start:  string
  test_end:    string
  wape:        number | null
  mae:         number | null
  bias:        number | null
  rmse:        number | null
}

export interface CvSummary {
  n_folds:   number
  wape_mean: number | null
  wape_std:  number | null
  mae_mean:  number | null
  mae_std:   number | null
  bias_mean: number | null
  folds:     CvFold[]
}

export interface ForecastResult {
  job_id: string
  status: ForecastStatus
  dataset_id: string
  model_used: ModelName
  freq: DataFreq
  horizon: number
  test_periods: number
  cv_folds: number
  metrics: ForecastMetrics
  model_params: ModelParams  // parámetros usados por el modelo (E4)
  historical: HistoricalPoint[]
  predictions: PredictionPoint[]
  // Hold-out manual (Paso 2) — empty arrays when test_periods === 0
  test_actual: HistoricalPoint[]
  test_predicted: PredictionPoint[]
  train_end_date: string | null
  test_start_date: string | null
  // Rolling CV (Paso 3) — null when cv_folds === 0
  cv_summary: CvSummary | null
  cv_warning: string | null
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
  user_id?: string | null
  dataset_id?: string | null
  source: "manual" | "auto"   // auto = generado algorítmicamente (Black Friday, etc.)
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

// ── MLOps (Fase 8) ──────────────────────────────────────────────
export interface MlflowRun {
  run_id:      string
  run_name:    string
  status:      string
  start_time:  string
  model:       string
  freq:        string
  horizon:     string
  n_obs:       string
  wape:        number | null
  mae:         number | null
  bias:        number | null
  rmse:        number | null
  dataset_id:  string
  dagshub_url: string
}

export interface DriftColumnResult {
  drift_detected: boolean
  drift_score:    number | null
  stattest:       string
  threshold:      number | null
}

export interface DriftSummary {
  dataset_id:  string
  reports:     { name: string; url: string }[]
  latest_url:  string | null
}

// ── Batch Forecast (Fase 9) ─────────────────────────────────────────────

export interface BatchForecastRequest {
  records:         Record<string, unknown>[]
  date_col?:       string
  target_col?:     string
  id_col?:         string
  cluster_abc_col?: string | null
  cluster_xyz_col?: string | null
  freq?:           string
  horizon?:        number
}

export interface BatchPredictionPoint {
  unique_id:  string
  ds:         string
  predicted:  number
}

export interface BatchForecastResponse {
  n_series:    number
  horizon:     number
  freq:        string
  model_used:  string
  duration_s:  number
  predictions: BatchPredictionPoint[]
}

// ── E7: Benchmark multi-modelo ─────────────────────────────────────────────

export interface BenchmarkModelResult {
  model:       string
  label:       string
  wape:        number | null
  mae:         number | null
  bias:        number | null
  rmse:        number | null
  fva:         number | null   // FVA vs Seasonal Naive (%)
  is_winner:   boolean
  is_baseline: boolean         // true = Seasonal Naive
  error:       string | null
}

export interface BenchmarkResult {
  dataset_id:   string
  freq:         string
  horizon:      number
  n_obs:        number
  test_periods: number
  models:       BenchmarkModelResult[]
  winner:       string | null
  winner_label: string | null
  naive_wape:   number | null
  conclusion:   string
  run_at:       string
}

export interface BenchmarkRunRequest {
  dataset_id:   string
  date_column:  string
  target_column: string
  freq:         string
  horizon:      number
  test_periods?: number
  models?:      string[]
}

// ── Chat Conversations (chat history) ──────────────────────────────────────

export interface ChatConversation {
  id:         string
  title:      string
  model_id:   string | null
  created_at: string
  updated_at: string
}

export interface ChatConversationDetail extends ChatConversation {
  messages: ChatMessage[]
}
